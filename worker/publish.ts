/**
 * Publishing a build, which is the only thing an account buys.
 *
 * A build shared as a link carries the whole build inside the link, which is
 * why sharing has never needed a server, and which makes that link **1,588
 * characters**. Discord renders it as a wall, Reddit mangles it, and it will
 * not fit in a QR code. Publishing stores the same payload under a short id so
 * the link becomes about thirty.
 *
 * **The server has no opinion about what a build is.** The payload arrives
 * packed, is stored as text, and is handed back packed. Nothing here parses it,
 * validates a boon id, or needs a second copy of the game data to check against.
 * The browser packs and unpacks, exactly as it already does for a link.
 *
 * ## The limits, and why each one is here
 *
 * Every one of these bounds something a stranger could otherwise spend on this
 * account's behalf. None of them are guesses about what a person needs.
 */

import { and, eq, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { publishedBuild } from './schema-app.ts'
import * as schema from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

/**
 * A packed build is around 1,600 characters. 16 KB is ten times the largest
 * real one, which leaves room for the format to grow and still refuses anything
 * being used as free storage.
 */
const MAX_PAYLOAD = 16 * 1024

/** Long enough to read out, short enough to not be a paragraph. */
const MAX_NAME = 120

/**
 * The shape token, which this server stores and compares and never reads.
 *
 * The browser hashes the build's picks and sends the result. 32 is generous for
 * a base36 FNV fingerprint and short enough that the column cannot be used as
 * somewhere to put a payload. Anything longer is dropped rather than refused:
 * it is a hint about versions, not a thing worth failing a publish over.
 */
const MAX_SHAPE = 32
const shapeIn = (body: { shape?: unknown }): string =>
  typeof body.shape === 'string' && body.shape.length <= MAX_SHAPE ? body.shape : ''

/**
 * Per account, and the only thing bounding total storage.
 *
 * better-auth's rate limiter covers `/api/auth/*` and nothing else, so it caps
 * how many accounts can exist but not what one account can write. Fifty is far
 * past what anybody publishes and still bounded. **A Cloudflare rate limiting
 * rule at the edge is the better answer** and is the owner's to add.
 */
const MAX_PER_USER = 50

/**
 * No `0`, `O`, `1`, `l` or `I`. These ids get read aloud and typed by hand
 * often enough that removing the four pairs people confuse costs nothing.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ID_LENGTH = 10

/**
 * Random, never sequential.
 *
 * A counter would let anybody walk every build ever published by adding one,
 * which turns an unlisted thing into a public feed that nobody designed and
 * nobody moderates. 57^10 is about 58 bits, so guessing one is not a strategy.
 */
function shortId(): string {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

export type Published = {
  id: string
  name: string
  createdAt: number
  updatedAt: number | null
  revision: number
  /** null while it is live. A timestamp, so it answers when as well as whether. */
  takenDownAt: number | null
}

/** What a caller did wrong, in words the UI can show without rewording. */
export type Refusal = { status: number; say: string }

export async function publish(
  db: DB,
  userId: string,
  body: { payload?: unknown; name?: unknown; shape?: unknown },
): Promise<{ id: string } | Refusal> {
  const payload = typeof body.payload === 'string' ? body.payload : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const shape = shapeIn(body)

  if (!payload) return { status: 400, say: 'No build in that request.' }
  if (payload.length > MAX_PAYLOAD) return { status: 413, say: 'That build is too large to publish.' }
  if (!name) return { status: 400, say: 'A published build needs a name.' }
  if (name.length > MAX_NAME) return { status: 400, say: 'That name is too long.' }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(publishedBuild)
    .where(eq(publishedBuild.userId, userId))

  if ((row?.count ?? 0) >= MAX_PER_USER) {
    return {
      status: 409,
      say: `You have ${MAX_PER_USER} published builds, which is the limit. Unpublish one first.`,
    }
  }

  /**
   * Three attempts, because a primary key collision is possible rather than
   * impossible and a 500 is a bad way to report a coin landing on its edge.
   * At 58 bits it will never take the second one.
   */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = shortId()
    try {
      await db.insert(publishedBuild).values({ id, userId, payload, name, shape })
      return { id }
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
  return { status: 500, say: 'Could not publish that.' }
}

/**
 * Replace a published build in place, and count that it happened.
 *
 * **This is what makes following mean anything.** A copy is a snapshot and does
 * not care whether its source moved. Somebody following a build is reading the
 * author's current version, so the author needs a way to change it that does
 * not mint a second listing and orphan every follower on the first.
 *
 * Publishing the same build twice used to do exactly that: `publish` only ever
 * inserted, so two listings existed under two ids with the same content, and
 * `Exchange.tsx` keyed its listings by the unpacked build's internal id and
 * collapsed them into one. Two docblocks said "publishing again replaces the
 * copy" the whole time.
 *
 * **The ownership check is in the `where`**, the same reasoning `unpublish`
 * gives below: a read then a write is a race, and D1 has no transaction to
 * close it with. Zero rows changed means it was not theirs or is gone, and
 * those two are deliberately not told apart.
 *
 * The size and name rules are the same ones `publish` applies, because a
 * republish that could smuggle past them would be a hole in the front door.
 */
export async function republish(
  db: DB,
  userId: string,
  id: string,
  body: { payload?: unknown; name?: unknown; shape?: unknown },
): Promise<{ id: string; revision: number } | Refusal> {
  const payload = typeof body.payload === 'string' ? body.payload : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const shape = shapeIn(body)

  if (!payload) return { status: 400, say: 'No build in that request.' }
  if (payload.length > MAX_PAYLOAD) return { status: 413, say: 'That build is too large to publish.' }
  if (!name) return { status: 400, say: 'A published build needs a name.' }
  if (name.length > MAX_NAME) return { status: 400, say: 'That name is too long.' }

  const result = await db
    .update(publishedBuild)
    .set({
      payload,
      name,
      shape,
      updatedAt: new Date(),
      revision: sql`${publishedBuild.revision} + 1`,
    })
    .where(and(eq(publishedBuild.id, id), eq(publishedBuild.userId, userId)))

  if ((result as { meta?: { changes?: number } }).meta?.changes === 0) {
    return { status: 404, say: 'That build is not one of yours.' }
  }

  const [row] = await db
    .select({ revision: publishedBuild.revision })
    .from(publishedBuild)
    .where(eq(publishedBuild.id, id))
    .limit(1)

  return { id, revision: row?.revision ?? 1 }
}

export async function listMine(db: DB, userId: string): Promise<Published[]> {
  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      createdAt: publishedBuild.createdAt,
      updatedAt: publishedBuild.updatedAt,
      revision: publishedBuild.revision,
      takenDownAt: publishedBuild.takenDownAt,
    })
    .from(publishedBuild)
    .where(eq(publishedBuild.userId, userId))

  // Taken-down rows are listed rather than filtered: this is the author's own
  // inventory, and a listing they cannot see is one they cannot put back.
  return rows.map((one) => ({
    ...one,
    createdAt: one.createdAt.getTime(),
    updatedAt: one.updatedAt ? one.updatedAt.getTime() : null,
    takenDownAt: one.takenDownAt ? one.takenDownAt.getTime() : null,
  }))
}

/**
 * Take one off the shelves, and only if it is yours.
 *
 * **This was a delete and is not any more.** The row is referenced by
 * `exchange_stat` and `curated_pick`, both `on delete cascade`, so deleting it
 * destroyed every run and rating anybody had logged against the build and the
 * curator's note in the same statement. It also emptied the build out of the
 * library of everybody following it, because their client reads it back from
 * here. One person pressing a button should not throw away that much of other
 * people's work, and the owner's call was that it should not.
 *
 * What is left is a tombstone: the build leaves every shelf, and `read` keeps
 * answering for anybody holding the link. Unlisted rather than destroyed, which
 * is the honest word for it, since the id is ten unguessable characters that
 * were already shared and what taking it down really removes is discovery.
 *
 * The ownership check is in the `where` rather than in a read followed by a
 * write. Two statements would be a race, and on D1 there is no transaction to
 * close it with.
 */
export async function takeDown(db: DB, userId: string, id: string): Promise<boolean> {
  const result = await db
    .update(publishedBuild)
    .set({ takenDownAt: new Date() })
    .where(and(eq(publishedBuild.id, id), eq(publishedBuild.userId, userId)))
  // D1 reports rows changed; zero means it was not theirs or never existed, and
  // those two are deliberately not told apart. SQLite counts a matched row as
  // changed even when the value written is the one already there, so taking the
  // same build down twice answers truthfully rather than claiming it is gone.
  return (result as { meta?: { changes?: number } }).meta?.changes !== 0
}

/**
 * Put one back on the shelves. The other half of taking it down.
 *
 * **A separate verb rather than a side effect of republishing.** An author
 * fixing a build while it is down should not have to make it public to save the
 * fix, and a republish that quietly relisted would put a build back on the
 * curated shelf without anybody asking. Two verbs with one meaning each are
 * easier to put on a screen than one verb with a hidden second effect.
 *
 * It touches `takenDownAt` and nothing else. In particular it does not move
 * `revision`, because nothing about the build changed and every follower would
 * otherwise be told there was something to look at.
 */
export async function putBack(db: DB, userId: string, id: string): Promise<boolean> {
  const result = await db
    .update(publishedBuild)
    .set({ takenDownAt: null })
    .where(and(eq(publishedBuild.id, id), eq(publishedBuild.userId, userId)))
  return (result as { meta?: { changes?: number } }).meta?.changes !== 0
}

/**
 * Public. The whole point is that somebody with the link needs no account.
 *
 * Carries the revision so a follower can tell whether what they are holding is
 * current without diffing a 1.2 KB payload against the one they cached.
 *
 * **It does not filter out a build that has been taken down**, and that is the
 * decision rather than an oversight. Taking a build down removes it from the
 * shelves so nobody new finds it; the link somebody was already handed keeps
 * working, and says so. Filtering here would empty the build out of the library
 * of everybody following it, which is the outcome the tombstone exists to
 * prevent.
 *
 * It is also the only version this route can enforce. There is no session on
 * it, by design, so the server cannot tell a follower from a stranger and any
 * rule of the form "only for people already following" would be a rule it has
 * no way to apply.
 */
export async function read(
  db: DB,
  id: string,
): Promise<{ payload: string; name: string; revision: number; takenDown: boolean } | null> {
  const [row] = await db
    .select({
      payload: publishedBuild.payload,
      name: publishedBuild.name,
      revision: publishedBuild.revision,
      takenDownAt: publishedBuild.takenDownAt,
    })
    .from(publishedBuild)
    .where(eq(publishedBuild.id, id))
  if (!row) return null
  const { takenDownAt, ...rest } = row
  // A boolean, not the timestamp. When the author took it down is their
  // business and answers no question the reader has.
  return { ...rest, takenDown: takenDownAt !== null }
}
