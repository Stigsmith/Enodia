/**
 * The page of things the game never tells you.
 *
 * It is prose, so what a test can hold it to is the rule that makes it worth
 * publishing at all: every entry cites the symbols it was read from, and
 * anything that is ours rather than the game's is marked as ours. A page like
 * this is exactly where a judgement would slip in wearing a source's clothes.
 *
 * The entry that was wrong for the whole life of the old page is pinned by the
 * claim it used to make, so it cannot come back.
 */

import { describe, expect, it } from 'vitest'

import { UNDER_HOOD } from './underhood.ts'

const entries = UNDER_HOOD.flatMap((tier) => tier.entries.map((entry) => ({ ...entry, level: tier.level })))

describe('the shape of it', () => {
  it('is three tiers, each with something in it', () => {
    expect(UNDER_HOOD.map((tier) => tier.level)).toEqual([1, 2, 3])
    for (const tier of UNDER_HOOD) expect(tier.entries.length).toBeGreaterThan(0)
  })

  it('gives every entry a summary and something to read', () => {
    for (const entry of entries) {
      expect(entry.summary).not.toBe('')
      expect(entry.body.length).toBeGreaterThan(0)
    }
  })
})

describe('what it is allowed to claim', () => {
  it('cites the symbols behind every entry', () => {
    expect(entries.filter((entry) => !entry.source).map((entry) => entry.summary)).toEqual([])
  })

  /* Level 3 is the tier that says "you will work this out yourself", which is
     advice about playing rather than a rule in the files. Both of its entries
     rest on a real mechanism and neither is a reading of one. */
  it('marks what is ours, and only in the tier that is ours', () => {
    expect(entries.filter((entry) => entry.ours).map((entry) => entry.level)).toEqual([3, 3])
    expect(entries.filter((entry) => entry.level === 3).every((entry) => entry.ours)).toBe(true)
  })
})

describe('the entry that was wrong the whole time it was live', () => {
  const cap = entries.find((entry) => /fourth Olympian/.test(entry.summary))

  it('no longer closes the run to every other god', () => {
    // What it used to say: "Every other Olympian becomes impossible for the
    // rest of the run". `CLAUDE.md` error 6.
    const said = cap?.body.join(' ') ?? ''
    expect(said).not.toMatch(/impossible for the rest of the run/)
    expect(said).toMatch(/keepsake/)
  })

  it('cites the line that overwrites the cap', () => {
    expect(cap?.source).toContain('RewardLogic.lua:242')
  })
})
