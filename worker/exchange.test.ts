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

type Counts = {
  takes: number
  players: number
  runs: number
  clears: number
  bestFear: number | null
  rating: number | null
  raters: number
}

type Listing = {
  id: string
  name: string
  payload: string
  by: string
  note?: string
  mine?: boolean
  stats: Counts
  /** What earlier versions of this build earned, when there is anything. */
  before?: Omit<Counts, 'players'>
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
    expect(body).not.toContain(curator.id)
  })

  /**
   * The same check, over the fields added since it was written.
   *
   * `mine` and `before` are both answers computed from rows this table owns,
   * and the shape token is stored per person per version. None of that may
   * carry an identity out. A new column near this table is the exact place
   * somebody adds one without noticing.
   */
  it('says nothing about who, through any of the newer fields', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    /* Published with a shape, so the run below lands on it rather than being
       treated as a run against a version that is not current. */
    const made = await post(
      '/api/builds',
      { payload: 'Zpackedbuild', name: 'Watched', shape: 'aaa' },
      { cookie: author.cookie },
    )
    const id = (await made.json<{ id: string }>()).id
    await curate(id, 'a pick')
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 12, shape: 'aaa' }, { cookie: player.cookie })
    await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { origin: ORIGIN, cookie: author.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ payload: 'Zother', name: 'Watched', shape: 'bbb' }),
    })

    const body = await (await get('/api/exchange', author.cookie)).text()
    expect(body).not.toContain(player.id)
    expect(body).not.toContain(author.id)
    // The listing does say `before`, which is the point of the republish above:
    // this asserts it says so without saying whose.
    expect(body).toContain('"before"')
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

/**
 * The author acting on their own build, which nothing checked.
 *
 * `take`, `played` and `rate` each read the row to prove it exists and none
 * compared its owner to the caller, so publishing a build and then taking,
 * playing and rating it moved its own public numbers. The owner found the first
 * half of that by taking copies of their own build, then copies of those.
 *
 * Every assertion below was watched failing before the checks went in.
 */
describe('your own build', () => {
  it('cannot be taken, because it is already yours', async () => {
    const me = await someone('Author')
    const id = await publish(me.cookie, 'Mine')

    const refused = await post(`/api/exchange/${id}/take`, {}, { cookie: me.cookie })
    expect(refused.status).toBe(409)
    expect((await refused.json<{ error: string }>()).error).toMatch(/yours/i)
  })

  it('does not count the author\'s own take', async () => {
    const me = await someone('Author')
    const other = await someone('Reader')
    const id = await publish(me.cookie, 'Mine')
    await pick(drizzle(env.DB, { schema }), id, 'a note')

    await post(`/api/exchange/${id}/take`, {}, { cookie: me.cookie })
    const afterMine = (await shelf('/api/exchange'))[0]
    expect(afterMine?.stats.takes).toBe(0)

    // And a stranger's take does count, so this is a check rather than a break.
    await post(`/api/exchange/${id}/take`, {}, { cookie: other.cookie })
    expect((await shelf('/api/exchange'))[0]?.stats.takes).toBe(1)
  })

  it('does not count the author\'s own runs', async () => {
    const me = await someone('Author')
    const id = await publish(me.cookie, 'Mine')
    await pick(drizzle(env.DB, { schema }), id, 'a note')

    // Answers ok rather than refusing: the run happened, and the player did
    // nothing wrong. It simply does not move a number a stranger reads.
    const ran = await post(
      `/api/exchange/${id}/played`,
      { cleared: true, fear: 30 },
      { cookie: me.cookie },
    )
    expect(ran.status).toBe(200)

    const row = (await shelf('/api/exchange'))[0]
    expect(row?.stats.runs).toBe(0)
    expect(row?.stats.clears).toBe(0)
    expect(row?.stats.bestFear).toBeNull()
  })

  it('cannot be rated by its author', async () => {
    const me = await someone('Author')
    const id = await publish(me.cookie, 'Mine')

    const refused = await post(`/api/exchange/${id}/rate`, { rating: 5 }, { cookie: me.cookie })
    expect(refused.status).toBe(409)
    expect((await refused.json<{ error: string }>()).error).toMatch(/your own/i)
  })

  it('is marked as yours on the shelf, without saying whose', async () => {
    const me = await someone('Author')
    const other = await someone('Reader')
    const id = await publish(me.cookie, 'Mine')
    await pick(drizzle(env.DB, { schema }), id, 'a note')

    const asAuthor = (await shelf('/api/exchange', me.cookie))[0]
    expect(asAuthor?.mine).toBe(true)

    const asReader = (await shelf('/api/exchange', other.cookie))[0]
    expect(asReader?.mine).toBe(false)

    // Signed out there is nobody for it to be true of, and it is simply absent.
    const asStranger = (await shelf('/api/exchange'))[0]
    expect(asStranger?.mine).toBeUndefined()

    // And the id it was compared against never leaves the worker.
    const raw = await (await get('/api/exchange', me.cookie)).text()
    expect(raw).not.toContain(me.id)
    expect(raw).not.toContain(other.id)
  })
})

