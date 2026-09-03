/**
 * Rate limiting for the routes better-auth does not cover.
 *
 * `worker/auth.ts` sets limits on `/api/auth/*` and that is all it can do:
 * better-auth only sees its own handler. Everything else on this API, which is
 * publishing, reading a published build, and friends, was unlimited.
 *
 * ## Why the counting has to be one statement
 *
 * D1 has no interactive transactions, only batches, which is the same
 * constraint that put `transaction: false` in `worker/auth.ts`. So a limiter
 * written the obvious way, read the count then write it back, is two round
 * trips with a gap in the middle, and a burst of concurrent requests all read
 * the same value before any of them writes. The limit then holds only when
 * nobody is trying, which is when it is not needed.
 *
 * `take` is therefore a single upsert with `RETURNING`. SQLite applies it
 * atomically, every `SET` expression sees the pre-update row, and the count it
 * hands back is this caller's own position in the window and nobody else's.
 *
 * ## A fixed window, not a sliding one
 *
 * The window opens on the first request and closes `window` seconds later, and
 * the count resets when the next request arrives after that. A caller can
 * therefore spend `max` at the end of one window and `max` at the start of the
 * next. The alternative needs either a row per request or a decaying counter,
 * and neither is worth it: the point is to bound what one caller can spend, not
 * to smooth it.
 *
 * Note that the count keeps rising while a caller is over the limit. That is
 * deliberate and it does not extend the window, because `window_start` is only
 * moved when a window actually rolls over. Hammering does not push the reset
 * further away.
 *
 * ## What this does not do
 *
 * **It does not save a Worker invocation.** The request has already been
 * counted against the daily 100k by the time this runs, and this adds a D1
 * write on top. What it bounds is the database: how many rows one caller can
 * create, and how much one caller can read.
 *
 * A Cloudflare rate limiting rule at the edge is the answer to the other half,
 * because it rejects before a Worker is invoked at all. It is free, it is the
 * owner's to configure, and `worker/auth.ts` says the same thing about the auth
 * routes. This is what holds until then.
 */

import { sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import * as schema from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

export type Rule = { window: number; max: number }

/**
 * Every limit on this API, in one place so they can be read against each other.
 *
 * The numbers are what a person could plausibly do, rounded up generously. None
 * of them should ever be reached by somebody using the tool: a limit that fires
 * on ordinary use teaches people the tool is broken, and they are right.
 */
export const RULES = {
  /**
   * Reading a published build. **The only route here a stranger can reach**, so
   * it is keyed on the address rather than an account.
   *
   * Two a second sustained. Opening a link, refreshing it, and opening the four
   * somebody sent you all sit far under that.
   */
  read: { window: 60, max: 120 },

  /**
   * Publishing. The only route that creates a row which persists.
   *
   * `MAX_PER_USER` in `publish.ts` already caps the total at fifty, but a total
   * is not a rate: republishing over the same id replaces rather than adds, so
   * without this an account could write forever without ever holding more than
   * one build. Thirty an hour is well past anyone deciding what to share.
   */
  publish: { window: 3600, max: 30 },

  /**
   * Everything else on your own account: listing your builds, unpublishing one,
   * your friends list, your code, the feed.
   *
   * These need a session, so the cost of getting one is already limited by
   * better-auth's ten sign-ups an hour. This bounds what a session can do once
   * it exists.
   */
  own: { window: 60, max: 120 },

  /**
   * Redeeming a friend code, which is the one guessable secret in the API.
   *
   * A code is 8 characters from a 57 character alphabet, so the space is about
   * 1.1e14 and guessing was never the threat. Twenty an hour is here because an
   * unlimited endpoint that looks up an arbitrary string is a free database
   * read, not because the code is weak.
   */
  redeem: { window: 3600, max: 20 },
} as const satisfies Record<string, Rule>

export type Refused = { retryAfter: number }

/**
 * Take one request against `key`. Returns null when it is allowed, and how long
 * to wait when it is not.
 *
 * `key` is `<rule>:<who>`. Callers build it with `keyFor` so the shape is
 * stated once.
 */
export async function take(db: DB, key: string, rule: Rule): Promise<Refused | null> {
  const now = Date.now()
  const opened = now - rule.window * 1000

  /**
   * One statement, and every part of it matters.
   *
   * `excluded` is the row this insert tried to add, so `excluded.window_start`
   * is `now`. The bare column names are the row already there. SQLite evaluates
   * all of the `SET` expressions against the pre-update row, so the `count` and
   * `window_start` cases cannot disagree about whether the window has rolled.
   *
   * `RETURNING` is what makes this one round trip rather than two. Without it
   * the caller would have to read back the row it just wrote, and the read
   * could see somebody else's increment.
   */
  const row = await db.get<{ count: number; window_start: number }>(sql`
    insert into api_rate_limit (key, count, window_start)
    values (${key}, 1, ${now})
    on conflict(key) do update set
      count = case when api_rate_limit.window_start <= ${opened} then 1
                   else api_rate_limit.count + 1 end,
      window_start = case when api_rate_limit.window_start <= ${opened} then excluded.window_start
                          else api_rate_limit.window_start end
    returning count, window_start
  `)

  // A driver that returned nothing is a bug, not an allowance. Refusing to
  // count is refusing to limit, so fail closed rather than waving it through.
  if (!row) return { retryAfter: rule.window }

  /**
   * Pruning, and only when a window has just opened for this key.
   *
   * That is once per window per caller at most, so it costs nothing on a busy
   * key and nothing at all on an idle one. `LONGEST` and not this rule's own
   * window, because one table holds rows for every rule and deleting on the
   * shortest one would keep resetting the longest.
   */
  if (row.count === 1) {
    await db.run(sql`delete from api_rate_limit where window_start < ${now - LONGEST * 1000}`)
  }

  if (row.count > rule.max) {
    return { retryAfter: Math.max(1, Math.ceil((row.window_start + rule.window * 1000 - now) / 1000)) }
  }

  return null
}

/**
 * The longest window any rule uses, so pruning cannot delete a row that is
 * still counting. Derived rather than written down: a rule added with a longer
 * window would otherwise start being pruned early, and nothing would say so.
 */
const LONGEST = Math.max(...Object.values(RULES).map((rule) => rule.window))

/**
 * The two things a limit can be keyed on.
 *
 * **Signed-in routes are keyed on the account, not the address.** A shared
 * address, a university or an office or anywhere behind one NAT, would
 * otherwise let one person's use lock out everybody else's. The account is the
 * thing being spent, so the account is what to count.
 *
 * **The public route is keyed on the address**, because there is no account to
 * key it on. `cf-connecting-ip` and never `x-forwarded-for`: Cloudflare appends
 * to that one rather than replacing it, so a caller who sends their own arrives
 * with a value of their choosing in front, and every limit here would be
 * resettable by changing a string. `worker/auth.ts` says the same at more
 * length. A request with no address at all shares one bucket, which is strict
 * rather than open: the failure mode is a stranger being limited, not a
 * stranger being unlimited.
 */
export const keyFor = {
  user: (rule: keyof typeof RULES, userId: string) => `${rule}:u:${userId}`,
  address: (rule: keyof typeof RULES, request: Request) =>
    `${rule}:a:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`,
}
