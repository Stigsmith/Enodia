/**
 * The limits, run inside workerd against a real D1.
 *
 * Node cannot answer any of these. `take` is one SQLite upsert with `RETURNING`
 * and the whole question is whether that statement counts correctly, which
 * needs the real engine. Every backend bug on this project so far was invisible
 * to a type check and a green build.
 *
 * ## Why most of these seed the counter rather than spending it
 *
 * Written the obvious way, each of these fired 121 requests to get one refusal,
 * and every one of them timed out: a sequential fetch through workerd with a D1
 * write behind it is slow enough that the loop is the test's whole runtime.
 *
 * So the counter is seeded to the edge and one real request is sent over it.
 * That is the same code path, and it puts the assertion on the behaviour rather
 * than on a loop. **One test still spends a limit end to end without seeding**,
 * on the smallest one, so nothing rests on the seeding being faithful.
 *
 * Each test was run against the unwired code first and failed. The concurrency
 * one is why `take` is a single statement: with a read-then-write limiter every
 * simultaneous request reads the same count and they all pass.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import { RULES } from './limit.ts'

const ORIGIN = 'https://enodia.me'
const PASSWORD = 'a-long-enough-password-here'

const from = (ip: string) => ({ 'cf-connecting-ip': ip })

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

let seq = 0

async function someone(ip = '203.0.113.40') {
  const email = `l${Date.now()}-${seq++}@example.invalid`
  const response = await post(
    '/api/auth/sign-up/email',
    { name: 'Limited', email, password: PASSWORD },
    from(ip),
  )
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?')
    .bind(email)
    .first<{ id: string }>()
  return { cookie, id: row?.id ?? '' }
}

/** Put a counter at `count` in a window that opened just now. */
const seed = (key: string, count: number, windowStart = Date.now()) =>
  env.DB.prepare('insert or replace into api_rate_limit (key, count, window_start) values (?, ?, ?)')
    .bind(key, count, windowStart)
    .run()

/** Rows the limiter has written, so a test can assert on the counter itself. */
const counters = async () =>
  (
    await env.DB.prepare('select key, count, window_start from api_rate_limit').all<{
      key: string
      count: number
      window_start: number
    }>()
  ).results

