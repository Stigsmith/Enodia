/**
 * The exchange, run inside workerd against a real D1.
 *
 * Two things are worth the trouble here and the rest follows from them.
 *
 * **The counts have to be arithmetic somebody can check.** They are the only
 * evidence the exchange offers, the tool has promised not to turn them into a
 * score, and a sum that is quietly wrong is worse than no number at all: it
 * reads exactly like a right one. So these drive real rows through the real
 * aggregation rather than asserting on a mock.
 *
 * **Nobody may see whose runs they are.** `exchange_stat` holds a user id so the
 * counts can be arithmetic, and that id must never come back out. A test that
 * only checks the totals would pass just as well on an endpoint that leaked it.
 */

import { SELF, env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { beforeEach, describe, expect, it } from 'vitest'

import { pick } from './exchange.ts'
import * as schema from './schema.ts'

const ORIGIN = 'https://enodia.me'
const PASSWORD = 'a-long-enough-password-here'

let seq = 0

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

const get = (path: string, cookie?: string) =>
  SELF.fetch(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} })

async function someone(name = 'Player') {
  const email = `x${Date.now()}-${seq++}@example.invalid`
  const response = await post(
    '/api/auth/sign-up/email',
    { name, email, password: PASSWORD },
    { 'cf-connecting-ip': `203.0.113.${180 + (seq % 60)}` },
  )
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?')
    .bind(email)
    .first<{ id: string }>()
  return { cookie, id: row?.id ?? '', name }
}

/** Publish one, the way the app does, and hand back its short id. */
async function publish(cookie: string, name = 'Killer Current') {
  const response = await post('/api/builds', { payload: 'Zpackedbuild', name }, { cookie })
  expect(response.status).toBe(201)
  return (await response.json<{ id: string }>()).id
}

const shelf = async (path: string, cookie?: string) =>
  (await (await get(path, cookie)).json<{ builds: Listing[] }>()).builds

type Listing = {
  id: string
  name: string
  payload: string
  by: string
  note?: string
  stats: {
    takes: number
    players: number
    runs: number
    clears: number
    bestFear: number | null
    rating: number | null
    raters: number
  }
}

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
  await env.DB.prepare('delete from curated_pick').run()
})

