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
import { duplicateBuild, loadBuilds, newBuildId, saveBuild } from './builds.ts'
import { clearOffer, loadOffers, offerFor, setOffers } from './offers.ts'
import type { Offers } from './offers.ts'
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

/**
 * What earlier versions of a build earned, when its author replaced the picks
 * and somebody had already played or rated what was there before.
 *
 * **No `players`.** That is a distinct-people claim, and folding versions
 * together would count somebody who played two of them twice. The worker omits
 * it for that reason and this mirrors it.
 */
export type Before = Omit<Stats, 'players'>

/** One build on a shelf, unpacked and ready for the ordinary filters. */
export type Listed = {
  /** The published id, which is what runs are reported against. */
  id: string
  by: string
  createdAt: number
  /** The owner's own words, on the picked shelf only. */
  note?: string
  /** Whether you published it. A boolean from the worker, never an id. */
  mine?: boolean
  /**
   * Whether you have taken it off the shelves. Only the Mine shelf answers.
   *
   * Absent everywhere else, because every other shelf filters those rows out
   * and has therefore not been asked. Reading absent as false would have a
   * screen say a listing is up on a shelf that would not have shown it either
   * way.
   */
  takenDown?: boolean
  build: ShownBuild
  stats: Stats
  /**
   * Beside `stats` rather than inside it, because that is where the worker puts
   * it and a type that disagrees with the wire is a field that never arrives.
   *
   * It was declared inside `Stats` first and `shelfAt` silently dropped it,
   * which is exactly what happened to `mine` above. Caught by looking at a
   * listing that should have had one.
   */
  before?: Before
}

/**
 * Which shelf is open.
 *
 * `all` and `mine` were added after the owner published nine builds and could
 * see one: the picked shelf shows only what the curator chose and the friends
 * shelf cannot contain your own, so an account's own listings were on no shelf
 * at all.
 */
export type Shelf = 'picked' | 'all' | 'friends' | 'mine'

type Wire = {
  id: string
  name: string
  payload: string
  by: string
  createdAt: number
  note?: string
  /**
   * Optional here for the same reason it is optional on `Listed`: the worker
   * omits it entirely when nobody is signed in, and that absence is an answer.
   *
   * **This field was declared on `Listed` and computed by the worker for weeks
   * without ever being declared here, so `shelfAt` had nothing to copy.** The
   * cost was that `Relation` never reached its "This one is yours" branch and
   * offered Follow on your own listing, which then wrote a second copy of your
   * own build into your library marked as somebody else's.
   */
  mine?: boolean
  /* Declared here as well as on `Listed`, which is the whole lesson of the
     paragraph above: a field the worker sends and this type does not name is a
     field `shelfAt` cannot copy, and nothing fails. */
  takenDown?: boolean
  stats: Stats
  before?: Before
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
  /**
   * Worth adding is sorted before it is hashed, and the build's boons are not.
   *
   * `optional` is a **ranked wishlist**: which of three hammers you would rather
   * have first. Re-ranking it is a change to advice, not to what anybody
   * played, so it must not stop a taken copy reporting its runs. Adding or
   * removing one still moves the hash, which is right, because that changes
   * what the build asks for.
   *
   * `boons` keeps its order, because there the order is a property of the build
   * rather than a preference: `data/builds.ts` says core slots come first, and
   * nobody drags those into place by hand.
   */
  const ranked = (ids: readonly string[] | undefined) => [...(ids ?? [])].sort().join(',')
  return [
    `weapon=${build.weapon}`,
    `aspect=${build.aspect}`,
    `playstyle=${build.playstyle ?? ''}`,
    `centrepiece=${build.centrepiece}`,
    `boons=${list(build.boons)}`,
    `optional=${ranked(build.optional)}`,
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
      // Same conditional spread as the note above, and for a sharper reason:
      // absent means nobody is signed in, so the shelf does not know whose this
      // is. Defaulting that to false would have the screen say "not yours" when
      // what it means is that it never asked.
      ...(row.mine === undefined ? {} : { mine: row.mine }),
      ...(row.takenDown === undefined ? {} : { takenDown: row.takenDown }),
      ...(row.before === undefined ? {} : { before: row.before }),
      // The server's name is authoritative for the listing: it is what the
      // author published under, and the packed build could say anything.
      build: { ...build, name: row.name },
      stats: row.stats,
    })
  }
  return out
}

