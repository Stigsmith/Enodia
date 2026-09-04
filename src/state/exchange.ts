/**
 * The exchange, from the browser's side.
 *
 * `worker/exchange.ts` is the other half. The division is the same one
 * publishing already draws: the server stores and counts, and knows nothing
 * about what a build is. A shelf arrives as packed payloads and this unpacks
 * them, which is what lets the existing filters run over other people's builds
 * with no second implementation anywhere.
 *
 * ## Three things a reader is shown, and they are never merged
 *
 * The mechanical reading from `engine/repeat.ts`, the counted facts from the
 * server, and what players rated it. `repeat.ts` argues at length that the
 * first two are independent and both worth showing: a build can be five stars
 * from five thousand people and still read Not in one run, which is not a
 * contradiction but a famous build people keep chasing. Combining them into one
 * score would be the tool claiming a build is good, which it has said in eight
 * places it will not do.
 *
 * ## Runs travel back, but only while the copy is still the build
 *
 * Taking a copy records where it came from and **what its picks were at the
 * time**. When a run is logged against it, the picks are read again and the two
 * are compared. Same, and the run is reported to the original. Different, and it
 * is not, because it is a different build now and counting it would be a claim
 * about somebody else's work that the person editing gets to write.
 *
 * `shapeOf` draws that line and argues where it goes. The short version: the
 * picks are the build, and the id, the name, the author and the write-up are
 * not, so a copy is comparable to its original from the moment it is made.
 */

import type { ShownBuild } from '../data/builds.ts'
import { duplicateBuild } from './builds.ts'
import { loadPrefs } from './prefs.ts'
import { unpackBuild } from './transfer.ts'

/** Counted facts about a build. Every one is a tally, and none is a judgement. */
export type Stats = {
  takes: number
  players: number
  runs: number
  clears: number
  bestFear: number | null
  rating: number | null
  raters: number
}

/** One build on a shelf, unpacked and ready for the ordinary filters. */
export type Listed = {
  /** The published id, which is what runs are reported against. */
  id: string
  by: string
  createdAt: number
  /** The owner's own words, on the picked shelf only. */
  note?: string
  build: ShownBuild
  stats: Stats
}

export type Shelf = 'picked' | 'friends'

type Wire = {
  id: string
  name: string
  payload: string
  by: string
  createdAt: number
  note?: string
  stats: Stats
}

/**
 * A stable fingerprint of a string.
 *
 * FNV-1a, which is not a cryptographic hash and does not need to be. Nothing
 * here is defending against somebody constructing a collision on purpose: a
 * person who wants their edited build to keep reporting can already just not
 * edit it. This is here to notice honest change, and a 32 bit hash over a few
 * hundred bytes of picks notices that.
 */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * What a build *is*, as one string, for deciding whether a copy still is it.
 *
 * **This is the picks and nothing else**, and getting the boundary wrong is
 * what broke this loop the first time. It hashed the packed payload instead,
 * which carries the id, the author, the name and three timestamps, and
 * `duplicateBuild` rewrites every one of those on the way out. So a copy taken
 * a second earlier and not touched since already failed the comparison, and
 * `reportRun` returned false forever on a path that shows nothing either way.
 *
 * What is deliberately **not** in here:
 *
 * - **Identity.** `id`, `by`, `author`, `created`, `modified`, `schemaVersion`,
 *   `derivedFrom`, `derivedHash`. A copy differs in all of them by definition.
 * - **The name.** Calling your copy something else is not changing the build.
 * - **The prose**, `say`, `how` and `luck`. You played the picks, not the
 *   write-up, and rewriting somebody's paragraph in your own words is a normal
 *   thing to do to a build you took.
 * - **`play`.** Logging a run must not itself change the answer, or the first
 *   run reported would be the last.
 *
 * What is in here is what a player would point at and call the build: the
 * weapon and aspect, what it leans on, the centrepiece, the boons in their
 * order, the optional ones, the Hex, the hammers, the keepsake, the familiar
 * and the Arcana. Change any of those and the runs stop counting toward
 * somebody else's build, which is the whole point of the comparison.
 *
 * The field names are written into the string rather than the values being
 * joined, so a boon moving from `boons` to `optional` cannot come out reading
 * the same.
 */
export function shapeOf(build: ShownBuild): string {
  const list = (ids: readonly string[] | undefined) => (ids ?? []).join(',')
  return [
    `weapon=${build.weapon}`,
    `aspect=${build.aspect}`,
    `playstyle=${build.playstyle ?? ''}`,
    `centrepiece=${build.centrepiece}`,
    `boons=${list(build.boons)}`,
    `optional=${list(build.optional)}`,
    `hex=${build.hex ?? ''}`,
    `hammers=${list(build.hammers)}`,
    `keepsake=${build.keepsake ?? ''}`,
    `familiar=${build.familiar ?? ''}`,
    `arcana=${list(build.arcana)}`,
  ].join('\n')
}

