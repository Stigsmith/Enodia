/**
 * Guides, run inside workerd against a real D1.
 *
 * What has to hold, in the order it would hurt somebody:
 *
 * - **A withdrawn build does not come back out of a guide.** Its author took
 *   it off the shelves, and a guide is a page strangers find.
 * - **A hidden guide is gone for everybody but its author**, and nothing in
 *   the API can hide or unhide one.
 * - **Nobody moves a count about themselves**, and nobody learns who saved,
 *   liked or reported anything.
 * - **Every route is limited**, and a report spends its own budget.
 * - A guide its author took down leaves every list and still opens by its link.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import { RULES } from './limit.ts'

const ORIGIN = 'https://enodia.me'
const PASSWORD = 'a-long-enough-password-here'

let seq = 0

const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const post = (path: string, body: unknown, cookie?: string) =>
  send('POST', path, body, cookie ? { cookie } : {})

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, { headers: { ...(cookie ? { cookie } : {}), ...headers } })

async function someone(name = 'Reader') {
  const email = `g${Date.now()}-${seq++}@example.invalid`
  const response = await post('/api/auth/sign-up/email', { name, email, password: PASSWORD }, undefined)
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?').bind(email).first<{ id: string }>()
  return { cookie, id: row?.id ?? '', name }
}

/** Publish a build the way the app does. */
async function aBuild(cookie: string, shape = 'aaa', name = 'Killer Current') {
  const response = await post('/api/builds', { payload: 'Zpackedbuild', name, shape }, cookie)
  expect(response.status).toBe(201)
  return (await response.json<{ id: string }>()).id
}

type Named =
  | { id: string; state: 'live'; name: string; payload: string; revision: number; changed: boolean }
  | { id: string; state: 'withdrawn' }
  | { id: string; state: 'gone' }

type Listing = {
  id: string
  title: string
  payload: string
  by: string
  mine?: boolean
  takenDown?: boolean
  hidden?: boolean
  saved?: boolean
  liked?: boolean
  revision: number
  stats: { saves: number; likes: number }
  builds: string[]
}

type Read = Listing & { takenDown: boolean; named: Named[] }

async function aGuide(cookie: string, builds: { id: string; shape?: string }[] = [], title = 'How to beat the RNG') {
  const response = await post('/api/guides', { title, payload: 'Zpackedguide', builds }, cookie)
  expect(response.status).toBe(201)
  return (await response.json<{ id: string }>()).id
}

const read = async (id: string, cookie?: string) => {
  const response = await get(`/api/g/${id}`, cookie)
  return { status: response.status, body: response.status === 200 ? await response.json<Read>() : null }
}

const everybody = async (cookie?: string) => (await (await get('/api/guides', cookie)).json<{ guides: Listing[] }>()).guides

const mine = async (cookie: string) =>
  (await get('/api/guides/mine', cookie)).json<{ written: Listing[]; saved: Listing[] }>()

/** What a moderator runs. Nothing in the API can do this. */
const hide = (id: string, on = true) =>
  env.DB.prepare(`update guide set hidden_at = ${on ? "cast(unixepoch('subsecond') * 1000 as integer)" : 'null'} where id = ?`)
    .bind(id)
    .run()

beforeEach(async () => {
  for (const table of [
    'rate_limit',
    'api_rate_limit',
    'guide_report',
    'guide_stat',
    'guide_build',
    'guide',
    'build_facet',
    'exchange_stat',
    'published_build',
  ]) {
    await env.DB.prepare(`delete from ${table}`).run()
  }
})

describe('who can reach what', () => {
  it('lets a stranger read and list, and nothing else', async () => {
    const author = await someone('Author')
    const id = await aGuide(author.cookie)

    expect((await get(`/api/g/${id}`)).status).toBe(200)
    expect((await get('/api/guides')).status).toBe(200)
    expect((await get('/api/guides/mine')).status).toBe(401)
    expect((await post('/api/guides', { title: 'x', payload: 'y' })).status).toBe(401)
    expect((await post(`/api/guides/${id}/save`, {})).status).toBe(401)
    expect((await post(`/api/guides/${id}/report`, {})).status).toBe(401)
  })

  it('answers a guide that does not exist with a 404', async () => {
    expect((await get('/api/g/nosuchguide')).status).toBe(404)
  })
})

