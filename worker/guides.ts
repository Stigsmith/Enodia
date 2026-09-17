/**
 * Guides: a few sections of writing with builds named inside them.
 *
 * ## The server still has no opinion about what anything is
 *
 * A guide arrives packed, is stored as text and is handed back packed, exactly
 * as a build is in `publish.ts`. The builds a guide names arrive beside it as a
 * list of ids and shape tokens the browser read out of the `b:` mentions, and
 * this file stores them, orders them and compares the tokens without reading
 * either. Nobody types that list: it is whatever the guide names, in the order
 * it names them.
 *
 * ## What reading one returns, and what it withholds
 *
 * One response carries the guide and every build it names, so a reader does
 * not make a request per mention. **A build its author took off the shelves
 * comes back without its payload.** `/api/b/<id>` keeps answering for a
 * taken-down build, because followers hold its link; a guide is a page
 * strangers find, and handing the build over there would keep it discoverable
 * after its author withdrew it. The mention says withdrawn and the guide's own
 * words stay.
 *
 * A build whose picks changed since the guide was written is marked, from the
 * shape token the author's browser sent and the one the listing holds now.
 *
 * ## Moderation, which is a person with a statement
 *
 * Guides are listed, and they carry text a stranger wrote, so they ship with a
 * way to report one and a way to hide one, per the owner's call on 17
 * September 2026. **Reports are stored and never returned. Hiding is a column
 * no route writes.** A moderator reads and acts on the database directly:
 *
 *     npx wrangler d1 execute enodia --remote --command "select g.id, g.title,
 *       count(*) as reports, group_concat(r.reason, ' | ') as said
 *       from guide_report r join guide g on g.id = r.guide_id
 *       group by g.id order by reports desc"
 *
 *     npx wrangler d1 execute enodia --remote --command "update guide
 *       set hidden_at = cast(unixepoch('subsecond') * 1000 as integer)
 *       where id = '<id>'"
 *
 * and `set hidden_at = null` to undo it. There is no moderator route, so there
 * is no moderator session for anybody to find or forge. Nothing hides a guide
 * on a count of reports either: a count is something a group can manufacture.
 *
 * A hidden guide leaves every list, and its link answers 404 for everybody but
 * its author, who still sees it among their own, marked hidden.
 *
 * ## Counts, and never who
 *
 * Saves and likes are counted per guide and handed back as two numbers. The
 * person asking is told whether they saved or liked it themselves, as two
 * booleans. No user id leaves this file, and `guides.test.ts` reads every
 * response for one.
 */

import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { shortId } from './publish.ts'
import type { Refusal } from './publish.ts'
import { guide, guideBuild, guideReport, guideStat, publishedBuild } from './schema-app.ts'
import * as schema from './schema.ts'
import { user } from './schema.ts'

type DB = DrizzleD1Database<typeof schema>

/**
 * Live guides per account. Fewer than builds, because a guide is a longer
 * thing to write and a person with fifty of them has a blog.
 */
export const MAX_GUIDES = 50

/**
 * A few sections of prose, packed. Three thousand characters a section is a
 * long section, four of them compress to well under 10 KB, and this is five
 * times that, with the same purpose as `MAX_PAYLOAD`: room to grow, and no
 * room to use this as storage.
 */
const MAX_GUIDE_PAYLOAD = 48 * 1024

const MAX_TITLE = 120

/**
 * How many builds one guide can name. Forty is more than a guide about builds
 * would ever want to be read against, and it bounds the rows one publish
 * writes.
 */
export const MAX_GUIDE_BUILDS = 40

/** The shape of a published id, as the build routes accept it. */
const BUILD_ID = /^[A-Za-z0-9]{1,32}$/

/** As `MAX_SHAPE` in `publish.ts`: a token, and never somewhere to put a payload. */
const MAX_SHAPE = 32

/** What a reader can say in a report. Bounded, and only a moderator reads it. */
const MAX_REASON = 500

/** A page, so one call cannot ask for every guide there is. */
const PAGE = 60

type Mentioned = { id: string; shape: string }

