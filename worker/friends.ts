/**
 * Friends. `worker/schema-app.ts` explains why it is a code and not a search.
 *
 * ## What a friend actually gets you
 *
 * Their published builds, without being sent a link each time. That is the
 * whole feature, and it is deliberately the whole feature: publishing already
 * turns a 1,588 character link into thirty, and this turns "send me that again"
 * into a list.
 *
 * **It is not a feed and there is nothing global.** You see builds from people
 * you both agreed to, and nobody else can see yours. `REQUIREMENTS.md` 5 wants
 * moderation designed before anything discoverable exists; a list of people you
 * chose one at a time is not discovery, and the moderation tool for it is
 * removing somebody, which is one call.
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { friendCode, friendship, publishedBuild } from './schema-app.ts'
import * as schema from './schema.ts'
import { user } from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

/**
 * The same alphabet the published ids use: no `0`, `O`, `1`, `l` or `I`.
 * A friend code gets read aloud and typed by hand far more than a build id
 * does, so the confusable pairs matter more here, not less.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const CODE_LENGTH = 8

/**
 * Eight characters of a 57 letter alphabet is about 46 bits.
 *
 * Lower than a published build id, and that is fine: a build id has to resist
 * being guessed by anybody on the internet, whereas guessing a friend code
 * costs an attacker a friendship with a stranger who can remove them again. The
 * length is chosen to be typed, not to be unguessable.
 */
function newCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

/** Nobody needs a thousand friends, and this bounds the rows one account can write. */
const MAX_FRIENDS = 200

export type Friend = { id: string; name: string; since: number }
export type Refusal = { status: number; say: string }

/**
 * Your code, made on first ask.
 *
 * Created lazily rather than at sign-up, so an account that never touches
 * friends never gets a row. Also means the table only ever holds people who
 * have actually opened the screen.
 */
export async function codeFor(db: DB, userId: string): Promise<string> {
  const [existing] = await db
    .select({ code: friendCode.code })
    .from(friendCode)
    .where(eq(friendCode.userId, userId))
  if (existing) return existing.code

  const code = newCode()
  await db.insert(friendCode).values({ userId, code })
  return code
}

/** A new one. The old stops working immediately; friendships are untouched. */
export async function rotateCode(db: DB, userId: string): Promise<string> {
  const code = newCode()
  await db
    .insert(friendCode)
    .values({ userId, code })
    .onConflictDoUpdate({ target: friendCode.userId, set: { code } })
  return code
}

/**
 * Use somebody's code.
 *
 * Writes both directions. D1 has no interactive transaction, so the two rows go
 * in one `batch`, which is atomic where the platform supports it and ordered
 * where it does not. Re-redeeming the same code is a no-op rather than an
 * error: the end state is what was asked for either way.
 */
export async function redeem(db: DB, userId: string, raw: unknown): Promise<Friend | Refusal> {
  const code = typeof raw === 'string' ? raw.trim() : ''
  if (!code) return { status: 400, say: 'No code in that request.' }

  const [owner] = await db
    .select({ id: friendCode.userId })
    .from(friendCode)
    .where(eq(friendCode.code, code))

  // A wrong code and somebody else's rotated-away code answer identically, so
  // this cannot be used to learn whether a code was ever valid.
  if (!owner) return { status: 404, say: 'That code does not match anybody.' }
  if (owner.id === userId) return { status: 400, say: 'That is your own code.' }

  const [mine] = await db
    .select({ count: sql<number>`count(*)` })
    .from(friendship)
    .where(eq(friendship.userId, userId))
  if ((mine?.count ?? 0) >= MAX_FRIENDS) {
    return { status: 409, say: `You have ${MAX_FRIENDS} friends, which is the limit.` }
  }

  await db.batch([
    db.insert(friendship).values({ userId, friendId: owner.id }).onConflictDoNothing(),
    db.insert(friendship).values({ userId: owner.id, friendId: userId }).onConflictDoNothing(),
  ])

  const [them] = await db.select({ name: user.name }).from(user).where(eq(user.id, owner.id))
  return { id: owner.id, name: them?.name ?? 'Someone', since: Date.now() }
}

/** Your friends, names included, which needs the join onto the generated user table. */
export async function listFriends(db: DB, userId: string): Promise<Friend[]> {
  const rows = await db
    .select({ id: friendship.friendId, since: friendship.createdAt, name: user.name })
    .from(friendship)
    .innerJoin(user, eq(user.id, friendship.friendId))
    .where(eq(friendship.userId, userId))

  return rows.map((one) => ({ id: one.id, name: one.name, since: one.since.getTime() }))
}

/** Either side can, and it takes both rows. */
export async function unfriend(db: DB, userId: string, friendId: string): Promise<boolean> {
  const result = await db.batch([
    db
      .delete(friendship)
      .where(and(eq(friendship.userId, userId), eq(friendship.friendId, friendId))),
    db
      .delete(friendship)
      .where(and(eq(friendship.userId, friendId), eq(friendship.friendId, userId))),
  ])
  const changed = (result as { meta?: { changes?: number } }[])[0]?.meta?.changes
  return changed !== 0
}

/**
 * One friend's published builds.
 *
 * **The friendship is checked before anything is read**, and a stranger gets
 * the same 404 as a friend with nothing published. Answering differently would
 * turn this into a way to ask whether a given account exists.
 */
export async function buildsOfFriend(
  db: DB,
  userId: string,
  friendId: string,
): Promise<{ id: string; name: string; createdAt: number }[] | null> {
  const [link] = await db
    .select({ friendId: friendship.friendId })
    .from(friendship)
    .where(and(eq(friendship.userId, userId), eq(friendship.friendId, friendId)))
  if (!link) return null

  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      createdAt: publishedBuild.createdAt,
    })
    .from(publishedBuild)
    /* These two are shelves under another name, so a build the author has taken
       down leaves them the same way it leaves the exchange. */
    .where(and(eq(publishedBuild.userId, friendId), isNull(publishedBuild.takenDownAt)))

  return rows.map((one) => ({ ...one, createdAt: one.createdAt.getTime() }))
}

/**
 * Everything your friends have published, newest first.
 *
 * One query rather than one per friend, because a list of twenty friends should
 * not be twenty round trips to D1 on the free tier's row budget.
 */
export async function friendsFeed(
  db: DB,
  userId: string,
): Promise<{ id: string; name: string; by: string; createdAt: number }[]> {
  const friends = await db
    .select({ id: friendship.friendId })
    .from(friendship)
    .where(eq(friendship.userId, userId))
  if (!friends.length) return []

  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      by: user.name,
      createdAt: publishedBuild.createdAt,
    })
    .from(publishedBuild)
    .innerJoin(user, eq(user.id, publishedBuild.userId))
    .where(
      and(
        inArray(
          publishedBuild.userId,
          friends.map((one) => one.id),
        ),
        isNull(publishedBuild.takenDownAt),
      ),
    )

  return rows
    .map((one) => ({ ...one, createdAt: one.createdAt.getTime() }))
    .sort((a, b) => b.createdAt - a.createdAt)
}
