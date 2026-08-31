/**
 * Which Arcana are actually on.
 *
 * Nineteen of the twenty-five cost Grasp and are on because you switched them
 * on. **The other six cost nothing and switch themselves on**, each by its own
 * rule, and that is the whole reason this file exists: a player picking three
 * cards for a build needs to know which of the six they just turned on or off
 * by accident.
 *
 * This is `MetaUpgradeLogic.CheckAutoEquipRequirements`, followed to the
 * letter. The field names are the game's own so a reader can find the rule
 * beside this one.
 *
 * ## The counting rule, which everything else rests on
 *
 * ```lua
 * if MetaUpgradeCardData[name] and equipped and not AutoEquipRequirements then
 *   IncrementTableValue( metaUpgradeCosts, cost )
 *   totalMetaUpgrades = totalMetaUpgrades + 1
 * end
 * ```
 *
 * **A conditional card counts for nothing, including for the other five.**
 * Only the cards you paid Grasp for are tallied. That is what makes the owner's
 * case work: switch on a third paid card at the same cost and The Queen goes
 * dark, because she caps *paid* cards at two per cost.
 *
 * ## A fully unlocked board
 *
 * `GetZoomLevel` shrinks the grid while cards are still locked, so Divinity's
 * "a complete row or column" means a shorter row early on. That depends on a
 * save this tool cannot see, so the board is taken as five by five throughout
 * and the assumption is stated on the page.
 *
 * ## AdjacencyBonus is not this
 *
 * There is a second, separate system: `UpdateMetaUpgradeCardAdjacencyBonuses`
 * applies a `CustomMultiplier` to all eight neighbours of a card declaring an
 * `AdjacencyBonus`. **No card declares one**, so it is dormant and nothing here
 * models it. Worth knowing before anyone re-derives it and assumes otherwise.
 */

import { arcanaBoard, arcanaById } from '../data/app.ts'
import type { ArcanaRule } from '../data/app.ts'

export type Coords = { row: number; column: number }

/** Where each card sits. The board is fixed, so this is computed once. */
const COORDS: ReadonlyMap<string, Coords> = new Map(
  arcanaBoard.flatMap((row, r) => row.map((id, c) => [id, { row: r, column: c }] as const)),
)

export const coordsOf = (id: string): Coords | null => COORDS.get(id) ?? null

/** A card switches itself on rather than being paid for. */
export const isConditional = (id: string): boolean =>
  Object.keys(arcanaById.get(id)?.requires ?? {}).length > 0

/**
 * The eight neighbours, diagonals included.
 *
 * `GetNeighboringCoords( row, column, true )`. Every caller in the game passes
 * true, so the orthogonal-only form is not modelled. A corner card has three
 * neighbours and an edge card five, which is why The Fates, in the bottom left,
 * needs only three cards around her rather than eight.
 */
export function neighbours({ row, column }: Coords): Coords[] {
  const out: Coords[] = []
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      const r = row + dr
      const c = column + dc
      if (arcanaBoard[r]?.[c]) out.push({ row: r, column: c })
    }
  }
  return out
}

const at = ({ row, column }: Coords): string => arcanaBoard[row]?.[column] ?? ''

/** What the paid cards in a set add up to, which is all the rules count. */
export function tally(equipped: ReadonlySet<string>): {
  total: number
  byCost: Map<number, number>
  grasp: number
} {
  const byCost = new Map<number, number>()
  let total = 0
  let grasp = 0
  for (const id of equipped) {
    const card = arcanaById.get(id)
    if (!card || isConditional(id)) continue
    const cost = card.cost ?? 0
    byCost.set(cost, (byCost.get(cost) ?? 0) + 1)
    total += 1
    grasp += cost
  }
  return { total, byCost, grasp }
}

/**
 * One reason a conditional card is off, in the player's words.
 *
 * Every rule that fails produces one, so a card that misses on two counts says
 * both rather than only the first. The game returns on the first failure; that
 * is right for a boolean and wrong for an explanation.
 */
export type Unmet = { rule: keyof ArcanaRule; say: string }

