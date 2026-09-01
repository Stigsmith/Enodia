/**
 * The builder's checker, against builds that are wrong on purpose.
 *
 * The eight samples are the control: `builds.test.ts` already proves they are
 * coherent, so this asserts the checker finds nothing blocking in them. Then it
 * breaks one in each way and asserts it says so.
 */

import { arcanaById, olympians, traits } from '../data/app.ts'
import { describe, expect, it } from 'vitest'

import { SAMPLE_BUILDS } from '../data/builds.ts'
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

  it('more Arcana than a save has Grasp for', () => {
    // Every paid card at once is 55 Grasp against a ceiling of 30. The limit is
    // the cost, not the count: six cheap cards are legal and two expensive ones
    // plus a third may not be.
    const everyPaidCard = [...arcanaById.values()].filter((c) => (c.cost ?? 0) > 0).map((c) => c.id)
    const said = blockers(checkBuild(bend({ arcana: everyPaidCard })))
    expect(said.some((p) => /Grasp/.test(p.say))).toBe(true)
  })

  it('lets a long but affordable board through', () => {
    const cheap = [...arcanaById.values()]
      .filter((c) => (c.cost ?? 0) > 0 && (c.cost ?? 0) <= 2)
      .map((c) => c.id)
    const grasp = cheap.reduce((n, id) => n + (arcanaById.get(id)?.cost ?? 0), 0)
    expect(grasp).toBeLessThanOrEqual(30)
    expect(blockers(checkBuild(bend({ arcana: cheap })))).toEqual([])
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

  it('a duo whose prerequisites are not held yet', () => {
    const said = checkBuild(bend({ boons: ['LightningVulnerabilityBoon'], centrepiece: '' }))
    expect(said.some((p) => p.severity === 'notes' && /prerequisites/.test(p.say))).toBe(true)
    expect(blockers(said)).toEqual([])
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
