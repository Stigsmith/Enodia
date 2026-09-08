/**
 * Leaderboards: the counts the exchange already keeps, put beside each other.
 *
 * ## One query, and why that was worth the trouble
 *
 * Twelve boards could have been twelve `order by ... limit 10` statements, which
 * is the obvious shape and is twelve round trips to D1 for one screen. Instead
 * `scan` reads every live listing once with its current-version counts attached,
 * and every board is a sort over that array. At this size the difference is
 * academic; the reason to write it this way is that the free tier bills rows
 * read, and a screen that costs one query stays affordable at a size where
 * twelve would not.
 *
 * The cost is a ceiling: `SCAN` listings, newest first. Named rather than left
 * implicit, because a board quietly built from a truncated set is a board that
 * is wrong without saying so.
 *
 * ## Counts, and the rule that survived
 *
 * `worker/exchange.ts` says everything out of `exchange_stat` is a tally and
 * never a score. A leaderboard is a ranking, so that sentence needed narrowing
 * rather than ignoring, and the narrower rule is: **order by one counted column,
 * never combine columns into a score.**
 *
 * That is why there are no rate boards. A clear rate reads as a quality
 * ranking and is not one: five clears from five runs would beat ninety from a
 * hundred, and the board would be saying the first build is better when what it
 * has is less evidence. Counts do not make that claim. The owner's call, and it
 * is the same principle one step further on.
 *
 * ## Whose counts these are
 *
 * `exchange_stat.user_id` is the **player**, and it never leaves: no board
 * groups by it, and `worker/exchange.test.ts` pins that user ids stay off the
 * wire. The person boards group by `published_build.user_id`, the **author**,
 * and return `user.name`, which already travels on every listing as
 * `Listing.by`. Who played what stays private; whose build it is was never
 * private.
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { buildFacet, exchangeStat, friendship, publishedBuild } from './schema-app.ts'
import * as schema from './schema.ts'
import { user } from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

/**
 * How many listings a board is built from, newest first.
 *
 * Generous by a wide margin at the size this runs at, and the number to delete
 * rather than raise when it stops being: the replacement is per-board SQL with
 * its own `order by` and `limit`, at the cost of one query each.
 */
const SCAN = 2000

/** Rows per board. Enough to be a board, few enough to read at a glance. */
const TOP = 10

/** Whose listings a board is built from. */
export type Scope = 'global' | 'friends'

export type BoardRow = {
  /** The listing, when the row is a build. Absent on a person board. */
  id?: string
  /** The build's name, or the person's display name. */
  name: string
  /** Who published it. Only on a build board. */
  by?: string
  count: number
}

export type Board = {
  id: string
  title: string
  /** What `count` counts, singular. The screen pluralises. */
  unit: string
  /**
   * How to read a row.
   *
   * `facet` rows carry a token rather than a name, and the browser turns it
   * into something legible through `src/state/facets.ts`. This server has no
   * idea what one says, which is the whole point of the arrangement.
   */
  kind: 'build' | 'person' | 'facet'
  rows: BoardRow[]
}

/** One live listing with its current version's counts. */
type Scanned = {
  id: string
  name: string
  by: string
  userId: string
  revision: number
  createdAt: number
  takes: number
  runs: number
  clears: number
  bestFear: number | null
}

/**
 * Every live listing, with the counts for the version that is current.
 *
 * **Joined on the shape as well as the id**, which is what makes a board agree
 * with the card it came from: `withStats` shows the current version's tally and
 * folds the rest into `before`, so a board summing every version would print a
 * number the listing itself does not show. A build nobody has touched still
 * appears, at zero, because the join is a left join.
 */
async function scan(db: DB, scope: Scope, viewer: string | null): Promise<Scanned[]> {
  const who = scope === 'friends' ? await circle(db, viewer) : null
  if (who !== null && who.length === 0) return []

  const rows = await db
    .select({
      id: publishedBuild.id,
      name: publishedBuild.name,
      by: user.name,
      userId: publishedBuild.userId,
      revision: publishedBuild.revision,
      createdAt: publishedBuild.createdAt,
      takes: sql<number>`sum(case when ${exchangeStat.takenAt} is not null then 1 else 0 end)`,
      runs: sql<number>`coalesce(sum(${exchangeStat.runs}), 0)`,
      clears: sql<number>`coalesce(sum(${exchangeStat.clears}), 0)`,
      bestFear: sql<number | null>`max(${exchangeStat.bestFear})`,
    })
    .from(publishedBuild)
    .leftJoin(user, eq(publishedBuild.userId, user.id))
    .leftJoin(
      exchangeStat,
      and(
        eq(exchangeStat.buildId, publishedBuild.id),
        eq(exchangeStat.shape, publishedBuild.shape),
      ),
    )
    .where(
      who === null
        ? isNull(publishedBuild.takenDownAt)
        : and(isNull(publishedBuild.takenDownAt), inArray(publishedBuild.userId, who)),
    )
    .groupBy(publishedBuild.id)
    .orderBy(desc(publishedBuild.createdAt))
    .limit(SCAN)

  return rows.map((row) => ({
    ...row,
    // A published build always has an author row; the left join is what makes
    // the type nullable rather than anything that happens.
    by: row.by ?? 'Somebody',
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
    takes: Number(row.takes ?? 0),
    runs: Number(row.runs ?? 0),
    clears: Number(row.clears ?? 0),
    bestFear: row.bestFear === null ? null : Number(row.bestFear),
  }))
}

