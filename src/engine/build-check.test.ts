/**
 * The builder's checker, against builds that are wrong on purpose.
 *
 * The eight samples are the control: `builds.test.ts` already proves they are
 * coherent, so this asserts the checker finds nothing blocking in them. Then it
 * breaks one in each way and asserts it says so.
 */

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

  it('a fifth Olympian', () => {
    const said = blockers(
      checkBuild(
        bend({
          boons: ['PoseidonWeaponBoon', 'ZeusSpecialBoon', 'ApolloCastBoon', 'HestiaSprintBoon', 'AresManaBoon'],
        }),
      ),
    )
    expect(said.some((p) => /allows four/.test(p.say))).toBe(true)
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

  it('more than five Arcana', () => {
    const said = blockers(checkBuild(bend({ arcana: [...first.arcana, 'BonusHealth'] })))
    expect(said.some((p) => /holds five/.test(p.say))).toBe(true)
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
    expect(olympiansOf(first)).toEqual(['Poseidon', 'Zeus'])
  })

  it('maps a boon to its core slot', () => {
    expect(slotMap(first).get('Melee')).toEqual(['PoseidonWeaponBoon'])
  })
})
