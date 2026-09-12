/**
 * A build taken apart for drawing, for the keepsakes a run carries.
 *
 * Every layout reads its keepsakes out of `crossroads.pieces`, so this is the
 * one place that decides what a build that swaps looks like, and the one place
 * that has to leave a build that does not swap looking exactly as it did.
 */

import { describe, expect, it } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { assemble, pieceOf } from './build-pieces.ts'

const keepsakes = (build: ShownBuild) =>
  assemble(build).crossroads.pieces.filter((piece) => piece.kind === 'keepsake')

describe('the keepsakes', () => {
  it('draws a build that swaps nothing as it always did: one keepsake, no label', () => {
    const found = keepsakes(FIRST_BUILD)
    expect(found.map((piece) => piece.id)).toEqual([FIRST_BUILD.keepsake])
    expect(found[0]?.when).toBeUndefined()
  })

  it('draws the swaps in order, each saying when it is taken', () => {
    const found = keepsakes({ ...FIRST_BUILD, swaps: ['ForceZeusBoonKeepsake', null, 'ForceHeraBoonKeepsake'] })
    expect(found.map((piece) => [piece.id, piece.when])).toEqual([
      [FIRST_BUILD.keepsake, 'To start'],
      ['ForceZeusBoonKeepsake', 'After the first Guardian'],
      ['ForceHeraBoonKeepsake', 'After the third Guardian'],
    ])
  })

  it('leaves out a swap to the keepsake already carried', () => {
    const found = keepsakes({ ...FIRST_BUILD, swaps: [FIRST_BUILD.keepsake, null, null] })
    expect(found).toHaveLength(1)
    expect(found[0]?.when).toBeUndefined()
  })

  it('gives every keepsake its own key, one taken twice included', () => {
    const found = keepsakes({ ...FIRST_BUILD, swaps: ['ForceZeusBoonKeepsake', FIRST_BUILD.keepsake, null] })
    expect(found).toHaveLength(3)
    expect(new Set(found.map((piece) => piece.key)).size).toBe(3)
  })
})

describe('notes on the picks', () => {
  const noted: ShownBuild = {
    ...FIRST_BUILD,
    by: 'community',
    author: 'Ana',
    notes: {
      HestiaWeaponBoon: 'The Attack Freezer Burn wants.',
      FrogFamiliar: 'For the dodge.',
      ZeusWeaponBoon: 'Not in the build.',
    },
  }

  it('puts a note on the piece it is about, saying whose it is', () => {
    const built = assemble(noted)
    expect(built.all.find((piece) => piece.id === 'HestiaWeaponBoon')?.note).toEqual({
      by: "Ana's note",
      text: 'The Attack Freezer Burn wants.',
    })
    expect(built.crossroads.pieces.find((piece) => piece.id === 'FrogFamiliar')?.note?.text).toBe('For the dodge.')
  })

  /* The slot map, the groups and `all` are built from the same pieces, so a
     layout reading any one of them sees the note. */
  it('carries it into the slot map as well', () => {
    const attack = assemble(noted).slots.find((slot) => slot.slot === 'Melee')
    expect(attack?.piece?.note?.text).toBe('The Attack Freezer Burn wants.')
  })

  it('puts no note on anything the build does not hold', () => {
    expect(assemble(noted).all.filter((piece) => piece.note)).toHaveLength(2)
  })

  it('calls a note on your own build yours', () => {
    expect(assemble({ ...noted, by: 'owner' }).all.find((piece) => piece.note)?.note?.by).toBe('Your note')
  })
})

describe('a piece for a mention', () => {
  it('draws each kind of thing as that kind', () => {
    expect(pieceOf({ kind: 'trait', id: 'ForceHestiaBoonKeepsake' })?.kind).toBe('keepsake')
    expect(pieceOf({ kind: 'trait', id: 'StaffExAoETrait' })?.kind).toBe('hammer')
    expect(pieceOf({ kind: 'trait', id: 'MeteorHestiaTalent' })?.kind).toBe('hex')
    expect(pieceOf({ kind: 'arcana', id: 'CastBuff' })?.kind).toBe('arcana')
    expect(pieceOf({ kind: 'familiar', id: 'FrogFamiliar' })?.kind).toBe('familiar')
  })

  it('has nothing for an id the data does not know', () => {
    expect(pieceOf({ kind: 'trait', id: 'NoSuchTrait' })).toBeNull()
    expect(pieceOf({ kind: 'arcana', id: 'NoSuchCard' })).toBeNull()
    expect(pieceOf({ kind: 'familiar', id: 'NoSuchFamiliar' })).toBeNull()
  })
})
