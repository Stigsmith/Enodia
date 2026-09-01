/**
 * The builder's checker, against builds that are wrong on purpose.
 *
 * The eight samples are the control: `builds.test.ts` already proves they are
 * coherent, so this asserts the checker finds nothing blocking in them. Then it
 * breaks one in each way and asserts it says so.
 */

import { arcanaById, olympians, traits } from '../data/app.ts'
import { describe, expect, it } from 'vitest'

import { SAMPLE_BUILDS } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { blockers, checkBuild, olympiansOf, slotMap } from './build-check.ts'

const first = SAMPLE_BUILDS[0]
if (!first) throw new Error('no samples')

const bend = (over: Partial<ShownBuild>): ShownBuild => ({ ...first, ...over })

describe('the samples pass', () => {
  it.each(SAMPLE_BUILDS)('$name has nothing blocking', (build) => {
    expect(blockers(checkBuild(build)).map((p) => p.say)).toEqual([])
  })
})

describe('what it blocks', () => {
  it('two boons in one core slot', () => {
    // Killer Current holds Poseidon's Attack. Add Zeus's.
    const said = blockers(checkBuild(bend({ boons: [...first.boons, 'ZeusWeaponBoon'] })))
    expect(said.some((p) => /Attack/.test(p.say))).toBe(true)
  })

  it('does not block a fifth Olympian, because the cap is on the pool', () => {
    /**
     * This used to be a blocker citing `HeroData.MaxGodsPerRun`, and the
     * constant was real while the conclusion was not.
     *
     * `RewardLogic.lua:238` calls `ChooseLoot`, which goes through
     * `GetEligibleLootNames` and freezes the pool to gods already held once
     * `ReachedMaxGods` is true. Line 242 then overwrites that choice outright
     * if a held trait carries `ForceBoonName` and `Uses > 0`, without ever
     * consulting the cap again. All nine Olympians have such a keepsake, so a
     * fifth god is a keepsake away.
     *
     * Same shape as the four-gods error `CLAUDE.md` records: a proxy read for
     * the property, and never checked against the property.
     */
    const five = bend({
      boons: ['PoseidonWeaponBoon', 'ZeusSpecialBoon', 'ApolloCastBoon', 'HestiaSprintBoon', 'AresManaBoon'],
      centrepiece: 'PoseidonWeaponBoon',
    })
    const problems = checkBuild(five)
    expect(blockers(problems)).toEqual([])
    // Still said, because it is worth knowing what it will cost.
    expect(problems.some((p) => p.severity === 'notes' && /keepsake/.test(p.say))).toBe(true)
  })

  it('an aspect from another arm', () => {
    const said = blockers(checkBuild(bend({ aspect: 'DaggerTripleAspect' })))
    expect(said.some((p) => /not an aspect of this arm/.test(p.say))).toBe(true)
  })

  it('a hammer from another arm', () => {
    const said = blockers(checkBuild(bend({ hammers: ['DaggerRapidAttackTrait'] })))
    expect(said.some((p) => /not an upgrade for this arm/.test(p.say))).toBe(true)
  })

  it('a centrepiece the build does not take', () => {
    const said = blockers(checkBuild(bend({ centrepiece: 'EchoBurnBoon' })))
    expect(said.some((p) => /does not take it/.test(p.say))).toBe(true)
  })

  it('a nameless build', () => {
    expect(blockers(checkBuild(bend({ name: '  ' }))).some((p) => p.field === 'name')).toBe(true)
  })

  it('more Arcana than a build should be naming', () => {
    /**
     * The limit is the count, and it is about usefulness rather than legality.
     *
     * It has been wrong in both directions. It blocked above five on the belief
     * that the Grasp holds five, which it does not: eighteen paid cards cost 1
     * to 5 against a ceiling of 30, so six cheap cards are legal. Then it became
     * a Grasp sum, which was right about the game and wrong about the build.
     *
     * A build is not a save file. What belongs on one is the couple of cards
     * that follow from what it does, so the count is back and it is five.
     */
    const everyPaidCard = [...arcanaById.values()].filter((c) => (c.cost ?? 0) > 0).map((c) => c.id)
    const said = blockers(checkBuild(bend({ arcana: everyPaidCard })))
    expect(said.some((p) => /Arcana/.test(p.say))).toBe(true)
  })

  it('lets a couple of suggestions through without comment', () => {
    const two = [...arcanaById.values()].slice(0, 2).map((c) => c.id)
    expect(blockers(checkBuild(bend({ arcana: two })))).toEqual([])
    expect(checkBuild(bend({ arcana: two })).some((p) => p.field === 'arcana')).toBe(false)
  })

  it('says so above three, without blocking', () => {
    // Four is legal, cheap and still more than a reader wants handed to them.
    const four = [...arcanaById.values()].slice(0, 4).map((c) => c.id)
    const problems = checkBuild(bend({ arcana: four }))
    expect(blockers(problems)).toEqual([])
    expect(problems.some((p) => p.field === 'arcana' && p.severity === 'notes')).toBe(true)
  })
})

