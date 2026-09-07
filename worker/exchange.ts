/**
 * The build exchange: builds other people published, and what happened to them.
 *
 * ## Two shelves, and why not a third yet
 *
 * `REQUIREMENTS.md` 5 requires moderation before anything discoverable, and this
 * would be the first discoverable thing the tool has. So both shelves are ones
 * a human already stood in front of:
 *
 * - **Picked**, the owner's own choices, each signed and saying why.
 * - **From friends**, people whose code you swapped one at a time.
 *
 * Neither is discovery. `worker/friends.ts` makes the same argument about the
 * friends list, and this inherits it. An **everything** shelf is the obvious
 * third and is deliberately absent: it needs a way to report a listing and a way
 * for the owner to hide one, and those do not exist. The UI says so rather than
 * quietly offering two shelves as though they were the whole thing.
 *
 * ## The server still has no opinion about what a build is
 *
 * `worker/publish.ts` says it and it stays true here. A listing hands back the
 * packed payload exactly as it was stored, and the browser unpacks it and runs
 * its own filters over it. Nothing on this side parses a build, so a change to
 * the build format is not a migration and a boon this deployment has never heard
 * of is not an error.
 *
 * That costs bytes rather than correctness: a packed build is around 1.2 KB, so
 * a page of sixty is roughly 70 KB. The 16 KB cap in `publish.ts` is a ceiling
 * nothing real approaches.
 *
 * ## Counts, never a score
 *
 * Everything read out of `exchange_stat` is aggregated and handed over as
 * counts. There is no ranking, no weighting and no composite. See the table's
 * own docblock for why: the tool has committed to not saying whether a build is
 * good, and a single number would be exactly that claim wearing arithmetic.
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { curatedPick, exchangeStat, friendship, publishedBuild } from './schema-app.ts'
import * as schema from './schema.ts'
import { user } from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

export type Refusal = { status: number; say: string }

/** What a build looks like on a shelf. `payload` is packed and unread here. */
export type Listing = {
  id: string
  name: string
  payload: string
  by: string
  createdAt: number
  /** The owner's note, when this came off the picked shelf. */
  note?: string
  /**
   * Whether the person asking published it.
   *
   * **A boolean, computed here, and never the id.** The screen needs to know so
   * it can say "this one is yours" rather than offering to follow you back to
   * yourself, and `worker/exchange.test.ts` pins that user ids do not go over
   * the wire. Answering the question without shipping the identity is the whole
   * shape of this field.
   *
   * Absent on the picked shelf when nobody is signed in, because there is then
   * nobody for it to be true of.
   */
  mine?: boolean
  stats: Stats
}

/** Counted facts. Every one of these is a tally, and none is a judgement. */
export type Stats = {
  /** How many people took a copy. */
  takes: number
  /** How many people have logged at least one run. */
  players: number
  runs: number
  clears: number
  /** The highest Fear anybody cleared it at, or null. */
  bestFear: number | null
  /** The mean, and how many it is a mean of. Both, always. */
  rating: number | null
  raters: number
}

const NONE: Stats = {
  takes: 0,
  players: 0,
  runs: 0,
  clears: 0,
  bestFear: null,
  rating: null,
  raters: 0,
}

/** A page, so one call cannot ask for the whole shelf. */
const PAGE = 60

/**
 * Aggregate the stat rows for a set of builds, in one query.
 *
 * One round trip for the page rather than one per build: a shelf of sixty would
 * otherwise be sixty queries against D1's row budget, which is the same argument
 * `friends.ts` makes about not looping over friends.
 *
 * **Nothing here returns a user id.** The identity in `exchange_stat` exists to
 * make the counts arithmetic rather than to be reported, and a function that
 * could leak it is a function somebody will eventually call.
 */
