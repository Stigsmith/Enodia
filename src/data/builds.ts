/**
 * A build, as something to look at.
 *
 * `data/types.ts Build` describes a build as a set of prerequisites, because
 * that is what `engine/reachability.ts verdictForBuild` needs to judge one. It
 * is the wrong shape for showing somebody a build, which is what this file is
 * about: a full loadout is an aspect, a dozen boons across five core slots and
 * beyond them, a Hex, two hammers, a keepsake, a familiar and five Arcana.
 *
 * ## Written for a library, not for eight
 *
 * These eight are placeholders for **dozens of tested builds from the
 * community**, and later for builds the community adds itself. So the shape
 * carries what a library needs and a demo does not: `by` says where a build
 * came from, and `how` is the paragraph explaining it. Both are dead weight at
 * eight entries and both are the point at eighty.
 *
 * Everything the overview filters on is **derived, not stored**. Aspect comes
 * from `aspect`, gods come from the boons' own god lists, keepsake and familiar
 * are already fields. Nothing here restates a fact the data answers, which is
 * the mistake the `gods` field made before it was deleted.
 *
 * ## These are samples, not recommendations
 *
 * **Nothing here is a judgement about what is good.** `CLAUDE.md` is clear that
 * evaluations come from the owner, and `data/curated/builds.json` is where the
 * real ones will live, still empty and still theirs.
 *
 * What these are is **mechanically coherent**: every id is real, every duo's
 * prerequisites are actually held, no two boons contend for the same core slot,
 * and no build reaches past the four Olympian slots. `builds.test.ts` holds
 * them to it, so a sample that drifts into nonsense fails the build rather than
 * quietly misleading whoever is looking at the design.
 *
 * **`how` describes, it does not rate.** Each one says what feeds what, and
 * every claim in it restates a boon's own description or a prerequisite the
 * data states. None says a build is strong, or fast, or better than another,
 * because that is not in any file and is not mine to write.
 */

import type { TraitId } from './types.ts'

/** One familiar, by the id `FamiliarData.lua` lists in `FamiliarOrderData`. */
export type FamiliarId = string

/** One Arcana card, by its key in `MetaUpgradeCardData`. */
export type ArcanaId = string

/**
 * Where a build came from.
 *
 * `sample` is the only one in use. The others are here because the library is
 * going to hold other people's work, and a reader is owed the difference
 * between a build the owner tested and a build somebody uploaded.
 */
export type Provenance = 'sample' | 'owner' | 'community'

/** How dependably a build comes together, in the player's own judgement. */
export type Assembles = 'reliably' | 'situational' | 'needs-luck'

/**
 * What a build is built to do.
 *
 * **The game's own words, from the table in `CLAUDE.md`.** Attack is `Melee`,
 * Special is `Secondary`, Cast is `Ranged`, Sprint is `Rush`, Magick is `Mana`,
 * and the Ω forms are `Omega`. Using the player-facing column is the rule that
 * file states, and the internal names stay in the code.
 *
 * **It does nothing on its own yet**, and that is deliberate. The owner wants a
 * hook for advice later: "you have a god slot open, and Demeter's Weed Killer
 * suits a build leaning on Ω Attack". The advice is theirs to write and is not
 * derivable from any file, which is the same line `CLAUDE.md` draws around
 * every other evaluation. This is the field it will hang off.
 */
export type Playstyle =
  | 'attack'
  | 'omega-attack'
  | 'special'
  | 'omega-special'
  | 'cast'
  | 'omega-cast'
  | 'sprint'
  | 'magick'
  | 'hex'

/** The nine, in the order the game lists the moves they name. */
/**
 * The nine, with what each one means.
 *
 * **`say` describes the move, not the build.** Every line below is a mechanic
 * the game states in its own glossary (`HelpText.en.sjson`, the `Keywords`
 * entries), rewritten in this tool's words: what "Ω Special" is, not whether a
 * build that leans on it is any good. That keeps it on the right side of the
 * line `CLAUDE.md` draws, where mechanics are mine to read out of the files and
 * evaluations are the owner's.
 *
 * The order is the order the game lists the moves in, which is why
 * `build-filter.ts` can rank by index rather than keeping a second list.
 */
