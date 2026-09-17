/**
 * Publishing a build, from the browser's side. `worker/publish.ts` is the rest.
 *
 * ## What this is for, in one number
 *
 * `linkFor` packs a whole build into a URL fragment, which is why sharing has
 * never needed a server. It also makes the link **1,588 characters**. Discord
 * renders that as a wall, Reddit mangles it, and no QR code will hold it.
 *
 * A published link is `enodia.me/b/aB3xK9pQmR`, about thirty. That is the whole
 * of what an account buys, and the reason the gate sits here rather than at the
 * door.
 *
 * ## Publishing is a copy, not a move
 *
 * The build stays in this browser. It stays the record, stays the thing being
 * edited, and stays what the export writes. Publishing takes a snapshot; editing
 * afterwards changes yours and not the published one until you publish again.
 *
 * That is worth being plain about, because the obvious assumption is the other
 * one, and the loss warning in the build manager deliberately does not point
 * here for exactly this reason.
 */

import type { SavedBuild, ShownBuild } from '../data/builds.ts'
import { loadBin, loadBuilds, newBuildId, saveBuild } from './builds.ts'
import { fingerprint, shapeOf } from './exchange.ts'
import { facetsOf } from './facets.ts'
import { packBuild, received, unpackBuild } from './transfer.ts'

/**
 * One of your listings, as `worker/publish.ts listMine` returns it.
 *
 * `revision` and `updatedAt` were being returned by the worker and thrown away
 * here before anything on this side could act on them. They are what an author
 * needs to see: which version people are reading, and when it last moved.
 */
export type Published = {
  id: string
  name: string
  createdAt: number
  revision: number
  /** null when it has never been republished. */
  updatedAt: number | null
  /**
   * null while it is on the shelves. A timestamp, so it answers when too.
   *
   * Taken-down listings are in this list rather than filtered out of it: it is
   * the author's own inventory, and one they cannot see is one they cannot put
   * back.
   */
  takenDownAt: number | null
}

export type PublishOutcome = { ok: true; id: string; link: string } | { ok: false; say: string }

/** The short link, and the only place its shape is written. */
export const linkTo = (id: string): string => `${window.location.origin}/b/${id}`

/**
 * What a published id can look like, as the worker's routes accept it. The ids
 * it hands out are ten characters of this; the routes allow up to 32.
 */
const PUBLISHED_ID = '[A-Za-z0-9]{1,32}'

/** Whether a string could be a published id, before anybody is asked about it. */
export const isPublishedId = (id: string): boolean => new RegExp(`^${PUBLISHED_ID}$`).test(id)

/**
 * The id in the address, or null.
 *
 * A path rather than a fragment. Both would work and both are short, but a path
 * survives being pasted into places that strip fragments, and reads as an
 * address rather than as an address with something bolted on.
 */
export function publishedInUrl(pathname: string): string | null {
  const found = new RegExp(`^/b/(${PUBLISHED_ID})/?$`).exec(pathname)
  return found ? (found[1] as string) : null
}

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return 'You need to be signed in to publish.'
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? 'That did not work.'
  } catch {
    return 'That did not work.'
  }
}

/**
 * Publish, and **stamp the local build with what came back**.
 *
 * The stamp is the whole reason this function writes to the library at all. Two
 * things need it and neither can get it from the server: the author cannot be
 * offered "update the published copy" for a listing nothing connects to a
 * build, and the exchange cannot refuse to let you follow your own build,
 * because `/api/b/:id` takes no session and will happily hand you your own.
 *
 * This module is the only writer of both fields, the way `reportRun` is the
 * only sender of a run. A second writer forgets one of them, and the pair
 * coming apart is a failure this codebase has already had once.
 *
 * **The shape goes up here too, and for a long time it did not.** Only
 * `republishBuild` sent one, so a listing published and never replaced was
 * stored under an empty token while `stamp` wrote the real hash locally. The
 * worker compares the two on every reported run, so every run against such a
 * listing was answered and dropped, and rating one was refused as unplayed.
 * Nothing showed it: zero is what an unplayed build looks like, and takes carry
 * on counting because `take` files under whatever the listing says.
 */
export async function publishBuild(build: ShownBuild): Promise<PublishOutcome> {
  try {
    const response = await fetch('/api/builds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payload: await packBuild(build),
        name: build.name,
        shape: fingerprint(shapeOf(build)),
        facets: facetsOf(build),
      }),
    })
    if (!response.ok) return { ok: false, say: await readError(response) }
    const { id } = (await response.json()) as { id: string }
    stamp(build, id)
    return { ok: true, id, link: linkTo(id) }
  } catch {
    return { ok: false, say: 'Could not reach the server. Your build is untouched.' }
  }
}