/**
 * You and the people whose codes you swapped.
 *
 * **Yourself included**, which is a decision rather than an oversight: a board
 * of your circle that leaves you off it cannot answer the question somebody
 * opens it to ask, which is where they stand among the people they know.
 */
async function circle(db: DB, viewer: string | null): Promise<string[]> {
  if (!viewer) return []
  const rows = await db
    .select({ id: friendship.friendId })
    .from(friendship)
    .where(eq(friendship.userId, viewer))
  return [viewer, ...rows.map((row) => row.id)]
}

/**
 * How many live listings carry each facet token.
 *
 * A second query, and it has to be: the facets live one row per token per
 * build, so joining them into `scan` would multiply every listing by its own
 * facet count and every sum in it would come back wrong. Two small queries beat
 * one clever one that needs a comment explaining why the numbers are right.
 *
 * **Grouped by a column this server never reads.** The tokens go out exactly as
 * they came in and the browser does the naming.
 */
async function facets(db: DB, scope: Scope, viewer: string | null): Promise<Map<string, number>> {
  const who = scope === 'friends' ? await circle(db, viewer) : null
  if (who !== null && who.length === 0) return new Map()

  const rows = await db
    .select({ facet: buildFacet.facet, count: sql<number>`count(*)` })
    .from(buildFacet)
    .innerJoin(publishedBuild, eq(publishedBuild.id, buildFacet.buildId))
    .where(
      who === null
        ? isNull(publishedBuild.takenDownAt)
        : and(isNull(publishedBuild.takenDownAt), inArray(publishedBuild.userId, who)),
    )
    .groupBy(buildFacet.facet)

  return new Map(rows.map((row) => [row.facet, Number(row.count ?? 0)]))
}

/**
 * One content board, from the tokens of one kind.
 *
 * The prefix is matched as a string and never interpreted: this reads `arm:` as
 * "the characters before the colon" and has no opinion about what an arm is.
 * The browser decides what the rest of the token says.
 */
function ofKind(counts: Map<string, number>, prefix: string): BoardRow[] {
  const mine = [...counts.entries()].filter(([token]) => token.startsWith(`${prefix}:`))
  return rank(mine, ([, n]) => n, ([token]) => ({ name: token }))
}

/**
 * Sort, trim, and drop the rows that have nothing to say.
 *
 * **A zero is not a placing.** A build nobody has followed has not come tenth
 * in a following contest, and a board padded out with zeroes to reach ten rows
 * would read as a ranking of things that were ranked. `Counted` refuses to draw
 * a zero for the same reason, and a board left with no rows at all is dropped
 * by `boards` rather than drawn empty.
 */
function rank<T>(rows: T[], count: (row: T) => number | null, into: (row: T) => BoardRow): BoardRow[] {
  return rows
    .map((row) => ({ row, n: count(row) }))
    .filter((one): one is { row: T; n: number } => one.n !== null && one.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, TOP)
    .map((one) => ({ ...into(one.row), count: one.n }))
}

/** A build board's row, before its count is attached. */
const asBuild = (one: Scanned): BoardRow => ({ id: one.id, name: one.name, by: one.by })

/** What one author's listings add up to. */
type Person = {
  name: string
  listings: number
  takes: number
  clears: number
  runs: number
  revisions: number
  bestFear: number | null
  /** Listings published between midnight and 05:00 UTC. */
  small: number
  /** When they first published, so "longest standing" has something to measure. */
  first: number
}