/**
 * Replacing a listing rather than minting a second one.
 *
 * `publish` only ever inserted, so the same build published twice became two
 * listings under two ids, and two docblocks claimed the opposite the whole
 * time. Following makes this load bearing: a follower reads the author's
 * current version, so the author needs a way to change it that does not orphan
 * everybody on the old id.
 */
describe('republishing', () => {
  it('replaces in place and counts that it happened', async () => {
    const me = await someone('Author')
    const id = await publish(me.cookie, 'First name')

    const again = await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: me.cookie },
      body: JSON.stringify({ payload: 'Zsecondpayload', name: 'Second name' }),
    })
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ id, revision: 1 })

    // One listing, not two, and the reader gets the new content.
    const mine = await (await get('/api/builds', me.cookie)).json<{ builds: unknown[] }>()
    expect(mine.builds).toHaveLength(1)

    const read = await (await get(`/api/b/${id}`)).json<{ payload: string; name: string; revision: number }>()
    expect(read.payload).toBe('Zsecondpayload')
    expect(read.name).toBe('Second name')
    expect(read.revision).toBe(1)
  })

  it('refuses somebody else\'s build the way delete does', async () => {
    const me = await someone('Author')
    const other = await someone('Stranger')
    const id = await publish(me.cookie, 'Mine')

    const nope = await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: other.cookie },
      body: JSON.stringify({ payload: 'Ztheirs', name: 'Theirs now' }),
    })
    expect(nope.status).toBe(404)

    // Untouched.
    const read = await (await get(`/api/b/${id}`)).json<{ payload: string }>()
    expect(read.payload).toBe('Zpackedbuild')
  })

  it('applies the same size and name rules as publishing', async () => {
    const me = await someone('Author')
    const id = await publish(me.cookie, 'Mine')

    const put = (body: unknown) =>
      SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: me.cookie },
        body: JSON.stringify(body),
      })

    expect((await put({ payload: '', name: 'x' })).status).toBe(400)
    expect((await put({ payload: 'Z', name: '' })).status).toBe(400)
    expect((await put({ payload: 'Z'.repeat(17_000), name: 'x' })).status).toBe(413)
  })
})

/**
 * Taking a build down, and what it must not destroy.
 *
 * A delete cascaded through `exchange_stat` and `curated_pick`, so one press of
 * a button threw away every run and rating anybody had logged against the build
 * and the curator's note as well. It also emptied the build out of the library
 * of everybody following it, because their client reads it back from the same
 * route. The owner's call was that none of that should happen.
 *
 * What is left is that the build leaves the shelves and the link keeps
 * answering. These assertions are the record of that decision.
 */
