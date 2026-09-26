/**
 * The two headers every API answer carries, whoever wrote the answer.
 *
 * **`assets/_headers` does not reach any of this.** Cloudflare applies that
 * file to static assets only, so for as long as the API existed every `/api/*`
 * response went out with no `x-content-type-options` and no cache instruction,
 * `/api/me` with a name and an email included. Measured under `wrangler dev` on
 * 26 September 2026: a static path answered with both headers, and
 * `/api/capabilities`, `/api/me` and a sign-up answered with neither.
 *
 * So the routes are listed by who built the response, because that is where it
 * could go missing: ours through `json`, better-auth's through its own handler,
 * and the fallthrough 404.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const ORIGIN = 'https://enodia.me'

/** Only the two this is about, so a failure shows both at once. */
const hardening = (response: Response) => ({
  nosniff: response.headers.get('x-content-type-options'),
  cache: response.headers.get('cache-control'),
})

const HARDENED = { nosniff: 'nosniff', cache: 'no-store' }

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
})

describe('every API answer', () => {
  it('is hardened on a public route of ours', async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/capabilities`)
    expect(response.status).toBe(200)
    expect(hardening(response)).toEqual(HARDENED)
  })

  it('is hardened on a refusal and on the route that answers nothing', async () => {
    const refused = await SELF.fetch(`${ORIGIN}/api/me`)
    expect(refused.status).toBe(401)
    expect(hardening(refused)).toEqual(HARDENED)

    const missing = await SELF.fetch(`${ORIGIN}/api/no-such-thing`)
    expect(missing.status).toBe(404)
    expect(hardening(missing)).toEqual(HARDENED)
  })

  /**
   * Sign up is better-auth's response, not ours, and it carries the session
   * cookie. The wrapper copies it into a new `Response`, so the cookie is read
   * back and used: a copy that dropped `set-cookie` would pass on headers alone
   * and sign nobody in. The `/api/me` it unlocks is the answer that holds a
   * name and an email, which is the one `no-store` is for.
   */
  it('is hardened on better-auth, and keeps its session cookie working', async () => {
    const signUp = await SELF.fetch(`${ORIGIN}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        'cf-connecting-ip': '203.0.113.77',
      },
      body: JSON.stringify({
        name: 'Headers',
        email: `h${Date.now()}@example.invalid`,
        password: 'a-long-enough-password-here',
      }),
    })
    expect(signUp.status).toBe(200)
    expect(hardening(signUp)).toEqual(HARDENED)

    const cookie = (signUp.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    expect(cookie).toContain('session_token')

    const me = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie } })
    expect(me.status).toBe(200)
    expect(((await me.json()) as { user: { name: string } }).user.name).toBe('Headers')
    expect(hardening(me)).toEqual(HARDENED)
  })
})
