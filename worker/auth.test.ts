/**
 * The account endpoints, run inside workerd against a real D1.
 *
 * **These exist because every bug this backend has had was invisible to a green
 * build.** Rate limiting was off and looked on. The client IP came from a header
 * a caller can set. A generated schema was missing a `NOT NULL` column. A type
 * check passed on all three.
 *
 * So the assertions here are deliberately about behaviour at the edge of the
 * request rather than about the shape of a function: what a stranger gets back,
 * with what headers, after how many tries.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const ORIGIN = 'https://enodia.me'

/** Cloudflare sets this on every request and overwrites anything the caller sent. */
const from = (ip: string) => ({ 'cf-connecting-ip': ip })

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

/** The cookie a browser would send back, pulled out of a set-cookie. */
const cookieFrom = (response: Response): string =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

let seq = 0
const freshEmail = () => `t${Date.now()}-${seq++}@example.invalid`
const PASSWORD = 'a-long-enough-password-here'

async function signUpFresh(ip = '203.0.113.1') {
  const email = freshEmail()
  const response = await post(
    '/api/auth/sign-up/email',
    { name: 'Tester', email, password: PASSWORD },
    from(ip),
  )
  return { email, response, cookie: cookieFrom(response) }
}

beforeEach(async () => {
  // Shared database across the file, so the rate limiter's counters have to be
  // cleared or the first test's attempts bleed into the second's budget.
  await env.DB.prepare('delete from rate_limit').run()
})

describe('what the deployment admits to', () => {
  it('reports no password reset when no mail provider is configured', async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/capabilities`)
    expect(response.status).toBe(200)
    // The UI greys out "forgotten your password" on the strength of this. If it
    // ever lies, somebody is shown a flow that sends nothing.
    expect(await response.json()).toEqual({ passwordReset: false })
  })
})

describe('the session gate', () => {
  it('refuses a protected route with no session', async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/me`)
    expect(response.status).toBe(401)
  })

  it('refuses a forged cookie rather than trusting it', async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/me`, {
      headers: { cookie: 'better-auth.session_token=not.a.real.signature' },
    })
    expect(response.status).toBe(401)
  })

  it('signs up, holds the session, and lets go on sign out', async () => {
    const { cookie } = await signUpFresh()
    expect(cookie).toContain('session_token')

    const signedIn = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } })
    expect(signedIn.status).toBe(200)

    const out = await post('/api/auth/sign-out', {}, { cookie })
    expect(out.status).toBe(200)

    const after = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } })
    expect(after.status).toBe(401)
  })

  it('refuses a session whose row has expired', async () => {
    const { cookie } = await signUpFresh()
    expect((await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } })).status).toBe(200)

    // Backdated in the database rather than by waiting a week. The cookie is
    // still perfectly valid, which is the point: expiry has to be enforced
    // against the row and not against the signature.
    await env.DB.prepare('update session set expires_at = (unixepoch() - 3600) * 1000').run()

    const after = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } })
    expect(after.status).toBe(401)
  })

  it('sets the session cookie HttpOnly, Secure and SameSite=Lax', async () => {
    const { response } = await signUpFresh()
    const raw = response.headers.get('set-cookie') ?? ''
    // HttpOnly is the one that matters: it is what stops a script reading the
    // token if anything ever gets injected into the page.
    expect(raw).toMatch(/HttpOnly/i)
    expect(raw).toMatch(/Secure/i)
    expect(raw).toMatch(/SameSite=Lax/i)
  })
})

describe('refusals', () => {
  it('refuses the wrong password', async () => {
    const { email } = await signUpFresh()
    const response = await post('/api/auth/sign-in/email', { email, password: 'wrong-password-x' })
    expect(response.status).toBe(401)
  })

  it('refuses a second account on the same email', async () => {
    const { email } = await signUpFresh()
    const response = await post('/api/auth/sign-up/email', { name: 'Impostor', email, password: PASSWORD })
    expect(response.status).toBe(422)
  })

  it('refuses a request from another origin', async () => {
    const { email } = await signUpFresh()
    const response = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    expect(response.status).toBe(403)
  })
})

/**
 * The regression that matters most.
 *
 * better-auth sets `enabled: options.rateLimit?.enabled ?? isProduction`, and
 * `isProduction` is `NODE_ENV === 'production'`, which Workers never sets. So
 * the default reads as safe and does nothing here. Measured before it was
 * stated explicitly: 150 wrong-password attempts in 12 seconds, all 401, not a
 * single 429.
 *
 * If somebody deletes the `rateLimit` block from `worker/auth.ts` believing the
 * library covers it, this is what says otherwise.
 */
describe('rate limiting', () => {
  it('stops brute forcing a password after the configured 20', async () => {
    const { email } = await signUpFresh('198.51.100.10')

    const codes: number[] = []
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await post(
        '/api/auth/sign-in/email',
        { email, password: 'deliberately-wrong' },
        from('198.51.100.10'),
      )
      codes.push(response.status)
    }

    expect(codes).toContain(429)
    // Not "some 429s eventually": the limit is 20 per 300s and the first
    // rejection should land on the 21st, off by at most the one sign-up above.
    expect(codes.indexOf(429)).toBeGreaterThanOrEqual(19)
    expect(codes.indexOf(429)).toBeLessThanOrEqual(21)
  })

  /**
   * The other half, and the reason the limiter is keyed the way it is.
   *
   * better-auth defaults to `x-forwarded-for`. Cloudflare *appends* the real
   * address to that header rather than replacing it, so a caller who sends
   * their own arrives with a value of their choosing in front. If the limiter
   * read it, anybody could reset their own counter by varying a string, and
   * every limit above would be decoration.
   */
  it('cannot be reset by changing x-forwarded-for', async () => {
    const { email } = await signUpFresh('198.51.100.20')

    for (let attempt = 0; attempt < 22; attempt += 1) {
      await post(
        '/api/auth/sign-in/email',
        { email, password: 'deliberately-wrong' },
        from('198.51.100.20'),
      )
    }

    // Same real IP, a different claimed one. Still refused.
    const spoofed = await post(
      '/api/auth/sign-in/email',
      { email, password: 'deliberately-wrong' },
      { ...from('198.51.100.20'), 'x-forwarded-for': '9.9.9.9' },
    )
    expect(spoofed.status).toBe(429)
  })

  it('counts each address separately, so one attacker cannot lock everybody out', async () => {
    const { email } = await signUpFresh('198.51.100.30')

    for (let attempt = 0; attempt < 22; attempt += 1) {
      await post(
        '/api/auth/sign-in/email',
        { email, password: 'deliberately-wrong' },
        from('198.51.100.30'),
      )
    }

    // A different address, the correct password. This is the failure mode of a
    // limiter keyed on nothing: it would be shared, and one bad actor would
    // take the whole site down for everybody.
    const elsewhere = await post(
      '/api/auth/sign-in/email',
      { email, password: PASSWORD },
      from('198.51.100.31'),
    )
    expect(elsewhere.status).toBe(200)
  })
})
