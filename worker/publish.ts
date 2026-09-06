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

export type Published = { id: string; name: string; createdAt: number; updatedAt: number | null; revision: number }

/** What a caller did wrong, in words the UI can show without rewording. */
export type Refusal = { status: number; say: string }

export async function publish(
  db: DB,
  userId: string,
  body: { payload?: unknown; name?: unknown },
): Promise<{ id: string } | Refusal> {
  const payload = typeof body.payload === 'string' ? body.payload : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

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
      await db.insert(publishedBuild).values({ id, userId, payload, name })
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
  body: { payload?: unknown; name?: unknown },
): Promise<{ id: string; revision: number } | Refusal> {
  const payload = typeof body.payload === 'string' ? body.payload : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!payload) return { status: 400, say: 'No build in that request.' }
  if (payload.length > MAX_PAYLOAD) return { status: 413, say: 'That build is too large to publish.' }
  if (!name) return { status: 400, say: 'A published build needs a name.' }
  if (name.length > MAX_NAME) return { status: 400, say: 'That name is too long.' }

  const result = await db
    .update(publishedBuild)
    .set({
      payload,
      name,
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
    })
    .from(publishedBuild)
    .where(eq(publishedBuild.userId, userId))

  return rows.map((one) => ({
    ...one,
    createdAt: one.createdAt.getTime(),
    updatedAt: one.updatedAt ? one.updatedAt.getTime() : null,
  }))
}

/**
 * Delete one, and only if it is yours.
 *
 * The ownership check is in the `where` rather than in a read followed by a
 * delete. Two statements would be a race, and on D1 there is no transaction to
 * close it with.
 */
export async function unpublish(db: DB, userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(publishedBuild)
    .where(and(eq(publishedBuild.id, id), eq(publishedBuild.userId, userId)))
  // D1 reports rows changed; zero means it was not theirs or was already gone,
  // and those two are deliberately not told apart.
  return (result as { meta?: { changes?: number } }).meta?.changes !== 0
}

/**
 * Public. The whole point is that somebody with the link needs no account.
 *
 * Carries the revision so a follower can tell whether what they are holding is
 * current without diffing a 1.2 KB payload against the one they cached.
 */
export async function read(
  db: DB,
  id: string,
): Promise<{ payload: string; name: string; revision: number } | null> {
  const [row] = await db
    .select({
      payload: publishedBuild.payload,
      name: publishedBuild.name,
      revision: publishedBuild.revision,
    })
    .from(publishedBuild)
    .where(eq(publishedBuild.id, id))
  return row ?? null
}
