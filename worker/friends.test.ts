/**
 * Friends, run inside workerd against a real D1.
 *
 * As with publishing, the assertions worth having are the refusals. A friends
 * list is the first thing in this backend where one account can see another
 * account's data at all, so what it refuses is the whole security model.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const ORIGIN = 'https://enodia.me'
const PASSWORD = 'a-long-enough-password-here'

const from = (ip: string) => ({ 'cf-connecting-ip': ip })

const send = (
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const get = (path: string, cookie: string) => SELF.fetch(`${ORIGIN}${path}`, { headers: { cookie } })

let seq = 0

/** A signed-in account, with its id and its friend code already fetched. */
async function someone(ip = '203.0.113.50') {
  const email = `f${Date.now()}-${seq++}@example.invalid`
  const signUp = await send(
    'POST',
    '/api/auth/sign-up/email',
    { name: `Player ${seq}`, email, password: PASSWORD },
    from(ip),
  )
  const cookie = (signUp.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?')
    .bind(email)
    .first<{ id: string }>()
  const { code } = (await (await get('/api/friends/code', cookie)).json()) as { code: string }
  return { cookie, id: row?.id ?? '', code }
}

const publish = (cookie: string, name: string) =>
  send('POST', '/api/builds', { payload: 'Zpackedpayload', name }, { cookie })

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
})

describe('the gate', () => {
  it('refuses every friends route while signed out', async () => {
    for (const path of ['/api/friends', '/api/friends/code', '/api/friends/feed']) {
      expect((await SELF.fetch(`${ORIGIN}${path}`)).status).toBe(401)
    }
    expect((await send('POST', '/api/friends/redeem', { code: 'whatever' })).status).toBe(401)
  })
})

describe('the code', () => {
  it('is eight characters with no confusable letters in it', async () => {
    const { code } = await someone()
    expect(code).toHaveLength(8)
    // A friend code gets read aloud and typed by hand more than a build id
    // does, so 0/O and 1/l/I matter more here, not less.
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/)
  })

  it('is stable until it is rotated, and rotating keeps the friendships', async () => {
    const me = await someone('203.0.113.51')
    const them = await someone('203.0.113.52')

    const again = (await (await get('/api/friends/code', me.cookie)).json()) as { code: string }
    expect(again.code).toBe(me.code)

    await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })

    const rotated = (await (
      await send('POST', '/api/friends/code', undefined, { cookie: me.cookie })
    ).json()) as { code: string }
    expect(rotated.code).not.toBe(me.code)

    // The friendship survives. Rotating is for a leaked code, not a purge.
    const list = (await (await get('/api/friends', me.cookie)).json()) as { friends: unknown[] }
    expect(list.friends).toHaveLength(1)

    // And the old code is dead.
    const stale = await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })
    expect(stale.status).toBe(404)
  })
})

describe('redeeming', () => {
  it('makes the friendship visible from both sides at once', async () => {
    const me = await someone('203.0.113.53')
    const them = await someone('203.0.113.54')

    const done = await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })
    expect(done.status).toBe(201)

    // Both directions, from one redemption. Sharing the code is consent from
    // one side and using it is consent from the other, which is why there is
    // no request-and-accept step.
    const mine = (await (await get('/api/friends', me.cookie)).json()) as { friends: { id: string }[] }
    const theirs = (await (await get('/api/friends', them.cookie)).json()) as {
      friends: { id: string }[]
    }
    expect(mine.friends.map((one) => one.id)).toEqual([them.id])
    expect(theirs.friends.map((one) => one.id)).toEqual([me.id])
  })

  it('refuses your own code', async () => {
    const me = await someone()
    const response = await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: me.cookie })
    expect(response.status).toBe(400)
  })

  it('refuses a code nobody has', async () => {
    const me = await someone()
    const response = await send('POST', '/api/friends/redeem', { code: 'ZZZZZZZZ' }, { cookie: me.cookie })
    expect(response.status).toBe(404)
  })

  it('is a no-op the second time rather than an error or a duplicate', async () => {
    const me = await someone('203.0.113.55')
    const them = await someone('203.0.113.56')

    await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })
    const twice = await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })
    expect(twice.status).toBe(201)

    const mine = (await (await get('/api/friends', me.cookie)).json()) as { friends: unknown[] }
    expect(mine.friends).toHaveLength(1)
  })
})

