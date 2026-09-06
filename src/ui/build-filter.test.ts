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
import { FIRST_BUILD, SAMPLE_BUILDS } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { EMPTY_SELECTION, apply, choose, countSelected, facets, godsOf, isEmpty, matches, sortBuilds } from './build-filter.ts'
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
    expect(facet('weapon', choose(EMPTY_SELECTION, 'weapon', arm.value)).chosen).toEqual([arm.value])
    expect(facet('weapon').chosen).toEqual([])
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
  /**
   * OR inside a facet, which is the question people actually have. The other
   * reading, AND inside a facet, means "uses both gods" and is answered today
   * by picking one and reading the list.
   */
  it('is OR within a facet', () => {
    const [a, b] = PAIR
    if (!a || !b) throw new Error('need two arms')

    const both = choose(choose(EMPTY_SELECTION, 'weapon', a.weapon), 'weapon', b.weapon)
    expect(apply(PAIR, both)).toHaveLength(2)

    // And one of them alone is still one of them.
    expect(apply(PAIR, choose(EMPTY_SELECTION, 'weapon', a.weapon))).toHaveLength(1)
  })

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
    const impossible = { ...EMPTY_SELECTION, aspect: ['NoSuchAspect'] }
    expect(matches(first, impossible)).toBe(false)
    expect(matches(first, impossible, 'aspect')).toBe(true)
  })
})

describe('choosing', () => {
  it('adds, toggles off, and clears the whole facet with null', () => {
    const one = choose(EMPTY_SELECTION, 'god', 'Zeus')
    expect(one.god).toEqual(['Zeus'])
    expect(countSelected(one)).toBe(1)

    // A second value joins rather than replacing. This is the whole change.
    const two = choose(one, 'god', 'Poseidon')
    expect(two.god).toEqual(['Zeus', 'Poseidon'])
    // Still one facet narrowing, whatever it holds.
    expect(countSelected(two)).toBe(1)

    // Clicking a chosen option again takes it back out.
    expect(choose(two, 'god', 'Zeus').god).toEqual(['Poseidon'])
    expect(choose(two, 'god', null).god).toEqual([])
  })

  /**
   * Fear is a threshold, so a set of them collapses to the lowest and the extra
   * choices would be furniture. It replaces instead of accumulating.
   */
  it('replaces rather than accumulating on Fear', () => {
    const one = choose(EMPTY_SELECTION, 'fear', '20')
    expect(one.fear).toEqual(['20'])
    expect(choose(one, 'fear', '40').fear).toEqual(['40'])
    // And clicking the held one still clears it.
    expect(choose(one, 'fear', '20').fear).toEqual([])
  })

  /**
   * The dependency survived the move to sets, but its trigger changed.
   *
   * It used to fire when the arm *changed*, because only one could be held.
   * Arms accumulate now, so the case that strands an aspect is dropping the arm
   * it belongs to. An aspect whose arm is gone matches nothing and says nothing
   * about why, which is the thing this has always been here to prevent.
   */
  it('clears an aspect when the arm it belongs to is dropped', () => {
    const [build, other] = PAIR
    if (!build || !other) throw new Error('need two arms')

    let picked = choose(EMPTY_SELECTION, 'weapon', build.weapon)
    picked = choose(picked, 'aspect', build.aspect)
    expect(picked.aspect).toEqual([build.aspect])

    // Add a second arm, then take the first one away.
    picked = choose(picked, 'weapon', other.weapon)
    const dropped = choose(picked, 'weapon', build.weapon)

    expect(dropped.weapon).toEqual([other.weapon])
    expect(dropped.aspect).toEqual([])
    expect(apply(PAIR, dropped).length).toBeGreaterThan(0)
  })

  it('keeps the aspect when the arm is the one it belongs to', () => {
    const build = SAMPLE_BUILDS[0]
    if (!build) throw new Error('no builds')
    const picked = choose(EMPTY_SELECTION, 'aspect', build.aspect)
    const weapon = traits.get(build.aspect)?.requiredWeapon
    expect(weapon).toBeTruthy()
    expect(choose(picked, 'weapon', weapon as string).aspect).toEqual([build.aspect])
  })

  it('keeps the aspect when the arm is cleared', () => {
    const build = SAMPLE_BUILDS[0]
    if (!build) throw new Error('no builds')
    const picked = choose(choose(EMPTY_SELECTION, 'weapon', build.weapon), 'aspect', build.aspect)
    expect(choose(picked, 'weapon', null).aspect).toEqual([build.aspect])
  })

  /**
   * Two arms chosen keeps the aspects of both.
   *
   * The old rule cleared the aspect whenever the arm changed, which was right
   * when only one arm could be held. With a set, "the Blades or the Staff, and
   * these two aspects" is expressible, and dropping an aspect whose arm is still
   * chosen would silently answer a different question.
   */
  it('keeps the aspects of every arm still chosen', () => {
    const [a, b] = PAIR
    if (!a || !b) throw new Error('need two arms')

    let picked = choose(EMPTY_SELECTION, 'weapon', a.weapon)
    picked = choose(picked, 'aspect', a.aspect)
    picked = choose(picked, 'weapon', b.weapon)

    // Both arms held, so the first arm's aspect survives.
    expect(picked.weapon).toEqual([a.weapon, b.weapon])
    expect(picked.aspect).toEqual([a.aspect])

    // Dropping the arm it belongs to takes it with it.
    const dropped = choose(picked, 'weapon', a.weapon)
    expect(dropped.weapon).toEqual([b.weapon])
    expect(dropped.aspect).toEqual([])
  })
})