describe('taking a build down', () => {
  const takeDown = (id: string, cookie: string) =>
    SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie },
    })

  it('takes it off the picked shelf', async () => {
    const { cookie } = await someone()
    const id = await publish(cookie, 'On the shelf')
    await curate(id, 'worth a look')
    expect((await shelf('/api/exchange')).map((one) => one.id)).toContain(id)

    await takeDown(id, cookie)

    expect((await shelf('/api/exchange')).map((one) => one.id)).not.toContain(id)
  })

  it('takes it off the friends shelf', async () => {
    const mine = await someone('Author')
    const friend = await someone('Friend')
    const code = await (await get('/api/friends/code', mine.cookie)).json<{ code: string }>()
    await post('/api/friends/redeem', { code: code.code }, { cookie: friend.cookie })
    const id = await publish(mine.cookie, 'Among friends')
    expect((await shelf('/api/exchange/friends', friend.cookie)).map((o) => o.id)).toContain(id)

    await takeDown(id, mine.cookie)

    expect((await shelf('/api/exchange/friends', friend.cookie)).map((o) => o.id)).not.toContain(id)
  })

  /**
   * The whole point. Every one of these rows is somebody else's work, and the
   * cascades used to take all of it.
   */
  it('keeps every run, every rating and the curator\u2019s note', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Played and rated')
    await curate(id, 'the one I hand new players')
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 20 }, { cookie: player.cookie })
    await post(`/api/exchange/${id}/rate`, { rating: 5 }, { cookie: player.cookie })

    await takeDown(id, author.cookie)

    const stats = await env.DB.prepare('select count(*) as n from exchange_stat where build_id = ?')
      .bind(id)
      .first<{ n: number }>()
    const note = await env.DB.prepare('select count(*) as n from curated_pick where build_id = ?')
      .bind(id)
      .first<{ n: number }>()
    expect(stats?.n).toBe(1)
    expect(note?.n).toBe(1)
  })

  it('comes back on the shelf when it is put back', async () => {
    const { cookie } = await someone()
    const id = await publish(cookie, 'Back on it')
    await curate(id, 'still worth a look')
    await takeDown(id, cookie)

    await SELF.fetch(`${ORIGIN}/api/builds/${id}/restore`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie },
    })

    expect((await shelf('/api/exchange')).map((one) => one.id)).toContain(id)
  })

  it('cannot be taken by somebody who did not already have it', async () => {
    const author = await someone('Author')
    const stranger = await someone('Stranger')
    const id = await publish(author.cookie, 'Not any more')
    await takeDown(id, author.cookie)

    const attempt = await post(`/api/exchange/${id}/take`, {}, { cookie: stranger.cookie })
    expect(attempt.status).toBe(404)
  })
})

/**
 * A build that changes stops inheriting the numbers its old version earned.
 *
 * Republish had no limit on how much the payload could change, so an author
 * could swap a build entirely and keep four stars from forty people. The owner
 * asked for the counts to start again, with the old ones still visible as being
 * from before the change.
 *
 * **The server never learns what changed.** The browser hashes the picks and
 * sends the result; the server stores that token and compares two strings. The
 * last test in here is the one that pins that: nonsense in, same behaviour out.
 */