/**
 * Record on the build which listing it is behind, and what shape it went up as.
 *
 * Deliberately after the request rather than optimistically before it: a build
 * that thinks it is published when it is not would offer to update a listing
 * that does not exist.
 */
function stamp(build: ShownBuild, id: string): void {
  saveBuild({ ...build, publishedAs: id, publishedHash: fingerprint(shapeOf(build)) })
}

export async function myPublished(): Promise<Published[]> {
  try {
    const response = await fetch('/api/builds')
    if (!response.ok) return []
    const body = (await response.json()) as { builds?: Published[] }
    return body.builds ?? []
  } catch {
    return []
  }
}

/**
 * Replace what people are reading, and restamp the shape it now has.
 *
 * The shape goes up with it as an opaque token, which is how the server splits
 * a listing's counts across versions without ever reading the payload. See
 * `worker/publish.ts`.
 */
export async function republishBuild(build: ShownBuild): Promise<PublishOutcome> {
  if (!build.publishedAs) return { ok: false, say: 'That build is not published.' }
  try {
    const response = await fetch(`/api/builds/${build.publishedAs}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payload: await packBuild(build),
        name: build.name,
        shape: fingerprint(shapeOf(build)),
        facets: facetsOf(build),
      }),
    })
    if (!response.ok) return { ok: false, say: await readError(response) }
    stamp(build, build.publishedAs)
    return { ok: true, id: build.publishedAs, link: linkTo(build.publishedAs) }
  } catch {
    return { ok: false, say: 'Could not reach the server. Your build is untouched.' }
  }
}

/**
 * Take a listing off the shelves. **Not a delete**, on purpose.
 *
 * The row stays and the link keeps working for anybody who already has it,
 * marked as taken down. Destroying it would take every run anybody logged
 * against it, every rating, and the curator's note with it, and it would empty
 * the build out of the library of everyone following it. `worker/publish.ts`
 * carries the rest of the argument.
 */
export async function takeDownBuild(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/builds/${id}`, { method: 'DELETE' })
    if (response.ok) mark(id, true)
    return response.ok
  } catch {
    return false
  }
}

