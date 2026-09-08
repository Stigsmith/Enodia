/**
 * The build exchange: builds other people published, and what happened to them.
 *
 * ## Four shelves
 *
 * - **All**, everything published and still up. Public.
 * - **From friends**, people whose code you swapped one at a time.
 * - **Mine**, your own listings, taken-down ones included.
 * - **Followed**, the builds you took up, taken-down ones included.
 *
 * **There was a fifth and it is gone.** A curated shelf held builds the owner
 * had picked by hand, each with a note saying why, and it was the default and
 * the only thing a stranger could see. It made sense while there was no way to
 * browse: somebody had to have read anything a stranger landed on. Once All
 * opened, curation was a second answer to a question that already had one, and
 * the owner's call is that people find what they want themselves. The table,
 * the route and the one owner-gated endpoint in this API went with it.
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

import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { exchangeStat, friendship, publishedBuild } from './schema-app.ts'
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
  /**
   * Whether the person asking published it.
   *
   * **A boolean, computed here, and never the id.** The screen needs to know so
   * it can say "this one is yours" rather than offering to follow you back to
   * yourself, and `worker/exchange.test.ts` pins that user ids do not go over
   * the wire. Answering the question without shipping the identity is the whole
   * shape of this field.
   *
   * Absent when nobody is signed in, because there is then nobody for it to be
   * true of.
   */
  mine?: boolean
  /**
   * Whether the author has taken it off the shelves.
   *
   * Only ever present on the Mine shelf, and always false everywhere else,
   * because every other shelf filters these rows out entirely. It exists for
   * the same reason `listMine` does not filter them: a listing its author
   * cannot see is one they cannot put back.
   */
  takenDown?: boolean
  stats: Stats
  /**
   * What earlier versions of this build earned, when there is anything.
   *
   * Present only when the author has replaced the picks and somebody had
   * already played or rated what was there before. Absent is the normal case
   * and means there is nothing to say, which is why it is optional rather than
   * a row of zeroes: `Counted` already refuses to draw those, and a listing
   * claiming "0 from before" would be a verdict on a build nobody changed.
   *
   * **No `players` and no `takes`**, for two different reasons.
   *
   * `players` is a distinct-people claim, and folding several versions together
   * would count somebody who played two of them twice.
   *
   * `takes` is not here because a follow is a fact about the **listing** rather
   * than about a version of it. Somebody following a build goes on following it
   * when the author replaces the picks, which is the whole difference between
   * following and copying, so their follow is counted once and stays current.
   * It used to fold into here, and on the live site a listing whose entire
   * history was one follow therefore said "Nothing logged since the author
   * changed this build" about a build nobody had knowingly changed.
   */
  before?: Omit<Stats, 'players' | 'takes'>
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
type Tally = {
  buildId: string
  shape: string
  takes: number
  players: number
  runs: number
  clears: number
  bestFear: number | null
  ratingSum: number | null
  raters: number
}

