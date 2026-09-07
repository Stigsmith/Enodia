/**
 * Changes waiting for a follower to answer.
 *
 * Following a build means the author's work reaches you. It also means they can
 * replace it with something else, or take it away, and the first version of this
 * did both silently: `refreshFollowed` compared a revision number and overwrote
 * the build in place. The owner's objection was exact, that an author turning a
 * build into a worse one should not simply become your build.
 *
 * So the rule is **prose applies, the build itself is offered**. A better note,
 * a fixed typo, a clearer name: those land quietly, because nobody wants to be
 * asked about a typo. Anything that changes what you would actually build waits
 * here until you look at it. `shapeOf` already draws that line for run
 * reporting, over the picks and not the words, so this needs no new judgement
 * about what counts as a real change.
 *
 * ## Why this is its own store and not a field on the build
 *
 * `saveBuild` stamps `modified: now` on every write, and `state/sync.ts` merges
 * newest wins. Recording an offer on the build would make a background poll look
 * like an edit, and it would beat a real edit made on another device an hour
 * earlier. **A noticing must not be able to outrank a change.**
 *
 * It is also a cache rather than a record, in the sense `DESIGN.md` uses of
 * `enodia.run.tally`: every entry is rebuilt from the server on the next
 * refresh, and losing the file costs one round trip. That is why it stays out of
 * the synced settings in `state/sync.ts`, alongside `enodia.stamps` and
 * `enodia.tombstones`, which are this device's account of a conversation rather
 * than anything of the player's.
 */

const KEY = 'enodia.follow.offers'
const VERSION = 1

/**
 * The author replaced the picks, and this is what they replaced them with.
 *
 * The payload is kept rather than re-fetched on accept, for two reasons: the
 * screen can draw the incoming version beside the held one without a request,
 * and accepting may happen hours later on a train.
 */
export type Changed = {
  kind: 'changed'
  /** The published id, which is what this is an offer from. */
  from: string
  revision: number
  name: string
  payload: string
  at: number
  /** The revision the follower said no to, so the same one is not asked twice. */
  declined?: number
}

/** The author took it off the shelves. Nothing to answer, only to know. */
export type Gone = { kind: 'takenDown'; from: string; at: number }

export type Offer = Changed | Gone

/** Keyed by the local build id, because that is what the library screen holds. */
export type Offers = Record<string, Offer>

function read(): Offers {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const held = JSON.parse(raw) as { version?: number; offers?: Offers }
    /* A file from a version this one does not know is dropped rather than
       migrated. It is a cache: the next refresh rebuilds it. */
    if (held.version !== VERSION) return {}
    return held.offers ?? {}
  } catch {
    return {}
  }
}

export function loadOffers(): Offers {
  return read()
}

export function offerFor(localId: string): Offer | null {
  return read()[localId] ?? null
}

function write(offers: Offers): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, offers }))
  } catch {
    /* Storage full or blocked. An offer is a convenience and the build itself is
       untouched either way, so this is not worth failing a refresh over. */
  }
}

/**
 * Replace the whole set, which is how a refresh ends.
 *
 * Wholesale rather than one at a time, because that is what prunes it: a build
 * that was forked, deleted, or whose author put it back is simply not in the new
 * set. Nothing has to remember to clean up after itself.
 */
export function setOffers(offers: Offers): void {
  write(offers)
}

/** Answer one, by taking it or by keeping what you have. */
export function clearOffer(localId: string): void {
  const offers = read()
  delete offers[localId]
  write(offers)
}

/**
 * Say no to this revision, and stay followed.
 *
 * The offer is kept rather than dropped, carrying the revision that was refused,
 * so the next refresh can tell "you already said no to this" from "the author
 * has moved again since". Saying no once should not mean never being told
 * anything again.
 */
export function declineOffer(localId: string): void {
  const offers = read()
  const held = offers[localId]
  if (!held || held.kind !== 'changed') return
  offers[localId] = { ...held, declined: held.revision }
  write(offers)
}