export const PLAYSTYLES: { id: Playstyle; name: string; say: string }[] = [
  {
    id: 'attack',
    name: 'Attack',
    say: 'The weapon’s ordinary Attack, with no Magick spent on it.',
  },
  {
    id: 'omega-attack',
    name: 'Ω Attack',
    say: 'The Attack held down rather than tapped, spending Magick for a stronger version of it.',
  },
  {
    id: 'special',
    name: 'Special',
    say: 'The weapon’s ordinary Special, with no Magick spent on it.',
  },
  {
    id: 'omega-special',
    name: 'Ω Special',
    say: 'The Special held down rather than tapped, spending Magick for a stronger version of it.',
  },
  {
    id: 'cast',
    name: 'Cast',
    say: 'The Cast that binds what it catches, and can pick up other properties from boons.',
  },
  {
    id: 'omega-cast',
    name: 'Ω Cast',
    say: 'The Cast held down, spending Magick so that it damages what it caught when it runs out.',
  },
  {
    id: 'sprint',
    name: 'Sprint',
    say: 'Holding the dash to keep running at speed, and whatever the build hangs off doing so.',
  },
  {
    id: 'magick',
    name: 'Magick',
    say: 'Magick itself: the pool every Ω Move spends, and having enough of it to keep spending.',
  },
  {
    id: 'hex',
    name: 'Hex',
    say: 'Selene’s Hex, which becomes available once enough Magick has been spent near enemies.',
  },
]

/**
 * The three, in order, with the words a reader sees.
 *
 * One list, so the editor's control and the detail strip cannot drift into
 * calling the same state two different things.
 */
export const ASSEMBLES: { id: Assembles; name: string }[] = [
  { id: 'reliably', name: 'Reliably' },
  { id: 'situational', name: 'Situational' },
  { id: 'needs-luck', name: 'Needs luck' },
]

/**
 * How a build has actually gone, for this player.
 *
 * **Personal to this install, and not part of what a build is.** Two people can
 * hold the same build and have played it a different number of times, so when
 * single build sharing arrives this is the one key the export drops. That is
 * the whole reason it is nested rather than four loose fields: one `delete`
 * instead of four, and no chance of missing one.
 *
 * Every field is optional. A build nobody has rated is the normal case, and
 * `engine/build-check.ts` must not find anything to say about it.
 */
export type PlayRecord = {
  /** one to five, absent for none */
  rating?: number
  runs?: number
  clears?: number
  assembles?: Assembles
  /**
   * The highest Fear this build has cleared, here, for this player.
   *
   * A fact about how a build has gone rather than about the build, which is
   * what this whole record is for and why `shareable()` strips it: a link
   * carrying "cleared Fear 20" would be claiming something about the recipient's
   * runs. It also makes the useful question askable on the overview, which a
   * single profile high-water mark could not: which of my builds have cleared
   * Fear 20 or better.
   */
  fear?: number
  /**
   * Which vows were on, and how far up each one was taken.
   *
   * **A total is a sum with its terms thrown away.** Fear 20 under Vow of Pain,
   * Grit and Frenzy is a different run from Fear 20 under Void, Denial and
   * Forfeit: one makes the fight harder and the other takes the build's own
   * pieces away. "Cleared Fear 20" says nothing about which, and a build that
   * survives one may be exactly the build that cannot survive the other.
   *
   * Optional, and expected to stay optional. Most people will type the number
   * and move on, which is fine: this is detail for a run somebody wants to be
   * precise about, not a form to fill in. `engine/vows.ts` holds the arithmetic
   * and says why it is the shrine's rather than ours.
   */
  vows?: Record<string, number>
}