/**
 * The builds a guide names, as the browser sent them.
 *
 * Kept in order, each id once, bounded. An entry that is not a plausible id is
 * dropped rather than refused, because the list is a derived hint beside the
 * guide and not worth failing a publish over, and the same goes for a shape
 * token that is too long.
 */
function buildsIn(body: { builds?: unknown }): Mentioned[] {
  if (!Array.isArray(body.builds)) return []
  const out: Mentioned[] = []
  for (const one of body.builds) {
    if (out.length >= MAX_GUIDE_BUILDS) break
    if (typeof one !== 'object' || one === null) continue
    const { id, shape } = one as { id?: unknown; shape?: unknown }
    if (typeof id !== 'string' || !BUILD_ID.test(id) || out.some((was) => was.id === id)) continue
    out.push({ id, shape: typeof shape === 'string' && shape.length <= MAX_SHAPE ? shape : '' })
  }
  return out
}

/** The same checks for a publish and a replace, so a replace cannot slip past them. */
function checked(body: {
  payload?: unknown
  title?: unknown
}): { payload: string; title: string } | Refusal {
  const payload = typeof body.payload === 'string' ? body.payload : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!payload) return { status: 400, say: 'No guide in that request.' }
  if (payload.length > MAX_GUIDE_PAYLOAD) return { status: 413, say: 'That guide is too long to publish.' }
  if (!title) return { status: 400, say: 'A guide needs a title.' }
  if (title.length > MAX_TITLE) return { status: 400, say: 'That title is too long.' }
  return { payload, title }
}

