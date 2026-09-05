/**
 * The Oath of the Unseen, and the ceiling nobody had ever summed.
 *
 * `MAX_FEAR` was 57 for the whole life of the project, hard-coded, under a
 * docblock that said it was "the sum of all of them". It is not. The sum is
 * **67**, and 55 before any Boss Difficulty rank is unlocked, so 57 is a number
 * the game's data does not produce at either end. Nothing caught it because
 * nothing had run the arithmetic the comment described.
 *
 * These tests exist so the next wrong number has to get past an assertion
 * rather than past a sentence. They pin what the game's own functions do, and
 * the two places it is easy to read them wrong:
 *
 * - **`Points` is incremental.** `ShrineLogic.GetTotalSpentShrinePoints` sums
 *   `Ranks[1..activeRank]`, so a maxed vow is worth the sum of its ranks and
 *   not its last one. Reading the last rank gives 26 instead of 67.
 * - **A gated rank does not count.** `GetMaxShrinePoints` skips any rank whose
 *   `GameStateRequirements` are unmet, which is the entire difference between a
 *   new save and a finished one.
 *
 * If the game changes these, the right response is to read `ShrineData.lua` and
 * `ShrineLogic.lua` again and then move the numbers here, in that order.
 */

import { describe, expect, it } from 'vitest'

import { MAX_FEAR, MIN_MAX_FEAR, vows } from './app.ts'

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)

describe('the vow list', () => {
  it('is the seventeen the shrine draws, in its own order', () => {
    expect(vows).toHaveLength(17)
    // ShrineUpgradeOrder opens on damage and closes on the bosses, and the
    // order is the shrine's rather than the table's.
    expect(vows[0]?.name).toBe('Vow of Pain')
    expect(vows.at(-1)?.name).toBe('Vow of Rivals')
  })

  it('gives every one of them a name out of the game rather than an id', () => {
    for (const vow of vows) {
      expect(vow.name, vow.id).not.toBe(vow.id)
      expect(vow.name, vow.id).toMatch(/^Vow of /)
    }
  })

  it('holds forty ranks between them, each with a cost', () => {
    expect(sum(vows.map((vow) => vow.ranks.length))).toBe(40)
    for (const vow of vows) {
      expect(vow.ranks.length, vow.name).toBeGreaterThan(0)
      for (const rank of vow.ranks) expect(rank.points, vow.name).toBeGreaterThan(0)
    }
  })
})

describe('the ceiling', () => {
  it('is 67, which is every rank of every vow added up', () => {
    expect(MAX_FEAR).toBe(67)
    expect(MAX_FEAR).toBe(sum(vows.map((vow) => sum(vow.ranks.map((r) => r.points)))))
  })

  it('is 55 before any gated rank is unlocked', () => {
    expect(MIN_MAX_FEAR).toBe(55)
  })

  /**
   * The wrong reading, written down so it stays wrong on purpose. If `Points`
   * were the Fear *at* a rank rather than the cost *of* it, the ceiling would
   * be 34.
   *
   * That number was first written here as 26, from memory rather than from the
   * data, and this test failed on its first run and corrected it. Which is the
   * entire argument for the file: 57 got in because nobody made it fail.
   */
  it('is not what reading only the last rank of each vow would give', () => {
    const lastRankOnly = sum(vows.map((vow) => vow.ranks.at(-1)?.points ?? 0))
    expect(lastRankOnly).not.toBe(MAX_FEAR)
    expect(lastRankOnly).toBe(34)
  })

  it('is not the 57 it was asserted to be for the whole of Phase 1', () => {
    expect(MAX_FEAR).not.toBe(57)
    expect(MIN_MAX_FEAR).not.toBe(57)
  })

  /** All four gated ranks are Boss Difficulty, and they are the whole gap. */
  it('gates exactly the Boss Difficulty ranks, worth 12', () => {
    const gated = vows.flatMap((vow) => vow.ranks.filter((r) => r.locked).map(() => vow.name))
    expect(new Set(gated)).toEqual(new Set(['Vow of Rivals']))
    expect(gated).toHaveLength(4)
    expect(MAX_FEAR - MIN_MAX_FEAR).toBe(12)
  })
})