describe('publishing', () => {
  it('stores the guide and the builds it names, in the order it names them', async () => {
    const author = await someone('Author')
    const one = await aBuild(author.cookie, 'aaa', 'First')
    const two = await aBuild(author.cookie, 'bbb', 'Second')
    const id = await aGuide(author.cookie, [{ id: two, shape: 'bbb' }, { id: one, shape: 'aaa' }])

    const { body } = await read(id)
    expect(body?.title).toBe('How to beat the RNG')
    expect(body?.payload).toBe('Zpackedguide')
    expect(body?.by).toBe('Author')
    expect(body?.builds).toEqual([two, one])
    expect(body?.named.map((n) => n.id)).toEqual([two, one])
    expect(body?.named.every((n) => n.state === 'live')).toBe(true)
  })

  it('names each build once, and drops what could not be a build id', async () => {
    const author = await someone()
    const build = await aBuild(author.cookie)
    const id = await aGuide(author.cookie, [
      { id: build },
      { id: build },
      { id: 'not an id!' },
      { id: 'x'.repeat(40) },
    ])
    expect((await read(id)).body?.builds).toEqual([build])
  })

  it('refuses a guide with no text, no title, or too much text', async () => {
    const author = await someone()
    expect((await post('/api/guides', { title: 'T', payload: '' }, author.cookie)).status).toBe(400)
    expect((await post('/api/guides', { title: '  ', payload: 'Z' }, author.cookie)).status).toBe(400)
    expect((await post('/api/guides', { title: 'T', payload: 'Z'.repeat(48 * 1024 + 1) }, author.cookie)).status).toBe(413)
  })

  it('stops at fifty live guides, and taking one down makes room', async () => {
    const author = await someone()
    const insert = env.DB.prepare("insert into guide (id, user_id, title, payload) values (?, ?, 'T', 'Z')")
    await env.DB.batch(Array.from({ length: 50 }, (_, n) => insert.bind(`seeded${n}`, author.id)))

    const refused = await post('/api/guides', { title: 'One more', payload: 'Z' }, author.cookie)
    expect(refused.status).toBe(409)

    expect((await send('DELETE', '/api/guides/seeded0', undefined, { cookie: author.cookie })).status).toBe(200)
    expect((await post('/api/guides', { title: 'One more', payload: 'Z' }, author.cookie)).status).toBe(201)
  })
})

describe('replacing, taking down and putting back', () => {
  it('replaces the text and the builds wholesale, and counts the revision', async () => {
    const author = await someone()
    const one = await aBuild(author.cookie)
    const two = await aBuild(author.cookie)
    const id = await aGuide(author.cookie, [{ id: one }])

    const replaced = await send(
      'PUT',
      `/api/guides/${id}`,
      { title: 'Better title', payload: 'Znewer', builds: [{ id: two }] },
      { cookie: author.cookie },
    )
    expect(replaced.status).toBe(200)
    expect((await replaced.json<{ revision: number }>()).revision).toBe(1)

    const { body } = await read(id)
    expect(body?.title).toBe('Better title')
    expect(body?.payload).toBe('Znewer')
    expect(body?.builds).toEqual([two])
  })

  it('will not let anybody else replace, take down or put back a guide', async () => {
    const author = await someone()
    const other = await someone()
    const id = await aGuide(author.cookie)
    const cookie = { cookie: other.cookie }

    expect((await send('PUT', `/api/guides/${id}`, { title: 'Mine now', payload: 'Z' }, cookie)).status).toBe(404)
    expect((await send('DELETE', `/api/guides/${id}`, undefined, cookie)).status).toBe(404)
    expect((await send('POST', `/api/guides/${id}/restore`, {}, cookie)).status).toBe(404)
    expect((await read(id)).body?.title).toBe('How to beat the RNG')
  })

  /* The build rule, applied to guides: off the lists, and the link still reads. */
  it('takes a guide off every list, and its link still reads and says so', async () => {
    const author = await someone()
    const reader = await someone()
    const id = await aGuide(author.cookie)
    await post(`/api/guides/${id}/save`, {}, reader.cookie)

    await send('DELETE', `/api/guides/${id}`, undefined, { cookie: author.cookie })

    expect(await everybody()).toEqual([])
    expect(await everybody(reader.cookie)).toEqual([])
    const { status, body } = await read(id)
    expect(status).toBe(200)
    expect(body?.takenDown).toBe(true)

    /* The author's own list and a reader's saved list keep it, marked, the way
       Mine and Followed kept a taken-down build. */
    expect((await mine(author.cookie)).written[0]).toMatchObject({ id, takenDown: true })
    expect((await mine(reader.cookie)).saved[0]).toMatchObject({ id, takenDown: true })
  })

  it('puts one back without moving its revision', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    await send('DELETE', `/api/guides/${id}`, undefined, { cookie: author.cookie })
    expect((await post(`/api/guides/${id}/restore`, {}, author.cookie)).status).toBe(200)

    const [listed] = await everybody()
    expect(listed?.id).toBe(id)
    expect(listed?.revision).toBe(0)
  })
})

