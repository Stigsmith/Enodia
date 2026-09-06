/**
 * The vow sheet, against the shrine's own arithmetic.
 *
 * `src/data/vows.test.ts` pins the ceiling. This pins the part underneath it:
 * what one vow at one rank costs, which is the same trap one layer down. The
 * project has already read `Points` as the Fear *at* a rank rather than the cost
 * *of* it once, and that reading survived a year because nobody made it fail.
 *
 * Every assertion below was watched failing against `fearOfVow` written the
 * wrong way, returning `ranks[rank - 1].points`. That version gives Vow of Pain
 * at rank 3 a cost of 2 and the full sheet a total of 34.
 */

import { describe, expect, it } from 'vitest'

import { MAX_FEAR, vows } from '../data/app.ts'
import { coversTotal, fearOf, fearOfVow, setVow, tidyVows, vowSheet, vowsTakenCount } from './vows.ts'

const PAIN = 'EnemyDamageShrineUpgrade'
const RIVALS = 'BossDifficultyShrineUpgrade'
const named = (name: string) => {
  const found = vows.find((vow) => vow.name === name)
  if (!found) throw new Error(`no ${name}`)
  return found
}

/** Every vow at its highest rank, which has to come to the ceiling. */
const everything = Object.fromEntries(vows.map((vow) => [vow.id, vow.ranks.length]))

describe('what a vow costs', () => {
  it('charges the ranks up to it, not the price of the last step', () => {
    const pain = named('Vow of Pain')
    // 1, then 2, then 2. The wrong reading gives 1, 2, 2 for the three ranks.
    expect(pain.ranks.map((rank) => rank.points)).toEqual([1, 2, 2])
    expect(fearOfVow(pain, 1)).toBe(1)
    expect(fearOfVow(pain, 2)).toBe(3)
    expect(fearOfVow(pain, 3)).toBe(5)
  })

  it('is nothing at rank zero, and below', () => {
    const pain = named('Vow of Pain')
    expect(fearOfVow(pain, 0)).toBe(0)
    expect(fearOfVow(pain, -2)).toBe(0)
  })

  it('clamps a rank the vow does not have rather than throwing', () => {
    const pain = named('Vow of Pain')
    expect(fearOfVow(pain, 99)).toBe(fearOfVow(pain, pain.ranks.length))
  })
})

describe('a whole sheet', () => {
  it('adds up to the ceiling when every vow is at its highest', () => {
    expect(fearOf(everything)).toBe(MAX_FEAR)
    expect(fearOf(everything)).toBe(67)
  })

  it('is nothing when nothing is taken', () => {
    expect(fearOf({})).toBe(0)
  })

  it('ignores a vow the game does not have', () => {
    expect(fearOf({ NotAVow: 4 })).toBe(0)
    expect(fearOf({ ...{ NotAVow: 4 }, [PAIN]: 2 })).toBe(3)
  })

  it('counts only the vows that are on', () => {
    expect(vowsTakenCount({})).toBe(0)
    expect(vowsTakenCount({ [PAIN]: 2 })).toBe(1)
    expect(vowsTakenCount(everything)).toBe(17)
  })
})

describe('tidying what came out of storage', () => {
  it('drops unknown ids, zero and below, and fractions of a rank', () => {
    expect(tidyVows({ NotAVow: 3, [PAIN]: 0, [RIVALS]: -1 })).toEqual({})
    expect(tidyVows({ [PAIN]: 2.9 })).toEqual({ [PAIN]: 2 })
  })

  it('clamps a rank past the end of its vow', () => {
    const pain = named('Vow of Pain')
    expect(tidyVows({ [pain.id]: 40 })).toEqual({ [pain.id]: pain.ranks.length })
  })

  it('leaves a sound list exactly as it was', () => {
    expect(tidyVows(everything)).toEqual(everything)
  })

  it('treats an absent list as an empty one', () => {
    expect(tidyVows(undefined)).toEqual({})
  })
})

describe('setting one vow', () => {
  it('adds, raises and clears', () => {
    const pain = named('Vow of Pain')
    let taken = setVow({}, pain.id, 2)
    expect(taken).toEqual({ [pain.id]: 2 })
    taken = setVow(taken, pain.id, 3)
    expect(taken).toEqual({ [pain.id]: 3 })
    expect(setVow(taken, pain.id, 0)).toEqual({})
  })

  it('never writes a vow the game does not have', () => {
    expect(setVow({}, 'NotAVow', 2)).toEqual({})
  })

  it('leaves the set it was given alone', () => {
    const before = { [PAIN]: 1 }
    setVow(before, PAIN, 3)
    expect(before).toEqual({ [PAIN]: 1 })
  })
})

describe('the sheet a screen draws', () => {
  it('is all seventeen in the shrine order, taken or not', () => {
    const rows = vowSheet({ [PAIN]: 2 })
    expect(rows).toHaveLength(17)
    expect(rows.map((row) => row.vow.name)).toEqual(vows.map((vow) => vow.name))
    expect(rows[0]?.rank).toBe(2)
    expect(rows[0]?.fear).toBe(3)
    expect(rows[1]?.rank).toBe(0)
    expect(rows[1]?.fear).toBe(0)
  })
})

describe('whether the sheet can speak for the total', () => {
  /**
   * The case this exists to stop: somebody records Fear 30, then ticks two vows
   * because those are the two they remember. The sheet says 4. Letting it win
   * would quietly rewrite a real run.
   */
  it('does not let a partial sheet overwrite a typed total', () => {
    expect(coversTotal({ [PAIN]: 2 }, 30)).toBe(false)
  })

  it('lets a sheet that adds to the total speak for it', () => {
    expect(coversTotal({ [PAIN]: 2 }, 3)).toBe(true)
    expect(coversTotal(everything, MAX_FEAR)).toBe(true)
  })

  it('speaks for a total nobody typed, as long as something is ticked', () => {
    expect(coversTotal({ [PAIN]: 1 }, undefined)).toBe(true)
    expect(coversTotal({}, undefined)).toBe(false)
  })
})