async function statsFor(db: DB, ids: string[]): Promise<Tally[]> {
  if (ids.length === 0) return []

  const rows = await db
    .select({
      buildId: exchangeStat.buildId,
      shape: exchangeStat.shape,
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
    /* By version as well as by build, which is still one query for the page.
       The caller decides which group is current, because only it knows what
       shape each build is in now. */
    .groupBy(exchangeStat.buildId, exchangeStat.shape)

  return rows.map((row) => ({
    buildId: row.buildId,
    shape: row.shape,
    takes: Number(row.takes ?? 0),
    players: Number(row.players ?? 0),
    runs: Number(row.runs ?? 0),
    clears: Number(row.clears ?? 0),
    bestFear: row.bestFear === null ? null : Number(row.bestFear),
    ratingSum: row.ratingSum === null ? null : Number(row.ratingSum),
    raters: Number(row.raters ?? 0),
  }))
}

/** The mean, to one place, or null. Never shown without `raters` beside it. */
const mean = (sum: number | null, raters: number): number | null =>
  raters && sum ? Math.round((sum / raters) * 10) / 10 : null

/** One version's tally, as counts. */
const countsOf = (t: Tally): Stats => ({
  takes: t.takes,
  players: t.players,
  runs: t.runs,
  clears: t.clears,
  bestFear: t.bestFear,
  rating: mean(t.ratingSum, t.raters),
  raters: t.raters,
})

/**
 * What earlier versions earned, added up. Play only.
 *
 * **Takes are not in here**, and leaving them out is what stops a listing whose
 * only history is a follow from claiming its author changed it. See
 * `Listing.before`; the short version is that a follow is about the listing and
 * survives a republish, so it is counted once, currently, and is never evidence
 * that something was superseded.
 */
function foldBefore(tallies: Tally[]): Omit<Stats, 'players' | 'takes'> | undefined {
  if (!tallies.length) return undefined
  const runs = tallies.reduce((n, t) => n + t.runs, 0)
  const clears = tallies.reduce((n, t) => n + t.clears, 0)
  const raters = tallies.reduce((n, t) => n + t.raters, 0)
  const sum = tallies.reduce((n, t) => n + (t.ratingSum ?? 0), 0)
  const fears = tallies.map((t) => t.bestFear).filter((f): f is number => f !== null)
  if (!runs && !clears && !raters && !fears.length) return undefined
  return {
    runs,
    clears,
    bestFear: fears.length ? Math.max(...fears) : null,
    rating: mean(sum || null, raters),
    raters,
  }
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
    userId?: string | null
    shape?: string
    takenDownAt?: Date | number | null
  }[],
  viewer?: string | null,
): Promise<Listing[]> {
  const tallies = await statsFor(db, rows.map((row) => row.id))
  return rows.map((row) => {
    const mine = tallies.filter((t) => t.buildId === row.id)
    const now = row.shape ?? ''
    const current = mine.find((t) => t.shape === now)
    const before = foldBefore(mine.filter((t) => t.shape !== now))
    /* Every version's, not the current one's. A follower of this listing is a
       follower of this listing, whichever version they arrived at, and the row
       that records them is never rewritten when the author republishes. */
    const takes = mine.reduce((n, t) => n + t.takes, 0)
    return {
      id: row.id,
      name: row.name,
      payload: row.payload,
      // A published build always has an author row; the left join is what makes
      // the type nullable rather than anything that happens.
      by: row.by ?? 'Somebody',
      createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
      ...(viewer && row.userId ? { mine: row.userId === viewer } : {}),
      /* Absent rather than false on the shelves that filter these out, so the
         field means "this shelf tracks it" rather than "this one is live". */
      ...(row.takenDownAt === undefined ? {} : { takenDown: row.takenDownAt !== null }),
      stats: { ...(current ? countsOf(current) : NONE), takes },
      ...(before ? { before } : {}),
    }
  })
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
      shape: publishedBuild.shape,
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
 * Everything anybody published, which this file spent a year calling impossible,
 * and which is now the shelf a stranger lands on.
 *
 * The reasoning it used to carry was real: an everything shelf is the first
 * thing a stranger can stumble across, and `REQUIREMENTS.md` 5 wanted a way to
 * report a listing and a way to hide one before that happened. The owner has
 * decided to open it without them, and the honest version of the argument is
 * narrower than the old comment made it sound. A listing carries a build's name
 * and its author's display name and no free text a stranger wrote. The only
 * removal lever is the author taking their own listing down. If a hide is ever
 * needed it is a nullable column and one more clause in this `where`, because
 * every shelf reads through this file.
 *
 * Two things pushed it open. Your own listings appeared on no shelf at all, so
 * the app that published them could not show them back to you. And the curated
 * shelf that used to stand here was one person reading everything, which is not
 * a thing that scales past one person.
 */
export async function everything(db: DB, viewer?: string | null): Promise<Listing[]> {
  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      payload: publishedBuild.payload,
      by: user.name,
      userId: publishedBuild.userId,
      createdAt: publishedBuild.createdAt,
      shape: publishedBuild.shape,
    })
    .from(publishedBuild)
    .leftJoin(user, eq(publishedBuild.userId, user.id))
    .where(isNull(publishedBuild.takenDownAt))
    .orderBy(desc(publishedBuild.createdAt))
    .limit(PAGE)

  return withStats(db, rows, viewer)
}

/**
 * The builds you took up.
 *
 * **The server already knows.** `exchange_stat.taken_at` records the moment
 * somebody started following a listing, so this needs no new column and no list
 * kept on the client: it is the rows that are yours and have a `taken_at`.
 *
 * Like `myShelf` and unlike everything else, **taken-down listings stay on it**.
 * A build you follow goes on working when its author withdraws it: it is still
 * in your library and the link still opens. Hiding it here would make it
 * disappear from the exchange with no explanation, when the useful thing to say
 * is that it is off the shelves and still yours.
 *
 * Nothing on this shelf can be your own, because `take` refuses your own build.
 * `mine` is passed anyway so every shelf answers the same question the same way.
 */
export async function followedByYou(db: DB, userId: string): Promise<Listing[]> {
  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      payload: publishedBuild.payload,
      by: user.name,
      userId: publishedBuild.userId,
      createdAt: publishedBuild.createdAt,
      shape: publishedBuild.shape,
      takenDownAt: publishedBuild.takenDownAt,
    })
    .from(exchangeStat)
    .innerJoin(publishedBuild, eq(publishedBuild.id, exchangeStat.buildId))
    .leftJoin(user, eq(publishedBuild.userId, user.id))
    .where(and(eq(exchangeStat.userId, userId), isNotNull(exchangeStat.takenAt)))
    .orderBy(desc(exchangeStat.takenAt))
    .limit(PAGE)

  return withStats(db, rows, userId)
}