const PATHS: Record<Shelf, string> = {
  picked: '/api/exchange',
  all: '/api/exchange/all',
  friends: '/api/exchange/friends',
  mine: '/api/exchange/mine',
}

export const listShelf = (shelf: Shelf): Promise<Listed[]> => shelfAt(PATHS[shelf])

export type TakeOutcome = { ok: true; build: ShownBuild } | { ok: false; say: string }

/**
 * Follow a build, which is the relationship the exchange offers now.
 *
 * **A follow is not a copy, and the difference is who the build belongs to.** A
 * copy was yours the moment you took it: your name on it, editable, and frozen
 * at the moment you pressed the button. Following leaves it the author's. Their
 * edits reach you, nothing about it is yours to change, and the moment you want
 * to change something you fork it and it becomes an ordinary build of yours.
 *
 * The owner's words for why: "I thought we were doing more of a subscription
 * thing. You basically subscribe to somebody else's build. If they want to
 * update it or improve it, then you seamlessly copy those improvements."
 *
 * **It is stored as an ordinary build with `by: 'community'`.** That member of
 * `Provenance` has existed unused since the type was written and this is what
 * it is for. Storing it as a build rather than as a separate followed-thing
 * table means the library lists it, the filters narrow it, sync carries it and
 * the run can be pointed at it, all without a second code path. What marks it
 * is the provenance and `derivedRevision`, not a parallel store.
 */
export async function followBuild(id: string): Promise<TakeOutcome> {
  /**
   * Not your own, and the check is local because it cannot be anywhere else.
   *
   * `take` refuses this on the server (`worker/exchange.ts:306`) and the shelf
   * refuses it on the screen now that `mine` reaches it, but neither covers a
   * raw `/b/<id>` link: that route takes no session, so the server does not
   * know who is asking and will hand you your own build back. Following it
   * would put a second copy of your own build in your library marked as
   * somebody else's, which is what the owner hit.
   *
   * Before the request, so a refusal costs nothing. The sentence is the
   * worker's own, because two ways of saying it is one too many.
   *
   * **Known hole, stated rather than papered over:** a build published before
   * `publishedAs` existed carries no stamp, so its own author can still follow
   * a raw link to it. The shelf catches that case with `mine`, and the outcome
   * is one harmless duplicate rather than anything destructive.
   */
  if (loadBuilds().some((one) => one.publishedAs === id)) {
    return { ok: false, say: 'That build is yours. It is already in your library.' }
  }

  let response: Response
  try {
    response = await fetch(`/api/b/${id}`)
  } catch {
    return { ok: false, say: 'Could not reach the server. Nothing here has changed.' }
  }

  if (!response.ok) return { ok: false, say: 'That build is not there any more.' }

  const { payload, name, revision, takenDown } = (await response.json()) as {
    payload: string
    name: string
    revision?: number
    takenDown?: boolean
  }

  /**
   * A build off the shelves takes no new followers.
   *
   * `take` says the same on the server, and this is the path that never reaches
   * it: `/api/b/:id` keeps answering after a takedown on purpose, so anybody
   * with the link can still read one. Reading it is the point; starting a
   * relationship with it is not, because it will never change again and its
   * author has said they are done with it.
   */
  if (takenDown) return { ok: false, say: 'That build has been taken off the exchange.' }

  const source = await unpackBuild(payload)
  if (!source) return { ok: false, say: 'That build is in a format this version cannot read.' }

  /**
   * Already following it: refresh rather than add a second one.
   *
   * The whole reported bug was N clicks producing N builds. A follow is a
   * relationship and you either have it or you do not.
   */
  const held = loadBuilds().find((one) => one.derivedFrom === id && one.by === 'community')

  const followed: ShownBuild = {
    ...source,
    id: held?.id ?? newBuildId(),
    by: 'community',
    name: name || source.name,
    derivedFrom: id,
    // Of the picks, not of the payload. `shapeOf` says why at length.
    derivedHash: fingerprint(shapeOf(source)),
    derivedRevision: revision ?? 0,
    /* Their runs are not yours. A followed build starts with no record here,
       and anything you log against it is yours from then on. */
    ...(held?.play ? { play: held.play } : { play: undefined }),
  }

  saveBuild(followed)

  /**
   * Tell the server, so the count on the listing can move again.
   *
   * **Nothing had written `taken_at` since following replaced taking**, so
   * "Taken N" on every listing was frozen at whatever the copy era left in it.
   * A number on screen that can never change is worse than no number, because
   * it reads as current.
   *
   * The `take` route rather than a new one: it already refuses your own build,
   * refuses one that has been taken down, dedupes so a second press is the same
   * relationship rather than a second person, and files the row under the
   * build's current shape. All four are things this would otherwise reimplement.
   * The payload it hands back is thrown away, which costs about 1.2 KB on a
   * button somebody pressed on purpose.
   *
   * **Not awaited, and a failure is not a failure.** The follow is already in
   * the library; the count is somebody else's tally. Losing it is worth less
   * than making a person watch a spinner, or telling them the thing they asked
   * for did not happen when it did.
   */
  void fetch(`/api/exchange/${id}/take`, { method: 'POST' }).catch(() => {})

  return { ok: true, build: followed }
}

