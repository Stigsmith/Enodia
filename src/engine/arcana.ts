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
 * ## But the positional rules do count them, and that is a different set
 *
 * `SurroundAllEquipped`, `SurroundEquipped` and `OtherRowOrColumnEquipped` do
 * not use that tally. They read `GameState.MetaUpgradeState[name].Equipped`
 * directly, which is **true for a conditional card that is currently on**. So a
 * free card sitting in a row still completes that row for Divinity.
 *
 * This was wrong here first: the exclusion was applied to both, and Divinity
 * stayed dark on a row the owner could see was full. Two sets, not one.
 *
 * ## Which means it has to settle
 *
 * The game runs one pass per click and lets successive clicks settle it. A tool
 * showing a board has to show where it lands, so this iterates to a fixed
 * point. That terminates: a conditional switching on can only add to the
 * equipped set, the positional rules only get easier as it grows, and the
 * counting rules cannot see conditionals at all. Nothing can turn back off, so
 * it converges in at most six passes.
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

/**
 * The most Grasp a save can hold, summed from the game rather than reported.
 *
 * `MetaUpgradeCostData` (`MetaUpgradeData.lua:29-52`) starts at
 * `StartingMetaUpgradeLimit = 10` and lists fifteen levels, five at
 * `CostIncrease = 2` and ten at 1. `GetMaxMetaUpgradeCost()`
 * (`MetaUpgradeCardScreenLogic.lua:800-808`) adds exactly those, so the ceiling
 * is 10 + 10 + 10 = **30** and the table has no sixteenth level.
 *
 * **Declared here and imported by everything else.** It was written out twice,
 * in `ui/Arcana.tsx` and `engine/build-check.ts`, both from the owner's report
 * rather than from the file. Two copies of a number is two numbers waiting to
 * disagree.
 */
export const MAX_GRASP = 30

/**
 * Whether a card can be switched on inside a budget, and by how much it misses.
 *
 * **The budget counts paid cards only, and that is the game's rule rather than
 * a simplification.** `MetaUpgradeLogic.lua:97-106` tallies cost only for cards
 * with no `AutoEquipRequirements`, and every conditional resolves to `Cost = 0`,
 * so the six that switch themselves on never spend. They still have to sit on
 * the board for each other's positional rules, which is why this asks about a
 * set rather than about a running total.
 *
 * The game refuses the same way, in three places:
 * `MetaUpgradeCardScreenLogic.lua:1046` on equip, `:1087` on auto-equip after an
 * unlock, and `ValidateMetaUpgradeLayout` at `:148-165`, which unequips
 * cheapest-first when a save is loaded over its limit.
 *
 * **Switching a card off is never refused**, which is why this is only ever
 * asked about adding. A board loaded over budget has to be reducible, or the
 * only way out would be to start again.
 */
export type Afford = { ok: true } | { ok: false; cost: number; would: number; limit: number }

export function affords(equipped: ReadonlySet<string>, id: string, limit: number): Afford {
  const card = arcanaById.get(id)
  if (!card || isConditional(id) || equipped.has(id)) return { ok: true }
  const cost = card.cost ?? 0
  const would = tally(equipped).grasp + cost
  return would > limit ? { ok: false, cost, would, limit } : { ok: true }
}

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

/**
 * Why a conditional card is off.
 *
 * `paid` is what Grasp was spent on, and is what every counting rule tallies.
 * `equipped` is that plus the conditionals currently on, and is what the three
 * positional rules read. They are genuinely different sets and conflating them
 * is the bug this signature exists to prevent.
 */
export function whyOff(
  id: string,
  paid: ReadonlySet<string>,
  equipped: ReadonlySet<string> = paid,
): Unmet[] {
  const card = arcanaById.get(id)
  const rule = card?.requires
  if (!card || !rule) return []

  const { total, byCost } = tally(paid)
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
  const conditionals = arcanaBoard.flat().filter(isConditional)

  /**
   * Settle it.
   *
   * A conditional switching on can complete a row for another, so one pass is
   * not enough: the game gets away with it because the player clicks again.
   * Monotone, so it converges; the bound is belt and braces.
   */
  let live = new Set<string>()
  for (let pass = 0; pass < conditionals.length + 1; pass += 1) {
    const on = new Set<string>()
    const board = new Set([...chosen, ...live])
    for (const id of conditionals) {
      if (whyOff(id, chosen, board).length === 0) on.add(id)
    }
    if (on.size === live.size && [...on].every((id) => live.has(id))) break
    live = on
  }

  // Reasons are taken against the settled board, or a card would be told it is
  // missing a neighbour that is in fact on.
  const settled = new Set([...chosen, ...live])
  const dark = new Map<string, Unmet[]>()
  for (const id of conditionals) {
    if (live.has(id)) continue
    dark.set(id, whyOff(id, chosen, settled))
  }

  const counts = tally(chosen)
  return { chosen, live, dark, grasp: counts.grasp, counted: counts.total }
}
