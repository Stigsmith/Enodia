/**
 * How reachable a build is.
 *
 * The claims worth testing are the ones that would quietly rot: that the
 * asymmetries are read off the data rather than hardcoded, that the reading
 * never depends on a run, and that unlikely is not the same as impossible.
 */

import { describe, expect, it } from 'vitest'

import { REACH, bandFor, ratingCeiling, readRepeat, reachName } from './repeat.ts'
import { olympians, traits } from '../data/app.ts'
import { olympiansOf } from './build-check.ts'
import { ASSEMBLES } from '../data/builds.ts'
import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'

const read = (over: Partial<ShownBuild> = {}) => readRepeat({ ...FIRST_BUILD, ...over }, traits, olympians)

/** A small, sane build to bend: two gods, one duo, nothing exotic. */
const modest: Partial<ShownBuild> = {
  boons: ['HestiaWeaponBoon', 'AphroditeSpecialBoon', 'ManaBurstBoon', 'BurnRefreshBoon'],
  centrepiece: 'BurnRefreshBoon',
  hex: null,
  hammers: [],
}

const charge = (build: Partial<ShownBuild>, id: string) => read(build).charges.find((one) => one.id === id)

/** The Olympians a build already touches, for picking a fixture that adds new ones. */
const godsIn2 = (build: ShownBuild) => olympiansOf(build)

describe('the words', () => {
  it('shares the first three with what a player answers themselves', () => {
    // The whole reason for these words rather than easy/medium/hard: the detail
    // view puts the tool's read beside the player's, and they have to line up.
    expect(REACH.map((one) => one.id).slice(0, 3)).toEqual(ASSEMBLES.map((one) => one.id))
    expect(REACH.map((one) => one.name).slice(0, 3)).toEqual(ASSEMBLES.map((one) => one.name))
  })

  it('names every band it can return', () => {
    for (const one of REACH) expect(reachName(one.id)).toBe(one.name)
  })
})

describe('what a build costs', () => {
  it('charges a boon per pick, because more boons is harder', () => {
    const few = read({ ...modest })
    const more = read({ ...modest, boons: [...(modest.boons ?? []), 'CastNovaBoon', 'PlantHealthBoon'] })
    expect(more.cost).toBeGreaterThan(few.cost)
  })

  it('charges a legendary more than a duo, and reads the reason off the data', () => {
    // Not asserted against a number. The rule is that a target arriving from one
    // god costs more than one arriving from two, so the fixture is picked by
    // that property and the assertion is the ordering.
    const duo = [...traits.values()].find(
      (t) => t.kind === 'duo' && t.gods.filter((g) => olympians.includes(g)).length === 2,
    )
    const legendary = [...traits.values()].find(
      (t) => t.kind === 'legendary' && t.gods.filter((g) => olympians.includes(g)).length === 1,
    )
    expect(duo).toBeTruthy()
    expect(legendary).toBeTruthy()

    const base = ['HestiaWeaponBoon', 'AphroditeSpecialBoon']
    const withDuo = read({ ...modest, boons: [...base, duo!.id], centrepiece: duo!.id })
    const withLegendary = read({ ...modest, boons: [...base, legendary!.id], centrepiece: legendary!.id })
    expect(withLegendary.cost).toBeGreaterThan(withDuo.cost)
  })

  it('charges a god you need four boons from more than four gods of one boon', () => {
    // The owner's point: four gods is not four times the trouble, and needing
    // one boon from Hestia is nearly free.
    const spread = read({
      ...modest,
      boons: ['HestiaWeaponBoon', 'AphroditeSpecialBoon', 'DemeterCastBoon', 'ApolloSprintBoon'],
    })
    const deep = read({
      ...modest,
      boons: ['DemeterCastBoon', 'CastNovaBoon', 'PlantHealthBoon', 'SlowExAttackBoon'],
    })
    expect(deep.cost).toBeGreaterThan(spread.cost)
    // Four gods of one boon each is charged nothing at all: the rule starts
    // above two boons from any single god.
    expect(spread.charges.find((one) => one.id === 'concentration')).toBeUndefined()
  })

  it('charges a second named hammer, because a run offers two at most', () => {
    const one = read({ ...modest, hammers: ['StaffExAoETrait'] })
    const two = read({ ...modest, hammers: ['StaffExAoETrait', 'StaffFastSpecialTrait'] })
    expect(two.cost).toBeGreaterThan(one.cost)
    expect(charge({ ...modest, hammers: ['StaffExAoETrait'] }, 'hammers')).toBeUndefined()
  })

  it('charges a Hex, because which one you get and what its tree offers are both draws', () => {
    expect(charge({ ...modest, hex: 'MeteorHestiaTalent' }, 'hex')).toBeTruthy()
    expect(charge({ ...modest, hex: null }, 'hex')).toBeUndefined()
  })

  it('charges a god the run decides about rather than you', () => {
    const hermes = [...traits.values()].find((t) => t.gods.includes('Hermes') && t.kind !== 'legendary')
    expect(hermes).toBeTruthy()
    const without = read({ ...modest })
    const with_ = read({ ...modest, boons: [...(modest.boons ?? []), hermes!.id] })
    // More than the one point the extra pick alone would cost.
    expect(with_.cost - without.cost).toBeGreaterThan(1)
    expect(charge({ ...modest, boons: [...(modest.boons ?? []), hermes!.id] }, 'unsummonable')).toBeTruthy()
  })
})

