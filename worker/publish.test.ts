/**
 * Publishing, run inside workerd against a real D1.
 *
 * The interesting assertions here are the refusals. Publishing working is the
 * easy half; what protects the deployment is that a stranger cannot read your
 * list, delete your build, or use the endpoint as free storage.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

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

/** A signed-in cookie, and the account's id, for a brand new account. */
async function someone(ip = '203.0.113.9') {
  const email = `p${Date.now()}-${seq++}@example.invalid`
  const response = await post(
    '/api/auth/sign-up/email',
    { name: 'Publisher', email, password: PASSWORD },
    from(ip),
  )
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?').bind(email).first<{ id: string }>()
  return { cookie, id: row?.id ?? '' }
}

const publish = (cookie: string, name = 'Every Pair', payload = 'Zpackedbuildpayload') =>
  post('/api/builds', { payload, name }, { cookie })

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
})

describe('the gate', () => {
  it('refuses publishing while signed out', async () => {
    const response = await post('/api/builds', { payload: 'Zx', name: 'Nope' })
    expect(response.status).toBe(401)
  })

  it('refuses listing while signed out', async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/builds`)
    expect(response.status).toBe(401)
  })
})

describe('what a published build costs to store', () => {
  it('refuses a request with no build in it', async () => {
    const { cookie } = await someone()
    expect((await post('/api/builds', { name: 'No payload' }, { cookie })).status).toBe(400)
  })

  it('refuses one with no name', async () => {
    const { cookie } = await someone()
    expect((await post('/api/builds', { payload: 'Zx' }, { cookie })).status).toBe(400)
  })

  /**
   * A real packed build is about 1,600 characters. The cap is 16 KB, ten times
   * the largest honest one, and it is the difference between a feature and free
   * object storage for anybody who finds the endpoint.
   */
  it('refuses a payload past 16 KB', async () => {
    const { cookie } = await someone()
    const response = await post('/api/builds', { payload: 'Z'.repeat(20_000), name: 'Too big' }, { cookie })
    expect(response.status).toBe(413)
  })

  /**
   * The only thing bounding total storage per account. better-auth's rate
   * limiter covers `/api/auth/*` and nothing else, so it caps how many accounts
   * can exist but not what one of them can write.
   */
  it('refuses the hundred and first', async () => {
    const { cookie, id } = await someone()

    const values = Array.from({ length: 100 }, (_, at) => `('cap${String(at).padStart(6, '0')}','${id}','Zx','Seeded')`)
    await env.DB.prepare(`insert into published_build (id,user_id,payload,name) values ${values.join(',')}`).run()

    const response = await publish(cookie, 'One too many')
    expect(response.status).toBe(409)
    expect(await response.text()).toContain('limit')
  })
})

describe('the short link', () => {
  it('publishes, and hands back an id short enough to be the point', async () => {
    const { cookie } = await someone()
    const response = await publish(cookie)
    expect(response.status).toBe(201)

    const { id } = (await response.json()) as { id: string }
    // Ten characters, which is what makes enodia.me/b/<id> about thirty against
    // a 1,588 character share link. If this grows, the feature stops paying.
    expect(id).toHaveLength(10)
    // No 0, O, 1, l or I: these get read aloud and typed by hand.
    expect(id).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/)
  })

  it('is readable by a stranger with no cookie at all', async () => {
    const { cookie } = await someone()
    const { id } = (await (await publish(cookie, 'Shared One', 'Zthepayload')).json()) as { id: string }

    // The whole reason publishing exists. If this ever needs a session, the
    // link is useless for the thing it was made for.
    const anon = await SELF.fetch(`${ORIGIN}/api/b/${id}`)
    expect(anon.status).toBe(200)
    // The revision travels so a follower can tell whether what it cached is
    // still current without diffing a kilobyte of payload. Zero until the
    // author replaces it.
    expect(await anon.json()).toEqual({
      payload: 'Zthepayload',
      name: 'Shared One',
      revision: 0,
      // Whether the author has taken it off the shelves. False here, and the
      // only reason a reader needs it is to say so rather than to be refused.
      takenDown: false,
    })
  })

  it('answers 404 for an id that was never issued', async () => {
    expect((await SELF.fetch(`${ORIGIN}/api/b/doesnotexis`)).status).toBe(404)
  })
})