async function shelfAt(path: string): Promise<Listed[]> {
  let response: Response
  try {
    response = await fetch(path)
  } catch {
    return []
  }
  if (!response.ok) return []

  let body: { builds?: Wire[] }
  try {
    body = (await response.json()) as { builds?: Wire[] }
  } catch {
    return []
  }

  const out: Listed[] = []
  for (const row of body.builds ?? []) {
    const build = await unpackBuild(row.payload)
    /**
     * A payload this version cannot read is skipped rather than fatal.
     *
     * It stays on the shelf for a client that understands it. The alternative,
     * failing the whole shelf, would let one bad row take out everybody's
     * browsing.
     */
    if (!build) continue
    out.push({
      id: row.id,
      by: row.by,
      createdAt: row.createdAt,
      ...(row.note === undefined ? {} : { note: row.note }),
      // The server's name is authoritative for the listing: it is what the
      // author published under, and the packed build could say anything.
      build: { ...build, name: row.name },
      stats: row.stats,
    })
  }
  return out
}

export const listShelf = (shelf: Shelf): Promise<Listed[]> =>
  shelfAt(shelf === 'picked' ? '/api/exchange' : '/api/exchange/friends')

export type TakeOutcome = { ok: true; build: ShownBuild } | { ok: false; say: string }

/**
 * Take a copy into your own library.
 *
 * The copy is made by the same `duplicateBuild` a fork uses, so it is an
 * ordinary build of yours from the first moment: your name on it, a new id, and
 * no play record, because inheriting somebody else's twelve runs would have
 * yours lying on its first day.
 *
 * What it does carry is where it came from and what it looked like, which is
 * what lets a run you log later count toward the build you took.
 */
export async function takeBuild(id: string): Promise<TakeOutcome> {
  let response: Response
  try {
    response = await fetch(`/api/exchange/${id}/take`, { method: 'POST' })
  } catch {
    return { ok: false, say: 'Could not reach the server. Nothing here has changed.' }
  }

  if (response.status === 401) return { ok: false, say: 'Sign in to take a copy.' }
  if (!response.ok) {
    try {
      const body = (await response.json()) as { error?: string }
      return { ok: false, say: body.error ?? 'That did not work.' }
    } catch {
      return { ok: false, say: 'That did not work.' }
    }
  }

  const { payload } = (await response.json()) as { payload: string }
  const source = await unpackBuild(payload)
  if (!source) return { ok: false, say: 'That build is in a format this version cannot read.' }

  const { copy } = duplicateBuild(source, new Date().toISOString(), {
    id,
    // Of the picks, not of the payload. `shapeOf` says why at length.
    hash: fingerprint(shapeOf(source)),
  })
  return { ok: true, build: copy }
}

/**
 * The published build a run against this one would be counted toward, or null.
 *
 * **A predicate rather than a comment, because the screen has to ask it too.**
 * `LogRun` tells somebody that their stars will count toward the build they
 * took, and that sentence has to be true at the moment it is on screen: an
 * edited copy reports nothing, and so does any copy while the switch is off.
 * The first version of that hint read the two `derived` fields and promised a
 * report the hash check then refused, which is a tool saying one thing and
 * doing another about somebody else's numbers.
 *
 * Three conditions, and all three are the same question asked once here:
 *
 * - The switch in Settings is on.
 * - It came off a shelf. `derivedFrom` with no `derivedHash` is a fork of one
 *   of your own builds, and that id is a local build's, not a published one.
 * - The picks still match what was taken. See `shapeOf`.
 */
export function reportsTo(build: ShownBuild): string | null {
  if (!loadPrefs().reportRuns) return null
  if (!build.derivedFrom || !build.derivedHash) return null
  return fingerprint(shapeOf(build)) === build.derivedHash ? build.derivedFrom : null
}

/**
 * Report a run against the build a copy came from, if it still is that build.
 *
 * **Silent by design.** Nothing about the result is shown: somebody logging a
 * run is recording their own history, and whether a count moved on a shelf they
 * are not looking at is not their problem. A failure here loses one tally and
 * nothing else.
 *
 * **Whether to send at all is `reportsTo`'s answer**, and so is `rateBuild`'s.
 * A privacy switch honoured by whoever remembers to check it is a switch the
 * second caller forgets, and the second caller is always the one nobody
 * reviews. There is one way to send a run and it asks.
 *
 * Returns whether it was sent, which is for the tests rather than the screen.
 */
export async function reportRun(
  build: ShownBuild,
  cleared: boolean,
  fear: number | null,
): Promise<boolean> {
  const to = reportsTo(build)
  if (!to) return false

  try {
    const response = await fetch(`/api/exchange/${to}/played`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cleared, fear }),
    })
    return response.ok
  } catch {
    return false
  }
}

export type RateOutcome = { ok: true } | { ok: false; say: string }

/**
 * Rate a build you have played.
 *
 * The server refuses a rating with no run behind it, which is the whole
 * anti-abuse story and needs nothing else: an opinion here is always somebody
 * reporting on what they did rather than on what they read.
 *
 * Which is also why the switch covers this. Runs off means the server has no
 * run of yours to find, so a rating would be refused anyway; asking here says
 * so in words rather than making the server say no in a dialog.
 */
export async function rateBuild(id: string, rating: number): Promise<RateOutcome> {
  if (!loadPrefs().reportRuns) {
    return { ok: false, say: 'Reporting runs is switched off in Settings, and a rating needs one.' }
  }
  try {
    const response = await fetch(`/api/exchange/${id}/rate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating }),
    })
    if (response.ok) return { ok: true }
    const body = (await response.json()) as { error?: string }
    return { ok: false, say: body.error ?? 'That did not work.' }
  } catch {
    return { ok: false, say: 'Could not reach the server.' }
  }
}