describe('the shelves', () => {
  /**
   * The picked shelf is the one a stranger can see, because every build on it
   * was chosen by hand. Nothing else about the exchange is reachable signed out.
   */
  it('shows the picked shelf to a stranger and nothing else', async () => {
    expect((await get('/api/exchange')).status).toBe(200)
    expect((await get('/api/exchange/friends')).status).toBe(401)
    expect((await post('/api/exchange/anything/take', {})).status).toBe(401)
  })

  it('is empty until somebody picks something', async () => {
    expect(await shelf('/api/exchange')).toEqual([])
  })

  /**
   * **Only the curator curates.** A signed-in stranger gets 404 rather than 403,
   * so the route does not confirm it exists to somebody who cannot use it.
   */
  it('refuses to curate for anybody but the curator', async () => {
    const stranger = await someone()
    const id = await publish(stranger.cookie)

    const refused = await post(`/api/exchange/${id}/pick`, { note: 'mine now' }, { cookie: stranger.cookie })
    expect(refused.status).toBe(404)
    expect(await shelf('/api/exchange')).toEqual([])
  })

  /**
   * **Nobody curates when no curator is configured**, which is the state every
   * deployment that is not this one is in. The refusal above passes for the same
   * reason, so this pins the reason rather than the symptom.
   *
   * `vitest.worker.config.ts` sets this binding explicitly. It used to be read
   * from `.dev.vars`, which is gitignored and which gets a real account id in it
   * the moment somebody wants to try curating in a browser: this test then
   * failed on a machine and passed on every other, which is the worst way for a
   * test to be wrong.
   */
  it('lets nobody curate when no curator is set', async () => {
    expect(env.CURATOR_USER_ID ?? '').toBe('')
  })

  /**
   * And the writing half works, tested through `pick` rather than the route,
   * because the route's guard is about who is calling and this is about what
   * happens once they are through it.
   */
  it('puts a build on the shelf and takes it off again', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie, 'Picked one')
    const db = drizzle(env.DB, { schema })

    expect(await pick(db, id, 'worth your evening')).toEqual({ ok: true })
    expect((await shelf('/api/exchange'))[0]?.note).toBe('worth your evening')

    // Re-picking replaces the note rather than failing or duplicating.
    await pick(db, id, 'still worth it')
    expect((await shelf('/api/exchange'))[0]?.note).toBe('still worth it')

    expect(await pick(db, id, null)).toEqual({ ok: true })
    expect(await shelf('/api/exchange')).toEqual([])
  })

  it('refuses a pick with no reason, and one for a build that is not there', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    const db = drizzle(env.DB, { schema })

    // A pick is an opinion with a byline. An unsigned one is not a pick.
    expect(await pick(db, id, '   ')).toMatchObject({ status: 400 })
    expect(await pick(db, 'nosuchbuild', 'lovely')).toMatchObject({ status: 404 })
  })

  it('shows a picked build with the note and the byline', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie, 'Killer Current')
    await curate(id, 'the one I hand new players')

    const [only] = await shelf('/api/exchange')
    expect(only?.name).toBe('Killer Current')
    expect(only?.note).toBe('the one I hand new players')
    expect(only?.by).toBe('Stig')
    // The payload travels packed and unread, so the browser can filter on it.
    expect(only?.payload).toBe('Zpackedbuild')
  })

  /** Friends is the same membership rule the friends list already has. */
  it('shows a friend’s builds and not a stranger’s', async () => {
    const me = await someone()
    const friend = await someone('Pal')
    const stranger = await someone('Nobody')

    await publish(friend.cookie, 'From a friend')
    await publish(stranger.cookie, 'From a stranger')

    // Not friends yet, so nothing.
    expect(await shelf('/api/exchange/friends', me.cookie)).toEqual([])

    const code = await (await get('/api/friends/code', friend.cookie)).json<{ code: string }>()
    await post('/api/friends/redeem', { code: code.code }, { cookie: me.cookie })

    const names = (await shelf('/api/exchange/friends', me.cookie)).map((one) => one.name)
    expect(names).toEqual(['From a friend'])
  })
})

describe('the counts, which are the only evidence there is', () => {
  it('counts a take once, however many times it is taken', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const taker = await someone()
    expect((await post(`/api/exchange/${id}/take`, {}, { cookie: taker.cookie })).status).toBe(200)
    await post(`/api/exchange/${id}/take`, {}, { cookie: taker.cookie })

    const [only] = await shelf('/api/exchange')
    expect(only?.stats.takes).toBe(1)
  })

  it('counts two people as two takes', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    for (const _ of [1, 2]) {
      const taker = await someone()
      await post(`/api/exchange/${id}/take`, {}, { cookie: taker.cookie })
    }

    expect((await shelf('/api/exchange'))[0]?.stats.takes).toBe(2)
  })

  /**
   * Runs sum across people, clears sum separately, and the number of people is
   * its own figure. "61 runs by 12 people" needs all three and none of them is
   * derivable from the others.
   */
  it('sums runs and clears across people, and counts the people', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const one = await someone()
    const two = await someone()
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 10 }, { cookie: one.cookie })
    await post(`/api/exchange/${id}/played`, { cleared: false }, { cookie: one.cookie })
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 24 }, { cookie: two.cookie })

    const stats = (await shelf('/api/exchange'))[0]?.stats
    expect(stats?.runs).toBe(3)
    expect(stats?.clears).toBe(2)
    expect(stats?.players).toBe(2)
  })

  /**
   * Fear rises only on a clear, matching `LogRun.tsx`. Dying at Fear 30 is not
   * clearing Fear 30, and counting it as one would inflate somebody's history.
   */
  it('raises Fear only on a clear, and keeps the best', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const player = await someone()
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 20 }, { cookie: player.cookie })
    // A death at a higher Fear must not raise it.
    await post(`/api/exchange/${id}/played`, { cleared: false, fear: 40 }, { cookie: player.cookie })
    expect((await shelf('/api/exchange'))[0]?.stats.bestFear).toBe(20)

    // A worse clear must not lower it either.
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 5 }, { cookie: player.cookie })
    expect((await shelf('/api/exchange'))[0]?.stats.bestFear).toBe(20)

    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 33 }, { cookie: player.cookie })
    expect((await shelf('/api/exchange'))[0]?.stats.bestFear).toBe(33)
  })

  it('says nothing at all about a build nobody has touched', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const stats = (await shelf('/api/exchange'))[0]?.stats
    expect(stats).toEqual({
      takes: 0,
      players: 0,
      runs: 0,
      clears: 0,
      bestFear: null,
      rating: null,
      raters: 0,
    })
  })

  /**
   * **The one that would be invisible if it broke.**
   *
   * The user id in `exchange_stat` exists so the counts can be arithmetic. It is
   * never anybody's business who logged what, and an endpoint that leaked it
   * would still return correct totals.
   */
  it('never says whose runs they are', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const player = await someone()
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 12 }, { cookie: player.cookie })
    await post(`/api/exchange/${id}/rate`, { rating: 4 }, { cookie: player.cookie })

    const body = await (await get('/api/exchange')).text()
    expect(body).not.toContain(player.id)
  })
})