/** What a refresh did, so the screen can say so. */
export type Refreshed = {
  /** Applied silently: the author changed words and not picks. */
  moved: number
  /** Waiting for an answer, because the picks changed. */
  offered: number
  /** Authors who took a build off the shelves. */
  down: number
}

/**
 * Re-read every followed build. **Apply prose, offer the build itself.**
 *
 * This used to compare a revision number and overwrite whatever it found, which
 * meant an author could turn a build you follow into a different and worse one
 * and it would simply become your build. That is the failure the owner named.
 *
 * The line is `shapeOf`, the same one run reporting already uses: the picks are
 * the build, and the name and the write-up are not. So a fixed typo lands
 * quietly, because being asked about a typo is worse than not being told, and a
 * swapped boon waits in `state/offers.ts` until you look at it.
 *
 * Cheap on purpose. The revision is compared first, so a build that has not
 * changed costs one request, no unpack and no write.
 */
export async function refreshFollowed(): Promise<Refreshed> {
  const followed = loadBuilds().filter((one) => one.by === 'community' && one.derivedFrom)
  const held = loadOffers()
  const next: Offers = {}
  let moved = 0

  for (const one of followed) {
    const from = one.derivedFrom as string
    try {
      const response = await fetch(`/api/b/${from}`)

      /**
       * Rate limited: stop, rather than spending the rest of the budget one
       * refused request at a time.
       *
       * `worker/limit.ts` allows 120 reads a minute per address. A library with
       * more followed builds than that would previously have carried on asking
       * and been refused for every one of them.
       */
      if (response.status === 429) break

      /* Anything else that is not ok, including a 404 for a build genuinely
         purged, leaves both the build and any existing offer exactly as they
         are. Offline and gone are not distinguishable here and should not be
         acted on differently. */
      if (!response.ok) {
        const carry = held[one.id]
        if (carry) next[one.id] = carry
        continue
      }

      const { payload, name, revision, takenDown } = (await response.json()) as {
        payload: string
        name: string
        revision?: number
        takenDown?: boolean
      }

      /**
       * Taken down: record it and touch nothing.
       *
       * The docblock here used to promise this and got it by accident, because
       * a takedown was a delete and the fetch 404'd. Now the row survives and
       * answers, so without this branch a build the author took down and
       * changed on the way out would be applied like any other change.
       */
      if (takenDown) {
        next[one.id] = { kind: 'takenDown', from, at: Date.now() }
        continue
      }

      const now = revision ?? 0
      if (now === (one.derivedRevision ?? 0)) continue

      const source = await unpackBuild(payload)
      if (!source) continue

      /**
       * The picks decide. Equal means the author rewrote words, which is theirs
       * to do and yours to receive; different means they changed the build, and
       * that waits.
       */
      if (fingerprint(shapeOf(source)) === one.derivedHash) {
        saveBuild({
          ...source,
          id: one.id,
          by: 'community',
          name: name || source.name,
          derivedFrom: from,
          derivedHash: one.derivedHash,
          derivedRevision: now,
          ...(one.play ? { play: one.play } : {}),
        })
        moved += 1
        continue
      }

      /* Already said no to exactly this one. Carried forward rather than asked
         again; a further change from the author moves the revision and asks. */
      const before = held[one.id]
      const declined =
        before && before.kind === 'changed' && before.declined === now
          ? { declined: now }
          : {}

      next[one.id] = { kind: 'changed', from, revision: now, name, payload, at: Date.now(), ...declined }
    } catch {
      // Offline, or the server is having a moment. Nothing here changes.
      const carry = held[one.id]
      if (carry) next[one.id] = carry
    }
  }

  /* Wholesale, which is what prunes entries for builds that were forked,
     deleted, or whose author put them back. */
  setOffers(next)

  const outstanding = Object.values(next)
  return {
    moved,
    offered: outstanding.filter((o) => o.kind === 'changed' && o.declined !== o.revision).length,
    down: outstanding.filter((o) => o.kind === 'takenDown').length,
  }
}