export function whyOff(id: string, equipped: ReadonlySet<string>): Unmet[] {
  const card = arcanaById.get(id)
  const rule = card?.requires
  if (!card || !rule) return []

  const { total, byCost } = tally(equipped)
  const out: Unmet[] = []

  if (rule.HasCostsThrough) {
    const missing: number[] = []
    for (let cost = 1; cost <= rule.HasCostsThrough; cost += 1) {
      if (!byCost.get(cost)) missing.push(cost)
    }
    if (missing.length) {
      out.push({
        rule: 'HasCostsThrough',
        say: `Needs a card of every cost 1 to ${rule.HasCostsThrough}. Missing ${missing.join(', ')}.`,
      })
    }
  }

  if (rule.HasCosts) {
    const missing = rule.HasCosts.filter((cost) => !byCost.get(cost))
    if (missing.length) {
      out.push({ rule: 'HasCosts', say: `Needs a card costing ${missing.join(' and ')}.` })
    }
  }

  if (rule.MaxDuplicateCount !== undefined) {
    for (const [cost, count] of byCost) {
      if (count > rule.MaxDuplicateCount) {
        out.push({
          rule: 'MaxDuplicateCount',
          say: `${count} cards cost ${cost}. No more than ${rule.MaxDuplicateCount} may share a cost.`,
        })
      }
    }
  }

  if (rule.MinDuplicateCount !== undefined) {
    const has = [...byCost.values()].some((count) => count >= (rule.MinDuplicateCount ?? 0))
    if (!has) {
      out.push({
        rule: 'MinDuplicateCount',
        say: `Needs ${rule.MinDuplicateCount} cards sharing one cost.`,
      })
    }
  }

  if (rule.RequiredMetaUpgradesMin !== undefined && total < rule.RequiredMetaUpgradesMin) {
    out.push({
      rule: 'RequiredMetaUpgradesMin',
      say: `Needs at least ${rule.RequiredMetaUpgradesMin} card${rule.RequiredMetaUpgradesMin === 1 ? '' : 's'}.`,
    })
  }

  if (rule.RequiredMetaUpgradesMax !== undefined && total > rule.RequiredMetaUpgradesMax) {
    out.push({
      rule: 'RequiredMetaUpgradesMax',
      say: `${total} cards on. Goes dark above ${rule.RequiredMetaUpgradesMax}.`,
    })
  }

  const here = coordsOf(id)

  if (rule.SurroundAllEquipped && here) {
    const around = neighbours(here)
    const dark = around.filter((coords) => !equipped.has(at(coords)))
    if (dark.length) {
      const names = dark.map((coords) => arcanaById.get(at(coords))?.name ?? at(coords))
      out.push({
        rule: 'SurroundAllEquipped',
        say: `Needs all ${around.length} neighbours on. Still off: ${names.join(', ')}.`,
      })
    }
  }

  if (rule.SurroundEquipped && here) {
    if (!neighbours(here).some((coords) => equipped.has(at(coords)))) {
      out.push({ rule: 'SurroundEquipped', say: 'Needs at least one neighbour on.' })
    }
  }

  if (rule.OtherRowOrColumnEquipped && here) {
    if (!hasCompleteLine(equipped, here)) {
      out.push({
        rule: 'OtherRowOrColumnEquipped',
        say: 'Needs a whole row or column on, other than its own.',
      })
    }
  }

  return out
}

/**
 * A complete row or column that is not this card's own.
 *
 * The game checks columns against `sourceCoords.Column` and rows against
 * `sourceCoords.Row`, skipping the card's own line in each. Note it compares
 * the row index against the *column* of the source in its own loop, which
 * reads like a slip in the original; this follows the readable intent, which
 * is "some other full line", and says so rather than reproducing a typo.
 */
function hasCompleteLine(equipped: ReadonlySet<string>, here: Coords): boolean {
  const size = arcanaBoard.length
  for (let i = 0; i < size; i += 1) {
    if (i !== here.column) {
      const full = arcanaBoard.every((row) => equipped.has(row[i] ?? ''))
      if (full) return true
    }
    if (i !== here.row) {
      const full = (arcanaBoard[i] ?? []).every((id) => equipped.has(id))
      if (full) return true
    }
  }
  return false
}

/**
 * The whole board, resolved.
 *
 * `equipped` is what the player switched on. The six conditionals are worked
 * out from it, so passing one in makes no difference: they are derived, never
 * chosen.
 */
export type BoardState = {
  /** paid cards the player switched on */
  chosen: Set<string>
  /** conditional cards that are on as a result */
  live: Set<string>
  /** conditional cards that are off, and why */
  dark: Map<string, Unmet[]>
  /** Grasp the paid cards cost */
  grasp: number
  /** how many paid cards, which is what the rules count */
  counted: number
}

export function resolveBoard(equipped: ReadonlySet<string>): BoardState {
  const chosen = new Set([...equipped].filter((id) => !isConditional(id)))
  const live = new Set<string>()
  const dark = new Map<string, Unmet[]>()

  for (const row of arcanaBoard) {
    for (const id of row) {
      if (!isConditional(id)) continue
      const unmet = whyOff(id, chosen)
      if (unmet.length) dark.set(id, unmet)
      else live.add(id)
    }
  }

  const counts = tally(chosen)
  return { chosen, live, dark, grasp: counts.grasp, counted: counts.total }
}
