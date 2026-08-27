import { describe, expect, it } from 'vitest'

import { buildIconIndex, resolveIcon, slugify } from './icons.ts'
import type { Manifest } from './icons.ts'

describe('slugify', () => {
  it('matches the shape the wiki filenames were given', () => {
    expect(slugify('Arterial Spray')).toBe('arterial-spray')
    expect(slugify('Back Burner')).toBe('back-burner')
  })

  it('drops apostrophes rather than turning them into hyphens', () => {
    // Two shapes of apostrophe, since the game uses the typographic one.
    expect(slugify("Queen's Ransom")).toBe('queens-ransom')
    expect(slugify('Executioner’s Chop')).toBe('executioners-chop')
  })

  it('folds accents, so the wiki spelling of Melinoe resolves', () => {
    expect(slugify('Melinoë')).toBe('melinoe')
  })

  it('strips the inline formatting codes the game text carries', () => {
    expect(slugify('{#Emph}Hot Pot')).toBe('hot-pot')
  })

  it('collapses runs of punctuation into one hyphen and trims the ends', () => {
    expect(slugify('  Ω Moves: the End.  ')).toBe('moves-the-end')
  })
})

describe('the icon index', () => {
  const manifest: Manifest = {
    assets: [
      { id: 'back-burner', category: 'boons', file: 'boons/back-burner.png' },
      { id: 'back-burner', category: 'duos', file: 'duos/back-burner.webp' },
      { id: 'island-getaway', category: 'duos', file: 'duos/island-getaway.webp' },
    ],
  }

  it('keeps the first entry when two categories carry the same slug', () => {
    expect(buildIconIndex(manifest).get('back-burner')?.file).toBe('boons/back-burner.png')
  })

  it('resolves a trait through its display name', () => {
    const found = resolveIcon('AllCloseBoon', 'Island Getaway', buildIconIndex(manifest))
    expect(found).toEqual({ found: true, file: 'duos/island-getaway.webp', slug: 'island-getaway', via: 'slug' })
  })

  it('reports a trait with no display name separately from one with no art', () => {
    const index = buildIconIndex(manifest)
    expect(resolveIcon('SomeBaseTemplate', null, index)).toEqual({
      found: false,
      slug: null,
      why: 'no display name',
    })
    expect(resolveIcon('RapidHackTrait', 'Rapid Hack', index)).toEqual({
      found: false,
      slug: 'rapid-hack',
      why: 'no asset',
    })
  })

  it('takes an override for a file the wiki named badly', () => {
    const overrides = new Map([['AxeMassiveThirdStrikeTrait', 'hammers/executioner-27s-chop.webp']])
    const found = resolveIcon('AxeMassiveThirdStrikeTrait', 'Executioner’s Chop', buildIconIndex(manifest), overrides)
    expect(found).toEqual({
      found: true,
      file: 'hammers/executioner-27s-chop.webp',
      slug: 'executioners-chop',
      via: 'override',
    })
  })
})
