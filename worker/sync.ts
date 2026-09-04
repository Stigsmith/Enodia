/**
 * Carrying an account's things between devices.
 *
 * One exchange, both directions: the browser sends what changed on it since it
 * last asked, and gets back what changed anywhere else in the same window. That
 * is the whole protocol. There is no separate upload and download, because two
 * calls is two chances to half-succeed and leave a device believing it is in
 * sync when it is not.
 *
 * ## Newest wins, per item
 *
 * Every item carries `modified` and the later one survives. Per item, not per
 * sync: editing a build on a phone and a different one on a desktop keeps both,
 * because they are different rows and neither is newer than the other.
 *
 * **The clock is the client's.** A device set to the wrong year wins every
 * conflict it enters, which is a real weakness and the alternative is worse:
 * stamping on arrival orders two offline edits by whichever device reconnected
 * first rather than by when the person actually made them. `schema-app.ts` says
 * more where the column is defined.
 *
 * ## What this does not do
 *
 * **It does not merge the insides of anything.** Two devices editing the same
 * build produce one winner and one loss, not a combined build. Field level
 * merging needs either a CRDT or a three way diff over a format that is
 * deliberately opaque here, and the case it fixes, two devices editing one build
 * within one sync window, is rare enough not to earn that.
 *
 * **It does not resolve deletes against edits.** A delete is an item like any
 * other and wins if it is newer. Deleting on a desktop and editing on a phone
 * keeps whichever happened last, which is the same rule as everything else and
 * is at least explicable.
 */

import { and, eq, gt, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { syncItem } from './schema-app.ts'
import * as schema from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

/**
 * One thing that syncs: a build, a run, the bin, or a setting.
 *
 * `payload` is whatever the browser packed. Nothing here reads it.
 */
export type Item = {
  kind: string
  id: string
  payload: string
  modified: number
  deleted?: boolean
}

export type Refusal = { status: number; say: string }

/**
 * Per item, and ten times the largest real build.
 *
 * `publish.ts` uses the same number for the same reason: it leaves room for the
 * format to grow and still refuses an endpoint being used as free storage.
 */
const MAX_PAYLOAD = 16 * 1024

/**
 * Per account, across every kind.
 *
 * A library is tens of builds and a few hundred runs. Two thousand is far past
 * anybody's real use and still bounded, and unlike `publish.ts`'s cap this one
 * is never reached by somebody using the tool normally, so it is a backstop
 * rather than a rule anyone meets.
 */
const MAX_ITEMS = 2000

/** Per exchange, so one call cannot be made arbitrarily large. */
const MAX_BATCH = 500

/** The kinds this understands. An unknown kind is refused rather than stored,
 * so a typo in a client does not quietly create a parallel universe of rows. */
const KINDS = new Set(['build', 'run', 'bin', 'setting'])

function readItems(raw: unknown): Item[] | Refusal {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) return { status: 400, say: 'Expected a list of items.' }
  if (raw.length > MAX_BATCH) {
    return { status: 413, say: `That is more than ${MAX_BATCH} items in one go.` }
  }

  const items: Item[] = []
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) return { status: 400, say: 'Bad item.' }
    const { kind, id, payload, modified, deleted } = one as Record<string, unknown>

    if (typeof kind !== 'string' || !KINDS.has(kind)) {
      return { status: 400, say: 'Unknown kind of thing to sync.' }
    }
    if (typeof id !== 'string' || !id || id.length > 200) {
      return { status: 400, say: 'Bad item id.' }
    }
    if (typeof payload !== 'string') return { status: 400, say: 'Bad payload.' }
    if (payload.length > MAX_PAYLOAD) {
      return { status: 413, say: 'One of those is too large to sync.' }
    }
    /**
     * A non-finite `modified` would be stored and then compared, and every
     * comparison against NaN is false, so the item would neither win nor lose
     * and would simply stop syncing. Refused at the door instead.
     */
    if (typeof modified !== 'number' || !Number.isFinite(modified) || modified < 0) {
      return { status: 400, say: 'Bad modification time.' }
    }

    items.push({ kind, id, payload, modified, deleted: deleted === true })
  }
  return items
}

/**
 * Take what a device has, give back what it is missing.
 *
 * `since` is what the caller was last told; passing 0 asks for everything, which
 * is what a fresh sign-in does.
 */
export async function sync(
  db: DB,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ now: number; items: Item[] } | Refusal> {
  const since = typeof body.since === 'number' && Number.isFinite(body.since) ? body.since : 0

  const incoming = readItems(body.items)
  if ('status' in incoming) return incoming

  if (incoming.length > 0) {
    const [held] = await db
      .select({ count: sql<number>`count(*)` })
      .from(syncItem)
      .where(eq(syncItem.userId, userId))

    /* Counted before writing rather than after, and only against new rows,
     * because an account at the cap must still be able to edit and delete what
     * it already has. A cap that stops you deleting is a cap that traps you. */
    if ((held?.count ?? 0) + incoming.length > MAX_ITEMS + MAX_BATCH) {
      return { status: 409, say: 'That account is holding too much to sync.' }
    }

    /**
     * One upsert per item, and `setWhere` is what makes it a merge.
     *
     * The update runs only when the arriving row is genuinely newer. An older
     * copy, which is exactly what a device sends when it comes back from being
     * offline, is a no-op rather than a regression. Deciding in SQL rather than
     * reading first leaves no gap between the decision and the write, the same
     * reasoning as `worker/limit.ts`.
     *
     * Written through the query builder rather than as raw `sql`, because
     * `db.batch` takes prepared queries: handing it raw statement promises
     * fails at run time with an unhelpful error about `bind`, having type
     * checked perfectly well.
     */
    const writes = incoming.map((one) =>
      db
        .insert(syncItem)
        .values({
          userId,
          kind: one.kind,
          itemId: one.id,
          payload: one.payload,
          modified: one.modified,
          deleted: one.deleted ?? false,
        })
        .onConflictDoUpdate({
          target: [syncItem.userId, syncItem.kind, syncItem.itemId],
          set: {
            payload: sql`excluded.payload`,
            modified: sql`excluded.modified`,
            deleted: sql`excluded.deleted`,
          },
          setWhere: sql`excluded.modified > ${syncItem.modified}`,
        }),
    )

    /**
     * One batch, so a half-applied sync is not a state this can end in.
     *
     * `batch` is non-empty by construction here: `incoming.length > 0` is
     * checked above, and D1 rejects an empty batch.
     */
    await db.batch(writes as [(typeof writes)[number], ...typeof writes])
  }

  /**
   * Everything that changed since the caller last asked, including what it just
   * sent back to it.
   *
   * That echo is deliberate. An item the caller sent that lost the comparison
   * comes back as the winner, so a device that was behind is corrected in the
   * same round trip rather than believing its own version until next time.
   */
  const rows = await db
    .select()
    .from(syncItem)
    .where(and(eq(syncItem.userId, userId), gt(syncItem.modified, since)))
    .limit(MAX_ITEMS)

  return {
    /**
     * The high water mark, taken from the rows rather than from a clock.
     *
     * Using the server's `Date.now()` here would skip anything written while
     * this request was in flight, permanently: the caller would ask for changes
     * after a moment those rows already sit before. The largest `modified`
     * actually returned cannot skip anything, because anything newer is by
     * definition not in this answer yet.
     */
    now: rows.reduce((high, row) => Math.max(high, row.modified), since),
    items: rows.map((row) => ({
      kind: row.kind,
      id: row.itemId,
      payload: row.payload,
      modified: row.modified,
      deleted: row.deleted,
    })),
  }
}
