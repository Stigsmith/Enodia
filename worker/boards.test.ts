/**
 * The leaderboards, run inside workerd against a real D1.
 *
 * Two things are worth the trouble and the rest follows from them.
 *
 * **A board is a ranking, and this codebase has promised not to rank builds by
 * quality.** What keeps that promise is that every board orders by one counted
 * column and none combines two, so these drive real takes, runs and clears
 * through the real routes and check the resulting order rather than asserting
 * on a fixture. A board that silently ranked by something else would still look
 * like a list of builds.
 *
 * **A board names people, which no other endpoint does.** The counts have
 * always been anonymous: `exchange_stat.user_id` is the player and never leaves.
 * The person boards group by the author instead, which is a different id and one
 * that already travels as `Listing.by`. The test that matters here is the one
 * that pins that distinction, because an endpoint that leaked the player would
 * still return correct totals.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

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
  const email = `b${Date.now()}-${seq++}@example.invalid`
  const response = await post(
    '/api/auth/sign-up/email',
    { name, email, password: PASSWORD },
    { 'cf-connecting-ip': `203.0.113.${120 + (seq % 60)}` },
  )
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?')
    .bind(email)
    .first<{ id: string }>()
  return { cookie, id: row?.id ?? '', name }
}

/** Publish with a shape, because a run only counts against a declared version. */
async function publish(cookie: string, name: string, shape = 'aaa') {
  const response = await post('/api/builds', { payload: 'Zpacked', name, shape }, { cookie })
  expect(response.status).toBe(201)
  return (await response.json<{ id: string }>()).id
}

type Board = {
  id: string
  title: string
  unit: string
  kind: 'build' | 'person'
  rows: { id?: string; name: string; by?: string; count: number }[]
}

const boards = async (scope = 'global', cookie?: string) =>
  (await (await get(`/api/exchange/boards?scope=${scope}`, cookie)).json<{ boards: Board[] }>())
    .boards

const board = async (id: string, scope = 'global', cookie?: string) =>
  (await boards(scope, cookie)).find((one) => one.id === id)

/** Swap codes, both directions at once, the way the app does. */
async function befriend(a: { cookie: string }, b: { cookie: string }) {
  const { code } = (await (await get('/api/friends/code', a.cookie)).json()) as { code: string }
  const done = await post('/api/friends/redeem', { code }, { cookie: b.cookie })
  expect(done.status).toBe(201)
}

beforeEach(async () => {
  for (const table of [
    'exchange_stat',
    'curated_pick',
    'published_build',
    'friendship',
    'friend_code',
    'api_rate_limit',
    'build_facet',
  ]) {
    await env.DB.prepare(`delete from ${table}`).run()
  }
})

describe('what a board can be reached by', () => {
  it('answers a stranger for the global boards', async () => {
    expect((await get('/api/exchange/boards')).status).toBe(200)
    expect((await get('/api/exchange/boards?scope=global')).status).toBe(200)
  })

  /* Not an empty board: a stranger has no friends to scope to, rather than
     zero of them, and answering 200 with nothing would say the second. */
  it('refuses the friends boards to a stranger', async () => {
    expect((await get('/api/exchange/boards?scope=friends')).status).toBe(401)
  })

  it('reads anything it does not understand as global', async () => {
    expect((await get('/api/exchange/boards?scope=banana')).status).toBe(200)
  })
})

describe('the boards themselves', () => {
  it('draws nothing at all when nothing has happened', async () => {
    expect(await boards()).toEqual([])
  })

  /**
   * **A zero is not a placing.** A build nobody has followed has not come tenth
   * in a following contest, and a board padded with zeroes to fill its rows
   * would read as a ranking of things that were ranked.
   */
  it('leaves out a listing nothing has happened to', async () => {
    const author = await someone('Author')
    await publish(author.cookie, 'Untouched')

    expect(await board('followed')).toBeUndefined()
    expect(await board('cleared')).toBeUndefined()
  })

  it('ranks builds by how many people followed them', async () => {
    const author = await someone('Author')
    const one = await someone('One')
    const two = await someone('Two')
    const popular = await publish(author.cookie, 'Popular')
    const quiet = await publish(author.cookie, 'Quiet')

    await post(`/api/exchange/${popular}/take`, {}, { cookie: one.cookie })
    await post(`/api/exchange/${popular}/take`, {}, { cookie: two.cookie })
    await post(`/api/exchange/${quiet}/take`, {}, { cookie: one.cookie })

    const found = await board('followed')
    expect(found?.rows.map((row) => [row.name, row.count])).toEqual([
      ['Popular', 2],
      ['Quiet', 1],
    ])
    expect(found?.rows[0]?.by).toBe('Author')
    expect(found?.rows[0]?.id).toBe(popular)
  })

  it('ranks builds by clears, and counts runs separately', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Worked on it')

    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 20, shape: 'aaa' }, { cookie: player.cookie })
    await post(`/api/exchange/${id}/played`, { cleared: false, fear: null, shape: 'aaa' }, { cookie: player.cookie })

    expect((await board('cleared'))?.rows[0]?.count).toBe(1)
    expect((await board('played'))?.rows[0]?.count).toBe(2)
  })

  /* Fear rises on a clear and not on a death, which `played` already enforces.
     The board inherits it, and this is the check that it does. */
  it('ranks by the highest Fear anybody actually cleared', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Hard one')

    await post(`/api/exchange/${id}/played`, { cleared: false, fear: 60, shape: 'aaa' }, { cookie: player.cookie })
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 25, shape: 'aaa' }, { cookie: player.cookie })

    expect((await board('fear'))?.rows[0]?.count).toBe(25)
  })

  /**
   * The counts a board shows must be the counts the listing shows.
   *
   * `withStats` puts the current version's tally in `stats` and folds the rest
   * into `before`, so a board summing every version would print a number the
   * card it links to does not have.
   */
  it('counts the version that is current, not every version there has been', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Moved on', 'aaa')

    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 30, shape: 'aaa' }, { cookie: player.cookie })
    expect((await board('cleared'))?.rows[0]?.count).toBe(1)

    await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { origin: ORIGIN, cookie: author.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ payload: 'Zother', name: 'Moved on', shape: 'bbb' }),
    })

    expect(await board('cleared')).toBeUndefined()
  })

  it('leaves a taken-down listing off every board', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Withdrawn')
    await post(`/api/exchange/${id}/take`, {}, { cookie: player.cookie })
    expect((await board('followed'))?.rows).toHaveLength(1)

    await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie: author.cookie },
    })

    expect(await board('followed')).toBeUndefined()
  })
})