describe('sorting', () => {
  it.each(['name', 'arm', 'gods', 'recent', 'assemble', 'fear'] as const)(
    '%s keeps every build',
    (by) => {
      expect(sortBuilds(SAMPLE_BUILDS, by)).toHaveLength(SAMPLE_BUILDS.length)
    },
  )

  /** A build with no date sorts last rather than throwing. `ShownBuild` makes
   * `modified` optional even though `SavedBuild` does not. */
  it('puts an undated build last rather than failing on it', () => {
    const dated: ShownBuild = { ...FIRST_BUILD, id: 'dated', modified: '2026-09-01T00:00:00.000Z' }
    const undated: ShownBuild = { ...FIRST_BUILD, id: 'undated', modified: undefined, created: undefined }
    expect(sortBuilds([undated, dated], 'recent').map((one) => one.id)).toEqual(['dated', 'undated'])
  })

  it('orders Fear cleared with the highest first', () => {
    const at = (fear: number | undefined, id: string): ShownBuild => ({
      ...FIRST_BUILD,
      id,
      play: fear === undefined ? undefined : { fear },
    })
    const order = sortBuilds([at(undefined, 'none'), at(30, 'high'), at(10, 'low')], 'fear')
    expect(order.map((one) => one.id)).toEqual(['high', 'low', 'none'])
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

describe('an empty library', () => {
  /**
   * The bug that shipped, kept so it does not come back.
   *
   * `facets()` drops a facet with no options, so the object a caller rebuilds
   * from what it returned is missing those keys. `undefined` is not `null`, and
   * `countSelected` used `!== null`, so an empty library counted all six facets
   * as chosen and the bar offered to "Clear 6" with nothing selected.
   */
  it('offers no facets at all', () => {
    expect(facets([], EMPTY_SELECTION)).toEqual([])
  })

  it('counts nothing as chosen when the facets are missing entirely', () => {
    const rebuilt = Object.fromEntries(facets([], EMPTY_SELECTION).map((one) => [one.id, one.chosen]))
    expect(countSelected(rebuilt)).toBe(0)
    expect(isEmpty(rebuilt)).toBe(true)
  })
})

/**
 * Whose build it is, which only became a question when the library started
 * holding other people's.
 *
 * Following puts somebody else's build on your shelf and leaves it theirs, so
 * "show me only mine" is a real thing to want. The facet reads `build.by`,
 * which every build already carries.
 */
describe('whose', () => {
  const LIBRARY: ShownBuild[] = [
    { ...FIRST_BUILD, id: 'mine-1', name: 'Mine one', by: 'owner' },
    { ...FIRST_BUILD, id: 'mine-2', name: 'Mine two', by: 'owner' },
    { ...FIRST_BUILD, id: 'theirs', name: 'Followed', by: 'community' },
  ]

  it('offers each provenance in the reader’s words, with its count', () => {
    const facet = facets(LIBRARY, EMPTY_SELECTION).find((one) => one.id === 'whose')
    expect(facet).toBeTruthy()
    expect(facet?.options.map((one) => [one.label, one.count])).toEqual([
      ['Following', 1],
      ['Mine', 2],
    ])
  })

  it('narrows to yours, and to theirs', () => {
    const mine = apply(LIBRARY, choose(EMPTY_SELECTION, 'whose', 'owner'))
    expect(mine.map((one) => one.name)).toEqual(['Mine one', 'Mine two'])

    const theirs = apply(LIBRARY, choose(EMPTY_SELECTION, 'whose', 'community'))
    expect(theirs.map((one) => one.name)).toEqual(['Followed'])
  })

  /**
   * `facets()` drops a facet with fewer than two options, so a library that is
   * all yours never sees this control. Worth pinning: the alternative is a
   * dropdown offering one choice, which is furniture.
   */
  it('does not appear when everything is yours', () => {
    const allMine = LIBRARY.filter((one) => one.by === 'owner')
    expect(facets(allMine, EMPTY_SELECTION).find((one) => one.id === 'whose')).toBeUndefined()
  })
})