/**
 * The most Fear a run can carry. **Moved to `data/app.ts` and now summed.**
 *
 * It was 57 here, hard-coded, under a comment saying it was the sum of every
 * vow rank. It is not: the sum is 67, and 57 is a number nothing in the data
 * produces. The vows are extracted now, so the constant is arithmetic over them
 * rather than a claim about arithmetic nobody had run.
 *
 * Re-exported rather than moved outright, because a dozen call sites import it
 * from here and `data/builds.ts` is where the shape of a build lives.
 */
export { MAX_FEAR } from './app.ts'

/**
 * Clears over runs, or null when there is nothing to divide.
 *
 * **Clamped, not trusted.** The editor already refuses clears above runs, but
 * storage is a text file a person can edit and a build can arrive from another
 * install. A rate over 100 percent must be impossible to render, so the clamp
 * lives here where every caller gets it rather than in the one control.
 */
export function winRate(play: PlayRecord | undefined): number | null {
  const runs = play?.runs ?? 0
  if (!Number.isFinite(runs) || runs <= 0) return null
  const clears = Math.max(0, Math.min(play?.clears ?? 0, runs))
  return clears / runs
}

/**
 * Where each of a run's four keepsakes is taken, in the game's own words.
 *
 * A Guardian ends each Region (`Boss` in the glossary reads "Guardian"), and
 * the rack comes after it. The first entry is the one chosen at the Crossroads.
 */
export const KEEPSAKE_POSITIONS = [
  'To start',
  'After the first Guardian',
  'After the second Guardian',
  'After the third Guardian',
] as const

/**
 * A build's swaps, always three long, with anything that is not an id read as
 * keeping the one you have.
 *
 * A stored build or a link can carry anything in the field, and both
 * `looksLikeBuild` checks predate it, so nothing downstream reads `swaps`
 * directly.
 */
export function swapsOf(build: Pick<ShownBuild, 'swaps'>): (TraitId | null)[] {
  const raw = Array.isArray(build.swaps) ? build.swaps : []
  return [0, 1, 2].map((at) => {
    const id = raw[at]
    return typeof id === 'string' && id ? id : null
  })
}

/**
 * Every keepsake a build carries at some point in a run, the one it starts with
 * first, each once. What the keepsake filter, the facets and the shared image
 * read, because a build that swaps to Fig Leaf is a build that uses Fig Leaf.
 */