async function statsFor(db: DB, ids: string[]): Promise<Map<string, Stats>> {
  const found = new Map<string, Stats>()
  if (ids.length === 0) return found

  const rows = await db
    .select({
      buildId: exchangeStat.buildId,
      takes: sql<number>`sum(case when ${exchangeStat.takenAt} is not null then 1 else 0 end)`,
      players: sql<number>`sum(case when ${exchangeStat.runs} > 0 then 1 else 0 end)`,
      runs: sql<number>`coalesce(sum(${exchangeStat.runs}), 0)`,
      clears: sql<number>`coalesce(sum(${exchangeStat.clears}), 0)`,
      bestFear: sql<number | null>`max(${exchangeStat.bestFear})`,
      ratingSum: sql<number | null>`sum(${exchangeStat.rating})`,
      raters: sql<number>`sum(case when ${exchangeStat.rating} is not null then 1 else 0 end)`,
    })
    .from(exchangeStat)
    .where(inArray(exchangeStat.buildId, ids))
    .groupBy(exchangeStat.buildId)

  for (const row of rows) {
    found.set(row.buildId, {
      takes: Number(row.takes ?? 0),
      players: Number(row.players ?? 0),
      runs: Number(row.runs ?? 0),
      clears: Number(row.clears ?? 0),
      bestFear: row.bestFear === null ? null : Number(row.bestFear),
      /* Rounded to one place, and never shown without `raters` beside it. An
       * average of two is a different thing from an average of two hundred and
       * the reader has to be able to tell. */
      rating:
        row.raters && row.ratingSum
          ? Math.round((Number(row.ratingSum) / Number(row.raters)) * 10) / 10
          : null,
      raters: Number(row.raters ?? 0),
    })
  }
  return found
}

/**
 * Attach counts to rows that already have their build and author.
 *
 * `viewer` is who is asking, so a row can say whether it is theirs. The id is
 * compared here and never returned: `Listing` carries a boolean, and the test
 * at `exchange.test.ts` that pins user ids off the wire is the reason.
 */
async function withStats(
  db: DB,
  rows: {
    id: string
    name: string
    payload: string
    by: string | null
    createdAt: Date | number
    note?: string
    userId?: string | null
  }[],
  viewer?: string | null,
): Promise<Listing[]> {
  const stats = await statsFor(db, rows.map((row) => row.id))
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    payload: row.payload,
    // A published build always has an author row; the left join is what makes
    // the type nullable rather than anything that happens.
    by: row.by ?? 'Somebody',
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
    ...(row.note === undefined ? {} : { note: row.note }),
    ...(viewer && row.userId ? { mine: row.userId === viewer } : {}),
    stats: stats.get(row.id) ?? NONE,
  }))
}

/**
 * The owner's shelf. Public, and the only one a signed-out reader can see.
 *
 * Picked builds are chosen one at a time by a person, so showing them to
 * everybody does not cross the line `REQUIREMENTS.md` 5 draws: there is nothing
 * here that arrived without being read.
 */
export async function picked(db: DB, viewer?: string | null): Promise<Listing[]> {
  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      payload: publishedBuild.payload,
      by: user.name,
      userId: publishedBuild.userId,
      createdAt: publishedBuild.createdAt,
      note: curatedPick.note,
      at: curatedPick.at,
    })
    .from(curatedPick)
    .innerJoin(publishedBuild, eq(curatedPick.buildId, publishedBuild.id))
    .leftJoin(user, eq(publishedBuild.userId, user.id))
    /* A build the author has taken down leaves every shelf, and this is the
       one that matters most: the curated shelf is the one a stranger lands on.
       The pick itself is left alone rather than deleted, so putting the build
       back brings the note with it. */
    .where(isNull(publishedBuild.takenDownAt))
    .orderBy(desc(curatedPick.at))
    .limit(PAGE)

  return withStats(db, rows, viewer)
}

/**
 * What the people you added have published.
 *
 * The same shape as `friendsFeed` in `friends.ts` and the same membership rule.
 * It carries the payload and the counts, which that one does not, because this
 * is a shelf to browse rather than a list of links.
 */
export async function fromFriends(db: DB, userId: string): Promise<Listing[]> {
  const mine = await db
    .select({ friendId: friendship.friendId })
    .from(friendship)
    .where(eq(friendship.userId, userId))

  const ids = mine.map((row) => row.friendId)
  if (ids.length === 0) return []

  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      payload: publishedBuild.payload,
      by: user.name,
      userId: publishedBuild.userId,
      createdAt: publishedBuild.createdAt,
    })
    .from(publishedBuild)
    .leftJoin(user, eq(publishedBuild.userId, user.id))
    .where(and(inArray(publishedBuild.userId, ids), isNull(publishedBuild.takenDownAt)))
    .orderBy(desc(publishedBuild.createdAt))
    .limit(PAGE)

  /* Never true on this shelf: self-friendship is refused in `friends.ts`, so
     nothing here can be yours. Passed anyway so the two shelves answer the
     same question the same way. */
  return withStats(db, rows, userId)
}

