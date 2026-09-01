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
}

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
  hex: TraitId | null
  hammers: TraitId[]
  keepsake: TraitId | null
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
  // All four are optional on `ShownBuild` because the eight samples carry none
  // and do not need any. `SavedBuild` below is the type that has been through
  // the migration, and it requires them.

  /** ISO, when the build was first written. Never changes */
  created?: string
  /** ISO, updated on every save */
  modified?: string
  /** which shape this build is in, so a build sent to another install can say */
  schemaVersion?: number
  /** the id this was duplicated from, or absent. Stored now, displayed later */
  derivedFrom?: string
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
 * The one build that ships, and it is a stress test rather than a suggestion.
 *
 * **The library starts empty on purpose.** Eight placeholder builds used to
 * ship here to prove the screens worked. They did that, and then they sat in
 * everybody's library looking like recommendations. Real builds are being
 * written by people who play the game; this is the only one left, and it is
 * here because something has to be the hardest case the screens can be handed.
 *
 * ## What makes it the hardest case
 *
 * Aphrodite, Apollo, Demeter and Hestia are four Olympians, which is the cap a
 * run allows, and they are unusual in having a duo for **all six** of their
 * pairs plus a legendary each. That is ten targets between four gods.
 *
 * Nine of the ten fit. The tenth provably does not, and the reason is the
 * lockout this whole tool exists to show:
 *
 *   Exceptional Talent needs two Apollo core boons, one from Attack or Special
 *   and one from Cast, Sprint or Magick. Freezer Burn, Burning Desire and Fire
 *   Away all need Hestia in Attack, Special or Cast. Nervous Wreck needs
 *   Aphrodite in Attack or Special. Attack and Special are two slots and three
 *   gods want them, so Apollo loses, and Apollo's legendary goes with it.
 *
 * Checked by searching every one of the 1024 ways the five core slots can be
 * handed out among the four gods. Nine is the maximum, and this is one of the
 * assignments that reaches it.
 *
 * So: 21 boons, 6 duos, 3 legendaries, 10 Arcana at 29 of 30 Grasp, a Hex, two
 * hammers, a keepsake and a familiar. If a screen can draw this, it can draw
 * anything a real run produces.
 */
export const FIRST_BUILD: ShownBuild = {
  id: 'sample-four-gods',
  name: 'Every Pair',
  say: 'Four gods, all six duos between them, and three of their four legendaries.',
  how: 'The five core slots are handed out to make as many pairs as possible rather than to make any one of them strong. Hestia takes the Attack and Aphrodite the Special, which is what Freezer Burn, Burning Desire, Fire Away and Nervous Wreck all need. Demeter takes the Cast, Apollo the Sprint, and Aphrodite takes the Magick as well, which is the second Aphrodite core Nervous Wreck asks for. Everything else is a slotless boon taken purely to satisfy a prerequisite: Heart Breaker for Sunny Disposition, Arctic Gale for Tropical Cyclone, Flash Fry and Glowing Coal for Fire Away, Plentiful Forage and Weed Killer for Winter Harvest, Broken Resolve for Nervous Wreck. Apollo is the god who loses out. Exceptional Talent wants two Apollo core boons and Apollo only gets the Sprint, because Attack and Special are spoken for by gods that three other targets depend on.',
  by: 'sample',
  weapon: 'WeaponStaffSwing',
  aspect: 'StaffClearCastAspect',
  centrepiece: 'BurnConsumeBoon',
  boons: [
    // The five core slots. Two go to Aphrodite, which is what makes it fit.
    'HestiaWeaponBoon',        // Flame Strike        Attack
    'AphroditeSpecialBoon',    // Flutter Flourish    Special
    'DemeterCastBoon',         // Arctic Ring         Cast
    'ApolloSprintBoon',        // Blinding Rush       Sprint
    'AphroditeManaBoon',       // Glamour Gain        Magick

    // Slotless, and every one of them is a prerequisite rather than a choice.
    'ManaBurstBoon',           // Heart Breaker       Sunny Disposition
    'CastNovaBoon',            // Arctic Gale         Tropical Cyclone
    'BurnExplodeBoon',         // Flash Fry           Fire Away
    'CastProjectileBoon',      // Glowing Coal        Fire Away
    'PlantHealthBoon',         // Plentiful Forage    Winter Harvest
    'SlowExAttackBoon',        // Weed Killer         Winter Harvest
    'WeakPotencyBoon',         // Broken Resolve      Nervous Wreck

    // All six duos the four gods can make between them.
    'MaxHealthDamageBoon',     // Hearty Appetite     Aphrodite + Demeter
    'ManaBurstCountBoon',      // Sunny Disposition   Aphrodite + Apollo
    'BurnConsumeBoon',         // Freezer Burn        Demeter + Hestia
    'CoverRegenerationBoon',   // Warm Breeze         Apollo + Hestia
    'BurnRefreshBoon',         // Burning Desire      Aphrodite + Hestia
    'StormSpawnBoon',          // Tropical Cyclone    Apollo + Demeter

    // Three of the four legendaries. Apollo's is the one that cannot fit.
    'BurnSprintBoon',          // Fire Away           Hestia
    'InstantRootKill',         // Winter Harvest      Demeter
    'RandomStatusBoon',        // Nervous Wreck       Aphrodite
  ],
  luck:
    'Hearth of Hestia is written in because this build is a stress test, and it is the clearest thing in it to treat as upside instead. There are nine Hexes, you take one, and which blessings that Hex then offers from Selene is drawn separately, so a build that needs a particular one fails on a draw nobody controls. Meet Selene, take Hearth of Hestia if it is there, and lose nothing if it is not. Same for the second hammer: a run offers two at most out of everything the arm has, so plan for the Special upgrade and treat the area upgrade as a bonus. If a fifth Olympian is going spare, Hestia is the one worth a keepsake, and one boon from her is the whole reason to spend it.',
  hex: 'MeteorHestiaTalent',
  hammers: ['StaffExAoETrait', 'StaffFastSpecialTrait'],
  keepsake: 'ForceHestiaBoonKeepsake',
  familiar: 'FrogFamiliar',
  /**
   * Two cards, not a board.
   *
   * This used to list ten, at 29 of 30 Grasp, which was a save file rather than
   * a build. Nobody reading a build wants somebody else's whole loadout: they
   * want the one or two cards that follow from what the build does, so they know
   * what to bring and can fill the rest of the board themselves.
   *
   * These two follow. Origination because the build is made of status effects
   * and does nothing else. The Furies because the aspect clears with the Cast
   * and the centrepiece is a Cast duo.
   */
  arcana: [
    'StatusVulnerability', // Origination
    'CastBuff',            // The Furies
  ],
}

/**
 * The shipped library, which is one build long.
 *
 * `noUncheckedIndexedAccess` makes `SAMPLE_BUILDS[0]` optional, so `FIRST_BUILD`
 * is named separately and the screens fall back to it rather than guarding for
 * an empty list at every use.
 */
export const SAMPLE_BUILDS: ShownBuild[] = [FIRST_BUILD]
