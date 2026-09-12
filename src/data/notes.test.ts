/**
 * Notes on a build's picks.
 *
 * A note is prose that hangs on a pick, so the questions worth asking are the
 * ones a stale or a hostile note would raise: whether one on a pick that was
 * taken out is still shown anywhere, whether anything but a string gets
 * through, and whether the three kinds of id a note can hang on could ever be
 * mistaken for one another.
 */

import { describe, expect, it } from 'vitest'

import { arcana, familiars, traits } from './app.ts'
import { FIRST_BUILD } from './builds.fixture.ts'
import { NOTE_MAX, noteLabel, notesLength, notesOf, picksOf, withNotesPruned } from './builds.ts'
import type { ShownBuild } from './builds.ts'

const withNotes = (notes: unknown): ShownBuild => ({ ...FIRST_BUILD, notes }) as ShownBuild

describe('what a note can hang on', () => {
  it('is every pick, once, the keepsakes a build swaps to included', () => {
    const picks = picksOf({ ...FIRST_BUILD, swaps: ['ForceZeusBoonKeepsake', FIRST_BUILD.keepsake, null] })
    expect(picks).toContain(FIRST_BUILD.aspect)
    expect(picks).toContain('ForceZeusBoonKeepsake')
    expect(picks).toContain('FrogFamiliar')
    expect(picks).toContain('CastBuff')
    expect(new Set(picks).size).toBe(picks.length)
  })

  /* Notes are keyed by the bare id. That is only safe while no Arcana card or
     familiar shares an id with a trait, or with each other. */
  it('is keyed by ids that no two kinds of thing share', () => {
    const cards = arcana.map((one) => one.id)
    const pets = familiars.map((one) => one.id)
    expect(cards.filter((id) => traits.has(id))).toEqual([])
    expect(pets.filter((id) => traits.has(id))).toEqual([])
    expect(cards.filter((id) => pets.includes(id))).toEqual([])
  })
})

describe('reading notes', () => {
  it('keeps the notes on picks the build holds, and nothing else', () => {
    const notes = notesOf(withNotes({ HestiaWeaponBoon: 'Why.', ZeusWeaponBoon: 'Gone.' }))
    expect([...notes]).toEqual([['HestiaWeaponBoon', 'Why.']])
  })

  it('trims them, cuts one that is too long, and drops one that is empty', () => {
    const notes = notesOf(
      withNotes({ HestiaWeaponBoon: '  Why.  ', FrogFamiliar: 'x'.repeat(NOTE_MAX + 20), CastBuff: '   ' }),
    )
    expect(notes.get('HestiaWeaponBoon')).toBe('Why.')
    expect(notes.get('FrogFamiliar')).toHaveLength(NOTE_MAX)
    expect(notes.has('CastBuff')).toBe(false)
  })

  it('reads nothing out of a field that holds something else', () => {
    expect(notesOf(withNotes('nonsense')).size).toBe(0)
    expect(notesOf(withNotes(['Why.'])).size).toBe(0)
    expect(notesOf(withNotes(null)).size).toBe(0)
    expect(notesOf(withNotes({ HestiaWeaponBoon: 12 })).size).toBe(0)
    expect(notesOf(FIRST_BUILD).size).toBe(0)
  })
})

describe('saving notes', () => {
  it('drops a note on a pick that was taken out', () => {
    const saved = withNotesPruned(withNotes({ HestiaWeaponBoon: 'Why.', ZeusWeaponBoon: 'Gone.' }))
    expect(saved.notes).toEqual({ HestiaWeaponBoon: 'Why.' })
  })

  it('drops the field entirely when no note is left', () => {
    expect(withNotesPruned(withNotes({ ZeusWeaponBoon: 'Gone.' }))).not.toHaveProperty('notes')
  })

  it('counts only the notes on picks the build holds against the budget', () => {
    expect(notesLength(withNotes({ HestiaWeaponBoon: 'Why.', ZeusWeaponBoon: 'Not counted.' }))).toBe(4)
  })
})

describe('whose note it is', () => {
  it('is yours on your own build, and the author’s on anybody else’s', () => {
    expect(noteLabel({ by: 'owner', author: 'Ana' })).toBe('Your note')
    expect(noteLabel({ by: 'community', author: 'Ana' })).toBe("Ana's note")
    expect(noteLabel({ by: 'sample' })).toBe("The author's note")
  })
})
