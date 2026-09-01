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
 * The first sample, named on its own.
 *
 * `noUncheckedIndexedAccess` makes `SAMPLE_BUILDS[0]` optional, and the screen
 * needs a build that certainly exists to fall back to. Naming it says the list
 * is non-empty once rather than guarding for it at every use.
 */
export const FIRST_BUILD: ShownBuild = {
  id: 'sample-killer-current',
  name: 'Killer Current',
  say: 'Poseidon on the swing, Zeus in the ring, and the duo that makes the lightning stick.',
  how: 'Poseidon holds the Attack and the Special, so ordinary swings apply Froth. Storm Ring puts Zeus in the Cast, which is the one core slot Poseidon gives up. Killer Current is what joins them: it makes lightning deal more damage to anything already Frothed, so the Attack sets a target up and the Cast collects. Slippery Slope is not a preference, it is one of the two prerequisites. Aspect of Circe matters because it clears the Cast on cue rather than leaving it planted.',
  by: 'sample',
  weapon: 'WeaponStaffSwing',
  aspect: 'StaffClearCastAspect',
  centrepiece: 'LightningVulnerabilityBoon',
  boons: [
    'PoseidonWeaponBoon',
    'PoseidonSpecialBoon',
    'ZeusCastBoon',
    'PoseidonSprintBoon',
    'ZeusManaBoon',
    'PoseidonStatusBoon',
    'LightningVulnerabilityBoon',
    'RoomRewardBonusBoon',
  ],
  hex: 'PolymorphZeusTalent',
  hammers: ['StaffDoubleAttackTrait', 'StaffFastSpecialTrait'],
  keepsake: 'BonusMoneyKeepsake',
  familiar: 'FrogFamiliar',
  arcana: ['CastCount', 'RarityBoost', 'LastStand', 'MagicCrit', 'CardDraw'],
}