describe('reading a guide with builds in it', () => {
  /** The one the whole read path exists to get right. */
  it('withholds the build its author took down, and keeps the rest', async () => {
    const author = await someone()
    const kept = await aBuild(author.cookie, 'aaa', 'Kept')
    const withdrawn = await aBuild(author.cookie, 'bbb', 'Withdrawn Build')
    const id = await aGuide(author.cookie, [{ id: kept }, { id: withdrawn }])

    await send('DELETE', `/api/builds/${withdrawn}`, undefined, { cookie: author.cookie })

    const response = await get(`/api/g/${id}`)
    const text = await response.text()
    const body = JSON.parse(text) as Read
    expect(body.named).toEqual([
      { id: kept, state: 'live', name: 'Kept', payload: 'Zpackedbuild', revision: 0, changed: false },
      { id: withdrawn, state: 'withdrawn' },
    ])
    /* Not anywhere in the response, not only not in its own entry. */
    expect(text).not.toContain('Withdrawn Build')
  })

  it('calls a build nobody published gone', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie, [{ id: 'Zz9yX8wV7u' }])
    expect((await read(id)).body?.named).toEqual([{ id: 'Zz9yX8wV7u', state: 'gone' }])
  })

  it('marks a build whose picks changed since the guide named it, and only then', async () => {
    const author = await someone()
    const moved = await aBuild(author.cookie, 'aaa', 'Moved')
    const reworded = await aBuild(author.cookie, 'ccc', 'Reworded')
    const unversioned = await aBuild(author.cookie, '', 'Old Listing')
    const id = await aGuide(author.cookie, [
      { id: moved, shape: 'aaa' },
      { id: reworded, shape: 'ccc' },
      { id: unversioned, shape: 'ddd' },
    ])

    await send('PUT', `/api/builds/${moved}`, { payload: 'Zv2', name: 'Moved', shape: 'bbb' }, { cookie: author.cookie })
    await send('PUT', `/api/builds/${reworded}`, { payload: 'Zv2', name: 'Reworded', shape: 'ccc' }, { cookie: author.cookie })

    const changed = Object.fromEntries(
      ((await read(id)).body?.named ?? []).map((n) => [n.id, n.state === 'live' ? n.changed : null]),
    )
    expect(changed).toEqual({ [moved]: true, [reworded]: false, [unversioned]: false })
  })
})

