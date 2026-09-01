/**
 * Every Pair, the build the tests are written against.
 *
 * **Nothing in the app imports this.** The shipped library is empty, because a
 * placeholder in a library reads as a recommendation, and `builds.ts` records
 * why that lesson had to be learned twice. This is the same build, kept where
 * it is useful: half the suite needs a build to bend, and the hardest case
 * anybody could construct is exactly what a fixture should be.
 *
 * ## What makes it the hardest case
 *
 * Aphrodite, Apollo, Demeter and Hestia are four Olympians, which is where the
 * random pool freezes, and they are unusual in having a duo for **all six** of
 * their pairs plus a legendary each. That is ten targets between four gods.
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
 * So: 21 boons, 6 duos, 3 legendaries, a Hex, two hammers, a keepsake, a
 * familiar and two Arcana. If a screen can draw this, it can draw anything a
 * real run produces, which is what it is for.
 */

import type { ShownBuild } from './builds.ts'

export const EVERY_PAIR: ShownBuild = {

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
 * The old name, because the tests were written against it.
 *
 * Kept as an alias rather than renamed across nine test files in a commit that
 * is about emptying the library: two changes in one diff is how a rename hides
 * a behaviour change.
 */
export const FIRST_BUILD = EVERY_PAIR

/** A library of one, for the tests that want a list rather than a build. */
export const SAMPLE_BUILDS: ShownBuild[] = [EVERY_PAIR]
