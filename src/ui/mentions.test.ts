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
import { buildMentionables, linkedBuild, mentionQuery, mentionToken, parseProse, rankMentions } from './mentions.ts'

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

describe('a mentioned build', () => {
  const mine = { ...FIRST_BUILD, id: 'local-1', name: 'Alpha Build', by: 'owner' as const, publishedAs: 'aB3xK9pQmR' }
  const followed = { ...FIRST_BUILD, id: 'local-2', name: 'Followed One', by: 'community' as const, derivedFrom: 'Zz9yX8wV7u' }
  const unpublished = { ...FIRST_BUILD, id: 'local-3', name: 'Never Shared', by: 'owner' as const }

  it('is stored with its published id and reads back as a build', () => {
    const token = mentionToken({ kind: 'build', id: 'aB3xK9pQmR' }, 'Killer Current')
    expect(token).toBe('@[Killer Current](b:aB3xK9pQmR)')
    expect(parseProse(`Try ${token} first.`)).toEqual([
      { text: 'Try ' },
      { at: { kind: 'build', id: 'aB3xK9pQmR' }, name: 'Killer Current' },
      { text: ' first.' },
    ])
  })

  it('can be any build of yours that is published, or one you follow, and nothing else', () => {
    const found = buildMentionables([mine, followed, unpublished])
    expect(found.map((one) => [one.id, one.sub])).toEqual([
      ['aB3xK9pQmR', 'Your build'],
      ['Zz9yX8wV7u', 'Build you follow'],
    ])
    expect(found.every((one) => one.kind === 'build')).toBe(true)
  })

  it('is offered once however many copies carry its id', () => {
    const copy = { ...followed, id: 'local-4', name: 'A Copy' }
    expect(buildMentionables([followed, copy]).map((one) => one.id)).toEqual(['Zz9yX8wV7u'])
  })

  it('refuses an id the worker would never hand out', () => {
    const sample = { ...followed, derivedFrom: 'sample-killer-current' }
    expect(buildMentionables([sample])).toEqual([])
  })

  /* A guide is about builds and has no picks of its own, so a bare @ there
     lists the builds. Inside a build's own notes the picks still come first. */
  it('comes first where the text belongs to no build, and not inside one', () => {
    const builds = buildMentionables([mine, followed])
    expect(rankMentions('', null, 8, builds).map((one) => one.id)).toEqual(['aB3xK9pQmR', 'Zz9yX8wV7u'])
    expect(rankMentions('', FIRST_BUILD, 8, builds).some((one) => one.kind === 'build')).toBe(false)
    expect(rankMentions('followed', FIRST_BUILD, 8, builds).map((one) => one.id)).toContain('Zz9yX8wV7u')
  })

  it('is never offered inside its own notes', () => {
    const builds = buildMentionables([mine, followed])
    const found = rankMentions(mine.name.slice(0, 6), mine, 40, builds)
    expect(found.map((one) => one.id)).not.toContain('aB3xK9pQmR')
  })
})

describe('a pasted link', () => {
  const origin = 'https://enodia.example'

  it('names the build when it is a short link to this site', () => {
    expect(linkedBuild(`${origin}/b/aB3xK9pQmR`, origin)).toBe('aB3xK9pQmR')
    expect(linkedBuild(`  ${origin}/b/aB3xK9pQmR/\n`, origin)).toBe('aB3xK9pQmR')
  })

  it('names nothing on another site, with words around it, or as a long link', () => {
    expect(linkedBuild('https://elsewhere.example/b/aB3xK9pQmR', origin)).toBeNull()
    expect(linkedBuild(`see ${origin}/b/aB3xK9pQmR`, origin)).toBeNull()
    expect(linkedBuild(`${origin}/#build=zABC`, origin)).toBeNull()
    expect(linkedBuild('aB3xK9pQmR', origin)).toBeNull()
  })
})