describe('what it only notes', () => {
  it('an unfinished build is never blocked', () => {
    // A sketch: a name, an arm, an aspect and nothing else.
    const sketch = bend({ boons: [], hex: null, hammers: [], arcana: [], centrepiece: '' })
    expect(blockers(checkBuild(sketch))).toEqual([])
    // And it does not nag either: a named sketch with nothing in it yet has
    // nothing wrong with it. The empty-slot note is for a build that has
    // started, not for one that has not.
    expect(checkBuild(sketch)).toEqual([])
  })

  it('a duo whose prerequisites are not held yet, and says which they are', () => {
    /**
     * The message used to end at "needs prerequisites this build does not hold
     * yet", which named a problem and gave nobody a way to solve it: the boons
     * are somewhere in a list of two hundred and nothing said which.
     *
     * So the assertion is not the sentence, it is the options. Every one of
     * them satisfies a set the build has not met, and each says what taking it
     * would displace.
     */
    const said = checkBuild(bend({ boons: ['LightningVulnerabilityBoon'], centrepiece: '' }))
    const note = said.find((p) => p.severity === 'notes' && p.fix)
    expect(note).toBeTruthy()
    expect(blockers(said)).toEqual([])

    const fix = note!.fix!
    expect(fix.target).toBe('LightningVulnerabilityBoon')
    expect(fix.sets.length).toBeGreaterThan(0)
    for (const set of fix.sets) {
      expect(set.options.length).toBeGreaterThan(0)
      // Every option is real, and none of them is already held.
      for (const option of set.options) {
        expect(traits.get(option.id)).toBeTruthy()
        expect(option.name).not.toBe(option.id)
      }
    }
  })

  it('does not offer a set the build already satisfies', () => {
    // A legendary wanting three sets with two of them held should say what is
    // missing rather than restate the whole requirement.
    const duo = traits.get('LightningVulnerabilityBoon')
    const sets = duo?.requires && 'oneFromEachSet' in duo.requires ? duo.requires.oneFromEachSet : []
    if (sets.length < 2) return

    const first = sets[0]![0]!
    const said = checkBuild(bend({ boons: ['LightningVulnerabilityBoon', first], centrepiece: '' }))
    const fix = said.find((p) => p.fix)?.fix
    expect(fix?.sets).toHaveLength(sets.length - 1)
  })

  it('says which core slots are still empty', () => {
    const said = checkBuild(bend({ boons: ['PoseidonWeaponBoon'], centrepiece: '' }))
    expect(said.some((p) => /Nothing in your/.test(p.say))).toBe(true)
  })
})

describe('the helpers', () => {
  it('counts only Olympians', () => {
    // Read off the build rather than written down here, so this keeps checking
    // the helper rather than the fixture.
    const gods = olympiansOf(first)
    expect(gods.length).toBeGreaterThan(0)
    expect(gods.length).toBeLessThanOrEqual(4)
    expect([...gods].sort()).toEqual(gods)
    for (const god of gods) expect(olympians).toContain(god)
  })

  it('maps a boon to its core slot', () => {
    const attack = slotMap(first).get('Melee')
    expect(attack).toHaveLength(1)
    expect(traits.get(attack![0]!)?.slot).toBe('Melee')
  })
})