describe('whose build it is', () => {
  it('lists only your own', async () => {
    const mine = await someone('203.0.113.11')
    const theirs = await someone('203.0.113.12')
    await publish(mine.cookie, 'Mine')
    await publish(theirs.cookie, 'Theirs')

    const response = await SELF.fetch(`${ORIGIN}/api/builds`, { headers: { cookie: mine.cookie } })
    const listed = (await response.json()) as { builds: { name: string }[] }
    expect(listed.builds.map((one) => one.name)).toEqual(['Mine'])
  })

  it('refuses to let somebody else delete yours, and leaves it readable', async () => {
    const mine = await someone('203.0.113.13')
    const theirs = await someone('203.0.113.14')
    const { id } = (await (await publish(mine.cookie, 'Not yours')).json()) as { id: string }

    const attempt = await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie: theirs.cookie },
    })
    // 404 and not 403, deliberately: 403 would confirm the id exists on
    // somebody else's account, which is a question a stranger should not be
    // able to put to this endpoint.
    expect(attempt.status).toBe(404)

    expect((await SELF.fetch(`${ORIGIN}/api/b/${id}`)).status).toBe(200)
  })

  /**
   * **This used to assert that the link died, and that decision was reversed.**
   *
   * A delete cascades: it takes every run and rating anybody logged against the
   * build, the curator's note, and the build itself out of the library of
   * everyone following it. Too much of other people's work to destroy because
   * one person pressed a button. Taking a build down now removes it from the
   * shelves and leaves the link answering, marked.
   */
  it('lets the owner take it down, and the link keeps answering, marked', async () => {
    const { cookie } = await someone()
    const { id } = (await (await publish(cookie, 'Going away')).json()) as { id: string }

    const down = await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie },
    })
    expect(down.status).toBe(200)

    const after = await SELF.fetch(`${ORIGIN}/api/b/${id}`)
    expect(after.status).toBe(200)
    expect((await after.json() as { takenDown: boolean }).takenDown).toBe(true)
  })

  it('is not an error to take the same one down twice', async () => {
    const { cookie } = await someone()
    const { id } = (await (await publish(cookie, 'Twice')).json()) as { id: string }
    const down = () =>
      SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
        method: 'DELETE',
        headers: { origin: ORIGIN, cookie },
      })

    expect((await down()).status).toBe(200)
    // SQLite counts a matched row as changed even when the value it writes is
    // the one already there, so this stays truthful rather than 404ing.
    expect((await down()).status).toBe(200)
  })

  it('puts one back, without moving the revision', async () => {
    const { cookie } = await someone()
    const { id } = (await (await publish(cookie, 'Back again')).json()) as { id: string }

    await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie },
    })
    const back = await SELF.fetch(`${ORIGIN}/api/builds/${id}/restore`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie },
    })
    expect(back.status).toBe(200)

    const after = (await (await SELF.fetch(`${ORIGIN}/api/b/${id}`)).json()) as {
      takenDown: boolean
      revision: number
    }
    expect(after.takenDown).toBe(false)
    // Putting it back is not a change to the build, so nobody following it
    // should be told anything happened.
    expect(after.revision).toBe(0)
  })

  it('refuses to let somebody else take yours down or put it back', async () => {
    const mine = await someone('203.0.113.21')
    const theirs = await someone('203.0.113.22')
    const { id } = (await (await publish(mine.cookie, 'Still mine')).json()) as { id: string }

    const down = await SELF.fetch(`${ORIGIN}/api/builds/${id}`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie: theirs.cookie },
    })
    expect(down.status).toBe(404)

    const back = await SELF.fetch(`${ORIGIN}/api/builds/${id}/restore`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie: theirs.cookie },
    })
    expect(back.status).toBe(404)
  })

  /**
   * Worth testing rather than assuming. SQLite only enforces foreign keys when
   * told to, so a schema that declares `on delete cascade` proves nothing on
   * its own. If this ever fails, deleting an account leaves its published
   * builds readable forever by anybody holding a link.
   */
  it('takes published builds with the account when it is deleted', async () => {
    const { cookie, id: userId } = await someone()
    const { id } = (await (await publish(cookie, 'Cascade')).json()) as { id: string }

    await env.DB.prepare('delete from user where id = ?').bind(userId).run()

    expect((await SELF.fetch(`${ORIGIN}/api/b/${id}`)).status).toBe(404)
  })
})

/**
 * The cap counts what is on the shelves, not what has ever existed.
 *
 * A taken-down row stays forever by design, so counting it would turn a limit
 * on how much you publish into a permanent ceiling: fifty builds, take them all
 * down, and you can never publish again. The refusal telling you to take one
 * down would then be advice that does not work, which is worse than no advice.
 */
describe('the publish cap', () => {
  it('frees a slot when a build is taken down', async () => {
    const { cookie, id } = await someone()
    /* Seeded rather than published, the way the fifty-first test above does it:
       fifty real publishes would hit the rate limiter long before the cap. */
    const values = Array.from(
      { length: 100 },
      (_, at) => `('down${String(at).padStart(6, '0')}','${id}','Zx','Seeded')`,
    )
    await env.DB.prepare(
      `insert into published_build (id,user_id,payload,name) values ${values.join(',')}`,
    ).run()

    expect((await publish(cookie, 'One too many')).status).toBe(409)

    await SELF.fetch(`${ORIGIN}/api/builds/down000000`, {
      method: 'DELETE',
      headers: { origin: ORIGIN, cookie },
    })

    expect((await publish(cookie, 'Now there is room')).status).toBe(201)
  })
})