describe('counts, when the build underneath them changes', () => {
  const republish = (id: string, cookie: string, body: Record<string, unknown>) =>
    SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  const publishShaped = async (cookie: string, name: string, shape: string) => {
    const response = await post('/api/builds', { payload: 'Zpackedbuild', name, shape }, { cookie })
    expect(response.status).toBe(201)
    return (await response.json<{ id: string }>()).id
  }

  /** A run and a rating from one player, against whatever shape is current. */
  const playAndRate = async (id: string, cookie: string, shape: string) => {
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 30, shape }, { cookie })
    await post(`/api/exchange/${id}/rate`, { rating: 4 }, { cookie })
  }

  const statsOf = async (id: string) => {
    const rows = await shelf('/api/exchange')
    return rows.find((one) => one.id === id)
  }

  it('keeps them when a republish changes only the words', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publishShaped(author.cookie, 'Same picks', 'aaa111')
    await curate(id, 'unchanged')
    await playAndRate(id, player.cookie, 'aaa111')

    await republish(id, author.cookie, {
      payload: 'Zpackedbuild',
      name: 'Same picks, better name',
      shape: 'aaa111',
    })

    const listing = await statsOf(id)
    expect(listing?.stats.runs).toBe(1)
    expect(listing?.stats.rating).toBe(4)
    expect(listing?.before).toBeUndefined()
  })

  it('starts them again when the picks change, and keeps the old ones as before', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publishShaped(author.cookie, 'Changing', 'aaa111')
    await curate(id, 'changed under you')
    await playAndRate(id, player.cookie, 'aaa111')

    await republish(id, author.cookie, {
      payload: 'Zdifferentbuild',
      name: 'Changing',
      shape: 'bbb222',
    })

    const listing = await statsOf(id)
    expect(listing?.stats.runs).toBe(0)
    expect(listing?.stats.rating).toBeNull()
    // Not thrown away. Somebody reading the listing can still see that an
    // earlier version of it was played and rated.
    expect(listing?.before?.runs).toBe(1)
    expect(listing?.before?.rating).toBe(4)
  })

  it('does not count a run logged against the version before', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publishShaped(author.cookie, 'Moved on', 'aaa111')
    await curate(id, 'moved on')
    await republish(id, author.cookie, { payload: 'Znew', name: 'Moved on', shape: 'bbb222' })

    // A follower who has not taken the update yet, playing what they hold.
    const late = await post(
      `/api/exchange/${id}/played`,
      { cleared: true, fear: 40, shape: 'aaa111' },
      { cookie: player.cookie },
    )
    expect(late.status).toBe(200)

    const listing = await statsOf(id)
    expect(listing?.stats.runs).toBe(0)
  })

  it('takes them back when an author republishes the picks they had before', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publishShaped(author.cookie, 'There and back', 'aaa111')
    await curate(id, 'there and back')
    await playAndRate(id, player.cookie, 'aaa111')
    await republish(id, author.cookie, { payload: 'Zother', name: 'There and back', shape: 'bbb222' })
    expect((await statsOf(id))?.stats.runs).toBe(0)

    await republish(id, author.cookie, {
      payload: 'Zpackedbuild',
      name: 'There and back',
      shape: 'aaa111',
    })

    // Nothing was moved or copied to make this happen: the row was always
    // filed under the shape it was played against, and that shape is current
    // again.
    expect((await statsOf(id))?.stats.runs).toBe(1)
  })

  /**
   * The invariant, stated as a test.
   *
   * If this ever fails, somebody has taught the server to care what a build is.
   */
  it('treats the token as opaque, whatever it is', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publishShaped(author.cookie, 'Not a build', 'not-a-fingerprint')
    await curate(id, 'nonsense')
    await playAndRate(id, player.cookie, 'not-a-fingerprint')

    expect((await statsOf(id))?.stats.runs).toBe(1)

    await republish(id, author.cookie, { payload: 'Zx', name: 'Not a build', shape: 'banana' })
    expect((await statsOf(id))?.stats.runs).toBe(0)
    expect((await statsOf(id))?.before?.runs).toBe(1)
  })
})

/**
 * A listing that never declared a version, which is most of them.
 *
 * `publishBuild` in `src/state/publish.ts` did not send `shape` while
 * `republishBuild` did, so every listing published and never replaced is stored
 * with an empty token. The player's browser then sends its real fingerprint,
 * the two do not match, and `played` files the run under "you are holding
 * something else" and drops it. Takes still counted, which is what made it look
 * like the exchange worked.
 *
 * The client half is fixed. This is the other half: a stored token that was
 * never set cannot be a stale one, so a run against it counts.
 */