/** Fold the scan by author. One pass, no second query. */
function people(rows: Scanned[]): Person[] {
  const by = new Map<string, Person>()
  for (const row of rows) {
    const found = by.get(row.userId) ?? {
      name: row.by,
      listings: 0,
      takes: 0,
      clears: 0,
      runs: 0,
      revisions: 0,
      bestFear: null,
      small: 0,
      first: row.createdAt,
    }
    found.listings += 1
    found.takes += row.takes
    found.clears += row.clears
    found.runs += row.runs
    found.revisions += row.revision
    if (row.bestFear !== null) {
      found.bestFear = found.bestFear === null ? row.bestFear : Math.max(found.bestFear, row.bestFear)
    }
    /* UTC, because the server has no idea what time it was where they were and
       guessing would be worse than saying so. The screen says UTC too. */
    const hour = new Date(row.createdAt).getUTCHours()
    if (hour < 5) found.small += 1
    found.first = Math.min(found.first, row.createdAt)
    by.set(row.userId, found)
  }
  return [...by.values()]
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Every board, in the order they are read.
 *
 * Builds first, because a build is the thing the exchange is about and a person
 * is the thing it happens to have. Within each half the plain counts come
 * before the odd ones.
 */
export async function boards(db: DB, scope: Scope, viewer: string | null): Promise<Board[]> {
  const [rows, tokens] = await Promise.all([scan(db, scope, viewer), facets(db, scope, viewer)])
  const folk = people(rows)
  const now = Date.now()

  const asPerson = (one: Person): BoardRow => ({ name: one.name })

  const all: Board[] = [
    {
      id: 'followed',
      title: 'Most followed',
      unit: 'follower',
      kind: 'build',
      rows: rank(rows, (one) => one.takes, asBuild),
    },
    {
      id: 'cleared',
      title: 'Most cleared',
      unit: 'clear',
      kind: 'build',
      rows: rank(rows, (one) => one.clears, asBuild),
    },
    {
      id: 'played',
      title: 'Most played',
      unit: 'run',
      kind: 'build',
      rows: rank(rows, (one) => one.runs, asBuild),
    },
    {
      id: 'fear',
      title: 'Highest Fear cleared',
      unit: 'Fear',
      kind: 'build',
      rows: rank(rows, (one) => one.bestFear, asBuild),
    },
    {
      id: 'rewritten',
      title: 'Most rewritten',
      unit: 'rewrite',
      kind: 'build',
      rows: rank(rows, (one) => one.revision, asBuild),
    },
    {
      id: 'contributions',
      title: 'Most published',
      unit: 'build',
      kind: 'person',
      rows: rank(folk, (one) => one.listings, asPerson),
    },
    {
      id: 'pfollowed',
      title: 'Most followed author',
      unit: 'follower',
      kind: 'person',
      rows: rank(folk, (one) => one.takes, asPerson),
    },
    {
      id: 'pcleared',
      title: 'Most clears on their builds',
      unit: 'clear',
      kind: 'person',
      rows: rank(folk, (one) => one.clears, asPerson),
    },
    {
      id: 'pfear',
      title: 'Highest Fear on their build',
      unit: 'Fear',
      kind: 'person',
      rows: rank(folk, (one) => one.bestFear, asPerson),
    },
    {
      id: 'reviser',
      title: 'Never quite finished',
      unit: 'rewrite',
      kind: 'person',
      rows: rank(folk, (one) => one.revisions, asPerson),
    },
    {
      id: 'night',
      title: 'Published after midnight',
      unit: 'build',
      kind: 'person',
      rows: rank(folk, (one) => one.small, asPerson),
    },
    {
      id: 'standing',
      title: 'Here the longest',
      unit: 'day',
      kind: 'person',
      rows: rank(folk, (one) => Math.floor((now - one.first) / DAY), asPerson),
    },
    {
      id: 'arm',
      title: 'Most published arm',
      unit: 'build',
      kind: 'facet',
      rows: ofKind(tokens, 'arm'),
    },
    {
      id: 'aspect',
      title: 'Most published aspect',
      unit: 'build',
      kind: 'facet',
      rows: ofKind(tokens, 'aspect'),
    },
    {
      id: 'god',
      title: 'Most built around',
      unit: 'build',
      kind: 'facet',
      rows: ofKind(tokens, 'god'),
    },
    {
      id: 'keepsake',
      title: 'Most carried keepsake',
      unit: 'build',
      kind: 'facet',
      rows: ofKind(tokens, 'keepsake'),
    },
    {
      id: 'familiar',
      title: 'Most brought familiar',
      unit: 'build',
      kind: 'facet',
      rows: ofKind(tokens, 'familiar'),
    },
    {
      id: 'play',
      title: 'Most published playstyle',
      unit: 'build',
      kind: 'facet',
      rows: ofKind(tokens, 'play'),
    },
  ]

  /* A board with nothing in it is not drawn. At two accounts most of these are
     short and several are empty, and an empty leaderboard reads as a broken
     feature rather than as a new one. */
  return all.filter((board) => board.rows.length > 0)
}
