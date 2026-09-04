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
 * Taking a copy records where it came from and **what it looked like at the
 * time**. When a run is logged against it, the copy is packed again and the two
 * are compared. Same, and the run is reported to the original. Different, and it
 * is not, because it is a different build now and counting it would be a claim
 * about somebody else's work that the person editing gets to write.
 */

import type { ShownBuild } from '../data/builds.ts'
import { duplicateBuild } from './builds.ts'
import { packBuild, unpackBuild } from './transfer.ts'

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
 * A stable fingerprint of a packed build.
 *
 * FNV-1a, which is not a cryptographic hash and does not need to be. Nothing
 * here is defending against somebody constructing a collision on purpose: a
 * person who wants their edited build to keep reporting can already just not
 * edit it. This is here to notice honest change, and a 32 bit hash over a
 * kilobyte of packed build notices that.
 */
export function fingerprint(packed: string): string {
  let hash = 0x811c9dc5
  for (let at = 0; at < packed.length; at++) {
    hash ^= packed.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
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
    hash: fingerprint(payload),
  })
  return { ok: true, build: copy }
}

/**
 * Report a run against the build a copy came from, if it still is that build.
 *
 * **Silent by design.** Nothing about the result is shown: somebody logging a
 * run is recording their own history, and whether a count moved on a shelf they
 * are not looking at is not their problem. A failure here loses one tally and
 * nothing else.
 *
 * Returns whether it was sent, which is for the tests rather than the screen.
 */
export async function reportRun(
  build: ShownBuild,
  cleared: boolean,
  fear: number | null,
): Promise<boolean> {
  if (!build.derivedFrom || !build.derivedHash) return false

  // Packed again and compared. `packBuild` strips the play record, so a run
  // being logged does not itself change the fingerprint.
  const now = fingerprint(await packBuild(build))
  if (now !== build.derivedHash) return false

  try {
    const response = await fetch(`/api/exchange/${build.derivedFrom}/played`, {
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
 */
export async function rateBuild(id: string, rating: number): Promise<RateOutcome> {
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