describe('the boards about people', () => {
  it('counts what each person has published', async () => {
    const busy = await someone('Busy')
    const quiet = await someone('Quiet')
    await publish(busy.cookie, 'One')
    await publish(busy.cookie, 'Two')
    await publish(quiet.cookie, 'Only')

    const found = await board('contributions')
    expect(found?.kind).toBe('person')
    expect(found?.rows.map((row) => [row.name, row.count])).toEqual([
      ['Busy', 2],
      ['Quiet', 1],
    ])
  })

  it('adds up the follows across everything one person published', async () => {
    const author = await someone('Author')
    const one = await someone('One')
    const two = await someone('Two')
    const a = await publish(author.cookie, 'A')
    const b = await publish(author.cookie, 'B')

    await post(`/api/exchange/${a}/take`, {}, { cookie: one.cookie })
    await post(`/api/exchange/${a}/take`, {}, { cookie: two.cookie })
    await post(`/api/exchange/${b}/take`, {}, { cookie: one.cookie })

    expect((await board('pfollowed'))?.rows).toEqual([{ name: 'Author', count: 3 }])
  })

  /**
   * **The boundary, and the one that would be invisible if it broke.**
   *
   * `exchange_stat.user_id` is the player and has never left this backend. A
   * person board groups by the author instead, and returns a display name that
   * already travels on every listing. An endpoint that got that wrong would
   * still print the right totals.
   */
  it('names people without ever sending an id', async () => {
    const author = await someone('Author')
    const player = await someone('Player')
    const id = await publish(author.cookie, 'Watched')
    await post(`/api/exchange/${id}/take`, {}, { cookie: player.cookie })
    await post(`/api/exchange/${id}/played`, { cleared: true, fear: 12, shape: 'aaa' }, { cookie: player.cookie })

    const body = await (await get('/api/exchange/boards')).text()
    expect(body).toContain('Author')
    expect(body).not.toContain(author.id)
    expect(body).not.toContain(player.id)
    /* And the player is not named at all: they did not publish anything, so
       they belong on no person board. */
    expect(body).not.toContain('Player')
  })
})

describe('scoping the boards to your friends', () => {
  it('leaves out somebody whose code you never swapped', async () => {
    const me = await someone('Me')
    const stranger = await someone('Stranger')
    const reader = await someone('Reader')
    const mine = await publish(me.cookie, 'Mine')
    const theirs = await publish(stranger.cookie, 'Theirs')
    await post(`/api/exchange/${mine}/take`, {}, { cookie: reader.cookie })
    await post(`/api/exchange/${theirs}/take`, {}, { cookie: reader.cookie })

    expect((await board('followed', 'global'))?.rows).toHaveLength(2)

    const scoped = await board('followed', 'friends', me.cookie)
    expect(scoped?.rows.map((row) => row.name)).toEqual(['Mine'])
  })

  it('takes in somebody once you have swapped codes', async () => {
    const me = await someone('Me')
    const friend = await someone('Friend')
    const reader = await someone('Reader')
    await befriend(me, friend)
    const theirs = await publish(friend.cookie, 'Theirs')
    await post(`/api/exchange/${theirs}/take`, {}, { cookie: reader.cookie })

    expect((await board('followed', 'friends', me.cookie))?.rows.map((row) => row.name)).toEqual([
      'Theirs',
    ])
  })

  /**
   * **You are on your own board.** A board of your circle that leaves you off
   * it cannot answer the question somebody opens it to ask, which is where they
   * stand among the people they know.
   */
  it('includes you, even with no friends at all', async () => {
    const me = await someone('Me')
    const reader = await someone('Reader')
    const mine = await publish(me.cookie, 'Mine')
    await post(`/api/exchange/${mine}/take`, {}, { cookie: reader.cookie })

    expect((await board('followed', 'friends', me.cookie))?.rows.map((row) => row.name)).toEqual([
      'Mine',
    ])
  })
})