/** The other half of taking one down, and a separate verb rather than a toggle. */
export async function putBackBuild(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/builds/${id}/restore`, { method: 'POST' })
    if (response.ok) mark(id, false)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Record on the local build whether its listing is on the shelves.
 *
 * Without it the menu cannot tell the two states apart and offers Take it down
 * for a build already down, which is how `putBackBuild` ended up with no caller
 * at all: there was no state for a Put it back control to key on.
 */
function mark(id: string, down: boolean): void {
  const held = loadBuilds().find((one) => one.publishedAs === id)
  if (held) saveBuild({ ...held, publishedDown: down })
}

/**
 * Fetch a published build and unpack it, exactly as a share link is unpacked.
 *
 * Returns null for anything that does not resolve, and does not distinguish a
 * missing id from a corrupt payload: both mean the same thing to whoever
 * followed the link, which is that there is nothing on the other end of it.
 */
export async function openPublished(id: string): Promise<Opened | null> {
  try {
    const response = await fetch(`/api/b/${id}`)
    if (!response.ok) return null
    const { payload, takenDown } = (await response.json()) as {
      payload: string
      takenDown?: boolean
    }
    const build = await unpackBuild(payload)
    return build ? { build, takenDown: takenDown === true } : null
  } catch {
    return null
  }
}

/**
 * A published build and whether its author has taken it off the shelves.
 *
 * The link keeps working after a takedown, so somebody can open one and needs
 * telling: this is the last version the author published and it is not on the
 * exchange any more. Silently showing it as current would be the wrong kind of
 * quiet.
 */
export type Opened = { build: ShownBuild; takenDown: boolean }

/**
 * Put a listing of yours back in the library, when its build is not there.
 *
 * **The way back for a build you deleted after publishing.** The listing keeps
 * going on the server, holding one of your slots and read by everybody
 * following it, and once the bin was emptied nothing on your side named it:
 * the Mine shelf did, and that shelf is now your side of Builds. This reads the
 * published version and writes it as yours, stamped as that listing, so
 * Replace and Take it down work on it again.
 *
 * The published version is what comes back, not what you last had, which is
 * the only version anywhere to be had. A build still in the bin is refused,
 * because putting that one back keeps whatever you changed after publishing.
 */
export async function reclaimListing(
  id: string,
): Promise<{ ok: true; build: SavedBuild } | { ok: false; say: string }> {
  if (loadBuilds().some((one) => one.publishedAs === id)) {
    return { ok: false, say: 'That build is already in your builds.' }
  }
  if (loadBin().some((one) => one.publishedAs === id)) {
    return { ok: false, say: 'That build is in the bin. Put it back from there to keep your own version.' }
  }
  const opened = await openPublished(id)
  if (!opened) return { ok: false, say: 'That did not work. The listing could not be read.' }
  const taken = loadBuilds().some((one) => one.id === opened.build.id)
  const base = received(opened.build)
  const build: SavedBuild = {
    ...base,
    // A build already here under the same id is a different build now, and
    // writing over it would lose it.
    id: taken ? newBuildId() : base.id,
    by: 'owner',
    publishedAs: id,
    publishedHash: fingerprint(shapeOf(opened.build)),
    publishedDown: opened.takenDown,
  }
  saveBuild(build)
  return { ok: true, build }
}

/**
 * Reconnect listings to the builds they were published from.
 *
 * **A listing whose local build carries no `publishedAs` is orphaned.** Nothing
 * offers to update it or take it down, it holds one of the account's slots
 * forever, and pressing Publish on the build it came from mints a second
 * listing rather than replacing the first, which is the duplicate problem the
 * republish route exists to prevent.
 *
 * Two ways in. Everything published before that field existed has no stamp, and
 * that is not hypothetical: the owner had exactly one such listing. And
 * publishing from a browser you no longer have leaves the same hole for anybody.
 *
 * ## Matched on the picks, never on the name
 *
 * The danger here is stamping the wrong build: `publishedAs` is a claim that
 * updating this build replaces that listing, so a wrong match hands somebody a
 * button that overwrites a listing with a different build. A name is a label a
 * person can change and reuse; `shapeOf` is what the build actually is, and it
 * is the same comparison run reporting already trusts.
 *
 * So the rules are deliberately strict, and skipping is always the safe answer:
 *
 * - only builds that are yours and carry no stamp already
 * - the shape must match exactly
 * - **an ambiguous match is skipped, not guessed.** Two local builds with the
 *   same picks are a duplicate and a fork, and picking either one would be a
 *   coin toss with somebody's listing as the stake. The name breaks a tie only
 *   when it is exact
 *
 * ## What it costs
 *
 * One request for the list, then one per listing that nothing local claims. A
 * reconnected listing is claimed from then on, so this settles to a single
 * cheap call. `once` stops it running twice in a page: a genuinely orphaned
 * listing can never be matched, and without the guard it would be re-fetched
 * on every render that asked.
 */
let reconnected = false

export async function reconnectPublished(): Promise<number> {
  if (reconnected) return 0
  reconnected = true

  const listings = await myPublished()
  if (!listings.length) return 0

  const library = loadBuilds()

  /**
   * First, bring the down-state of everything already connected up to date.
   *
   * The same one request answers both halves, so this costs nothing extra. It
   * matters because the flag can go stale without this browser doing anything:
   * take a listing down on a laptop and the phone still offers Take it down
   * until it is told otherwise.
   */
  const by = new Map(listings.map((one) => [one.id, one]))
  for (const held of library) {
    if (!held.publishedAs) continue
    const listing = by.get(held.publishedAs)
    if (!listing) continue
    const down = listing.takenDownAt !== null
    if (down !== (held.publishedDown ?? false)) saveBuild({ ...held, publishedDown: down })
  }

  const claimed = new Set(library.map((one) => one.publishedAs).filter(Boolean))
  const orphans = listings.filter((one) => !claimed.has(one.id))
  if (!orphans.length) return 0

  /* Only your own, and only the ones with nothing to lose by being stamped. */
  const candidates = library.filter((one) => one.by === 'owner' && !one.publishedAs)
  if (!candidates.length) return 0

  let joined = 0
  for (const listing of orphans) {
    const opened = await openPublished(listing.id)
    if (!opened) continue

    const shape = fingerprint(shapeOf(opened.build))
    const same = candidates.filter((one) => fingerprint(shapeOf(one)) === shape && !one.publishedAs)
    /* Ambiguous, so leave it alone. An exact name settles a tie and nothing
       else does: two builds with the same picks and the same name are the same
       build by every measure this tool has. */
    const exact = same.filter((one) => one.name === listing.name)
    const match = same.length === 1 ? same[0] : exact.length === 1 ? exact[0] : null
    if (!match) continue

    saveBuild({
      ...match,
      publishedAs: listing.id,
      publishedHash: shape,
      publishedDown: listing.takenDownAt !== null,
    })
    match.publishedAs = listing.id
    joined += 1
  }
  return joined
}