describe('what a friend can see, and what a stranger cannot', () => {
  it('shows a friend the builds you published', async () => {
    const me = await someone('203.0.113.57')
    const them = await someone('203.0.113.58')
    await publish(me.cookie, 'Every Pair')
    await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })

    const seen = (await (await get(`/api/friends/${me.id}/builds`, them.cookie)).json()) as {
      builds: { name: string }[]
    }
    expect(seen.builds.map((one) => one.name)).toEqual(['Every Pair'])
  })

  /**
   * The important one.
   *
   * A stranger asking for somebody's builds and a stranger asking for an
   * account that does not exist get the same 404. Answering differently would
   * make this a way to ask who has an account here, one id at a time.
   */
  it('refuses a stranger, and does not admit the account exists', async () => {
    const me = await someone('203.0.113.59')
    const stranger = await someone('203.0.113.60')
    await publish(me.cookie, 'Private')

    const refused = await get(`/api/friends/${me.id}/builds`, stranger.cookie)
    const invented = await get('/api/friends/doesnotexistatall/builds', stranger.cookie)

    expect(refused.status).toBe(404)
    expect(invented.status).toBe(404)
    expect(await refused.text()).toEqual(await invented.text())
  })

  it('gathers every friend into one feed and leaves strangers out of it', async () => {
    const me = await someone('203.0.113.61')
    const friend = await someone('203.0.113.62')
    const stranger = await someone('203.0.113.63')

    await publish(friend.cookie, 'From a friend')
    await publish(stranger.cookie, 'From a stranger')
    await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: friend.cookie })

    const feed = (await (await get('/api/friends/feed', me.cookie)).json()) as {
      builds: { name: string }[]
    }
    expect(feed.builds.map((one) => one.name)).toEqual(['From a friend'])
  })

  it('gives an empty feed rather than an error when you have nobody', async () => {
    const alone = await someone()
    const feed = (await (await get('/api/friends/feed', alone.cookie)).json()) as {
      builds: unknown[]
    }
    expect(feed.builds).toEqual([])
  })
})

describe('removing somebody', () => {
  it('takes both directions, so neither can still see the other', async () => {
    const me = await someone('203.0.113.64')
    const them = await someone('203.0.113.65')
    await publish(me.cookie, 'Mine')
    await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })

    const gone = await send('DELETE', `/api/friends/${them.id}`, undefined, { cookie: me.cookie })
    expect(gone.status).toBe(200)

    // Removed by me, and gone from their list too. A one-sided removal would
    // leave them still reading my builds.
    const theirs = (await (await get('/api/friends', them.cookie)).json()) as { friends: unknown[] }
    expect(theirs.friends).toEqual([])
    expect((await get(`/api/friends/${me.id}/builds`, them.cookie)).status).toBe(404)
  })

  it('answers 404 for somebody who was never on the list', async () => {
    const me = await someone('203.0.113.66')
    const them = await someone('203.0.113.67')
    const response = await send('DELETE', `/api/friends/${them.id}`, undefined, { cookie: me.cookie })
    expect(response.status).toBe(404)
  })

  /**
   * Deleting an account has to take its friendships with it, or the other side
   * keeps a row pointing at nobody and the list join drops or throws. SQLite
   * only enforces foreign keys when told to, so this is measured.
   */
  it('cleans up both sides when an account is deleted', async () => {
    const me = await someone('203.0.113.68')
    const them = await someone('203.0.113.69')
    await send('POST', '/api/friends/redeem', { code: me.code }, { cookie: them.cookie })

    await env.DB.prepare('delete from user where id = ?').bind(them.id).run()

    const mine = (await (await get('/api/friends', me.cookie)).json()) as { friends: unknown[] }
    expect(mine.friends).toEqual([])
  })
})
