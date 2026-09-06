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
import { MAX_GRASP, affords, coordsOf, isConditional, neighbours, resolveBoard, tally, whyOff } from './arcana.ts'

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

/**
 * What the cards cost, and the one that read free for the life of the project.
 *
 * Three records state no `Cost` and inherit one, which the game resolves at load
 * through `ProcessDataInheritance` (`RunData.lua:1222-1224`) and the extractor
 * did not. Two of them inherit `BaseBonusMetaUpgrade.Cost = 0` and were right by
 * accident. **The Wayward Son inherits `BaseMetaUpgrade.Cost = 1`**, so it was
 * free here and 1 Grasp in the game.
 *
 * These are pinned because a budget is about to be enforced against them, and a
 * cap that is short by one lets through a board the game refuses.
 */
describe('what a card costs', () => {
  it('reads a cost the card inherits rather than states', () => {
    expect(costOf('The Wayward Son')).toBe(1)
    // The two that inherit zero, so the walk is not just special-casing one id.
    expect(costOf('Divinity')).toBe(0)
    expect(costOf('Judgment')).toBe(0)
  })

  it('leaves no card without a cost at all', () => {
    for (const card of arcanaById.values()) {
      expect(card.cost, card.name).not.toBeNull()
      expect(typeof card.cost, card.name).toBe('number')
    }
  })

  it('comes to nineteen paid cards and 56 Grasp', () => {
    const paid = [...arcanaById.values()].filter((card) => (card.cost ?? 0) > 0)
    expect(paid).toHaveLength(19)
    expect(paid.reduce((total, card) => total + (card.cost ?? 0), 0)).toBe(56)
  })
})

/**
 * The budget, which the board displayed and did not apply.
 *
 * It counted the Grasp, coloured the number when it was too high, said "More
 * Grasp than you have", and let you carry on. Three other files claimed
 * otherwise, one of them out loud to a first-time player.
 */
describe('what a board can afford', () => {
  it('refuses a card that would go over', () => {
    // Origination is 5. At a limit of 4 there is no room for it at all.
    const room = affords(new Set(), id('Origination'), 4)
    expect(room.ok).toBe(false)
    if (!room.ok) {
      expect(room.cost).toBe(5)
      expect(room.would).toBe(5)
      expect(room.limit).toBe(4)
    }
  })

  it('allows a card that lands exactly on the limit', () => {
    expect(affords(new Set(), id('Origination'), 5).ok).toBe(true)
  })

  it('counts what is already on', () => {
    const held = new Set([id('Origination')]) // 5
    // Death is 4, so the pair is 9. Eight is one short and nine is exact.
    expect(costOf('Origination')).toBe(5)
    expect(costOf('Death')).toBe(4)
    expect(affords(held, id('Death'), 8).ok).toBe(false)
    expect(affords(held, id('Death'), 9).ok).toBe(true)
  })

  /**
   * `MetaUpgradeLogic.lua:97-106` tallies cost only for cards with no
   * `AutoEquipRequirements`, and every conditional resolves to 0. They never
   * spend, so they are never refused, even at a limit of nothing.
   */
  it('never charges a card that switches itself on', () => {
    for (const name of ['The Fates', 'The Moon', 'The Centaur', 'The Queen', 'Judgment', 'Divinity']) {
      expect(affords(new Set(), id(name), 0).ok, name).toBe(true)
    }
  })

  /**
   * A board can be over budget without anybody clicking past a refusal: a saved
   * layout loads whole and the limit is a field you can lower. If taking a card
   * off were refused, the only way out would be to start again.
   */
  it('never refuses a card that is already on', () => {
    const held = new Set([id('Origination'), id('Death')]) // 9, well over
    expect(affords(held, id('Origination'), 1).ok).toBe(true)
  })

  it('lets a full 30 hold what the game would hold', () => {
    // The Centaur wants a card of every cost from 1 to 5, which is 15 at least.
    const spread = [1, 2, 3, 4, 5].map((cost) => paidAtCost(cost)[0]!).filter(Boolean)
    let held = new Set<string>()
    for (const card of spread) {
      expect(affords(held, card, MAX_GRASP).ok, card).toBe(true)
      held = new Set([...held, card])
    }
    expect(resolveBoard(held).live.has(id('The Centaur'))).toBe(true)
  })
})

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

describe('a free card still counts for the positional rules', () => {
  /**
   * The owner watched a full row light up and Divinity stay dark.
   *
   * `CheckAutoEquipRequirements` tallies only paid cards, but the three
   * positional rules read `.Equipped` straight off the card, which is true for
   * a conditional that is on. Row 1 ends in The Moon, which is free, so the row
   * can only ever be completed by a card that costs nothing.
   */
  it('completes a row with The Moon on it, which is free', () => {
    const row = arcanaBoard[0] ?? []
    const moon = id('The Moon')
    expect(row).toContain(moon)

    // The four paid cards of that row. The Moon cannot be bought.
    const paid = row.filter((one) => one !== moon)
    const board = resolveBoard(new Set(paid))

    expect(board.live.has(moon), 'The Moon should be on: it has neighbours').toBe(true)
    expect(board.live.has(id('Divinity')), 'the row is full once The Moon is on').toBe(true)
  })

  it('settles rather than taking one pass', () => {
    // Divinity can only be right after The Moon has been resolved, so a single
    // pass in the wrong order would miss it. The game gets away with one pass
    // because the player clicks again; a board has to show where it lands.
    const row = arcanaBoard[0] ?? []
    const paid = row.filter((one) => one !== id('The Moon'))
    expect(resolveBoard(new Set(paid)).live.size).toBeGreaterThanOrEqual(2)
  })

  it('still refuses to count a free card toward the tallies', () => {
    // The other half of the same distinction: Judgment caps *paid* cards at
    // three, and free ones on the board must not push it over.
    const three = [...paidAtCost(1), ...paidAtCost(2)].slice(0, 3)
    const board = resolveBoard(new Set(three))
    expect(board.counted).toBe(3)
    expect(board.live.has(id('Judgment'))).toBe(true)
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