describe('moderation', () => {
  it('has no route that can hide or unhide a guide', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    for (const path of [`/api/guides/${id}/hide`, `/api/guides/${id}/unhide`, `/api/guides/${id}/moderate`]) {
      expect((await post(path, {}, author.cookie)).status).toBe(404)
    }
    await hide(id)
    expect((await post(`/api/guides/${id}/restore`, {}, author.cookie)).status).toBe(200)
    expect((await read(id)).status).toBe(404)
  })

  it('takes a hidden guide off every list and out of reach of everybody but its author', async () => {
    const author = await someone('Author')
    const reader = await someone()
    const id = await aGuide(author.cookie)
    await post(`/api/guides/${id}/save`, {}, reader.cookie)

    await hide(id)

    expect(await everybody()).toEqual([])
    expect(await everybody(reader.cookie)).toEqual([])
    expect((await mine(reader.cookie)).saved).toEqual([])
    expect((await read(id)).status).toBe(404)
    expect((await read(id, reader.cookie)).status).toBe(404)
    expect((await post(`/api/guides/${id}/save`, {}, reader.cookie)).status).toBe(404)
    expect((await post(`/api/guides/${id}/report`, {}, reader.cookie)).status).toBe(404)

    const own = await read(id, author.cookie)
    expect(own.status).toBe(200)
    expect(own.body?.hidden).toBe(true)
    expect((await mine(author.cookie)).written[0]).toMatchObject({ id, hidden: true })
  })

  it('keeps a guide hidden when its author replaces it', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    await hide(id)
    expect((await send('PUT', `/api/guides/${id}`, { title: 'Fixed', payload: 'Z' }, { cookie: author.cookie })).status).toBe(200)
    expect((await read(id)).status).toBe(404)
    await hide(id, false)
    expect((await read(id)).body?.title).toBe('Fixed')
  })

  it('stores a report once per person, and never hands it back', async () => {
    const author = await someone()
    const reader = await someone()
    const id = await aGuide(author.cookie)

    expect((await post(`/api/guides/${id}/report`, { reason: 'first thought' }, reader.cookie)).status).toBe(200)
    expect((await post(`/api/guides/${id}/report`, { reason: 'SECRETREASON' }, reader.cookie)).status).toBe(200)

    const rows = await env.DB.prepare('select reason from guide_report where guide_id = ?').bind(id).all<{ reason: string }>()
    expect(rows.results.map((r) => r.reason)).toEqual(['SECRETREASON'])

    for (const response of [await get(`/api/g/${id}`, author.cookie), await get('/api/guides'), await get('/api/guides/mine', author.cookie)]) {
      expect(await response.text()).not.toContain('SECRETREASON')
    }
  })

  it('refuses a report that is longer than a report needs to be', async () => {
    const author = await someone()
    const reader = await someone()
    const id = await aGuide(author.cookie)
    expect((await post(`/api/guides/${id}/report`, { reason: 'x'.repeat(501) }, reader.cookie)).status).toBe(400)
  })
})

describe('saves and likes', () => {
  it('counts people, not presses, and takes one back', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    const one = await someone()
    const two = await someone()

    await post(`/api/guides/${id}/save`, {}, one.cookie)
    await post(`/api/guides/${id}/save`, {}, one.cookie)
    await post(`/api/guides/${id}/save`, {}, two.cookie)
    await post(`/api/guides/${id}/like`, {}, two.cookie)

    expect((await everybody())[0]?.stats).toEqual({ saves: 2, likes: 1 })

    const back = await post(`/api/guides/${id}/save`, { on: false }, one.cookie)
    expect((await back.json<{ stats: { saves: number } }>()).stats.saves).toBe(1)
  })

  it('tells a reader what they did themselves, as two booleans', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    const reader = await someone()
    await post(`/api/guides/${id}/like`, {}, reader.cookie)

    const { body } = await read(id, reader.cookie)
    expect(body).toMatchObject({ saved: false, liked: true, mine: false })
    expect((await read(id)).body).not.toHaveProperty('liked')
  })

  /** The author cannot move a number about their own guide, and no row is written trying. */
  it('refuses the author’s own save, like and report', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)

    expect((await post(`/api/guides/${id}/save`, {}, author.cookie)).status).toBe(409)
    expect((await post(`/api/guides/${id}/like`, {}, author.cookie)).status).toBe(409)
    expect((await post(`/api/guides/${id}/report`, { reason: 'x' }, author.cookie)).status).toBe(409)

    const stats = await env.DB.prepare('select count(*) as n from guide_stat').first<{ n: number }>()
    const reports = await env.DB.prepare('select count(*) as n from guide_report').first<{ n: number }>()
    expect([stats?.n, reports?.n]).toEqual([0, 0])
    expect((await read(id)).body?.stats).toEqual({ saves: 0, likes: 0 })
  })

  it('takes no new save on a guide that is down, and lets a reader take theirs back', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    const early = await someone()
    const late = await someone()
    await post(`/api/guides/${id}/save`, {}, early.cookie)
    await send('DELETE', `/api/guides/${id}`, undefined, { cookie: author.cookie })

    expect((await post(`/api/guides/${id}/save`, {}, late.cookie)).status).toBe(404)
    expect((await post(`/api/guides/${id}/save`, { on: false }, early.cookie)).status).toBe(200)
  })
})