describe('a listing published before it could state its shape', () => {
  const statsOf = async (id: string) => {
    const rows = await shelf('/api/exchange')
    return rows.find((one) => one.id === id)
  }

  it('counts a run sent by a client that does state one', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    /* No shape, which is exactly what every publish did until now. */
    const id = await publish(author.cookie, 'Published empty')
    await curate(id, 'from before')

    await post(
      `/api/exchange/${id}/played`,
      { cleared: true, fear: 30, shape: 'a-real-fingerprint' },
      { cookie: player.cookie },
    )

    expect((await statsOf(id))?.stats.runs).toBe(1)
    expect((await statsOf(id))?.stats.clears).toBe(1)
    expect((await statsOf(id))?.stats.bestFear).toBe(30)
  })

  /* Rating needs a run against the version being rated, and the run above was
     filed under the empty token, so this is the same bug one step further on:
     it refused people who had played. */
  it('lets somebody who has played it rate it', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Rate me')
    await curate(id, 'from before')

    await post(
      `/api/exchange/${id}/played`,
      { cleared: true, fear: 10, shape: 'a-real-fingerprint' },
      { cookie: player.cookie },
    )
    const rated = await post(`/api/exchange/${id}/rate`, { rating: 4 }, { cookie: player.cookie })

    expect(rated.status).toBe(200)
    expect((await statsOf(id))?.stats.raters).toBe(1)
  })
})

/**
 * The two shelves your own builds were missing from.
 *
 * The exchange had Picked and From friends. `picked` starts from `curated_pick`
 * so it shows only what the curator chose, and `fromFriends` cannot return your
 * own by construction. So an account's own listings were on no shelf at all: the
 * owner published nine builds, had picked one, and saw one. Live, reachable by
 * link, invisible in the app that made them.
 */
describe('all, and your own', () => {
  const takeDown = (id: string, cookie: string) =>
    SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie },
    })

  it('shows everything published to a stranger, picked or not', async () => {
    const author = await someone('Author')
    const unpicked = await publish(author.cookie, 'Nobody picked me')

    const rows = await shelf('/api/exchange/all')

    expect(rows.map((one) => one.id)).toContain(unpicked)
    /* And it really is the shelf that was empty before, not a renamed one. */
    expect(await shelf('/api/exchange')).toEqual([])
  })

  it('is public, while your own listings are not', async () => {
    expect((await get('/api/exchange/all')).status).toBe(200)
    expect((await get('/api/exchange/mine')).status).toBe(401)
  })

  it('gives you back every build you published', async () => {
    const author = await someone('Author')
    const ids = [
      await publish(author.cookie, 'One'),
      await publish(author.cookie, 'Two'),
      await publish(author.cookie, 'Three'),
    ]

    const rows = await shelf('/api/exchange/mine', author.cookie)

    expect(rows.map((one) => one.id).sort()).toEqual([...ids].sort())
    expect(rows.every((one) => one.mine === true)).toBe(true)
  })

  it('shows nobody else’s on your own shelf', async () => {
    const author = await someone('Author')
    const stranger = await someone('Stranger')
    await publish(stranger.cookie, 'Not yours')
    const yours = await publish(author.cookie, 'Yours')

    expect((await shelf('/api/exchange/mine', author.cookie)).map((one) => one.id)).toEqual([yours])
  })

  /**
   * The one that makes this an inventory rather than a shelf.
   *
   * Every other query filters taken-down rows out. This one must not, because a
   * listing its author cannot see is one they cannot put back, and a listing
   * whose local build is gone can be reached from nowhere else in the app.
   */
  it('keeps a taken-down listing on your own shelf, and off all the others', async () => {
    const author = await someone('Author')
    const id = await publish(author.cookie, 'Withdrawn')
    await curate(id, 'was picked')
    expect(await takeDown(id, author.cookie)).toMatchObject({ status: 200 })

    const own = await shelf('/api/exchange/mine', author.cookie)
    expect(own.map((one) => one.id)).toEqual([id])
    expect(own[0]?.takenDown).toBe(true)

    expect((await shelf('/api/exchange/all')).map((one) => one.id)).not.toContain(id)
    expect((await shelf('/api/exchange')).map((one) => one.id)).not.toContain(id)
  })

  /* `takenDown` is absent rather than false elsewhere, so the field means "this
     shelf tracks it" and a screen cannot read a live listing as a withdrawn one
     by looking at a shelf that never answers the question. */
  it('says nothing about takedowns on the shelves that filter them', async () => {
    const author = await someone('Author')
    const id = await publish(author.cookie, 'Up and about')
    await curate(id, 'picked')

    expect((await shelf('/api/exchange'))[0]?.takenDown).toBeUndefined()
    const all = await shelf('/api/exchange/all')
    expect(all.find((one) => one.id === id)?.takenDown).toBeUndefined()
  })

  /* The same boundary the picked shelf has. A shelf of everybody is exactly
     where an id would be most tempting to include. */
  it('never says whose builds they are', async () => {
    const author = await someone('Author')
    await publish(author.cookie, 'Anybody')

    const body = await (await get('/api/exchange/all')).text()
    expect(body).not.toContain(author.id)
    expect(body).toContain('Author')
  })
})

