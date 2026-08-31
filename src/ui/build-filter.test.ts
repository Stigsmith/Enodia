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
import { SAMPLE_BUILDS } from '../data/builds.ts'
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
    const arm = SAMPLE_BUILDS[0]
    const other = SAMPLE_BUILDS.find((build) => arm && build.weapon !== arm.weapon)
    if (!arm || !other) throw new Error('need two arms')
    const godOnlyOther = godsOf(other).find((god) => !godsOf(arm).includes(god))
    if (!godOnlyOther) return

    let selection = choose(EMPTY_SELECTION, 'god', godOnlyOther)
    selection = choose(selection, 'weapon', arm.weapon)
    const values = facet('god', selection).options.map((option) => option.value)
    expect(values).toContain(godOnlyOther)
  })
})

describe('matching', () => {
  it('is AND across facets', () => {
    const a = SAMPLE_BUILDS[0]
    const b = SAMPLE_BUILDS.find((build) => a && build.weapon !== a.weapon)
    if (!a || !b) throw new Error('need two arms')

    const godOnlyB = godsOf(b).find((god) => !godsOf(a).includes(god))
    if (godOnlyB) {
      const both = choose(choose(EMPTY_SELECTION, 'weapon', a.weapon), 'god', godOnlyB)
      expect(apply(SAMPLE_BUILDS, both)).toHaveLength(0)
    }
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
    const build = SAMPLE_BUILDS[0]
    const other = SAMPLE_BUILDS.find((one) => build && one.weapon !== build.weapon)
    if (!build || !other) throw new Error('need two arms')

    const picked = choose(choose(EMPTY_SELECTION, 'weapon', build.weapon), 'aspect', build.aspect)
    expect(picked.aspect).toBe(build.aspect)

    // An aspect belongs to exactly one arm, so keeping it would show an empty
    // list with no visible cause.
    const moved = choose(picked, 'weapon', other.weapon)
    expect(moved.aspect).toBeNull()
    expect(apply(SAMPLE_BUILDS, moved).length).toBeGreaterThan(0)
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
