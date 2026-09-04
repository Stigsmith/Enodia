/**
 * This project's own tables. **Hand written, and deliberately not in
 * `worker/schema.ts`.**
 *
 * That file is generated: `npm run db:schema` overwrites it wholesale from
 * better-auth's options. Anything of ours in it survives exactly until the next
 * time somebody regenerates, and then vanishes without a word. Two files, one
 * generated and one not, is the only arrangement where that cannot happen.
 * `drizzle.config.ts` reads both.
 *
 * ## What a published build is
 *
 * A build shared as a link carries the whole build inside the link, which is
 * why sharing needs no server, and which makes that link **1,588 characters**.
 * Publishing stores the same payload under a short id so the link becomes about
 * thirty. That is the only thing an account buys.
 *
 * **It is not a backup.** The build in this table is a copy taken at one moment.
 * The one in the browser is still the record, still the thing being edited, and
 * still the thing the export writes. Publishing again replaces the copy.
 *
 * ## Unlisted, not public
 *
 * Nothing lists these. There is no gallery, no index, no search, and the id is
 * random rather than sequential, so a published build is reachable only by
 * somebody who was given the link. That is a much smaller moderation surface
 * than a public feed, which is the point: `REQUIREMENTS.md` 5 wants moderation
 * designed before anything discoverable exists, and this is not that.
 */

import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { user } from './schema.ts'

export const publishedBuild = sqliteTable(
  'published_build',
  {
    /**
     * The short id, and the whole reason this table exists.
     *
     * Random rather than sequential. A counter would let anybody walk every
     * build ever published by adding one, which would turn an unlisted thing
     * into a public feed nobody designed.
     */
    id: text('id').primaryKey(),

    /** Cascade, so deleting an account takes its published builds with it. */
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /**
     * The packed build, byte for byte what the URL fragment carries.
     *
     * Stored opaque on purpose. The server has no opinion about what a build
     * is, does not validate boon ids, and does not need a second copy of the
     * game data to check them against. The browser packs it and the browser
     * unpacks it, exactly as it already does for a link.
     */
    payload: text('payload').notNull(),

    /** Shown in the owner's own list, so they can tell two of theirs apart. */
    name: text('name').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index('published_build_userId_idx').on(table.userId)],
)

/**
 * How two people become friends, and why it is a code rather than a search.
 *
 * **You cannot look somebody up here, on purpose.** `name` is not unique, so it
 * cannot address anybody. `email` is unique, so a search by email would let a
 * stranger test whether any given address has an account, one address at a
 * time. Neither is a good front door.
 *
 * A code is: you share it with somebody you already talk to, in Discord or
 * wherever, and they redeem it. Nothing is enumerable, nothing is searchable,
 * and there are no handles to claim, which also means there are no handles to
 * moderate. That last one matters more than it sounds for a public fan tool.
 *
 * One code per account, and it can be rotated. If it ends up somewhere public,
 * rotate it and the old one stops working. Rotating does not touch existing
 * friendships.
 */
export const friendCode = sqliteTable('friend_code', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

/**
 * A friendship, stored as two rows rather than one ordered pair.
 *
 * `(userId, friendId)` and its mirror. It costs a row and buys the only query
 * that matters being a single indexed lookup on `userId`, rather than an OR
 * across two columns that no index covers well. Both rows are written together
 * and deleted together.
 *
 * **Redeeming a code is consent from both sides**, which is why there is no
 * request-and-accept step. Sharing your code is you agreeing; using it is them
 * agreeing. Adding a pending state would be ceremony around a decision both
 * people have already made.
 *
 * Either side can remove it, and removal takes both rows.
 */
export const friendship = sqliteTable(
  'friendship',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    friendId: text('friend_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.friendId] }),
    index('friendship_userId_idx').on(table.userId),
  ],
)

/**
 * Everything a signed-in account carries between devices.
 *
 * **One table with a `kind` column, not five tables.** Builds, runs, the bin and
 * every setting are the same problem wearing different names: an identified
 * thing, a blob, and when it last changed. Five tables would be five migrations,
 * five endpoints and five merge implementations that have to agree, and the
 * first time they disagreed would be a build resurrecting itself on a phone.
 *
 * `payload` is opaque here on purpose, exactly as `publishedBuild` is. The
 * server stores what the browser packed and hands it back unread. Nothing on
 * this side knows what a build is, which is what keeps a change to the build
 * format from being a migration.
 *
 * ## Tombstones, and why `deleted` is a column rather than a `DELETE`
 *
 * A delete has to be a fact that syncs, not an absence. Remove the row and the
 * next device to sync still has its copy, sees something the server does not,
 * and helpfully puts it back. **A build that resurrects itself is worse than one
 * that lingers**, because the first looks like the tool is broken and the second
 * looks like you forgot. So a delete writes `deleted = true` with a fresh
 * `modified`, which is a change like any other and wins or loses on its date.
 *
 * They are small and they are kept. A tombstone has to outlive any device that
 * might still be carrying the thing it buries, and there is no way to know when
 * that is: a phone left in a drawer for a year is exactly the case that breaks.
 */
export const syncItem = sqliteTable(
  'sync_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** `build`, `run`, `bin` or `setting`. Not an enum: SQLite has none, and a
     * new kind should not need a migration. */
    kind: text('kind').notNull(),
    /** The build or run id, or the setting's name. Unique within its kind. */
    itemId: text('item_id').notNull(),
    /** Packed by the browser, stored as text, handed back unread. */
    payload: text('payload').notNull(),
    /**
     * When this last changed, epoch ms, **as the writing device saw it**.
     *
     * The merge is newest wins, so this decides everything, and it is a client
     * clock rather than the server's. That is a real weakness: a device with a
     * wrong clock wins or loses every conflict. The alternative, stamping on
     * arrival, is worse, because two edits made offline would then be ordered by
     * whichever device happened to reconnect first rather than by when the
     * person actually made them.
     */
    modified: integer('modified').notNull(),
    /** A tombstone. See above: a delete is a fact, not an absence. */
    deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.itemId] }),
    /* The only read this table has: everything of mine that changed since I
     * last asked. `userId` first because it selects, `modified` second because
     * it ranges. */
    index('sync_item_since_idx').on(table.userId, table.modified),
  ],
)

/**
 * The counters behind `worker/limit.ts`, one row per key per window.
 *
 * **A table of ours rather than better-auth's `rate_limit`, and that is not
 * tidiness.** Its database storage prunes with
 * `deleteMany({ where: [{ field: 'lastRequest', operator: 'lt', value: cutoff }] })`
 * where `cutoff` is `now - longestObservedWindow`, and `longestObservedWindow`
 * is the longest window **better-auth itself** has configured. There is no key
 * filter on that delete. Rows of ours in that table would be pruned on a
 * schedule set by a rule in `worker/auth.ts`, so lowering the sign-up window
 * from an hour would silently shorten every limit here. Its `key` column is
 * also `UNIQUE`, so a key of ours colliding with one of theirs would merge two
 * counters into one.
 *
 * `key` is the primary key rather than a separate id, because the whole access
 * pattern is one upsert on it. See `limit.ts` for why that has to be one
 * statement.
 */
export const apiRateLimit = sqliteTable('api_rate_limit', {
  /** `<rule>:<who>`, where who is a user id or an address. `limit.ts` builds it. */
  key: text('key').primaryKey(),
  /** Requests taken in the current window, including the one that went over. */
  count: integer('count').notNull(),
  /** When the current window opened, epoch ms. Fixed, not sliding. */
  windowStart: integer('window_start').notNull(),
})
