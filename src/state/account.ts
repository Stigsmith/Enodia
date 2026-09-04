/**
 * The account, from the browser's side. Phase 4, Stage 3.
 *
 * `worker/` is the other half. Everything here is a same-origin `fetch` under
 * `/api/`, which is why `assets/_headers` still says `connect-src 'self'` with
 * nothing added to it.
 *
 * ## The gate, and where it sits
 *
 * **Viewing is free. Creating is free. Saving locally is free. An account is
 * only needed to publish.** Nothing in the tool proper asks who you are, and
 * `DESIGN.md` 1 stays true of every screen somebody actually plays with: no
 * network call at runtime, all state in `localStorage`.
 *
 * The account earns itself at one measured moment. A build shared as a link
 * carries the whole build inside the link, which is why sharing works with no
 * server, and which makes that link **1,588 characters**. Discord renders that
 * as a wall, Reddit mangles it, and it will not fit in a QR code. Publishing
 * turns it into about thirty. That is the entire pitch, and it arrives when
 * somebody has a build worth sending rather than before they have anything.
 */

/**
 * **The switch. `false` until password reset exists.**
 *
 * There is no mail provider, so `worker/auth.ts` sends no email, so there is no
 * verification and no way to reset a forgotten password. Everything below is
 * built and tested, and the Account room stays a Dora room until this is true.
 *
 * Turning it on before then means the first stranger who forgets a password is
 * locked out permanently, with nobody able to help them. That is not a bug that
 * shows up in testing; it shows up in a week, in someone else's inbox that does
 * not exist.
 *
 * Two ways to earn the flip, and the second is probably better:
 *
 * - a mail provider, and `sendResetPassword` wired into `worker/auth.ts`
 * - **Discord**, as a social provider. No password, so nothing to reset, no
 *   email to send, and it is where this audience already is
 *
 * ## This is a UI gate, and only a UI gate
 *
 * Being precise, because the difference matters: `/api/auth/*` is deployed and
 * reachable whatever this says. Somebody who reads the JavaScript and posts to
 * the endpoint by hand can still make an account, and would then hit the same
 * missing reset.
 *
 * That is accepted rather than overlooked. The endpoints are rate limited, none
 * of them are linked from anywhere, and a person willing to curl their way into
 * an account is not the person who gets stranded by a missing reset. Closing the
 * server side too would also lock the owner out of testing their own deployment.
 * **If that trade stops looking right, the place to close it is `worker/auth.ts`,
 * not here.**
 */
export const ACCOUNTS_LIVE = false

export type Account = {
  id: string
  email: string
  name: string
}

/** What the UI needs back: either it worked, or a line to put in front of somebody. */
export type Outcome = { ok: true } | { ok: false; say: string }

const JSON_HEADERS = { 'content-type': 'application/json' }

/**
 * better-auth answers with `{ message, code }` and a real status. The codes are
 * stable and the messages are not written for a player, so the ones worth
 * rewording are rewritten here and the rest fall back to the server's line.
 */
const SAID: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match an account.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'There is already an account on that email.',
  PASSWORD_TOO_SHORT: 'That password is too short. Eight characters at least.',
  INVALID_EMAIL: 'That does not look like an email address.',
}

async function readError(response: Response): Promise<string> {
  // 429 is the rate limiter in `worker/auth.ts`, and it is the one refusal a
  // person is most likely to hit honestly, by mistyping a password a few times.
  if (response.status === 429) {
    return 'Too many attempts. Wait a few minutes and try again.'
  }
  try {
    const body = (await response.json()) as { message?: string; code?: string }
    const known = body.code ? SAID[body.code] : undefined
    return known ?? body.message ?? 'That did not work.'
  } catch {
    return 'That did not work.'
  }
}

/**
 * Who is signed in, or nobody.
 *
 * Returns null rather than throwing on a 401, because signed out is the normal
 * case and not an error. A network failure also returns null: the tool works
 * signed out, so an unreachable API should look exactly like being signed out
 * rather than putting an error in front of somebody who was not asking.
 */