describe('filler', () => {
  it('names a boon nothing depends on', () => {
    // Blinding Rush occupies a core slot, so it is load-bearing. Weed Killer
    // occupies none and nothing in this build requires it.
    const said = read({ ...modest, boons: [...(modest.boons ?? []), 'SlowExAttackBoon'] })
    expect(said.filler).toContain('SlowExAttackBoon')
  })

  it('does not call a target filler, because a target is the build', () => {
    // The first version of this rule called every duo in Every Pair filler,
    // which is exactly backwards: they are what it is for.
    expect(read().filler).toEqual([])
  })

  it('counts a boon load-bearing once something in the build requires it', () => {
    // Heart Breaker holds nothing up on its own, and holds up Sunny Disposition
    // the moment the duo that needs it is in the build too.
    const alone = read({ ...modest, boons: ['HestiaWeaponBoon', 'ManaBurstBoon'] })
    expect(alone.filler).toContain('ManaBurstBoon')

    const needed = read({
      ...modest,
      boons: ['HestiaWeaponBoon', 'ManaBurstBoon', 'AphroditeManaBoon', 'ApolloSprintBoon', 'ManaBurstCountBoon'],
    })
    expect(needed.filler).not.toContain('ManaBurstBoon')
  })

  it('never charges for filler, because the pick is already charged', () => {
    const said = read({ ...modest, boons: [...(modest.boons ?? []), 'SlowExAttackBoon'] })
    expect(said.charges.find((one) => one.id === 'filler')?.cost).toBe(0)
  })
})

describe('Olympians past the pool', () => {
  const godsIn = (build: Partial<ShownBuild>) => read(build).perGod.length

  it('counts the same Olympians the checker counts', () => {
    /**
     * The bug this exists to stop coming back.
     *
     * `perGod` only counted traits offered by exactly one Olympian, so a god a
     * build reached only through a duo was invisible to it. The same screen
     * showed "7 Olympians" from the checker and "6 Olympians" from the reading,
     * and worse, the hard stop reads this count, so a six-god build walked
     * straight past it.
     *
     * Checked on a build whose sixth god arrives only as half of a duo, which is
     * the exact shape that broke.
     */
    const duo = [...traits.values()].find(
      (t) =>
        t.kind === 'duo' &&
        t.gods.filter((g) => olympians.includes(g)).length === 2 &&
        t.gods.every((g) => !godsIn2(FIRST_BUILD).includes(g)),
    )
    expect(duo).toBeTruthy()

    const build = { ...FIRST_BUILD, boons: [...FIRST_BUILD.boons, duo!.id] }
    const said = readRepeat(build, traits, olympians)
    expect(said.perGod.map((one) => one.god).sort()).toEqual(olympiansOf(build).sort())
    expect(said.hardStop).toBeTruthy()
  })

  it('lets a fifth god through, but never as Reliably', () => {
    // RewardLogic.lua:242 lets a keepsake overwrite the capped choice, so five
    // is real. It costs a keepsake and it does not always land.
    const five = {
      ...modest,
      boons: ['HestiaWeaponBoon', 'AphroditeSpecialBoon', 'DemeterCastBoon', 'ApolloSprintBoon', 'ZeusManaBoon'],
      centrepiece: 'HestiaWeaponBoon',
    }
    expect(godsIn(five)).toBe(5)
    expect(read(five).hardStop).toBeNull()
    expect(read(five).reach).not.toBe('reliably')
  })

  it('stops at six, and says why rather than showing a number', () => {
    const six = {
      ...modest,
      boons: [
        'HestiaWeaponBoon',
        'AphroditeSpecialBoon',
        'DemeterCastBoon',
        'ApolloSprintBoon',
        'ZeusManaBoon',
        'AresWeaponBoon',
      ],
      centrepiece: 'HestiaWeaponBoon',
    }
    expect(godsIn(six)).toBe(6)
    const said = read(six)
    expect(said.hardStop).toBeTruthy()
    expect(said.reach).toBe('not-in-one-run')
  })

  it('holds the stars down only at a hard stop', () => {
    expect(ratingCeiling(read())).toBeNull()
    const six = read({
      ...modest,
      boons: [
        'HestiaWeaponBoon',
        'AphroditeSpecialBoon',
        'DemeterCastBoon',
        'ApolloSprintBoon',
        'ZeusManaBoon',
        'AresWeaponBoon',
      ],
    })
    expect(ratingCeiling(six)).toBe(1)
  })
})

