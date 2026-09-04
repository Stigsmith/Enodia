/**
 * Completing a password reset, run inside workerd against a real D1.
 *
 * The request half of this flow needs a mail provider and there is none in a
 * test, so `/request-password-reset` cannot be driven from here. The completion
 * half can: better-auth reads its token out of the `verification` table, and a
 * test can write one there the same way the request would have.
 *
 * **The property being pinned is that a reset ends every other session.** That
 * is `revokeSessionsOnPasswordReset` in `worker/auth.ts`, better-auth leaves it
 * off by default, and the UI says out loud that it happens. Copy that promises
 * a security property is worth exactly as much as the test underneath it.
 *
 * Both tests were run with that option removed and failed.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const ORIGIN = 'https://enodia.me'
const PASSWORD = 'the-first-password-here'
const NEXT = 'a-completely-different-one'

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

let seq = 0

/** A signed-in account, and a live session cookie for it. */
async function someone() {
  const email = `r${Date.now()}-${seq++}@example.invalid`
  const response = await post(
    '/api/auth/sign-up/email',
    { name: 'Resetter', email, password: PASSWORD },
    { 'cf-connecting-ip': `203.0.113.${100 + (seq % 100)}` },
  )
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const row = await env.DB.prepare('select id from user where email = ?')
    .bind(email)
    .first<{ id: string }>()
  return { email, cookie, id: row?.id ?? '' }
}

/**
 * The row `/request-password-reset` would have written, written directly.
 *
 * The identifier shape is better-auth's, `reset-password:<token>`, read off the
 * production database rather than guessed. If a version bump changes it these
 * tests fail, which is the point: the flow would be broken too.
 */
async function mintToken(userId: string, token: string, expiresInMs = 3_600_000) {
  await env.DB.prepare(
    'insert into verification (id, identifier, value, expires_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      `v-${token}`,
      `reset-password:${token}`,
      userId,
      Date.now() + expiresInMs,
      Date.now(),
      Date.now(),
    )
    .run()
}

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
})

describe('completing a reset', () => {
  it('changes the password, and the new one is the one that works', async () => {
    const who = await someone()
    await mintToken(who.id, `tok${seq}a`)

    const reset = await post('/api/auth/reset-password', {
      token: `tok${seq}a`,
      newPassword: NEXT,
    })
    expect(reset.status).toBe(200)

    const withNew = await post('/api/auth/sign-in/email', { email: who.email, password: NEXT })
    expect(withNew.status).toBe(200)

    const withOld = await post('/api/auth/sign-in/email', {
      email: who.email,
      password: PASSWORD,
    })
    expect(withOld.status).not.toBe(200)
  })

  /**
   * **The one that matters.**
   *
   * People reset a password because they think somebody else has it. A reset
   * that leaves the other person signed in for another week has not reset
   * anything, and the confirmation screen says every other session is gone.
   */
  it('signs every existing session out', async () => {
    const who = await someone()

    // The session is live before the reset.
    const before = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie: who.cookie } })
    expect(before.status).toBe(200)

    await mintToken(who.id, `tok${seq}b`)
    const reset = await post('/api/auth/reset-password', {
      token: `tok${seq}b`,
      newPassword: NEXT,
    })
    expect(reset.status).toBe(200)

    // And dead after it.
    const after = await SELF.fetch(`${ORIGIN}/api/me`, { headers: { cookie: who.cookie } })
    expect(after.status).toBe(401)
  })

  /** A token is spent on use, so a stolen letter is worth nothing twice. */
  it('refuses the same token a second time', async () => {
    const who = await someone()
    await mintToken(who.id, `tok${seq}c`)

    expect((await post('/api/auth/reset-password', { token: `tok${seq}c`, newPassword: NEXT })).status).toBe(200)
    expect(
      (await post('/api/auth/reset-password', { token: `tok${seq}c`, newPassword: 'yet-another-one-here' }))
        .status,
    ).not.toBe(200)
  })

  /** An expired token is refused, which is what makes the hour mean anything. */
  it('refuses a token that has run out', async () => {
    const who = await someone()
    await mintToken(who.id, `tok${seq}d`, -1000)

    const reset = await post('/api/auth/reset-password', {
      token: `tok${seq}d`,
      newPassword: NEXT,
    })
    expect(reset.status).not.toBe(200)

    // And the old password still works, so a dead link changes nothing.
    const withOld = await post('/api/auth/sign-in/email', {
      email: who.email,
      password: PASSWORD,
    })
    expect(withOld.status).toBe(200)
  })
})