export async function currentAccount(): Promise<Account | null> {
  try {
    const response = await fetch('/api/me')
    if (!response.ok) return null
    const body = (await response.json()) as { user?: Account }
    return body.user ?? null
  } catch {
    return null
  }
}

async function post(path: string, body: unknown): Promise<Outcome> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
    if (!response.ok) return { ok: false, say: await readError(response) }
    return { ok: true }
  } catch {
    return { ok: false, say: 'Could not reach the server. Your builds are untouched.' }
  }
}

/**
 * What this deployment can do, which is not a constant.
 *
 * Password reset needs a mail provider, and whether one is configured is a
 * server fact the browser cannot guess. Asking means the UI can grey the link
 * out and say why, rather than showing somebody a "check your email" screen for
 * a letter that was never written.
 */
export async function capabilities(): Promise<{ passwordReset: boolean }> {
  try {
    const response = await fetch('/api/capabilities')
    if (!response.ok) return { passwordReset: false }
    return (await response.json()) as { passwordReset: boolean }
  } catch {
    return { passwordReset: false }
  }
}

/** Ask for a reset letter. Always reports success, and deliberately. */
export async function requestReset(email: string): Promise<Outcome> {
  const outcome = await post('/api/auth/request-password-reset', {
    email,
    redirectTo: `${window.location.origin}/#reset`,
  })
  /**
   * A wrong address is not told apart from a right one, except for the rate
   * limiter's 429. Reporting "no account on that email" turns this endpoint
   * into a way to ask whether a given person has an account here, which is not
   * a question a stranger should be able to put to it.
   */
  if (!outcome.ok && !outcome.say.startsWith('Too many')) return { ok: true }
  return outcome
}

/**
 * Somebody arriving from the letter, and what the URL looks like when they do.
 *
 * The link in the letter points at the API, not at the app:
 * `/api/auth/reset-password/<token>?callbackURL=<here>`. better-auth checks the
 * token exists and has not expired, **without consuming it**, and then bounces
 * the browser to that callback with the answer on the end. It uses
 * `URL.searchParams.set`, so it always lands as a query parameter and any
 * fragment survives: `requestReset` asks for `/#reset` and a real arrival is
 * `https://enodia.me/?token=...#reset`.
 *
 * Two possible answers and both have to be handled. A dead link is the more
 * likely one, because the letter sits in an inbox for a day and the token lasts
 * an hour, and somebody who clicks a dead link and sees nothing at all will
 * assume the tool is broken rather than that they were slow.
 */
export type ResetArrival = { token: string } | { expired: true }

export function resetInUrl(search: string): ResetArrival | null {
  const params = new URLSearchParams(search)
  const token = params.get('token')
  if (token) return { token }
  // better-auth sends INVALID_TOKEN for both expired and already used, and it
  // is right to: telling them apart would say whether a token ever existed.
  if (params.get('error')) return { expired: true }
  return null
}

/**
 * Set the new password, which is the half that was missing.
 *
 * The token is spent here rather than on the link, so a mail scanner following
 * the link in the letter cannot burn it before the person reads it. That is
 * better-auth's design and it is the right one: several mail providers fetch
 * every URL in a message to check it for malware.
 */
export const completeReset = (token: string, newPassword: string): Promise<Outcome> =>
  post('/api/auth/reset-password', { token, newPassword })

export const signUp = (name: string, email: string, password: string): Promise<Outcome> =>
  post('/api/auth/sign-up/email', { name, email, password })

export const signIn = (email: string, password: string): Promise<Outcome> =>
  post('/api/auth/sign-in/email', { email, password })

/** An empty object, not an empty body: the endpoint requires JSON and refuses otherwise. */
export const signOut = (): Promise<Outcome> => post('/api/auth/sign-out', {})
