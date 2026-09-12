/**
 * A build's four keepsakes, read through the two helpers everything uses.
 *
 * `swaps` is new and optional, and the shape checks a stored build or a link
 * pass through were written before it, so these are what stand between a
 * malformed field and every screen that reads it.
 */

import { describe, expect, it } from 'vitest'

import { KEEPSAKE_POSITIONS, keepsakesOf, swapsOf } from './builds.ts'

describe('swapsOf', () => {
  it('is always three long, and absent means keeping the one you have', () => {
    expect(swapsOf({})).toEqual([null, null, null])
    expect(swapsOf({ swaps: ['ForceZeusBoonKeepsake'] })).toEqual(['ForceZeusBoonKeepsake', null, null])
  })

  it('reads anything that is not an id as keeping, and ignores a fourth', () => {
    const odd = { swaps: [3, '', 'ForceHeraBoonKeepsake', 'ForceZeusBoonKeepsake'] as never }
    expect(swapsOf(odd)).toEqual([null, null, 'ForceHeraBoonKeepsake'])
    expect(swapsOf({ swaps: 'nonsense' as never })).toEqual([null, null, null])
  })
})

describe('keepsakesOf', () => {
  it('starts with the one chosen at the Crossroads and says each keepsake once', () => {
    expect(
      keepsakesOf({
        keepsake: 'ForceHestiaBoonKeepsake',
        swaps: ['ForceZeusBoonKeepsake', 'ForceHestiaBoonKeepsake', null],
      }),
    ).toEqual(['ForceHestiaBoonKeepsake', 'ForceZeusBoonKeepsake'])
  })

  it('finds a swap on a build that starts with nothing', () => {
    expect(keepsakesOf({ keepsake: null, swaps: [null, null, 'ForceZeusBoonKeepsake'] })).toEqual([
      'ForceZeusBoonKeepsake',
    ])
  })
})

it('names four positions, the Crossroads and the three racks', () => {
  expect(KEEPSAKE_POSITIONS).toHaveLength(4)
})