describe('rating', () => {
  /** The gate is the whole anti-abuse story: an opinion needs a run behind it. */
  it('refuses a rating from somebody who has not played it', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const nosy = await someone()
    const refused = await post(`/api/exchange/${id}/rate`, { rating: 5 }, { cookie: nosy.cookie })
    expect(refused.status).toBe(409)
    expect((await shelf('/api/exchange'))[0]?.stats.rating).toBeNull()
  })

  it('takes a rating once a run is logged, and averages with the count beside it', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const one = await someone()
    const two = await someone()
    for (const who of [one, two]) {
      await post(`/api/exchange/${id}/played`, { cleared: true, fear: 10 }, { cookie: who.cookie })
    }
    await post(`/api/exchange/${id}/rate`, { rating: 5 }, { cookie: one.cookie })
    await post(`/api/exchange/${id}/rate`, { rating: 4 }, { cookie: two.cookie })

    const stats = (await shelf('/api/exchange'))[0]?.stats
    expect(stats?.rating).toBe(4.5)
    // Never an average without the count: two is a different thing from two hundred.
    expect(stats?.raters).toBe(2)
  })

  it('replaces a rating rather than adding another', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const player = await someone()
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 10 }, { cookie: player.cookie })
    await post(`/api/exchange/${id}/rate`, { rating: 1 }, { cookie: player.cookie })
    await post(`/api/exchange/${id}/rate`, { rating: 5 }, { cookie: player.cookie })

    const stats = (await shelf('/api/exchange'))[0]?.stats
    expect(stats?.rating).toBe(5)
    expect(stats?.raters).toBe(1)
  })

  it('refuses a rating outside one to five', async () => {
    const curator = await someone('Stig')
    const id = await publish(curator.cookie)
    await curate(id, 'a pick')

    const player = await someone()
    await post(`/api/exchange/${id}/played`, { cleared: true }, { cookie: player.cookie })
    for (const rating of [0, 6, 2.5, 'five']) {
      const refused = await post(`/api/exchange/${id}/rate`, { rating }, { cookie: player.cookie })
      expect(refused.status).toBe(400)
    }
  })
})

/**
 * Curate as the curator.
 *
 * `CURATOR_USER_ID` is read from the environment, and the test environment sets
 * a fixed one in `vitest.worker.config.ts`. So the curator here is whichever
 * account is written into that row, and this writes the pick directly for the
 * cases that are not about the gate itself.
 */
async function curate(buildId: string, note: string) {
  await env.DB.prepare('insert or replace into curated_pick (build_id, note, at) values (?, ?, ?)')
    .bind(buildId, note, Date.now())
    .run()
}
