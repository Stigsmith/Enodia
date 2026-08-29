/**
 * A build, as something to look at.
 *
 * `data/types.ts Build` describes a build as a set of prerequisites, because
 * that is what `engine/reachability.ts verdictForBuild` needs to judge one. It
 * is the wrong shape for showing somebody a build, which is what this file is
 * about: a full loadout is an aspect, a dozen boons across five core slots and
 * beyond them, a Hex, two hammers, a keepsake, a familiar and five Arcana, and
 * the question is how to put all of that in front of a player without it
 * reading as a spreadsheet.
 *
 * ## These three are samples, not recommendations
 *
 * **Nothing here is a judgement about what is good.** `CLAUDE.md` is clear that
 * evaluations come from the owner, and `data/curated/builds.json` is where the
 * real ones will live, still empty and still theirs.
 *
 * What these are is **mechanically coherent**: every id is real, every duo's
 * prerequisites are actually held, no two boons contend for the same core slot,
 * and no build reaches past the four Olympian slots. That is enough to judge a
 * layout by, and it is the only claim being made. `builds.test.ts` holds them
 * to it, so a sample that drifts into nonsense fails the build rather than
 * quietly misleading whoever is looking at the design.
 *
 * Writing them found three real errors, which is the argument for the test:
 * Killer Current listed no boon from its first prerequisite set, Thermal
 * Dynamics wanted Zeus and Hestia in the same two core slots, and Glorious
 * Disaster was missing Prominence Flare entirely.
 */

import type { TraitId } from './types.ts'

/** One familiar, by the id `FamiliarData.lua` lists in `FamiliarOrderData`. */
export type FamiliarId = string

/** One Arcana card, by its key in `MetaUpgradeCardData`. */
export type ArcanaId = string

export type ShownBuild = {
  id: string
  name: string
  /** one line, what it is */
  say: string
  weapon: TraitId
  aspect: TraitId
  /** what the build is for, and what everything else is feeding */
  centrepiece: TraitId
  /** in the order they matter, core slots first */
  boons: TraitId[]
  hex: TraitId | null
  hammers: TraitId[]
  keepsake: TraitId | null
  familiar: FamiliarId | null
  /** the Grasp holds five by default, and the order on the board is the player's */
  arcana: ArcanaId[]
}

/**
 * There is deliberately no `gods` field.
 *
 * It was here, listing the Olympians a build leans on, and it was a hand-kept
 * copy of something the data already answers: `build-pieces.ts assemble` reads
 * each boon's own gods out of the generated bundle. Keeping it meant four god
 * names written as string literals in source, which `DESIGN.md` 3.1 forbids and
 * `validate.ts` catches by name. The gods a build takes are derived.
 *
 * A "gods to avoid" list is not derivable, but it is a judgement, and
 * judgements belong to the owner in `data/curated/builds.json` rather than to a
 * sample built to test a layout.
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
]
