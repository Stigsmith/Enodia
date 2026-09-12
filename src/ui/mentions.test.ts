/**
 * Mentions: a game thing named inside a build's write-up.
 *
 * What has to hold is that the stored text means exactly one thing and reads
 * back the same, that the list opens when somebody is naming something and at
 * no other time, and that it offers the build's own picks first.
 */

import { describe, expect, it } from 'vitest'

import { traits } from '../data/app.ts'
import { FIRST_BUILD } from '../data/builds.fixture.ts'
import { picksOf } from '../data/builds.ts'
import { mentionQuery, mentionToken, parseProse, rankMentions } from './mentions.ts'

describe('a stored mention', () => {
  it('reads back as the thing it names, with the words around it untouched', () => {
    const burn = mentionToken({ kind: 'trait', id: 'BurnConsumeBoon' }, 'Freezer Burn')
    const furies = mentionToken({ kind: 'arcana', id: 'CastBuff' }, 'The Furies')
    expect(parseProse(`Take ${burn} early, then ${furies}.`)).toEqual([
      { text: 'Take ' },
      { at: { kind: 'trait', id: 'BurnConsumeBoon' }, name: 'Freezer Burn' },
      { text: ' early, then ' },
      { at: { kind: 'arcana', id: 'CastBuff' }, name: 'The Furies' },
      { text: '.' },
    ])
  })

  it('is stored in the form the documents give', () => {
    expect(mentionToken({ kind: 'familiar', id: 'FrogFamiliar' }, 'Frinos')).toBe('@[Frinos](f:FrogFamiliar)')
  })

  it('keeps the characters a mention is made of out of the name it stores', () => {
    expect(mentionToken({ kind: 'trait', id: 'X' }, 'Odd [name] (here)')).toBe('@[Odd name here](t:X)')
  })

  it('leaves anything that only looks like a mention as text', () => {
    for (const text of ['@[Name](z:Id)', '@[Name](t:has space)', '@[](t:Id)', '[Name](t:Id)', 'plain words']) {
      expect(parseProse(text)).toEqual([{ text }])
    }
  })
})

describe('the @ being typed', () => {
  const at = (text: string) => mentionQuery(text, text.length)

  it('opens at the start of the text, after a space and after a bracket', () => {
    expect(at('@fre')).toEqual({ start: 0, query: 'fre' })
    expect(at('Take @fre')).toEqual({ start: 5, query: 'fre' })
    expect(at('Take (@fre')).toEqual({ start: 6, query: 'fre' })
  })

  it('does not open in the middle of a word, like an address', () => {
    expect(at('me@example')).toBeNull()
  })

  it('carries on through a space, because names have them', () => {
    expect(at('@freezer bu')).toEqual({ start: 0, query: 'freezer bu' })
  })

  it('stops at a line break, past 30 characters, and after a finished mention', () => {
    expect(at('@fre\nand more')).toBeNull()
    expect(at(`@${'a'.repeat(31)}`)).toBeNull()
    expect(at(`${mentionToken({ kind: 'trait', id: 'BurnConsumeBoon' }, 'Freezer Burn')} and`)).toBeNull()
  })

  it('reads up to the caret, not to the end of the text', () => {
    expect(mentionQuery('@fre and more', 4)).toEqual({ start: 0, query: 'fre' })
  })
})

describe('what the list offers first', () => {
  it('lists the build’s own picks for a bare @, and nothing else', () => {
    const found = rankMentions('', FIRST_BUILD)
    const held = new Set(picksOf(FIRST_BUILD))
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((one) => held.has(one.id))).toBe(true)
  })

  /* Flame Strike is in the build. Demeter's Attack is not, and Demeter is one of
     its gods. Zeus is not one of them. */
  it('puts the build’s picks first, then the rest of what its gods give, then everything', () => {
    const found = rankMentions('strike', FIRST_BUILD, 40).map((one) => one.id)
    expect(found[0]).toBe('HestiaWeaponBoon')
    expect(found.indexOf('DemeterWeaponBoon')).toBeGreaterThan(0)
    expect(found.indexOf('ZeusWeaponBoon')).toBeGreaterThan(found.indexOf('DemeterWeaponBoon'))
  })

  it('finds a name without its accent', () => {
    const found = rankMentions('melinoe', null, 20)
    expect(found.filter((one) => one.name.includes('Melino')).length).toBeGreaterThanOrEqual(6)
  })

  it('prefers a name that starts with what was typed', () => {
    expect(rankMentions('heaven', null, 5)[0]?.name.toLowerCase().startsWith('heaven')).toBe(true)
  })

  it('names every trait it offers the way the data does', () => {
    for (const one of rankMentions('a', null, 30)) {
      if (one.kind === 'trait') expect(one.name).toBe(traits.get(one.id)?.name)
    }
  })
})
