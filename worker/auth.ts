/**
 * Accounts. Email and password, and nothing else yet.
 *
 * `REQUIREMENTS.md` 5 deferred accounts to Phase 4 and this is that. The gate
 * is deliberately loose: **viewing is free, creating is free, saving locally is
 * free. An account is only needed to share or compete.** So none of this runs
 * for the overwhelming majority of visits, which is also why it costs nothing.
 *
 * ## Why a factory rather than a module-level instance
 *
 * A D1 binding only exists inside a request. Building the auth object at module
 * scope, which is how every framework example writes it, throws in a Worker
 * because `env` is not there yet. So this takes the database and hands back an
 * instance, and `index.ts` calls it per request.
 *
 * ## The two decisions worth knowing
 *
 * **`transaction: false`.** D1 has no interactive transactions, only batches.
 * The adapter defaults to false already, but a correctness property should not
 * rest on a default that could change: stated, with the reason.
 *
 * **Password reset exists only when mail is configured.** `worker/email.ts`
 * reports whether a provider is set, and the reset flow is added to the options
 * only when it is. The alternative, which better-auth allows, is an endpoint
 * that succeeds and sends nothing while somebody waits for a letter that was
 * never written.
 *
 * Email verification is still off, and that is a separate call: verification
 * locks somebody out of their own account until they find a letter, whereas
 * reset is the only route back in. One is tidiness, the other is the difference
 * between a forgotten password and a dead account.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { configured, resetLetter, send } from './email.ts'
import * as schema from './schema.ts'

/** A week. Long enough that logging in is rare, short enough that a stolen one expires. */
const SESSION_DAYS = 7

/** What `send` needs, threaded through so this file names no environment variable. */
type Mail = { RESEND_API_KEY?: string; MAIL_FROM?: string }

export function createAuth(
  db: DrizzleD1Database<typeof schema>,
  secret: string,
  origin: string,
  mail: Mail = {},
) {
  /**
   * **Password reset appears only when mail can actually be sent.**
   *
   * better-auth is happy to expose /request-password-reset with no sender
   * configured: it succeeds, sends nothing, and the person waits forever for a
   * letter that was never written. Offering the flow only when there is a
   * provider means a locked-out person gets told the truth instead.
   */
  const canMail = configured(mail)
  return betterAuth({
    secret,
    // Derived from the request rather than configured, because the same code
    // serves enodia.<subdomain>.workers.dev and enodia.tools, and a baseURL
    // that disagrees with the host breaks cookies rather than erroring.
    baseURL: origin,
    basePath: '/api/auth',
    // Same origin by construction: assets/_headers says connect-src 'self' and
    // this Worker is served from the same hostname. Stated anyway so a future
    // reader does not assume it is open.
    trustedOrigins: [origin],

    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
      // See the docblock. D1 batches, it does not do interactive transactions.
      transaction: false,
    }),

    emailAndPassword: {
      enabled: true,
      /**
       * Still false, and it is a separate decision from reset.
       *
       * Verification gates somebody out of their own account until they find a
       * letter, which for a tool nobody has heard of is a wall at the worst
       * moment. Reset is the one that has to exist, because it is the only
       * route back in. Turn this on when there is a reason beyond tidiness.
       */
      requireEmailVerification: false,

      ...(canMail
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
              await send(mail, { to: user.email, ...resetLetter(url) })
            },
            // An hour. Long enough to find the letter, short enough that a link
            // sitting in an old inbox is not a way in.
            resetPasswordTokenExpiresIn: 3600,
          }
        : {}),
    },

    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      // Sliding: a week from last use rather than a week from sign-in.
      updateAge: 24 * 60 * 60,
    },

    /**
     * **Rate limiting, stated rather than defaulted, because the default is off
     * here and looks on.**
     *
     * better-auth sets `enabled: options.rateLimit?.enabled ?? isProduction`,
     * and `isProduction` is `NODE_ENV === 'production'`. Workers does not set
     * `NODE_ENV`. So the library's "on in production" reads as safe and would
     * never have fired on this platform. Measured before this was added: 150
     * wrong-password attempts in 12 seconds, all 401, not one 429.
     *
     * `storage: 'database'` for the same class of reason. The default is
     * `memory`, and a Worker's memory is per-isolate on an edge that runs many
     * and evicts them constantly, so a memory counter is close to no counter.
     * D1 is the only thing here that all isolates share. It costs a row write
     * per auth request, which is the trade: bounded writes to prevent unbounded
     * account creation, against a free tier of 100k row writes a day.
     *
     * This is the application-level limit. **A Cloudflare rate limiting rule at
     * the edge is better and free**, because it rejects before a Worker is even
     * invoked, and it is the owner's to configure. This is what holds until then.
     */
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        // Sign-up is the expensive one: it writes a user that persists.
        '/sign-up/email': { window: 3600, max: 10 },
        // Sign-in is the one worth brute forcing.
        '/sign-in/email': { window: 300, max: 20 },
        /**
         * Reset is the one that costs somebody ELSE something. Every call sends
         * a letter to an address the caller types, so an unlimited endpoint is
         * a way to flood a stranger's inbox using this domain's reputation.
         * Three an hour is more than a forgetful person needs.
         */
        '/request-password-reset': { window: 3600, max: 3 },
      },
    },

    advanced: {
      /**
       * **`cf-connecting-ip`, not the default.**
       *
       * better-auth defaults to `x-forwarded-for`. Cloudflare *appends* the real
       * address to that header rather than replacing it, so a client that sends
       * its own arrives with an attacker-chosen value in front. Every limit
       * above is keyed on the address, so trusting that header would let anyone
       * reset their own counter by changing a string.
       *
       * `cf-connecting-ip` is set by Cloudflare and overwritten on every
       * request, so it cannot be supplied by the caller.
       */
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },

      // The tool is one origin. Nothing embeds it, `frame-ancestors 'none'`
      // says so, and a cross-site cookie would be a capability nothing needs.
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