export function keepsakesOf(build: Pick<ShownBuild, 'keepsake' | 'swaps'>): TraitId[] {
  const out: TraitId[] = []
  for (const id of [build.keepsake, ...swapsOf(build)]) {
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

/**
 * How long one note on a pick may be, and how long all of a build's notes may
 * be together. Both count the text as stored, a mention included.
 *
 * **The total is what keeps a build inside one link.** `DESIGN.md` 9 carries
 * the whole build in the address, and 2000 characters is where a Discord
 * message stops. The worst build the tests know, 29 picks with every other
 * field of prose at its limit, packs to 1627 characters with no notes. 500
 * characters of notes brings it to about 1960 and 600 goes past 2000, measured
 * with `packBuild` using the game's own sentences as stand-in notes.
 * `transfer.test.ts` holds it under.
 */
export const NOTE_MAX = 140
export const NOTES_BUDGET = 500

/**
 * Every id in a build that can carry a note, each once: the aspect, the boons,
 * the ones worth adding, the Hex, the hammers, every keepsake, the familiar and
 * the Arcana.
 */
export function picksOf(build: ShownBuild): string[] {
  const out: string[] = []
  const add = (id: string | null | undefined) => {
    if (id && !out.includes(id)) out.push(id)
  }
  add(build.aspect)
  for (const id of build.boons) add(id)
  for (const id of build.optional ?? []) add(id)
  add(build.hex)
  for (const id of build.hammers) add(id)
  for (const id of keepsakesOf(build)) add(id)
  add(build.familiar)
  for (const id of build.arcana) add(id)
  return out
}

/** The stored text of a note, or nothing when the field holds anything else. */
const noteText = (build: ShownBuild, id: string): string | null => {
  const raw: unknown = build.notes
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || !Object.hasOwn(raw, id)) return null
  const text = (raw as Record<string, unknown>)[id]
  return typeof text === 'string' ? text : null
}

/**
 * A build's notes, for the picks it still holds and nothing else.
 *
 * Read through this rather than off `build.notes`. A note on a pick that has
 * since been taken out is shown nowhere, and a link or a stored build can carry
 * anything in the field, so a value that is not a string is dropped and one
 * longer than `NOTE_MAX` is cut there.
 */
export function notesOf(build: ShownBuild): Map<string, string> {
  const out = new Map<string, string>()
  for (const id of picksOf(build)) {
    const kept = noteText(build, id)?.trim().slice(0, NOTE_MAX)
    if (kept) out.set(id, kept)
  }
  return out
}

/** How much of `NOTES_BUDGET` the notes on a build's picks take, as typed. */
export function notesLength(build: ShownBuild): number {
  return picksOf(build).reduce((total, id) => total + (noteText(build, id)?.length ?? 0), 0)
}

/**
 * The build with its notes cut down to the picks it holds, or with no `notes`
 * at all when none are left. What the editor saves, so a note on a pick that
 * was taken out does not go on travelling in links where nobody can see it.
 */
export function withNotesPruned(build: ShownBuild): ShownBuild {
  const kept = notesOf(build)
  const { notes: _notes, ...rest } = build
  return kept.size ? { ...rest, notes: Object.fromEntries(kept) } : rest
}

/**
 * Whose note it is, the way the reader would say it: "Your note" on a build of
 * yours, "Ana's note" on one somebody else wrote.
 */
export function noteLabel(build: Pick<ShownBuild, 'by' | 'author'>): string {
  if (build.by === 'owner') return 'Your note'
  return build.author ? `${build.author}'s note` : "The author's note"
}

export type ShownBuild = {
  id: string
  name: string
  /** one line, what it is */
  say: string
  /**
   * How it works, in a paragraph.
   *
   * The thing a player actually wants on opening a build: not a list of what is
   * in it, which the layout already shows, but what feeds what.
   */
  how: string
  by: Provenance
  weapon: TraitId
  aspect: TraitId
  /**
   * What the build leans on, in the game's own words.
   *
   * Optional, so every build written before this loads unchanged. See
   * `Playstyle` for why it does nothing yet.
   */
  playstyle?: Playstyle
  /** what the build is for, and what everything else is feeding */
  centrepiece: TraitId
  /**
   * The build. What it is not a build without.
   *
   * In the order they matter, core slots first.
   */
  boons: TraitId[]
  /**
   * Boons that raise the ceiling without being the build.
   *
   * **A base build is not a closed set.** The owner's example: Hestia has a
   * boon that scales Attack power with how many boons you hold, and on a
   * high-attack-speed Sister Blades build you might take Hestia for that one
   * boon and nothing else. It is not part of the build's identity and the build
   * works without it, but holding it is strictly better.
   *
   * Separating them says something the flat list could not: which picks are the
   * build and which are the upside. It also makes the Olympian cost visible,
   * because a single boon from a god the build does not otherwise take still
   * spends one of the four slots.
   *
   * Optional, so every build written before this loads unchanged.
   */
  optional?: TraitId[]
  /**
   * What to do if the run goes your way, and what to leave alone if it does not.
   *
   * The place for everything that is real, useful and not the build: a Hex worth
   * taking if you happen to meet Selene, a fifth god worth a keepsake for one
   * boon, a boon from a god who turns up on their own schedule. All of it is
   * upside, none of it is a plan, and writing any of it into `boons` would make
   * the build read as demanding something it does not actually need.
   *
   * `optional` is the same idea for things that have a trait id. This is for
   * the ones that do not, and for the caveats underneath.
   *
   * Never shown on an overview card. The card is for scanning a shelf, and this
   * is the sort of thing you read once you have already picked a build up.
   *
   * Optional, so every build written before it loads unchanged.
   */
  luck?: string
  /**
   * A line on any pick that needs one, keyed by the pick's id: why this aspect,
   * why that keepsake after the second Guardian, what a boon is there to feed.
   *
   * **Prose, like `how` and `luck`**, so it is outside `shapeOf`: rewording a
   * note is not changing the build, and it reaches a follower without asking.
   * Shown under the game's own text wherever the pick is described, in the
   * author's register rather than the game's, and on the offer at an Exit when
   * a run is going for this build.
   *
   * Read it through `notesOf`, which keeps only the picks the build still holds.
   * Optional, so every build written before it loads unchanged.
   */
  notes?: Record<string, string>
  hex: TraitId | null
  hammers: TraitId[]
  /** the keepsake the run starts with */
  keepsake: TraitId | null
  /**
   * What to swap to at the rack after each of the first three Guardians, in
   * order, with null for keeping the one you have.
   *
   * **A run has four keepsakes, not one.** The rack stands "in the spaces
   * separating each Region" once Kindred Keepsakes is cast
   * (`WorldUpgradePostBossGiftRack`), and `RoomDataF`, `G`, `H`, `N`, `O` and
   * `P` each place one while the final Regions do not. Keyed by position rather
   * than by Region, because a Dream run visits Regions out of order
   * (`DreamRunLogic.lua`) and a Chaos Trial starts partway through.
   *
   * Optional, so every build written before it loads unchanged, and absent
   * rather than three nulls when a build swaps nothing, which is what keeps
   * `shapeOf` exactly as it was for every build that exists. Read it through
   * `swapsOf`, which the shape checks on the way in do not know about.
   */
  swaps?: (TraitId | null)[]
  familiar: FamiliarId | null
  /** the Grasp holds five by default, and the order on the board is the player's */
  arcana: ArcanaId[]
  /**
   * How it has played here. See `PlayRecord`.
   *
   * Optional because the samples have none and because a build is a build
   * without one.
   */
  play?: PlayRecord

  // --- Identity. Written by `state/builds.ts`, never by a form. ------------
  //
  // Every one is optional on `ShownBuild` because the eight samples carry none
  // and do not need any. `SavedBuild` below is the type that has been through
  // the migration, and it requires them.
  //
  // The two `published*` fields are the exception to the heading: they are
  // written by `state/publish.ts`, which is the only place that knows the
  // answer. Same rule otherwise, no form ever writes one.

  /** ISO, when the build was first written. Never changes */
  created?: string
  /** ISO, updated on every save */
  modified?: string
  /** which shape this build is in, so a build sent to another install can say */
  schemaVersion?: number
  /** the id this was duplicated from, or absent. Stored now, displayed later */
  derivedFrom?: string
  /**
   * The author's revision, when this build is one you follow.
   *
   * `by: 'community'` says the build is somebody else's and you are reading
   * their current version; this says which version you have. The worker returns
   * it on every read, so refreshing is a number comparison rather than a diff
   * of a kilobyte of payload.
   *
   * Absent on your own builds and on copies, both of which are snapshots that
   * do not care whether their source moved.
   */
  derivedRevision?: number
  /**
   * What the build looked like the moment it was taken from the exchange.
   *
   * **A hash of `shapeOf`, which is the picks and not the prose.** This line
   * used to say "a hash of the packed original", which was true when it was
   * written and stopped being true when `shapeOf` arrived: renaming a build or
   * rewriting its notes does not move this, and that is exactly the property
   * the follow offer in `state/exchange.ts` now rests on.
   *
   * It is the thing that keeps the exchange's numbers meaning something. Runs
   * logged against a copy are reported back to
   * the build it came from, and only while the copy is still that build: change
   * it and this stops matching, so the reporting stops. Otherwise "38 of 61
   * cleared" would be a claim about somebody else's work that anybody could
   * rewrite by editing their own copy.
   *
   * Absent on a fork of one of your own builds, which reports nothing anywhere.
   */
  derivedHash?: string
  /**
   * Who wrote it, as a name they picked in their own browser.
   *
   * **It travels, unlike `play`.** A build somebody sends you should say whose
   * it is, and that is the only reason this exists. It is not an identity
   * anybody can verify and nothing in the tool treats it as one: there is no
   * account behind it, two people can pick the same name, and `state/identity.ts`
   * says so at more length.
   *
   * Stamped when a build is created and when one is forked, never on an
   * ordinary save. Editing somebody's build does not make it yours.
   */
  author?: string
  /**
   * The short id this build of yours is published under, or absent.
   *
   * **The library had no way to know a build was published at all**, because
   * `publishBuild` wrote nothing back. Three things needed it: the author
   * cannot be offered "update the published copy" for a listing nobody has
   * connected to a build, the exchange cannot refuse to let you follow your own
   * build through a raw link, and nothing could tell the counts on a listing
   * which build in your library they belong to.
   *
   * Written only by `state/publish.ts`, and **stripped from duplicates and from
   * share links**. A copy that inherited this would offer to replace the
   * original listing with the copy, which is the same failure `derivedFrom` and
   * `derivedHash` already caused once and which `state/builds.ts` records at
   * length.
   */
  publishedAs?: string
  /**
   * The shape it had when it was last published, for the same `shapeOf` hash
   * `derivedHash` uses.
   *
   * This is what lets the republish warning fire without asking the server
   * anything: both sides of the comparison are here in the browser. Equal means
   * the edit was prose and republishing is quiet; different means the build
   * itself changed, which resets the listing's counts and asks everybody
   * following it, and the author is told that before it happens.
   */
  publishedHash?: string
  /**
   * Whether that listing is currently off the shelves.
   *
   * **Take it down was built without this and the result was half a feature.**
   * `putBackBuild` had no caller at all, so a listing could be taken down and
   * never restored, and the menu went on offering "Take it down" for a build
   * already down, because nothing on this side knew.
   *
   * Absent means live, which is the common case and the right default for a
   * build that has never been published. Refreshed by
   * `state/publish.ts reconcilePublished` on the same request that reconnects
   * orphans, so it costs nothing extra.
   */
  publishedDown?: boolean
}

/**
 * A build that has been through the migration.
 *
 * The four identity fields are optional on `ShownBuild` so the samples stay
 * clean, which leaves nothing checking that a stored build has them. This is
 * what `loadBuilds` returns, so anything reading storage has the guarantee and
 * anything reading the merged library still only sees a `ShownBuild`.
 */
export type SavedBuild = ShownBuild & {
  id: string
  created: string
  modified: string
  schemaVersion: number
}

/**
 * There is deliberately no `gods` field.
 *
 * It was here, listing the Olympians a build leans on, and it was a hand-kept
 * copy of something the data already answers: `build-pieces.ts assemble` reads
 * each boon's own gods out of the generated bundle. Keeping it meant god names
 * written as string literals in source, which `DESIGN.md` 3.1 forbids and
 * `validate.ts` catches by name. The gods a build takes are derived, and the
 * overview's god filter reads the derived list.
 *
 * A "gods to avoid" list is not derivable, but it is a judgement, and
 * judgements belong to the owner in `data/curated/builds.json`.
 */

/**
 * The library ships empty.
 *
 * **On purpose, and it took three goes to get here.** Eight placeholder builds
 * shipped first, to prove the screens worked. They did that, and then they sat
 * in everybody's library looking like recommendations. They were cut to one, a
 * deliberately absurd stress test called Every Pair, which did its job for the
 * card and the tray and the reading and then had the same problem at a
 * ninth the size: it was the only thing in the library, so it was what the
 * library looked like.
 *
 * Real builds are written by people who play the game, and the owner and the
 * testers are about to start writing them. An empty shelf is the honest state
 * until then, and it is the one that makes the first real build the first thing
 * anybody sees.
 *
 * **Every Pair is not deleted, it is moved.** It lives in
 * `builds.fixture.ts` now, which nothing in the app imports, because half the
 * test suite is written against it and a stress test is exactly what a fixture
 * should be. `data/curated/builds.json` is still where the real ones will go.
 */
export const SAMPLE_BUILDS: ShownBuild[] = []