describe('the bands', () => {
  it('never calls a build impossible on cost alone', () => {
    // Unlikely is not impossible, and Every Pair is the proof: it costs more
    // than a run is long and nine of its ten targets provably fit.
    expect(bandFor(1000, 40)).toBe('needs-luck')
    expect(read().reach).toBe('needs-luck')
    expect(read().cost).toBeGreaterThan(read().ceiling)
  })

  it('reads the share of a run rather than a fixed number', () => {
    // Written as fractions so a better ESTIMATED_EXITS does not silently move
    // every build a band.
    expect(bandFor(5, 40)).toBe('reliably')
    expect(bandFor(6, 20)).toBe('situational')
    expect(bandFor(15, 40)).toBe('situational')
    expect(bandFor(25, 40)).toBe('needs-luck')
  })

  it('calls a small build Reliably', () => {
    expect(read(modest).reach).toBe('reliably')
  })
})

describe('what it does not depend on', () => {
  it('is the same reading with and without a play record', () => {
    // The tool's read and the player's answer are separate claims. If the play
    // record fed the reading they would not be comparable.
    const bare = read({ play: undefined })
    const played = read({ play: { rating: 5, runs: 40, clears: 30, assembles: 'reliably' } })
    expect(played.reach).toBe(bare.reach)
    expect(played.cost).toBe(bare.cost)
  })

  it('is unmoved by how much Fear a build has cleared', () => {
    /**
     * Two different claims, deliberately kept apart.
     *
     * Fear is how hard the run was. The reading is how hard the build is to
     * assemble. A build cleared at Fear 40 is not easier to put together than
     * the same build cleared at Fear 0, and letting one move the other would
     * undo the separation between the rating and the reading.
     */
    const none = read({ play: { runs: 5 } })
    const deep = read({ play: { runs: 5, fear: 57 } })
    expect(deep.reach).toBe(none.reach)
    expect(deep.cost).toBe(none.cost)
  })

  it('is the same reading twice, with no run anywhere in it', () => {
    expect(read()).toEqual(read())
  })

  it('moves with the length of a run, since that is what it measures against', () => {
    expect(readRepeat(FIRST_BUILD, traits, olympians, 12).reach).toBe('needs-luck')
    expect(readRepeat({ ...FIRST_BUILD, ...modest }, traits, olympians, 4).reach).not.toBe('reliably')
  })
})

describe('the star ceiling, as the screens apply it', () => {
  const sixGods: Partial<ShownBuild> = {
    boons: [
      'HestiaWeaponBoon',
      'AphroditeSpecialBoon',
      'DemeterCastBoon',
      'ApolloSprintBoon',
      'ZeusManaBoon',
      'AresWeaponBoon',
    ],
    centrepiece: 'HestiaWeaponBoon',
    hex: null,
    hammers: [],
  }

  it('holds a build that cannot be assembled to one star', () => {
    // The owner's rule, and it is about honesty rather than taste: something a
    // run cannot hand over does not get to look like a recommendation.
    expect(ratingCeiling(read(sixGods))).toBe(1)
  })

  it('leaves a five-star Needs luck build alone', () => {
    // The case the rule must not catch. Hard to assemble and worth chasing is a
    // real kind of build, and the rating and the reading are separate claims.
    const said = read({ play: { rating: 5, runs: 40, clears: 12, assembles: 'needs-luck' } })
    expect(said.reach).toBe('needs-luck')
    expect(ratingCeiling(said)).toBeNull()
  })
})
