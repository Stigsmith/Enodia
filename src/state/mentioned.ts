/**
 * The build a mention names, found.
 *
 * A mention of a build carries its published id and the name it was written
 * with, and nothing else. Drawing it needs the build itself, for its current
 * name and, during a run, for a verdict on it.
 *
 * ## The library first
 *
 * Your own published builds and the ones you follow are already in this
 * browser, so they cost nothing to find and they are the version you are
 * playing. Only an id the library does not hold is asked about, through the
 * same public read a short link uses.
 *
 * ## Three answers, and only one of them is "withdrawn"
 *
 * `gone` is a 404 or a payload that will not unpack: nothing answers to the id.
 * A found build its author took off the shelves is drawn the same way, as
 * withdrawn. `unknown` is everything else: still being asked, refused by the
 * rate limit, or offline. **Those are not withdrawn**, and drawing them so
 * would tell a reader a build is gone because their connection dropped. An
 * unknown mention is drawn as the name it was written with, and asked about
 * again later in the session.
 *
 * ## Cached for the page, and stopped by a 429
 *
 * A found or gone answer is kept until the page reloads. A refusal from the
 * worker stops every further read until its `retry-after` has passed, the way
 * `refreshFollowed` stops rather than spending the rest of the budget one
 * refused request at a time: `worker/limit.ts` allows 120 reads a minute per
 * address, and a long guide should not be the thing that uses them up.
 */

import { useEffect, useState } from 'react'

import type { ShownBuild } from '../data/builds.ts'
import { loadBuilds } from './builds.ts'
import { loadOffers } from './offers.ts'
import type { Offers } from './offers.ts'
import { isPublishedId } from './publish.ts'
import { unpackBuild } from './transfer.ts'

export type Mentioned =
  | {
      state: 'found'
      build: ShownBuild
      /** off the shelves, which is drawn as withdrawn */
      takenDown: boolean
      /** the build's id in this library, when the library holds it */
      local: string | null
    }
  | { state: 'gone' }
  | { state: 'unknown' }

const GONE: Mentioned = { state: 'gone' }
const UNKNOWN: Mentioned = { state: 'unknown' }

/** How long a failed read waits before the same id is asked about again. */
const RETRY_MS = 60_000

/**
 * The build an id names, if this library holds it. Null when it does not.
 *
 * `publishedAs` is only ever on a build of yours. A build you follow carries
 * the id it came from in `derivedFrom`, and whether its author took it down is
 * recorded in the offers, which is where `refreshFollowed` writes it.
 */
export function fromLibrary(
  id: string,
  library: readonly ShownBuild[] = loadBuilds(),
  offers: Offers = loadOffers(),
): Mentioned | null {
  const mine = library.find((one) => one.publishedAs === id)
  if (mine) return { state: 'found', build: mine, takenDown: mine.publishedDown === true, local: mine.id }
  const followed = library.find((one) => one.by === 'community' && one.derivedFrom === id)
  if (followed) {
    return {
      state: 'found',
      build: followed,
      takenDown: offers[followed.id]?.kind === 'takenDown',
      local: followed.id,
    }
  }
  return null
}

const settled = new Map<string, Mentioned>()
const asking = new Map<string, Promise<Mentioned>>()
const failedAt = new Map<string, number>()
let pausedUntil = 0

/** What is already known about an id, without asking. */
export function knownMention(id: string): Mentioned {
  if (!isPublishedId(id)) return GONE
  return settled.get(id) ?? UNKNOWN
}

/**
 * The build an id names, asked of the worker when nothing here knows it.
 *
 * An id that could not be a published id is gone without a request, since the
 * route would refuse it anyway. Concurrent asks for one id share one request.
 */
export async function fetchMentioned(id: string, now = Date.now()): Promise<Mentioned> {
  if (!isPublishedId(id)) return GONE
  const known = settled.get(id)
  if (known) return known
  if (now < pausedUntil) return UNKNOWN
  const failed = failedAt.get(id)
  if (failed !== undefined && now - failed < RETRY_MS) return UNKNOWN
  const already = asking.get(id)
  if (already) return already
  const asked = ask(id).finally(() => asking.delete(id))
  asking.set(id, asked)
  return asked
}

async function ask(id: string): Promise<Mentioned> {
  try {
    const response = await fetch(`/api/b/${id}`)
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after'))
      pausedUntil = Date.now() + (Number.isFinite(wait) && wait > 0 ? wait : 60) * 1000
      return UNKNOWN
    }
    if (response.status === 404) {
      settled.set(id, GONE)
      return GONE
    }
    if (!response.ok) {
      failedAt.set(id, Date.now())
      return UNKNOWN
    }
    const { payload, name, takenDown } = (await response.json()) as {
      payload: string
      name?: string
      takenDown?: boolean
    }
    const build = await unpackBuild(payload)
    /* A payload that will not unpack is nothing anybody can read, which is the
       same answer `openPublished` gives it. */
    const found: Mentioned = build
      ? { state: 'found', build: { ...build, name: name || build.name }, takenDown: takenDown === true, local: null }
      : GONE
    settled.set(id, found)
    return found
  } catch {
    /* Offline, or a server that answered with something other than the API,
       which is what the Vite dev server does. Neither says the build is gone. */
    failedAt.set(id, Date.now())
    return UNKNOWN
  }
}

/**
 * What a guide already handed over, taken as read.
 *
 * Reading a guide returns every build it names in the same response, which is
 * the whole reason `worker/guides.ts` gathers them: a guide naming twenty
 * builds would otherwise spend twenty requests out of an address's budget of a
 * hundred and twenty a minute. Writing them in here is what makes the mentions
 * inside the guide draw without asking anybody.
 *
 * **Withdrawn and gone land in the same place, on purpose.** The server tells
 * them apart and withholds a withdrawn build's payload either way, so there is
 * no build here to draw. `BuildMention` draws both as withdrawn, with the name
 * the author wrote and no link, which is exactly what is true of them.
 */
export async function learnMentioned(
  named: readonly (
    | { id: string; state: 'live'; name: string; payload: string }
    | { id: string; state: 'withdrawn' | 'gone' }
  )[],
): Promise<void> {
  await Promise.all(
    named.map(async (one) => {
      if (settled.has(one.id)) return
      if (one.state !== 'live') {
        settled.set(one.id, GONE)
        return
      }
      const build = await unpackBuild(one.payload)
      settled.set(
        one.id,
        build
          ? { state: 'found', build: { ...build, name: one.name || build.name }, takenDown: false, local: null }
          : GONE,
      )
    }),
  )
}

/** Forget every answer. For tests, which each want a page that has asked nothing. */
export function forgetMentioned(): void {
  settled.clear()
  asking.clear()
  failedAt.clear()
  pausedUntil = 0
}

/**
 * The build a mention names, as the screen should draw it now.
 *
 * The library is read on every render, as the run screen reads it, so a build
 * followed a minute ago is found without asking anybody. Only when the library
 * does not hold the id is the worker asked, once per mount, so an unknown
 * answer is asked again the next time the text is drawn.
 */
export function useMentioned(id: string): Mentioned {
  const local = fromLibrary(id)
  const [fetched, setFetched] = useState<Mentioned>(() => knownMention(id))
  const needed = local === null

  useEffect(() => {
    if (needed) void fetchMentioned(id).then(setFetched)
  }, [id, needed])

  return local ?? fetched
}
