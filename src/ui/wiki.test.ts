/**
 * The wiki's addresses and its index.
 *
 * An address is something people send each other, so it has to round-trip and
 * it has to land somewhere sensible when it names nothing. The index has to
 * hold every named trait exactly once: a section that swallowed another's
 * entries, or a trait that fell through every heading, would be invisible on
 * screen and only this could say so.
 */

import { describe, expect, it } from 'vitest'

import { arcana, familiars, traits } from '../data/app.ts'
import { prerequisiteFor, wikiSections } from './wiki-index.ts'
import { wikiInUrl, wikiPath } from './wiki-route.ts'

describe('wiki addresses', () => {
  it('reads the index and a record, and ignores everything else', () => {
    expect(wikiInUrl('/wiki')).toEqual({ at: null })
    expect(wikiInUrl('/wiki/')).toEqual({ at: null })
    expect(wikiInUrl('/wiki/t/ZeusWeaponBoon')).toEqual({ at: { kind: 'trait', id: 'ZeusWeaponBoon' } })
    expect(wikiInUrl('/wiki/arcana/Death')).toEqual({ at: { kind: 'arcana', id: 'Death' } })
    expect(wikiInUrl('/')).toBeNull()
    expect(wikiInUrl('/b/abc123')).toBeNull()
  })

  it('round-trips an id that needs escaping', () => {
    const at = { kind: 'trait' as const, id: 'Odd Name/With?Things' }
    expect(wikiInUrl(wikiPath(at))).toEqual({ at })
    expect(wikiPath(null)).toBe('/wiki')
  })

  it('falls back to the index for a kind it does not know or an id that will not decode', () => {
    expect(wikiInUrl('/wiki/nonsense/ZeusWeaponBoon')).toEqual({ at: null })
    expect(wikiInUrl('/wiki/t/%E0%A4%A')).toEqual({ at: null })
  })
})

describe('the index', () => {
  const sections = wikiSections()
  const traitIds = sections.flatMap((section) =>
    section.entries.filter((one) => one.at.kind === 'trait').map((one) => one.at.id),
  )

  it('holds every named trait, and each exactly once', () => {
    const named = [...traits.values()].filter((trait) => trait.name).map((trait) => trait.id)
    expect(new Set(traitIds).size).toBe(traitIds.length)
    expect([...traitIds].sort()).toEqual([...named].sort())
  })

  it('holds every Arcana card and every familiar', () => {
    const cards = sections.flatMap((one) => one.entries).filter((one) => one.at.kind === 'arcana')
    const pets = sections.flatMap((one) => one.entries).filter((one) => one.at.kind === 'familiar')
    expect(cards).toHaveLength(arcana.length)
    expect(pets).toHaveLength(familiars.length)
  })

  it('files a duo under Duos rather than under either of its gods', () => {
    const duos = sections.find((one) => one.id === 'duos')
    expect(duos?.entries.map((one) => one.at.id)).toContain('AllCloseBoon')
    const zeus = sections.find((one) => one.id === 'god-Zeus')
    expect(zeus?.entries.some((one) => traits.get(one.at.id)?.kind === 'duo')).toBe(false)
  })

  it('files Daedalus Hammers by arm, six sections, 92 in all', () => {
    const hammers = sections.filter((one) => one.id.startsWith('hammers-'))
    expect(hammers).toHaveLength(6)
    expect(hammers.reduce((n, one) => n + one.entries.length, 0)).toBe(92)
  })

  it('puts a god’s core boons first, in the game’s slot order', () => {
    const zeus = sections.find((one) => one.id === 'god-Zeus')
    expect(zeus?.entries.slice(0, 5).map((one) => one.sub)).toEqual(['Attack', 'Special', 'Cast', 'Sprint', 'Magick'])
  })
})

describe('what a trait is a prerequisite for', () => {
  /* Island Getaway needs one Poseidon core boon and one of Aphrodite's Attack
     or Special, straight out of `TraitRequirements`. Read backwards, Wave
     Strike counts toward it. */
  it('reads a duo’s prerequisites backwards', () => {
    expect(prerequisiteFor('PoseidonWeaponBoon')).toContain('AllCloseBoon')
    expect(prerequisiteFor('AphroditeSpecialBoon')).toContain('AllCloseBoon')
  })

  it('says nothing for a trait nothing needs', () => {
    expect(prerequisiteFor('NoSuchTrait')).toEqual([])
  })
})