describe('who, which nothing says', () => {
  it('never sends a user id, from any route', async () => {
    const author = await someone('Author')
    const reader = await someone('Reader')
    const build = await aBuild(author.cookie)
    const id = await aGuide(author.cookie, [{ id: build }])
    await post(`/api/guides/${id}/save`, {}, reader.cookie)
    await post(`/api/guides/${id}/like`, {}, reader.cookie)

    const bodies = [
      await (await get(`/api/g/${id}`)).text(),
      await (await get(`/api/g/${id}`, reader.cookie)).text(),
      await (await get(`/api/g/${id}`, author.cookie)).text(),
      await (await get('/api/guides', reader.cookie)).text(),
      await (await get('/api/guides/mine', reader.cookie)).text(),
      await (await get('/api/guides/mine', author.cookie)).text(),
      await (await post(`/api/guides/${id}/save`, {}, reader.cookie)).text(),
      await (await post(`/api/guides/${id}/report`, { reason: 'why' }, reader.cookie)).text(),
    ]
    for (const body of bodies) {
      expect(body).not.toContain(author.id)
      expect(body).not.toContain(reader.id)
    }
  })
})

describe('limits', () => {
  const seed = (key: string, count: number) =>
    env.DB.prepare('insert or replace into api_rate_limit (key, count, window_start) values (?, ?, ?)')
      .bind(key, count, Date.now())
      .run()

  it('counts reading and listing on the caller’s address', async () => {
    const ip = '203.0.113.201'
    await seed(`read:a:${ip}`, RULES.read.max)
    expect((await get('/api/g/nosuchguide', undefined, { 'cf-connecting-ip': ip })).status).toBe(429)
    expect((await get('/api/guides', undefined, { 'cf-connecting-ip': ip })).status).toBe(429)
    expect((await get('/api/guides', undefined, { 'cf-connecting-ip': '203.0.113.202' })).status).toBe(200)
  })

  it('counts publishing and replacing on the account, on the same budget as builds', async () => {
    const author = await someone()
    const id = await aGuide(author.cookie)
    await seed(`publish:u:${author.id}`, RULES.publish.max)
    expect((await post('/api/guides', { title: 'T', payload: 'Z' }, author.cookie)).status).toBe(429)
    expect((await send('PUT', `/api/guides/${id}`, { title: 'T', payload: 'Z' }, { cookie: author.cookie })).status).toBe(429)
    expect((await post('/api/builds', { payload: 'Z', name: 'B' }, author.cookie)).status).toBe(429)
  })

  it('counts the rest on the account’s own budget', async () => {
    const author = await someone()
    const reader = await someone()
    const id = await aGuide(author.cookie)
    await seed(`own:u:${reader.id}`, RULES.own.max)
    expect((await get('/api/guides/mine', reader.cookie)).status).toBe(429)
    expect((await post(`/api/guides/${id}/save`, {}, reader.cookie)).status).toBe(429)
    expect((await post(`/api/guides/${id}/like`, {}, reader.cookie)).status).toBe(429)
    await seed(`own:u:${author.id}`, RULES.own.max)
    expect((await send('DELETE', `/api/guides/${id}`, undefined, { cookie: author.cookie })).status).toBe(429)
  })

  /** Its own counter both ways: a full `own` does not stop a report, and reports do not spend `own`. */
  it('counts reports on their own low budget', async () => {
    const author = await someone()
    const reader = await someone()
    const id = await aGuide(author.cookie)

    await seed(`own:u:${reader.id}`, RULES.own.max)
    expect((await post(`/api/guides/${id}/report`, {}, reader.cookie)).status).toBe(200)

    await seed(`report:u:${reader.id}`, RULES.report.max)
    expect((await post(`/api/guides/${id}/report`, {}, reader.cookie)).status).toBe(429)
    expect(RULES.report.max).toBeLessThan(RULES.own.max)
  })
})
