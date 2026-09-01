/**
 * The filter, and the two parts of it that are easy to get wrong.
 *
 * Most of this is ordinary set logic. What is worth testing is the counting,
 * which has to be taken with the counted facet lifted or the bar offers choices
 * that yield nothing, and the arm-to-aspect dependency, which is the only place
 * one facet reaches into another.
 */

import { describe, expect, it } from 'vitest'

import { traits } from '../data/app.ts'
import { FIRST_BUILD, SAMPLE_BUILDS } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'
import {
  EMPTY_SELECTION,
  apply,
  choose,
  countSelected,
  facets,
  godsOf,
  isEmpty,
  matches,
  sortBuilds,
} from './build-filter.ts'
import type { FacetId, Selection } from './build-filter.ts'

/**
 * A library of two, built here rather than taken from what ships.
 *
 * Three of these tests need two builds on different arms, and the shipped
 * library is one build long: it is a stress test for the screens, not a fixture
 * for the filter. Depending on it made the filter's own tests fail the moment
 * somebody changed what ships, which is the wrong thing to be sensitive to.
 */
const PAIR: ShownBuild[] = [
  FIRST_BUILD,
  {
    ...FIRST_BUILD,
    id: 'fixture-other-arm',
    name: 'Other arm',
    weapon: 'WeaponDagger',
    aspect: 'DaggerTripleAspect',
    // A god the first build does not touch, so the AND test has something that
    // genuinely cannot co-occur with the first build's arm.
    boons: ['ZeusWeaponBoon'],
    hammers: [],
    arcana: [],
  },
]

const facet = (id: FacetId, selection: Selection = EMPTY_SELECTION) => {
  const found = facets(SAMPLE_BUILDS, selection).find((one) => one.id === id)
  if (!found) throw new Error(`no ${id} facet`)
  return found
}

const firstOption = (id: FacetId, selection: Selection = EMPTY_SELECTION) => {
  const option = facet(id, selection).options[0]
  if (!option) throw new Error(`no ${id} options`)
  return option
}