/**
 * Take a copy, which is the one thing an exchange is for.
 *
 * Records that this person took it and hands back the payload. The copy itself
 * is made in the browser by the existing fork path, which gives it a new id and
 * drops the play record: `state/builds.ts` explains why inheriting somebody
 * else's twelve runs would have the record lying on its first day.
 *
 * Taking twice is not two takes. The row already exists, so `takenAt` is left
 * where it was: the first time is the honest answer to "when did you take this".
 */
/**
 * Whose build it is, for the three routes that must not count an author's own.
 *
 * **None of them checked.** `take`, `played` and `rate` all read the row to
 * prove it exists and none compared its `userId` to the caller, so publishing a
 * build and then taking, playing and rating it moved its own public numbers.
 * The owner found the first half of that by taking copies of their own build.
 */
/**
 * **It returns the row rather than the id**, so "no such build" cannot be
 * confused with "no author".
 *
 * It used to answer `row?.userId ?? null`, which folds those two together. The
 * column is `not null` today so they cannot both happen, but the two callers
 * were already reading that fold in opposite directions: `played` treated null
 * as gone and 404'd, while `rate` compared null to the caller, found them
 * unequal and carried on. That is two routes disagreeing about whether a build
 * exists, waiting for the column to become nullable.
 *
 * Which it nearly did: see `schema-app.ts` on why the rebuild that would have
 * made it nullable was reverted. Keeping this shape means the day that change
 * is made properly, it is one column and not a hunt for callers.
 *
 * `rate` gained the missing-build branch here too. Without it a rating against
 * an id that does not exist fell through to the run gate and answered "log a
 * run against this build before rating it", about a build there is nothing to
 * log a run against.
 */
async function authorOf(
  db: DB,
  buildId: string,
): Promise<{ userId: string | null } | null> {
  const [row] = await db
    .select({ userId: publishedBuild.userId })
    .from(publishedBuild)
    .where(eq(publishedBuild.id, buildId))
    .limit(1)
  return row ?? null
}

export async function take(
  db: DB,
  userId: string,
  buildId: string,
): Promise<{ payload: string; name: string } | Refusal> {
  const [found] = await db
    .select({
      payload: publishedBuild.payload,
      name: publishedBuild.name,
      userId: publishedBuild.userId,
      takenDownAt: publishedBuild.takenDownAt,
    })
    .from(publishedBuild)
    .where(eq(publishedBuild.id, buildId))
    .limit(1)

  /**
   * Gone and taken down answer the same way, and that is right here.
   *
   * `take` starts a new relationship with a build, and taking one down is the
   * author saying no new ones. It reads differently from `read`, which keeps
   * answering: that route serves people who already have the link, and this one
   * hands out a copy to somebody who does not.
   */
  if (!found || found.takenDownAt !== null) {
    return { status: 404, say: 'That build is not there any more.' }
  }

  /**
   * Your own build is already yours.
   *
   * Refused rather than allowed-and-uncounted, because the copy is the thing
   * that was wrong: it put a second build in your library named after the
   * first, and doing it again made a third. The payload is still readable
   * through `/api/b/<id>`, which is the route for reading one.
   */
  if (found.userId === userId) {
    return { status: 409, say: 'That build is yours. It is already in your library.' }
  }

  await db.run(sql`
    insert into exchange_stat (build_id, user_id, taken_at, updated)
    values (${buildId}, ${userId}, ${Date.now()}, ${Date.now()})
    on conflict(build_id, user_id) do update set
      taken_at = coalesce(exchange_stat.taken_at, excluded.taken_at),
      updated = excluded.updated
  `)

  return found
}

/**
 * A run, reported against the build a copy came from.
 *
 * The browser decides whether to call this at all: it does so only while the
 * copy still matches what was taken, which is what stops a heavily edited build
 * reporting runs about somebody else's work. `src/state/exchange.ts` holds that
 * check, because only the browser can pack a build and compare.
 *
 * Fear rises only on a clear, matching `LogRun.tsx`. Dying at Fear 30 is not
 * clearing Fear 30.
 */