/**
 * The content boards, and the tokens they are built from.
 *
 * `worker/publish.ts` refuses to parse a payload, so nothing here knows what an
 * arm is. The browser derives a handful of strings and sends them, this stores
 * them and groups by them, and `src/state/facets.ts` turns one back into a
 * label. Every assertion below is about the server keeping its half of that:
 * storing what it was given, counting it, and never having an opinion about it.
 */
describe('what people build', () => {
  const publishWith = async (cookie: string, name: string, facets: string[]) => {
    const response = await post('/api/builds', { payload: 'Zp', name, shape: 'aaa', facets }, { cookie })
    expect(response.status).toBe(201)
    return (await response.json<{ id: string }>()).id
  }

  it('counts how many builds carry each token', async () => {
    const author = await someone('Author')
    await publishWith(author.cookie, 'One', ['arm:staff', 'god:Zeus'])
    await publishWith(author.cookie, 'Two', ['arm:staff', 'god:Hera'])
    await publishWith(author.cookie, 'Three', ['arm:blades', 'god:Zeus'])

    const arms = await board('arm')
    expect(arms?.kind).toBe('facet')
    expect(arms?.rows).toEqual([
      { name: 'arm:staff', count: 2 },
      { name: 'arm:blades', count: 1 },
    ])
    expect((await board('god'))?.rows[0]).toEqual({ name: 'god:Zeus', count: 2 })
  })

  /**
   * The invariant, stated as a test.
   *
   * If this fails, somebody has taught the server to care what a build is made
   * of. It stores the string it was handed and hands it back.
   */
  it('treats a token as opaque, whatever it is', async () => {
    const author = await someone('Author')
    await publishWith(author.cookie, 'Nonsense', ['arm:not-a-real-arm', 'banana:split'])

    expect((await board('arm'))?.rows).toEqual([{ name: 'arm:not-a-real-arm', count: 1 }])
    /* `banana` matches no board, so it is stored, counted and never asked for.
       That is the correct amount of interest for this server to take. */
    expect(await board('banana')).toBeUndefined()
  })

  it('replaces the whole set when a build is republished', async () => {
    const author = await someone('Author')
    const id = await publishWith(author.cookie, 'Changed', ['arm:staff', 'god:Zeus'])

    await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'PUT',
      headers: { origin: ORIGIN, cookie: author.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ payload: 'Zp2', name: 'Changed', shape: 'bbb', facets: ['arm:blades'] }),
    })

    expect((await board('arm'))?.rows).toEqual([{ name: 'arm:blades', count: 1 }])
    expect(await board('god')).toBeUndefined()
  })

  it('drops a taken-down listing from the content boards too', async () => {
    const author = await someone('Author')
    const id = await publishWith(author.cookie, 'Withdrawn', ['arm:staff'])
    expect((await board('arm'))?.rows).toHaveLength(1)

    await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie: author.cookie },
    })

    expect(await board('arm')).toBeUndefined()
  })

  it('scopes them to your friends like every other board', async () => {
    const me = await someone('Me')
    const stranger = await someone('Stranger')
    await publishWith(me.cookie, 'Mine', ['arm:staff'])
    await publishWith(stranger.cookie, 'Theirs', ['arm:blades'])

    expect((await board('arm', 'global'))?.rows).toHaveLength(2)
    expect((await board('arm', 'friends', me.cookie))?.rows).toEqual([
      { name: 'arm:staff', count: 1 },
    ])
  })

  /* A publish with no facets is the ordinary case for every listing that
     existed before this table did, and it must not fail or count. */
  it('is fine with a build that sends none', async () => {
    const author = await someone('Author')
    await publish(author.cookie, 'No facets')
    expect(await board('arm')).toBeUndefined()
  })

  /**
   * Both bounds, because a column that takes any string is somewhere to put a
   * payload. Over-length is dropped rather than refused, as the shape is: this
   * is a hint for a board, not a thing worth failing a publish over.
   */
  it('drops a token that is too long, and keeps the rest', async () => {
    const author = await someone('Author')
    await publishWith(author.cookie, 'Too much', ['arm:staff', `arm:${'x'.repeat(200)}`])

    expect((await board('arm'))?.rows).toEqual([{ name: 'arm:staff', count: 1 }])
  })

  it('stops at forty tokens', async () => {
    const author = await someone('Author')
    const many = Array.from({ length: 60 }, (_, at) => `god:g${at}`)
    await publishWith(author.cookie, 'Greedy', many)

    const rows = await env.DB.prepare('select count(*) as n from build_facet').first<{ n: number }>()
    expect(rows?.n).toBe(40)
  })
})