type Batch = [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

/**
 * The statements that write a guide's builds, replacing whatever was there.
 * Never empty, because the delete is always in it, which is what `batch` needs.
 */
function buildRows(db: DB, guideId: string, builds: Mentioned[]): Batch {
  const writes: Batch = [db.delete(guideBuild).where(eq(guideBuild.guideId, guideId))]
  if (builds.length) {
    writes.push(
      db.insert(guideBuild).values(builds.map((one, position) => ({ guideId, buildId: one.id, shape: one.shape, position }))),
    )
  }
  return writes
}

export async function publishGuide(
  db: DB,
  userId: string,
  body: { payload?: unknown; title?: unknown; builds?: unknown },
): Promise<{ id: string } | Refusal> {
  const input = checked(body)
  if ('status' in input) return input
  const builds = buildsIn(body)

  /* Live guides only, for the reason `publish` gives: taking one down has to
     be a way to make room, or the refusal below would be a lie. */
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(guide)
    .where(and(eq(guide.userId, userId), isNull(guide.takenDownAt)))
  if ((row?.count ?? 0) >= MAX_GUIDES) {
    return { status: 409, say: `You have ${MAX_GUIDES} guides up, which is the limit. Take one down first.` }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = shortId()
    try {
      /* One batch, so a guide never exists without the builds it names. D1
         runs a batch as one transaction. */
      await db.batch([
        db.insert(guide).values({ id, userId, title: input.title, payload: input.payload }),
        ...buildRows(db, id, builds),
      ])
      return { id }
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
  return { status: 500, say: 'Could not publish that.' }
}

/**
 * Replace one of yours in place.
 *
 * Ownership is in the `where`, as it is for a build, and zero rows changed
 * answers "not yours" whether it is somebody else's or nobody's. The builds are
 * rewritten only after that proves the guide is the caller's. A hidden guide
 * can be edited and stays hidden: only a moderator unhides.
 */
export async function replaceGuide(
  db: DB,
  userId: string,
  id: string,
  body: { payload?: unknown; title?: unknown; builds?: unknown },
): Promise<{ id: string; revision: number } | Refusal> {
  const input = checked(body)
  if ('status' in input) return input
  const builds = buildsIn(body)

  const result = await db
    .update(guide)
    .set({
      title: input.title,
      payload: input.payload,
      updatedAt: new Date(),
      revision: sql`${guide.revision} + 1`,
    })
    .where(and(eq(guide.id, id), eq(guide.userId, userId)))
  if ((result as { meta?: { changes?: number } }).meta?.changes === 0) {
    return { status: 404, say: 'That guide is not one of yours.' }
  }

  await db.batch(buildRows(db, id, builds))

  const [row] = await db.select({ revision: guide.revision }).from(guide).where(eq(guide.id, id)).limit(1)
  return { id, revision: row?.revision ?? 1 }
}

/** Off every list, and the link keeps answering. The author's own lever. */
export async function takeDownGuide(db: DB, userId: string, id: string): Promise<boolean> {
  const result = await db
    .update(guide)
    .set({ takenDownAt: new Date() })
    .where(and(eq(guide.id, id), eq(guide.userId, userId)))
  return (result as { meta?: { changes?: number } }).meta?.changes !== 0
}

/** The other half. Touches nothing else: not the revision, and never a hide. */
export async function putBackGuide(db: DB, userId: string, id: string): Promise<boolean> {
  const result = await db
    .update(guide)
    .set({ takenDownAt: null })
    .where(and(eq(guide.id, id), eq(guide.userId, userId)))
  return (result as { meta?: { changes?: number } }).meta?.changes !== 0
}

/** A guide as a list shows it. `payload` is packed and unread here. */
export type GuideListing = {
  id: string
  title: string
  payload: string
  by: string
  createdAt: number
  updatedAt: number | null
  revision: number
  /** Whether the person asking wrote it. A boolean, never the id. Absent when nobody is signed in. */
  mine?: boolean
  /** Present only where a list keeps taken-down guides: your own, and your saved ones. */
  takenDown?: boolean
  /** Present only on your own list, where a hidden guide stays so you can see it was hidden. */
  hidden?: boolean
  stats: { saves: number; likes: number }
  /** Whether the person asking saved it, or liked it. Absent when nobody is signed in. */
  saved?: boolean
  liked?: boolean
  /** The ids of the builds it names, in order. */
  builds: string[]
}

type Row = {
  id: string
  title: string
  payload: string
  by: string | null
  userId: string
  createdAt: Date
  updatedAt: Date | null
  revision: number
  takenDownAt: Date | null
  hiddenAt: Date | null
}

const columns = {
  id: guide.id,
  title: guide.title,
  payload: guide.payload,
  by: user.name,
  userId: guide.userId,
  createdAt: guide.createdAt,
  updatedAt: guide.updatedAt,
  revision: guide.revision,
  takenDownAt: guide.takenDownAt,
  hiddenAt: guide.hiddenAt,
}

/**
 * Counts, the reader's own two flags, and the builds, for a page of guides, in
 * three queries whatever the page holds. Nothing here returns a user id.
 */
async function dressed(
  db: DB,
  rows: Row[],
  viewer: string | null,
  keep: { takenDown?: boolean; hidden?: boolean } = {},
): Promise<GuideListing[]> {
  const ids = rows.map((row) => row.id)
  if (!ids.length) return []

  const counts = await db
    .select({
      guideId: guideStat.guideId,
      saves: sql<number>`sum(case when ${guideStat.savedAt} is not null then 1 else 0 end)`,
      likes: sql<number>`sum(case when ${guideStat.likedAt} is not null then 1 else 0 end)`,
    })
    .from(guideStat)
    .where(inArray(guideStat.guideId, ids))
    .groupBy(guideStat.guideId)

  const own = viewer
    ? await db
        .select({ guideId: guideStat.guideId, savedAt: guideStat.savedAt, likedAt: guideStat.likedAt })
        .from(guideStat)
        .where(and(inArray(guideStat.guideId, ids), eq(guideStat.userId, viewer)))
    : []

  const named = await db
    .select({ guideId: guideBuild.guideId, buildId: guideBuild.buildId })
    .from(guideBuild)
    .where(inArray(guideBuild.guideId, ids))
    .orderBy(guideBuild.guideId, guideBuild.position)

  return rows.map((row) => {
    const tally = counts.find((one) => one.guideId === row.id)
    const mineRow = own.find((one) => one.guideId === row.id)
    return {
      id: row.id,
      title: row.title,
      payload: row.payload,
      by: row.by ?? 'Somebody',
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt ? row.updatedAt.getTime() : null,
      revision: row.revision,
      ...(viewer ? { mine: row.userId === viewer } : {}),
      ...(keep.takenDown ? { takenDown: row.takenDownAt !== null } : {}),
      ...(keep.hidden ? { hidden: row.hiddenAt !== null } : {}),
      stats: { saves: Number(tally?.saves ?? 0), likes: Number(tally?.likes ?? 0) },
      ...(viewer ? { saved: Boolean(mineRow?.savedAt), liked: Boolean(mineRow?.likedAt) } : {}),
      builds: named.filter((one) => one.guideId === row.id).map((one) => one.buildId),
    }
  })
}

/** Everybody's guides: up, not hidden, newest first. Public. */
export async function listGuides(db: DB, viewer: string | null): Promise<GuideListing[]> {
  const rows = await db
    .select(columns)
    .from(guide)
    .leftJoin(user, eq(guide.userId, user.id))
    .where(and(isNull(guide.takenDownAt), isNull(guide.hiddenAt)))
    .orderBy(desc(guide.createdAt))
    .limit(PAGE)
  return dressed(db, rows, viewer)
}

/**
 * Your side: what you wrote, and what you saved.
 *
 * **Written keeps everything**, taken down and hidden alike and marked, because
 * a guide its author cannot see is one they cannot put back or fix, and a hidden
 * one silently missing would read as lost. **Saved keeps what you saved and its
 * author took down**, as a followed build does, and drops what a moderator hid.
 */
export async function myGuides(
  db: DB,
  userId: string,
): Promise<{ written: GuideListing[]; saved: GuideListing[] }> {
  const written = await db
    .select(columns)
    .from(guide)
    .leftJoin(user, eq(guide.userId, user.id))
    .where(eq(guide.userId, userId))
    .orderBy(desc(guide.createdAt))
    .limit(PAGE)

  const saved = await db
    .select(columns)
    .from(guideStat)
    .innerJoin(guide, eq(guide.id, guideStat.guideId))
    .leftJoin(user, eq(guide.userId, user.id))
    .where(and(eq(guideStat.userId, userId), isNotNull(guideStat.savedAt), isNull(guide.hiddenAt)))
    .orderBy(desc(guideStat.savedAt))
    .limit(PAGE)

  return {
    written: await dressed(db, written, userId, { takenDown: true, hidden: true }),
    saved: await dressed(db, saved, userId, { takenDown: true }),
  }
}

/** A build a guide names, as reading the guide hands it over. */
export type NamedBuild =
  | { id: string; state: 'live'; name: string; payload: string; revision: number; changed: boolean }
  /** Taken off the shelves by its author. No payload, on purpose: see the top of this file. */
  | { id: string; state: 'withdrawn' }
  /** Nothing answers to the id. */
  | { id: string; state: 'gone' }

export type GuideRead = GuideListing & { takenDown: boolean; named: NamedBuild[] }

/**
 * One guide, with every build it names. Public.
 *
 * A taken-down guide still answers, as a build does, and says so. A hidden one
 * answers only its author.
 */
export async function readGuide(db: DB, id: string, viewer: string | null): Promise<GuideRead | null> {
  const [row] = await db
    .select(columns)
    .from(guide)
    .leftJoin(user, eq(guide.userId, user.id))
    .where(eq(guide.id, id))
    .limit(1)
  if (!row) return null
  const author = viewer !== null && row.userId === viewer
  if (row.hiddenAt !== null && !author) return null

  const [listing] = await dressed(db, [row], viewer, author ? { hidden: true } : {})
  if (!listing) return null

  const rows = await db
    .select({
      buildId: guideBuild.buildId,
      shape: guideBuild.shape,
      payload: publishedBuild.payload,
      name: publishedBuild.name,
      revision: publishedBuild.revision,
      takenDownAt: publishedBuild.takenDownAt,
      nowShape: publishedBuild.shape,
      exists: publishedBuild.id,
    })
    .from(guideBuild)
    .leftJoin(publishedBuild, eq(publishedBuild.id, guideBuild.buildId))
    .where(eq(guideBuild.guideId, id))
    .orderBy(guideBuild.position)

  const named: NamedBuild[] = rows.map((one) => {
    if (one.exists === null || one.payload === null || one.name === null) return { id: one.buildId, state: 'gone' }
    if (one.takenDownAt !== null) return { id: one.buildId, state: 'withdrawn' }
    /* An empty token on either side is not a version, so it cannot be a
       changed one: the same rule `played` applies in `exchange.ts`. */
    const changed = one.shape !== '' && (one.nowShape ?? '') !== '' && one.shape !== one.nowShape
    return {
      id: one.buildId,
      state: 'live',
      name: one.name,
      payload: one.payload,
      revision: one.revision ?? 0,
      changed,
    }
  })

  return { ...listing, takenDown: row.takenDownAt !== null, named }
}

/**
 * Save or like a guide, or take either back.
 *
 * **Not your own**, refused before a row exists, so neither count can be
 * moved by the person it is about. A hidden guide and a missing one answer
 * alike. A guide its author took down takes no new saves or likes, which is
 * what taking it down means, and a reader can still take theirs back.
 */
export async function markGuide(
  db: DB,
  userId: string,
  id: string,
  what: 'saved' | 'liked',
  on: boolean,
): Promise<{ ok: true; stats: { saves: number; likes: number } } | Refusal> {
  const [found] = await db
    .select({ userId: guide.userId, takenDownAt: guide.takenDownAt, hiddenAt: guide.hiddenAt })
    .from(guide)
    .where(eq(guide.id, id))
    .limit(1)
  if (!found || found.hiddenAt !== null) return { status: 404, say: 'That guide is not there.' }
  if (found.userId === userId) {
    return { status: 409, say: what === 'saved' ? 'That guide is yours already.' : 'You cannot like your own guide.' }
  }
  if (on && found.takenDownAt !== null) return { status: 404, say: 'That guide is not there any more.' }

  const now = Date.now()
  const stamp = on ? now : null
  if (what === 'saved') {
    await db.run(sql`
      insert into guide_stat (guide_id, user_id, saved_at, updated)
      values (${id}, ${userId}, ${stamp}, ${now})
      on conflict(guide_id, user_id) do update set
        saved_at = case when excluded.saved_at is null then null else coalesce(guide_stat.saved_at, excluded.saved_at) end,
        updated = excluded.updated
    `)
  } else {
    await db.run(sql`
      insert into guide_stat (guide_id, user_id, liked_at, updated)
      values (${id}, ${userId}, ${stamp}, ${now})
      on conflict(guide_id, user_id) do update set
        liked_at = case when excluded.liked_at is null then null else coalesce(guide_stat.liked_at, excluded.liked_at) end,
        updated = excluded.updated
    `)
  }

  const [tally] = await db
    .select({
      saves: sql<number>`sum(case when ${guideStat.savedAt} is not null then 1 else 0 end)`,
      likes: sql<number>`sum(case when ${guideStat.likedAt} is not null then 1 else 0 end)`,
    })
    .from(guideStat)
    .where(eq(guideStat.guideId, id))
  return { ok: true, stats: { saves: Number(tally?.saves ?? 0), likes: Number(tally?.likes ?? 0) } }
}

/**
 * Report a guide. Stored for a moderator, returned to nobody.
 *
 * Your own is refused: taking it down is the lever for that. A hidden one and a
 * missing one answer alike. A second report from the same person replaces the
 * first, so one person is one report however often they press it.
 */
export async function reportGuide(
  db: DB,
  userId: string,
  id: string,
  reason: unknown,
): Promise<{ ok: true } | Refusal> {
  const said = typeof reason === 'string' ? reason.trim() : ''
  if (said.length > MAX_REASON) return { status: 400, say: 'That is longer than a report needs to be.' }

  const [found] = await db
    .select({ userId: guide.userId, hiddenAt: guide.hiddenAt })
    .from(guide)
    .where(eq(guide.id, id))
    .limit(1)
  if (!found || found.hiddenAt !== null) return { status: 404, say: 'That guide is not there.' }
  if (found.userId === userId) return { status: 409, say: 'That guide is yours. Take it down instead.' }

  const now = Date.now()
  await db
    .insert(guideReport)
    .values({ guideId: id, userId, reason: said, createdAt: now })
    .onConflictDoUpdate({ target: [guideReport.guideId, guideReport.userId], set: { reason: said, createdAt: now } })
  return { ok: true }
}