const readOnce = (ip: string, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}/api/b/nosuchbuild`, { headers: { ...from(ip), ...headers } })

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
})

describe('the public read', () => {
  /**
   * The route with no account behind it, so this is the one an anonymous
   * stranger can spend. Keyed on the address and nothing else.
   */
  it('refuses past the limit and says how long to wait', async () => {
    await seed('read:a:198.51.100.7', RULES.read.max)

    const last = await readOnce('198.51.100.7')

    expect(last.status).toBe(429)
    const retry = Number(last.headers.get('retry-after'))
    expect(retry).toBeGreaterThan(0)
    expect(retry).toBeLessThanOrEqual(RULES.read.window)
    expect((await last.json<{ error: string }>()).error).toContain('Try again in')
  })

  /**
   * The request that lands exactly on the limit must still be served. A limiter
   * that fires one early is a broken tool, and off-by-one is how you get one.
   */
  it('serves the request that lands exactly on the limit', async () => {
    await seed('read:a:198.51.100.8', RULES.read.max - 1)

    // 404 because the id is not real. What matters is that it is not a 429.
    expect((await readOnce('198.51.100.8')).status).toBe(404)
  })

  /** One address running out must not take another one down with it. */
  it('counts each address separately', async () => {
    await seed('read:a:198.51.100.9', RULES.read.max)

    expect((await readOnce('198.51.100.9')).status).toBe(429)
    expect((await readOnce('198.51.100.10')).status).toBe(404)
  })

  /**
   * **The header a caller can forge must not be the one that counts.**
   *
   * Cloudflare appends to `x-forwarded-for` rather than replacing it, so if the
   * limiter read that header a caller could reset their own counter by changing
   * a string. The real address is fixed here and the forged one changes; the
   * limit must still fire, and the counter must be the one keyed on the real
   * address rather than a second row.
   */
  it('cannot be reset with x-forwarded-for', async () => {
    await seed('read:a:198.51.100.11', RULES.read.max)

    const first = await readOnce('198.51.100.11', { 'x-forwarded-for': '10.0.0.1' })
    const second = await readOnce('198.51.100.11', { 'x-forwarded-for': '10.0.0.2' })

    expect(first.status).toBe(429)
    expect(second.status).toBe(429)
    expect(await counters()).toHaveLength(1)
  })
})

describe('counting', () => {
  /**
   * The reason `take` is one statement.
   *
   * Fired together, so a read-then-write limiter would have every one of them
   * read the same count before any of them wrote it back, and all of them would
   * pass. The upsert has to serialise them: exactly the five left in the window
   * are served and the rest are refused.
   */
  it('holds under requests fired at once', async () => {
    const spare = 5
    await seed('read:a:198.51.100.12', RULES.read.max - spare)

    const shots = 25
    const responses = await Promise.all(
      Array.from({ length: shots }, () => readOnce('198.51.100.12')),
    )

    expect(responses.filter((one) => one.status === 404)).toHaveLength(spare)
    expect(responses.filter((one) => one.status === 429)).toHaveLength(shots - spare)

    const [row] = await counters()
    expect(row?.count).toBe(RULES.read.max - spare + shots)
  })

  /**
   * Going over must not push the reset further away, or somebody who keeps
   * hammering would never be let back in.
   */
  it('does not extend the window by hammering it', async () => {
    const opened = Date.now() - 10_000
    await seed('read:a:198.51.100.13', RULES.read.max, opened)

    await readOnce('198.51.100.13')
    await readOnce('198.51.100.13')

    const [row] = await counters()
    expect(row?.window_start).toBe(opened)
    expect(row?.count).toBe(RULES.read.max + 2)
  })

  /** A window that has closed lets the next caller straight back in. */
  it('starts a new window once the old one has passed', async () => {
    const key = 'read:a:198.51.100.14'
    await seed(key, RULES.read.max, Date.now() - (RULES.read.window + 1) * 1000)

    const response = await readOnce('198.51.100.14')

    expect(response.status).toBe(404)
    const [row] = await counters()
    expect(row?.count).toBe(1)
  })
})

describe('the signed-in routes', () => {
  /**
   * Keyed on the account and not the address, so two people behind one office
   * connection do not share a limit. Both accounts here sign in from the same
   * address and only one of them is spent.
   */
  it('counts each account separately, from one address', async () => {
    const ip = '198.51.100.20'
    const one = await someone(ip)
    const two = await someone(ip)
    await seed(`own:u:${one.id}`, RULES.own.max)

    expect((await SELF.fetch(`${ORIGIN}/api/builds`, { headers: { cookie: one.cookie } })).status).toBe(429)
    expect((await SELF.fetch(`${ORIGIN}/api/builds`, { headers: { cookie: two.cookie } })).status).toBe(200)
  })

  /**
   * Publishing has its own counter, so running the cheap one out must not touch
   * it. This is the whole reason there are two rules rather than one.
   */
  it('does not spend the publish limit on reads', async () => {
    const { cookie, id } = await someone('198.51.100.21')
    await seed(`own:u:${id}`, RULES.own.max)

    expect((await SELF.fetch(`${ORIGIN}/api/builds`, { headers: { cookie } })).status).toBe(429)

    const published = await post('/api/builds', { payload: 'Zx', name: 'Still fine' }, { cookie })
    expect(published.status).toBe(201)
  })

  /** And publishing runs out on its own schedule. */
  it('refuses publishing past its own limit', async () => {
    const { cookie, id } = await someone('198.51.100.22')
    await seed(`publish:u:${id}`, RULES.publish.max)

    const last = await post('/api/builds', { payload: 'Zx', name: 'One too many' }, { cookie })

    expect(last.status).toBe(429)
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  /**
   * **The one spent end to end, with nothing seeded.**
   *
   * Redeeming has the smallest limit, so this is the one that fits in a test's
   * runtime. It proves the counting is real rather than a fixture: nothing here
   * writes to `api_rate_limit` except the Worker itself.
   */
  it('spends a real limit through the API alone', async () => {
    const { cookie } = await someone('198.51.100.23')

    let last = new Response(null)
    for (let i = 0; i < RULES.redeem.max + 1; i++) {
      last = await post('/api/friends/redeem', { code: 'ZZZZZZZZ' }, { cookie })
      // Every one before the last is a real answer: no such code.
      if (i < RULES.redeem.max) expect(last.status).toBe(404)
    }

    expect(last.status).toBe(429)

    // The rest of friends is on the other counter and is untouched by that.
    expect((await SELF.fetch(`${ORIGIN}/api/friends/code`, { headers: { cookie } })).status).toBe(200)
  })

  /** Signed out is 401, not 429: the gate comes before the counter. */
  it('answers a signed-out caller with 401 rather than counting them', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await SELF.fetch(`${ORIGIN}/api/builds`)).status).toBe(401)
    }
    expect(await counters()).toHaveLength(0)
  })
})

describe('housekeeping', () => {
  /**
   * Rows have to be cleaned up or the table grows one per address forever.
   * Pruning runs when a window opens, and must never take a row that is still
   * counting, whatever rule that row belongs to.
   */
  it('prunes rows older than the longest window, and keeps live ones', async () => {
    const longest = Math.max(...Object.values(RULES).map((rule) => rule.window))

    await seed('read:a:stale', 5, Date.now() - (longest + 60) * 1000)
    // Older than the read window but well inside the publish one, which is the
    // row a prune keyed on the wrong window would wrongly take.
    await seed('publish:u:live', 5, Date.now() - (RULES.read.window + 60) * 1000)

    // A fresh address, so this request opens a window and triggers the prune.
    await readOnce('198.51.100.30')

    const keys = (await counters()).map((row) => row.key)
    expect(keys).not.toContain('read:a:stale')
    expect(keys).toContain('publish:u:live')
  })
})