export const SAMPLE_BUILDS: ShownBuild[] = [
  FIRST_BUILD,
  {
    id: 'sample-glorious-disaster',
    name: 'Glorious Disaster',
    say: 'Everything into the Cast. Apollo builds it, Zeus rings it, and the Hex keeps it fed.',
    how: 'Apollo takes four of the five core slots and Zeus takes only the Cast. Prominence Flare is a prerequisite rather than a preference: Glorious Disaster states it as an entire set on its own, so this is not the build without it. Lucid Gain in the Magick slot is what pays for a Cast this expensive, and Shine of Apollo puts the Hex on the god the rest of the loadout is already committed to.',
    by: 'sample',
    weapon: 'WeaponStaffSwing',
    aspect: 'StaffClearCastAspect',
    centrepiece: 'ApolloSecondStageCastBoon',
    boons: [
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ZeusCastBoon',
      'ApolloSprintBoon',
      'ApolloManaBoon',
      'ApolloExCastBoon',
      'ApolloSecondStageCastBoon',
      'BoltRetaliateBoon',
    ],
    hex: 'LaserApolloTalent',
    hammers: ['StaffSecondStageTrait', 'StaffPowershotTrait'],
    keepsake: 'ArmorGainKeepsake',
    familiar: 'CatFamiliar',
    arcana: ['CastCount', 'EpicRarityBoost', 'LastStand', 'CardDraw', 'MagicCrit'],
  },
  {
    id: 'sample-thermal-dynamics',
    name: 'Thermal Dynamics',
    say: 'Hestia burns on the Attack, Zeus jumps off the Special, and the duo turns one into the other.',
    how: 'The two prerequisite sets contend for the same two slots, and that decides the whole layout: Thermal Dynamics wants a Zeus Attack or Special and a Hestia Attack or Special, and only one boon fits a slot. So Hestia takes the Attack, Zeus takes the Special, and there is no third arrangement. Zeus then keeps the Cast and the Sprint because nothing is competing for them, and Cardio Gain puts Hestia back in the Magick slot.',
    by: 'sample',
    weapon: 'WeaponDagger',
    aspect: 'DaggerBackstabAspect',
    centrepiece: 'EchoBurnBoon',
    boons: [
      'HestiaWeaponBoon',
      'ZeusSpecialBoon',
      'ZeusCastBoon',
      'ZeusSprintBoon',
      'HestiaManaBoon',
      'EchoBurnBoon',
      'BoltRetaliateBoon',
    ],
    hex: 'MeteorHestiaTalent',
    hammers: ['DaggerRapidAttackTrait', 'DaggerSpecialFanTrait'],
    keepsake: 'BlockDeathKeepsake',
    familiar: 'RavenFamiliar',
    arcana: ['LastStand', 'RarityBoost', 'MagicCrit', 'CastCount', 'EpicRarityBoost'],
  },
  {
    id: 'sample-freezer-burn',
    name: 'Freezer Burn',
    say: 'Demeter freezes, Hestia burns, and the duo spends one to pay for the other.',
    how: 'Two status gods in one build, and the duo is the reason they are not fighting for the same job. Freezer Burn asks for a Demeter Attack, Special or Cast and a Hestia one, so the Attack goes to Ice Strike and the Special to Flame Flourish. Demeter then keeps the Cast and the Sprint, Hestia keeps the Magick slot, and Squall of Demeter puts the Hex on the side holding three of the five core slots.',
    by: 'sample',
    weapon: 'WeaponTorch',
    aspect: 'TorchDetonateAspect',
    centrepiece: 'BurnConsumeBoon',
    boons: [
      'DemeterWeaponBoon',
      'HestiaSpecialBoon',
      'DemeterCastBoon',
      'DemeterSprintBoon',
      'HestiaManaBoon',
      'BurnConsumeBoon',
    ],
    hex: 'TimeSlowDemeterTalent',
    hammers: ['TorchAttackSpeedTrait', 'TorchEnhancedAttackTrait'],
    keepsake: 'ForceDemeterBoonKeepsake',
    familiar: 'HoundFamiliar',
    arcana: ['LastStand', 'StatusVulnerability', 'RarityBoost', 'CastCount', 'BonusHealth'],
  },
  {
    id: 'sample-cutting-edge',
    name: 'Cutting Edge',
    say: 'Ares in the ring, Apollo around it, and a duo that names the Sword Ring specifically.',
    how: 'Cutting Edge names Sword Ring in its first prerequisite set, so Ares has to hold the Cast and no other arrangement satisfies it. Ares also takes the Attack and the Magick slot. Apollo takes the Special and the Sprint, and either one of those satisfies the second set on its own. Lance of Ares is the Hex, and Aspect of Thanatos asks for the same repeated precise hits the Ares boons are already about.',
    by: 'sample',
    weapon: 'WeaponAxe',
    aspect: 'AxePerfectCriticalAspect',
    centrepiece: 'DoubleSwordBoon',
    boons: [
      'AresWeaponBoon',
      'ApolloSpecialBoon',
      'AresCastBoon',
      'ApolloSprintBoon',
      'AresManaBoon',
      'DoubleSwordBoon',
    ],
    hex: 'MoonBeamAresTalent',
    hammers: ['AxeArmorTrait', 'AxeChargedSpecialTrait'],
    keepsake: 'LowHealthCritKeepsake',
    familiar: 'PolecatFamiliar',
    arcana: ['LastStand', 'MagicCrit', 'LowHealthBonus', 'RarityBoost', 'BonusHealth'],
  },
  {
    id: 'sample-ecstatic-obsession',
    name: 'Ecstatic Obsession',
    say: 'Hera on the weapon, Aphrodite everywhere else, and the Hex aspect to carry it.',
    how: 'Hera holds the Attack and the Special, which satisfies the first prerequisite set twice over. Aphrodite holds the Cast, the Sprint and the Magick slot, and Rapture Ring alone satisfies the second. That split leaves nothing contested, which is unusual: most duos put their two sets in competition for the same slots. Aspect of Selene is why the Hex is worth building around here, and Allure of Aphrodite keeps it on the god holding three slots.',
    by: 'sample',
    weapon: 'WeaponSuit',
    aspect: 'SuitHexAspect',
    centrepiece: 'CharmCrowdBoon',
    boons: [
      'HeraWeaponBoon',
      'HeraSpecialBoon',
      'AphroditeCastBoon',
      'AphroditeSprintBoon',
      'AphroditeManaBoon',
      'CharmCrowdBoon',
    ],
    hex: 'TransformAphroditeTalent',
    hammers: ['SuitArmorTrait', 'SuitAttackSizeTrait'],
    keepsake: 'SpellTalentKeepsake',
    familiar: 'CatFamiliar',
    arcana: ['LastStand', 'CastCount', 'MagicCrit', 'RarityBoost', 'ManaOverTime'],
  },
  {
    id: 'sample-chain-reaction',
    name: 'Chain Reaction',
    say: 'Hephaestus on the Attack, Hestia on the Special, and a duo that repeats the big hit.',
    how: 'Chain Reaction wants a Hephaestus Attack, Special or Sprint and any of five Hestia boons, so the Attack goes to Volcanic Strike and Hestia takes the Special. Hephaestus keeps the Cast and the Sprint, which satisfies its set a second time, and that leaves the Magick slot for Cardio Gain. Hand of Hephaestus is the Hex. Aspect of Hel is here because the Attack it changes is the slot the duo cares about.',
    by: 'sample',
    weapon: 'WeaponLob',
    aspect: 'LobGunAspect',
    centrepiece: 'DoubleMassiveAttackBoon',
    boons: [
      'HephaestusWeaponBoon',
      'HestiaSpecialBoon',
      'HephaestusCastBoon',
      'HephaestusSprintBoon',
      'HestiaManaBoon',
      'DoubleMassiveAttackBoon',
    ],
    hex: 'LeapHephaestusTalent',
    hammers: ['LobAmmoTrait', 'LobGrowthTrait'],
    keepsake: 'ForceHephaestusBoonKeepsake',
    familiar: 'FrogFamiliar',
    arcana: ['LastStand', 'RarityBoost', 'BonusHealth', 'MagicCrit', 'EpicRarityBoost'],
  },
  {
    id: 'sample-arterial-spray',
    name: 'Arterial Spray',
    say: 'Poseidon knocks them into each other, Ares makes the landing hurt.',
    how: 'Arterial Spray needs a Poseidon Attack or Special specifically, and any one of five Ares boons for the other set, which is the loosest gate of the eight here. So Poseidon takes the Attack, Ares takes the Special, the Cast and the Magick slot, and Poseidon keeps the Sprint. Aspect of the Morrigan multiplies the Special, which is the slot Ares is holding, and Pride of Poseidon puts the Hex on the god holding the Attack.',
    by: 'sample',
    weapon: 'WeaponDagger',
    aspect: 'DaggerTripleAspect',
    centrepiece: 'DoubleSplashBoon',
    boons: [
      'PoseidonWeaponBoon',
      'AresSpecialBoon',
      'AresCastBoon',
      'PoseidonSprintBoon',
      'AresManaBoon',
      'DoubleSplashBoon',
    ],
    /**
     * The owner's own example of what this field is for.
     *
     * Slow Cooker gains Power on Attacks and Specials the more Fire is held,
     * and this is a fast Attack and Special build. It is not part of the build:
     * take it and you spend a third Olympian slot on Hestia for one boon.
     */
    optional: ['ElementalBaseDamageBoon'],
    hex: 'PotionPoseidonTalent',
    hammers: ['DaggerSpecialFanTrait', 'DaggerTripleBuffTrait'],
    keepsake: 'ForceAresBoonKeepsake',
    familiar: 'RavenFamiliar',
    arcana: ['LastStand', 'MagicCrit', 'RarityBoost', 'CastCount', 'LowHealthBonus'],
  },
]