/**
 * Following is a fact about the listing, not about one version of it.
 *
 * Found on the live site. A listing had exactly one thing recorded against it,
 * a follow, filed under the empty shape every listing carried before publishing
 * sent one. Its author republished, the shape became a real hash, and the follow
 * fell into `before`, so the card said **"Nothing logged since the author
 * changed this build"** about a build nobody had knowingly changed.
 *
 * The narrower bug is that a take was ever in `before` at all. `foldBefore`
 * already said takes fold honestly across versions, and the reason is that
 * somebody following a listing goes on following it when the author replaces
 * the picks. That is the whole difference between following and copying. So a
 * take belongs to the listing, is counted once, and is never evidence that
 * anything was superseded.
 */
describe('a follow outlives the version it was made against', () => {
  const republish = (id: string, cookie: string, body: Record<string, unknown>) =>
    SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  const statsOf = async (id: string) => {
    const rows = await shelf('/api/exchange')
    return rows.find((one) => one.id === id)
  }

  it('keeps counting after the author replaces the picks', async () => {
    const author = await someone('Author')
    const reader = await someone('Reader')
    const id = await publish(author.cookie, 'Replaced')
    await curate(id, 'a pick')
    await post(`/api/exchange/${id}/take`, {}, { cookie: reader.cookie })

    expect((await statsOf(id))?.stats.takes).toBe(1)

    await republish(id, author.cookie, { payload: 'Znew', name: 'Replaced', shape: 'brandnew' })

    const after = await statsOf(id)
    expect(after?.stats.takes).toBe(1)
    /* And it is not also reported as something the build used to have, which
       would be the same follower counted twice on one card. */
    expect(after?.before?.takes).toBeUndefined()
  })

  /**
   * The live case exactly: one follow under the empty shape, a real shape now.
   *
   * Nothing was ever played, so there is nothing to say was earned before a
   * change, and the card must not claim there was one.
   */
  it('does not read a follow as evidence the build changed', async () => {
    const author = await someone('Author')
    const reader = await someone('Reader')
    const id = await publish(author.cookie, 'Never really changed')
    await curate(id, 'a pick')
    await post(`/api/exchange/${id}/take`, {}, { cookie: reader.cookie })
    await republish(id, author.cookie, { payload: 'Zp', name: 'Never really changed', shape: '750c7d' })

    const after = await statsOf(id)
    expect(after?.stats.takes).toBe(1)
    expect(after?.before).toBeUndefined()
  })

  /* Runs are the other way round and must stay that way: they are evidence
     about the picks they were run against, so replacing the picks resets them
     and the old ones are still shown, marked as from before. */
  it('still resets the runs, and still shows what they were', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Played then changed')
    await curate(id, 'a pick')
    await post(`/api/exchange/${id}/take`, {}, { cookie: player.cookie })
    await post(
      `/api/exchange/${id}/played`,
      { cleared: true, fear: 30, shape: 'a-real-fingerprint' },
      { cookie: player.cookie },
    )
    expect((await statsOf(id))?.stats.clears).toBe(1)

    await republish(id, author.cookie, { payload: 'Znew', name: 'Played then changed', shape: 'later' })

    const after = await statsOf(id)
    expect(after?.stats.clears).toBe(0)
    expect(after?.before?.clears).toBe(1)
    expect(after?.before?.bestFear).toBe(30)
    /* The follower is still following, so the take stays current. */
    expect(after?.stats.takes).toBe(1)
  })
})