/**
 * Your own listings, which is an inventory rather than a shelf to browse.
 *
 * **Taken-down rows are listed rather than filtered**, which is the one place
 * that rule is inverted and it is the same argument `listMine` makes in
 * `publish.ts`: a listing its author cannot see is one it cannot put back. It
 * also reaches the case nothing else could, a listing whose local build is gone
 * because it was deleted or published from a browser that no longer exists.
 * Until this shelf existed such a listing could be neither updated nor removed
 * from anywhere in the app, while still holding one of the hundred slots.
 *
 * `mine` is true on every row here by construction. It is computed anyway, so
 * the screen can read one field on every shelf rather than knowing which shelf
 * it is looking at.
 */
export async function myShelf(db: DB, userId: string): Promise<Listing[]> {
  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      payload: publishedBuild.payload,
      by: user.name,
      userId: publishedBuild.userId,
      createdAt: publishedBuild.createdAt,
      shape: publishedBuild.shape,
      takenDownAt: publishedBuild.takenDownAt,
    })
    .from(publishedBuild)
    .leftJoin(user, eq(publishedBuild.userId, user.id))
    .where(eq(publishedBuild.userId, userId))
    .orderBy(desc(publishedBuild.createdAt))
    .limit(PAGE)

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
): Promise<{ userId: string | null; shape: string } | null> {
  const [row] = await db
    .select({ userId: publishedBuild.userId, shape: publishedBuild.shape })
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
      shape: publishedBuild.shape,
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
    insert into exchange_stat (build_id, user_id, shape, taken_at, updated)
    values (${buildId}, ${userId}, ${found.shape}, ${Date.now()}, ${Date.now()})
    on conflict(build_id, user_id, shape) do update set
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
  /**
   * The shape the player was holding, or absent from an older client.
   *
   * Absent is treated as the current shape rather than as a stale one: a client
   * that does not send this cannot be wrong about it, and refusing its runs
   * would punish somebody for not having reloaded the page.
   */
  shape?: string,
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

  /**
   * A run against a version the author has replaced is answered and not counted.
   *
   * The same quiet ok the author's own run gets, and for the same reason: the
   * run happened, it is real, and it is recorded in that player's own library.
   * What must not happen is it moving a number a stranger reads as evidence
   * about a build it was not run against. This is what stops a follower who has
   * not taken an update yet from feeding the new version's counts.
   *
   * **An empty stored token is not a version, so it cannot be a stale one.**
   * `publishBuild` sent no `shape` while `republishBuild` sent one, so every
   * listing published and never replaced holds `''`, the player's browser sent
   * its real fingerprint, and every run against one was dropped right here.
   * Takes still counted, which is what made the exchange look like it worked.
   *
   * That is the same argument the parameter's own docblock makes about a client
   * too old to send a token: something that never stated a version cannot be
   * wrong about which one it is holding. The client half is fixed, and this is
   * what stops the listings already published from sitting at zero until their
   * authors happen to replace them.
   */
  if (found.shape !== '' && shape !== undefined && shape !== found.shape) return { ok: true }

  const raise = cleared && fear !== null ? fear : null

  await db.run(sql`
    insert into exchange_stat (build_id, user_id, shape, runs, clears, best_fear, updated)
    values (${buildId}, ${userId}, ${found.shape}, 1, ${cleared ? 1 : 0}, ${raise}, ${Date.now()})
    on conflict(build_id, user_id, shape) do update set
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

  /**
   * The run has to be against the version being rated.
   *
   * Scoped to the current shape rather than to the build, so after an author
   * replaces the picks you play the new build before you can rate it. That is
   * what makes the reset mean something: without it, the first person to rate a
   * changed build would be rating it on the strength of runs against the one it
   * replaced.
   */
  const [mine] = await db
    .select({ runs: exchangeStat.runs })
    .from(exchangeStat)
    .where(
      and(
        eq(exchangeStat.buildId, buildId),
        eq(exchangeStat.userId, userId),
        eq(exchangeStat.shape, found.shape),
      ),
    )
    .limit(1)

  if (!mine || mine.runs < 1) {
    return { status: 409, say: 'Log a run against this build before rating it.' }
  }

  await db
    .update(exchangeStat)
    .set({ rating, updated: Date.now() })
    .where(
      and(
        eq(exchangeStat.buildId, buildId),
        eq(exchangeStat.userId, userId),
        eq(exchangeStat.shape, found.shape),
      ),
    )

  return { ok: true }
}

