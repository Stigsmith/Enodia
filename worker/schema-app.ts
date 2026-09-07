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
 * still the thing the export writes.
 *
 * **Publishing again replaces the copy**, which this said for months while
 * `publish()` only ever inserted, so the same build published twice became two
 * listings under two ids. There is a republish route now and this is true.
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

    /**
     * Whose it is. Still `cascade`, and **that was tried and reverted rather
     * than left unexamined.**
     *
     * The cascade is wrong in principle: deleting an account would destroy its
     * published builds, taking every run and rating anybody logged against
     * them, the curator's notes, and the builds themselves out of the library
     * of everybody following them. A person leaving should take their name with
     * them, not other people's work. `set null` plus the "Somebody" byline that
     * `exchange.ts` already falls back to is the right shape.
     *
     * **SQLite cannot alter a foreign key, so that is a table rebuild, and the
     * rebuild is the danger.** `published_build` is a parent and both
     * `exchange_stat` and `curated_pick` point at it `on delete cascade`, so the
     * `DROP TABLE` in the middle of a rebuild performs an implicit delete that
     * carries out those cascade actions.
     *
     * drizzle-kit wraps its rebuild in `PRAGMA foreign_keys=OFF`. **Measured, on
     * a real database with real rows: it does not help here.** The rebuild ran,
     * reported nine statements executed successfully, and took `exchange_stat`
     * from 2 rows to 0 and `curated_pick` from 1 to 0. D1 documents
     * `defer_foreign_keys` and not `foreign_keys`, and deferral postpones
     * constraint checking rather than suppressing cascade actions. So the
     * migration written to stop this loss would have caused it.
     *
     * **The rule instead, since there is no account deletion path today:**
     * whoever builds one must reassign this account's published builds before
     * deleting the row, to a reserved account that stands for a player who has
     * left. That needs no schema change and no rebuild. Do not reach for
     * `set null` without rehearsing the migration against an export and
     * counting `exchange_stat` and `curated_pick` on both sides of it.
     */
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

    /**
     * When the author last replaced it, and how many times they have.
     *
     * **These exist because following makes them mean something.** A copy is a
     * snapshot and does not care whether its source moved; somebody following a
     * build is reading the author's current version, so "when did this last
     * change" is the question the relationship is built on.
     *
     * `revision` counts replacements rather than versions. It is not a history
     * and there is nothing to roll back to: the owner ruled versioning out and
     * was right that it is a confusing feature to carry for the few people who
     * would use it. Somebody who wants a v1 and a v2 can publish two builds and
     * say so in the names.
     *
     * Cheap, and measured before it was added: an integer is a 1 to 2 byte
     * varint on a row whose payload column already averages 1.2 to 1.6 KB, so
     * the pair is about 0.1% of a row. Ten thousand listings would cost tens of
     * kilobytes.
     */
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    revision: integer('revision').default(0).notNull(),
    /**
     * When the author took it off the shelves, or null while it is live.
     *
     * **Taking a build down is not a delete, and this column is why.** A delete
     * cascades: it destroys every run and rating anybody logged against the
     * build and the curator's note with it, and it empties the build out of the
     * library of everyone following it. That is a lot of other people's work to
     * throw away because one person pressed a button, and the owner's call was
     * that it should not happen.
     *
     * So a tombstone. The row stays, it leaves every shelf, and `read` still
     * answers for anybody holding the link. Unlisted rather than destroyed, and
     * that is the honest description: the id is ten unguessable characters and
     * was already shared, so the thing taking it down actually removes is
     * discovery.
     *
     * A timestamp rather than a boolean because it answers when for free and
     * sits beside `updatedAt`. `syncItem.deleted` is a boolean for a reason its
     * own docblock gives, which does not apply here: there the fact of the
     * delete is what syncs, and nothing about this syncs.
     */
    takenDownAt: integer('taken_down_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('published_build_userId_idx').on(table.userId),
    /* The exchange lists newest first across every account, which the userId
     * index cannot answer. One column, and without it that listing is a scan. */
    index('published_build_createdAt_idx').on(table.createdAt),
  ],
)

/**
 * What has happened to a published build, one row per person per build.
 *
 * **This is the whole evidence model for the exchange**, and it is deliberately
 * counts rather than a score. The tool has committed in eight separate places to
 * not saying whether a build is good, and it still does not: it says how many
 * people took a build, how many runs they logged, how many of those cleared, and
 * what they rated it. A reader draws the conclusion. Nothing here is combined
 * into a single number, because any such number would have to weigh how fun a
 * build is against how hard it is to assemble, and the tool has no basis for
 * that trade. `src/engine/repeat.ts` makes the same argument at length: a build
 * can be five stars from five thousand people and still read Not in one run.
 *
 * **One row per person per build, and the identity is for arithmetic only.** It
 * is what stops one account counting a build a thousand times, and it buys an
 * honest "12 people logged runs" that bare counters cannot. It is never returned
 * to anybody: every read of this table aggregates. `src/ui/Account.tsx` says so
 * in the words a reader gets.
 *
 * The rating lives here rather than in its own table because it is one more
 * thing this person thinks about this build, and because rating is gated on
 * having logged a run, which is the row next to it.
 */
export const exchangeStat = sqliteTable(
  'exchange_stat',
  {
    buildId: text('build_id')
      .notNull()
      .references(() => publishedBuild.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** When they took a copy, or null if they have only rated or played it. */
    takenAt: integer('taken_at'),

    /** Runs they logged against their copy while it still matched the original. */
    runs: integer('runs').notNull().default(0),
    clears: integer('clears').notNull().default(0),

    /**
     * The highest Fear they cleared it at.
     *
     * Only ever raised on a clear, matching `src/ui/LogRun.tsx`: dying at Fear 30
     * is not clearing Fear 30, and counting it as one would be the tool
     * inflating somebody's history on their behalf.
     */
    bestFear: integer('best_fear'),

    /** One to five, null until they rate. Gated on having logged a run. */
    rating: integer('rating'),

    updated: integer('updated')
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.buildId, table.userId] }),
    /* Every read is "everything about this build", aggregated. */
    index('exchange_stat_build_idx').on(table.buildId),
  ],
)

/**
 * The owner's own shelf, and the only opinion the tool states as its own.
 *
 * `CLAUDE.md` draws the line where this sits: evaluations are not in the game
 * files and must come from the owner, and an opinion is allowed when it carries
 * a visible byline. So a pick is signed and says why in the owner's own words,
 * and it never looks like a measurement.
 *
 * It is also the only shelf that works on the first day, when every count in
 * `exchangeStat` is zero. A ranked list of nothing is not a feature.
 *
 * Not a column on `publishedBuild`, because curation is a fact about the shelf
 * rather than about the build: unpicking one must not touch what its author
 * published.
 */
export const curatedPick = sqliteTable('curated_pick', {
  buildId: text('build_id')
    .primaryKey()
    .references(() => publishedBuild.id, { onDelete: 'cascade' }),

  /** Why it is here, in the owner's words. The byline is the point. */
  note: text('note').notNull(),

  at: integer('at')
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

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