describe('the facets', () => {
  it('offers only values some build actually has', () => {
    for (const one of facets(SAMPLE_BUILDS, EMPTY_SELECTION)) {
      expect(one.options.length, one.id).toBeGreaterThan(0)
      for (const option of one.options) {
        expect(option.count, `${one.id}: ${option.label}`).toBeGreaterThan(0)
      }
    }
  })

  it('names the Aspects of Melinoe by their arm when no arm is chosen', () => {
    // CLAUDE.md records the duplicate-name hazard: six aspects share a name.
    const labels = facet('aspect').options.map((option) => option.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('drops the arm from aspect labels once an arm is chosen', () => {
    const arm = firstOption('weapon')
    const chosen = choose(EMPTY_SELECTION, 'weapon', arm.value)
    for (const option of facet('aspect', chosen).options) {
      expect(option.label).not.toContain(',')
    }
  })

  it('orders arms and aspects by the game’s own weapon order, not alphabetically', () => {
    const arms = facet('weapon').options.map((option) => option.label)
    expect(arms[0]).toContain('Descura')
  })

  it('never offers a god that costs no Olympian slot', () => {
    const gods = facet('god').options.map((option) => option.value)
    for (const outsider of ['Hermes', 'Selene', 'Chaos']) expect(gods).not.toContain(outsider)
  })
})

describe('counting, which is the part that lies if you get it wrong', () => {
  it('counts an option against the other facets, not against everything', () => {
    const god = firstOption('god')
    const selection = choose(EMPTY_SELECTION, 'god', god.value)

    for (const option of facet('weapon', selection).options) {
      const after = apply(SAMPLE_BUILDS, choose(selection, 'weapon', option.value))
      expect(after.length, `arm ${option.label} claimed ${option.count}`).toBe(option.count)
    }
  })

  it('lifts a facet’s own choice when counting it, so switching is possible', () => {
    const arm = firstOption('weapon')
    const chosen = choose(EMPTY_SELECTION, 'weapon', arm.value)
    // Every other arm still has to be offered with a true count, or the filter
    // is a one-way door.
    const after = facet('weapon', chosen).options
    expect(after.length).toBe(facet('weapon').options.length)
    for (const option of after) {
      expect(apply(SAMPLE_BUILDS, choose(chosen, 'weapon', option.value))).toHaveLength(option.count)
    }
  })

  it('marks what is chosen', () => {
    const arm = firstOption('weapon')
    expect(facet('weapon', choose(EMPTY_SELECTION, 'weapon', arm.value)).chosen).toBe(arm.value)
    expect(facet('weapon').chosen).toBeNull()
  })

  it('never drops the chosen option, even if it would count zero', () => {
    // Choose an arm, then a god that arm does not have. The god has to stay in
    // its own list or the control would silently show something else.
    const [arm, other] = PAIR
    if (!arm || !other) throw new Error('need two arms')
    const godOnlyOther = godsOf(other).find((god) => !godsOf(arm).includes(god))
    if (!godOnlyOther) throw new Error('the fixture needs a god only the second build has')

    let selection = choose(EMPTY_SELECTION, 'god', godOnlyOther)
    selection = choose(selection, 'weapon', arm.weapon)
    const found = facets(PAIR, selection).find((one) => one.id === 'god')
    expect(found?.options.map((option) => option.value)).toContain(godOnlyOther)
  })
})

describe('matching', () => {
  it('is AND across facets', () => {
    const [a, b] = PAIR
    if (!a || !b) throw new Error('need two arms')

    const godOnlyB = godsOf(b).find((god) => !godsOf(a).includes(god))
    if (!godOnlyB) throw new Error('the fixture needs a god only the second build has')
    const both = choose(choose(EMPTY_SELECTION, 'weapon', a.weapon), 'god', godOnlyB)
    expect(apply(PAIR, both)).toHaveLength(0)
  })

  it('an empty selection matches everything', () => {
    expect(apply(SAMPLE_BUILDS, EMPTY_SELECTION)).toHaveLength(SAMPLE_BUILDS.length)
    expect(isEmpty(EMPTY_SELECTION)).toBe(true)
    expect(countSelected(EMPTY_SELECTION)).toBe(0)
  })

  it('ignores the facet it is told to ignore', () => {
    const first = SAMPLE_BUILDS[0]
    if (!first) throw new Error('no builds')
    const impossible = { ...EMPTY_SELECTION, aspect: 'NoSuchAspect' }
    expect(matches(first, impossible)).toBe(false)
    expect(matches(first, impossible, 'aspect')).toBe(true)
  })
})

describe('choosing', () => {
  it('holds one value per facet and clears with null', () => {
    const one = choose(EMPTY_SELECTION, 'god', 'Zeus')
    expect(one.god).toBe('Zeus')
    expect(countSelected(one)).toBe(1)
    expect(choose(one, 'god', 'Poseidon').god).toBe('Poseidon')
    expect(choose(one, 'god', null).god).toBeNull()
  })

  it('clears the aspect when the arm changes under it', () => {
    const [build, other] = PAIR
    if (!build || !other) throw new Error('need two arms')

    const picked = choose(choose(EMPTY_SELECTION, 'weapon', build.weapon), 'aspect', build.aspect)
    expect(picked.aspect).toBe(build.aspect)

    // An aspect belongs to exactly one arm, so keeping it would show an empty
    // list with no visible cause.
    const moved = choose(picked, 'weapon', other.weapon)
    expect(moved.aspect).toBeNull()
    expect(apply(PAIR, moved).length).toBeGreaterThan(0)
  })

  it('keeps the aspect when the arm is the one it belongs to', () => {
    const build = SAMPLE_BUILDS[0]
    if (!build) throw new Error('no builds')
    const picked = choose(EMPTY_SELECTION, 'aspect', build.aspect)
    const weapon = traits.get(build.aspect)?.requiredWeapon
    expect(weapon).toBeTruthy()
    expect(choose(picked, 'weapon', weapon as string).aspect).toBe(build.aspect)
  })

  it('keeps the aspect when the arm is cleared', () => {
    const build = SAMPLE_BUILDS[0]
    if (!build) throw new Error('no builds')
    const picked = choose(choose(EMPTY_SELECTION, 'weapon', build.weapon), 'aspect', build.aspect)
    expect(choose(picked, 'weapon', null).aspect).toBe(build.aspect)
  })
})

describe('sorting', () => {
  it.each(['name', 'arm', 'gods'] as const)('%s keeps every build', (by) => {
    expect(sortBuilds(SAMPLE_BUILDS, by)).toHaveLength(SAMPLE_BUILDS.length)
  })

  it('does not mutate what it is given', () => {
    const before = SAMPLE_BUILDS.map((build) => build.id)
    sortBuilds(SAMPLE_BUILDS, 'arm')
    expect(SAMPLE_BUILDS.map((build) => build.id)).toEqual(before)
  })
})

describe('filtering by Fear cleared', () => {
  /**
   * A threshold wearing an exact match's clothes.
   *
   * Every other facet asks whether a build has exactly this value. Nobody wants
   * the builds cleared at exactly 34, so a build reports every band it reaches
   * and picking one means "or better", without `matches` learning anything new.
   */
  const at = (fear: number | undefined): ShownBuild => ({
    ...FIRST_BUILD,
    id: `fear-${fear ?? 'none'}`,
    play: fear === undefined ? undefined : { fear },
  })

  const library = [at(undefined), at(5), at(20), at(34), at(55)]

  it('offers a band only when some build reaches it', () => {
    const fear = facets(library, EMPTY_SELECTION).find((one) => one.id === 'fear')
    // 5 reaches nothing, 55 reaches every band up to 50.
    expect(fear?.options.map((one) => one.value)).toEqual(['10', '20', '30', '40', '50'])
  })

  it('reads as "or better" rather than as an exact match', () => {
    const kept = apply(library, choose(EMPTY_SELECTION, 'fear', '20')).map((one) => one.play?.fear)
    expect(kept.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([20, 34, 55])
  })

  it('is not drawn at all when no build has cleared any Fear', () => {
    // The shipped library is exactly this case, and a "Fear cleared" control
    // with no Fear in it is furniture claiming to be a choice.
    const none = facets([at(undefined), at(undefined)], EMPTY_SELECTION)
    expect(none.find((one) => one.id === 'fear')).toBeUndefined()
  })
})
