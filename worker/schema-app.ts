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
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