/**
 * Take the version an author offered, which is following as it was meant to be.
 *
 * It goes through `followBuild`, so there is still exactly one function that
 * writes a follow: it re-fetches, finds the held entry through the same dedupe,
 * keeps the `play` record, and sets the new revision and hash.
 */
export async function acceptOffer(build: ShownBuild): Promise<TakeOutcome> {
  const offer = offerFor(build.id)
  if (!offer || offer.kind !== 'changed') {
    return { ok: false, say: 'There is nothing waiting for that build.' }
  }
  const outcome = await followBuild(offer.from)
  if (outcome.ok) clearOffer(build.id)
  return outcome
}

/**
 * Would republishing this replace the build rather than the write-up?
 *
 * True when the picks have moved since it was published, which is the moment
 * the listing's counts start again and everybody following it gets asked
 * instead of updated. The author is told before that happens, and the same
 * answer decides both the warning and what the server does with it.
 *
 * **One function, so the screen and the request cannot disagree**, which is the
 * argument `reportsTo` makes above about `LogRun`. A dialog that warns on a
 * different rule from the one the server applies is worse than no dialog.
 *
 * False for a build that has never been published, because there is nothing to
 * replace, and false when it has no recorded shape, which is a build published
 * before that was stamped: no basis to claim anything changed.
 */
export function republishChangesTheBuild(build: ShownBuild): boolean {
  if (!build.publishedAs || !build.publishedHash) return false
  return fingerprint(shapeOf(build)) !== build.publishedHash
}

/**
 * Make a followed build yours, which is what editing one does.
 *
 * The follow ends: one build in the library rather than two, now an ordinary
 * owner build with your name on it. `derivedFrom` and `derivedHash` survive, so
 * runs you log still count toward the build it came from until you change a
 * pick, which is exactly what they mean on a copy.
 */
export function forkFollowed(build: ShownBuild): ShownBuild {
  const mine: ShownBuild = {
    ...build,
    by: 'owner',
    derivedRevision: undefined,
  }
  saveBuild(mine)
  return mine
}

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
      /**
       * The shape travels with the run, so the server files it under the
       * version that was actually played.
       *
       * `reportsTo` has already established these picks match what the author
       * published as of the last refresh, but the author can have republished
       * since. Sending it means a run against picks they have replaced is
       * answered and quietly not counted, rather than moving numbers about a
       * build it was never run against.
       */
      body: JSON.stringify({ cleared, fear, shape: fingerprint(shapeOf(build)) }),
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
