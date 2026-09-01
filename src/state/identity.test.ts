/**
 * A name, and what it is and is not allowed to mean.
 *
 * The claims worth pinning are the two that would be quietly wrong: that a name
 * travels with a shared build when the play record does not, and that the tool
 * never treats a locally chosen name as something it can verify.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { FIRST_BUILD } from '../data/builds.ts'
import { NAME_LIMIT, authorWord, readName, tidyName, writeName } from './identity.ts'
import { blankBuild, duplicateBuild } from './builds.ts'
import { packBuild, shareable, unpackBuild } from './transfer.ts'

beforeEach(() => {
  window.localStorage.clear()
})

describe('the name itself', () => {
  it('tidies whitespace and holds a limit', () => {
    expect(tidyName('  Stigsmith   the   Third  ')).toBe('Stigsmith the Third')
    expect(tidyName('x'.repeat(80)).length).toBe(NAME_LIMIT)
  })

  it('treats empty as no name rather than as a name', () => {
    writeName('Somebody')
    expect(readName()).toBe('Somebody')
    writeName('   ')
    expect(readName()).toBe('')
    expect(window.localStorage.getItem('enodia.name')).toBeNull()
  })
})

describe('whose build it is', () => {
  it('stamps a new build with the name, and none when there is none', () => {
    expect(blankBuild('WeaponStaffSwing', 'StaffClearCastAspect').author).toBeUndefined()
    writeName('Melinoe')
    expect(blankBuild('WeaponStaffSwing', 'StaffClearCastAspect').author).toBe('Melinoe')
  })

  it('makes a fork yours, and keeps the trail back to theirs', () => {
    // A fork is your work built on somebody else's, so it carries your name
    // while derivedFrom keeps the pointer to what it came from.
    writeName('Me')
    const { copy } = duplicateBuild({ ...FIRST_BUILD, author: 'Them' })
    expect(copy.author).toBe('Me')
    expect(copy.derivedFrom).toBe(FIRST_BUILD.id)
  })

  it('leaves a fork unsigned when nobody has picked a name', () => {
    const { copy } = duplicateBuild({ ...FIRST_BUILD, author: 'Them' })
    expect(copy.author).toBeUndefined()
  })
})

describe('the name travels and the play record does not', () => {
  it('carries the author through a link', async () => {
    const mine = { ...FIRST_BUILD, author: 'Melinoe', play: { rating: 5, runs: 9, clears: 4 } }
    expect(shareable(mine).author).toBe('Melinoe')

    const back = await unpackBuild(await packBuild(mine))
    expect(back?.author).toBe('Melinoe')
    expect(back).not.toHaveProperty('play')
  })
})

describe('what to call whoever wrote it', () => {
  it('says You for your own, and their name for theirs', () => {
    expect(authorWord('Melinoe', 'Melinoe')).toBe('You')
    expect(authorWord('Zagreus', 'Melinoe')).toBe('Zagreus')
  })

  it('says Someone rather than inventing a name', () => {
    // A build made before anyone picked a name has no author, and that is not
    // an error to paper over.
    expect(authorWord(undefined, 'Melinoe')).toBe('Someone')
    expect(authorWord('', 'Melinoe')).toBe('Someone')
  })

  it('cannot tell two people with the same name apart, and does not pretend to', () => {
    // There is no account behind a name. Anybody can pick any name, so the tool
    // treats a match as a match and nothing more.
    expect(authorWord('Melinoe', 'Melinoe')).toBe('You')
  })
})