export async function played(
  db: DB,
  userId: string,
  buildId: string,
  cleared: boolean,
  fear: number | null,
): Promise<{ ok: true } | Refusal> {
  const found = await authorOf(db, buildId)
  if (!found) return { status: 404, say: 'That build is not there any more.' }

  /**
   * An author's own runs do not count toward their own build.
   *
   * Quietly, with an ok. The run happened and it is recorded in their library;
   * what must not happen is it moving the number a stranger reads as evidence.
   * A refusal would make `LogRun` show an error for something the player did
   * nothing wrong in doing.
   */
  if (found.userId === userId) return { ok: true }

  const raise = cleared && fear !== null ? fear : null

  await db.run(sql`
    insert into exchange_stat (build_id, user_id, runs, clears, best_fear, updated)
    values (${buildId}, ${userId}, 1, ${cleared ? 1 : 0}, ${raise}, ${Date.now()})
    on conflict(build_id, user_id) do update set
      runs = exchange_stat.runs + 1,
      clears = exchange_stat.clears + ${cleared ? 1 : 0},
      best_fear = max(coalesce(exchange_stat.best_fear, 0), coalesce(excluded.best_fear, 0)),
      updated = excluded.updated
  `)

  return { ok: true }
}

/**
 * Rate a build, which requires having played it.
 *
 * **The gate is the point.** Tying the opinion to a logged run kills drive-by
 * voting without any separate anti-abuse machinery, and it means a rating is
 * always somebody reporting on something they did rather than on something they
 * read. The cost is real and worth naming: ratings will be sparse for a long
 * time, which is why the count is shown beside the average and never hidden.
 */
export async function rate(
  db: DB,
  userId: string,
  buildId: string,
  rating: number,
): Promise<{ ok: true } | Refusal> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: 400, say: 'A rating is one to five.' }
  }

  const found = await authorOf(db, buildId)
  /* Missing answers the same way it does in `played`, rather than falling
     through to the run gate and telling somebody to log a run against a build
     that is not there. */
  if (!found) return { status: 404, say: 'That build is not there any more.' }
  if (found.userId === userId) {
    return { status: 409, say: 'You cannot rate your own build.' }
  }

  const [mine] = await db
    .select({ runs: exchangeStat.runs })
    .from(exchangeStat)
    .where(and(eq(exchangeStat.buildId, buildId), eq(exchangeStat.userId, userId)))
    .limit(1)

  if (!mine || mine.runs < 1) {
    return { status: 409, say: 'Log a run against this build before rating it.' }
  }

  await db
    .update(exchangeStat)
    .set({ rating, updated: Date.now() })
    .where(and(eq(exchangeStat.buildId, buildId), eq(exchangeStat.userId, userId)))

  return { ok: true }
}

/**
 * Put a build on the picked shelf, or take it off. The owner only.
 *
 * Gated on a single account id from the environment rather than a role column,
 * because there is exactly one curator and a table of one row is a table to keep
 * in step. If that stops being true, this is the function to change.
 */
export async function pick(
  db: DB,
  buildId: string,
  note: string | null,
): Promise<{ ok: true } | Refusal> {
  if (note === null) {
    await db.delete(curatedPick).where(eq(curatedPick.buildId, buildId))
    return { ok: true }
  }

  const said = note.trim()
  if (!said) return { status: 400, say: 'A pick says why it is a pick.' }
  if (said.length > 280) return { status: 400, say: 'That note is too long.' }

  /* A build the author has taken down is not one to put on the shelf, and the
     existing sentence covers it without a second one: from the curator's side
     there is nothing there to pick. */
  const [found] = await db
    .select({ id: publishedBuild.id })
    .from(publishedBuild)
    .where(and(eq(publishedBuild.id, buildId), isNull(publishedBuild.takenDownAt)))
    .limit(1)

  if (!found) return { status: 404, say: 'There is no such build to pick.' }

  await db.run(sql`
    insert into curated_pick (build_id, note, at)
    values (${buildId}, ${said}, ${Date.now()})
    on conflict(build_id) do update set note = excluded.note
  `)

  return { ok: true }
}
