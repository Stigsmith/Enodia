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
 * **No email is sent, so there is no verification and no password reset.**
 * There is no mail provider and adding one is a vendor, an account and a bill.
 * That is fine for this stage, which has no UI and no users. It is NOT fine for
 * Stage 3, where somebody will lock themselves out on the first day. Anything
 * that puts a sign-in form in front of a real person needs a provider first.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import * as schema from './schema.ts'

/** A week. Long enough that logging in is rare, short enough that a stolen one expires. */
const SESSION_DAYS = 7

export function createAuth(db: DrizzleD1Database<typeof schema>, secret: string, origin: string) {
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
      // No provider, so this cannot be true yet. When it can be, it should be.
      requireEmailVerification: false,
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
