/**
 * The Arcana evaluator, against the rules as the game states them.
 *
 * The six conditional cards are the whole point, and each one is checked
 * against a set built to turn it on and a set built to turn it off. Where the
 * owner described a rule from play, that description is the test name, so a
 * regression reads as a contradiction of something a player observed.
 */

import { describe, expect, it } from 'vitest'

import { arcanaBoard, arcanaById } from '../data/app.ts'
import { coordsOf, isConditional, neighbours, resolveBoard, tally, whyOff } from './arcana.ts'

/** By display name, because that is how the rules were described to me. */
const id = (name: string): string => {
  const found = [...arcanaById.values()].find((card) => card.name === name)
  if (!found) throw new Error(`no Arcana called ${name}`)
  return found.id
}

const costOf = (name: string) => arcanaById.get(id(name))?.cost ?? 0

/** Cards that cost Grasp, by cost, so a test can say "three 2-cost cards". */
const paidAtCost = (cost: number): string[] =>
  [...arcanaById.values()]
    .filter((card) => !isConditional(card.id) && (card.cost ?? 0) === cost)
    .map((card) => card.id)

describe('the board', () => {
  it('is the game\'s five by five', () => {
    expect(arcanaBoard).toHaveLength(5)
    for (const row of arcanaBoard) expect(row).toHaveLength(5)
  })

  it('holds every card exactly once', () => {
    const flat = arcanaBoard.flat()
    expect(flat).toHaveLength(25)
    expect(new Set(flat).size).toBe(25)
  })

  it('has six cards that switch themselves on, and they all cost nothing', () => {
    const conditional = arcanaBoard.flat().filter(isConditional)
    expect(conditional).toHaveLength(6)
    for (const one of conditional) expect(arcanaById.get(one)?.cost ?? 0).toBe(0)
  })
})

describe('neighbours', () => {
  it('gives a corner three and the middle eight', () => {
    // The Fates sits bottom left, which is why the owner counted three.
    const fates = coordsOf(id('The Fates'))
    expect(fates).toBeTruthy()
    expect(neighbours(fates!)).toHaveLength(3)
    expect(neighbours({ row: 2, column: 2 })).toHaveLength(8)
  })
})

describe('the counting rule', () => {
  it('counts only what you paid for', () => {
    // A conditional card in the set must not add to the tally, or every rule
    // that counts cards would be wrong the moment one switched on.
    const paid = paidAtCost(1)[0]
    if (!paid) throw new Error('no 1-cost card')
    const withConditional = tally(new Set([paid, id('The Moon'), id('The Fates')]))
    expect(withConditional.total).toBe(1)
    expect(withConditional.grasp).toBe(1)
  })
})

describe('the six, one at a time', () => {
  it('The Fates wants every neighbour on', () => {
    const here = coordsOf(id('The Fates'))!
    const around = neighbours(here).map((c) => arcanaBoard[c.row]?.[c.column] ?? '')
    expect(whyOff(id('The Fates'), new Set(around))).toEqual([])
    expect(whyOff(id('The Fates'), new Set(around.slice(1))).length).toBeGreaterThan(0)
  })

  it('The Moon wants only one neighbour on', () => {
    const here = coordsOf(id('The Moon'))!
    const one = arcanaBoard[neighbours(here)[0]!.row]?.[neighbours(here)[0]!.column] ?? ''
    expect(whyOff(id('The Moon'), new Set([one]))).toEqual([])
    expect(whyOff(id('The Moon'), new Set()).some((u) => u.rule === 'SurroundEquipped')).toBe(true)
  })

  it('Judgment goes dark above three cards, which is the owner\'s note', () => {
    const three = [...paidAtCost(1), ...paidAtCost(2)].slice(0, 3)
    expect(whyOff(id('Judgment'), new Set(three))).toEqual([])
    const four = [...paidAtCost(1), ...paidAtCost(2)].slice(0, 4)
    expect(whyOff(id('Judgment'), new Set(four)).some((u) => u.rule === 'RequiredMetaUpgradesMax')).toBe(
      true,
    )
  })

  it('The Queen goes dark on a third card of one cost, which is the owner\'s note', () => {
    const two = paidAtCost(2).slice(0, 2)
    expect(whyOff(id('The Queen'), new Set(two))).toEqual([])
    const three = paidAtCost(2).slice(0, 3)
    expect(three).toHaveLength(3)
    expect(whyOff(id('The Queen'), new Set(three)).some((u) => u.rule === 'MaxDuplicateCount')).toBe(true)
  })

  it('The Centaur wants one card of every cost 1 through 5', () => {
    const oneOfEach = [1, 2, 3, 4, 5].map((cost) => paidAtCost(cost)[0] ?? '')
    expect(oneOfEach.every(Boolean)).toBe(true)
    expect(whyOff(id('The Centaur'), new Set(oneOfEach))).toEqual([])
    const missingFour = oneOfEach.filter((one) => one !== paidAtCost(4)[0])
    expect(whyOff(id('The Centaur'), new Set(missingFour)).some((u) => u.rule === 'HasCostsThrough')).toBe(
      true,
    )
  })

  it('Divinity wants a whole other row or column', () => {
    const row = arcanaBoard[0] ?? []
    expect(whyOff(id('Divinity'), new Set(row))).toEqual([])
    expect(
      whyOff(id('Divinity'), new Set(row.slice(1))).some((u) => u.rule === 'OtherRowOrColumnEquipped'),
    ).toBe(true)
  })
})

describe('the conflict that shapes every layout', () => {
  it('Judgment and The Centaur can never both be on', () => {
    // Judgment caps the count at three. The Centaur needs one card of each of
    // five costs, so at least five. No set satisfies both, which is the real
    // reason there are only a few base shapes worth having.
    const oneOfEach = new Set([1, 2, 3, 4, 5].map((cost) => paidAtCost(cost)[0] ?? ''))
    const board = resolveBoard(oneOfEach)
    expect(board.live.has(id('The Centaur'))).toBe(true)
    expect(board.live.has(id('Judgment'))).toBe(false)
  })
})

describe('resolveBoard', () => {
  it('derives the conditionals rather than taking them', () => {
    // Passing a conditional card in must change nothing: they are worked out.
    const paid = new Set([paidAtCost(3)[0] ?? ''])
    const withFates = new Set([...paid, id('The Fates')])
    expect(resolveBoard(withFates).chosen.has(id('The Fates'))).toBe(false)
    expect(resolveBoard(withFates).grasp).toBe(costOf(arcanaById.get([...paid][0] ?? '')?.name ?? ''))
  })

  it('adds up only what was paid for', () => {
    const set = new Set([...paidAtCost(5).slice(0, 1), ...paidAtCost(2).slice(0, 1)])
    const board = resolveBoard(set)
    expect(board.grasp).toBe(7)
    expect(board.counted).toBe(2)
  })

  it('accounts for all six conditionals every time', () => {
    const board = resolveBoard(new Set(paidAtCost(1)))
    expect(board.live.size + board.dark.size).toBe(6)
  })
})
