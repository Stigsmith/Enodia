/**
 * Which vows a run took, and what the shrine charges for them.
 *
 * A Fear total is a sum with the terms thrown away. Two runs at Fear 20 can ask
 * for entirely different things: one where enemies hit harder, one on a timer,
 * one where healing is gone. The build that cleared the first has not shown
 * anything about the second, and "cleared Fear 20" says it has.
 *
 * So a run can record the vows behind the number. The number then comes from
 * them rather than being typed beside them, which is the only way the two cannot
 * disagree.
 *
 * **This counts. It does not judge.** Nothing here says a vow is hard, or that a
 * build suits one. `CLAUDE.md` puts that with the owner, and `REQUIREMENTS.md` 8
 * rules out the tool pricing a build at all. What it can do is stop a total from
 * standing in for the conditions it was earned under.
 */

import { MAX_FEAR, vows } from '../data/app.ts'
import type { Vow } from '../data/app.ts'

/**
 * Vow id to the rank taken, counting from one. A vow not in the map, or at
 * zero, was not taken.
 *
 * A map rather than a list of ids, because a vow is not on or off: Vow of
 * Rivals alone runs from 2 Fear to 12 depending on how far up it is taken.
 */
export type VowsTaken = Readonly<Record<string, number>>

const byId = new Map<string, Vow>(vows.map((vow) => [vow.id, vow]))

/**
 * What one vow at a given rank costs.
 *
 * **The sum of the ranks up to it, not the cost of that rank.** This is the
 * reading that made `MAX_FEAR` 57 for the life of Phase 1, and it is worth
 * restating where the arithmetic actually happens: `ShrineLogic`'s
 * `GetTotalSpentShrinePoints` sums `Ranks[1..activeRank]`, so `Points` is the
 * price of stepping up to a rank rather than the Fear you carry at it. Vow of
 * Pain at rank 3 is 1 + 2 + 2 = 5, not 2.
 *
 * A rank past the end of the vow is clamped rather than rejected. Storage that
 * predates a game update should read as the highest rank that exists, not as a
 * throw in a build list.
 */
export function fearOfVow(vow: Vow, rank: number): number {
  const taken = Math.max(0, Math.min(Math.floor(rank), vow.ranks.length))
  let total = 0
  for (let i = 0; i < taken; i += 1) total += vow.ranks[i]?.points ?? 0
  return total
}

/** The Fear the shrine would charge for a whole set. Unknown ids cost nothing. */
export function fearOf(taken: VowsTaken): number {
  let total = 0
  for (const [id, rank] of Object.entries(taken)) {
    const vow = byId.get(id)
    if (vow) total += fearOfVow(vow, rank)
  }
  return total
}

/**
 * Drop what a vow list cannot mean: ids the game does not have, ranks at or
 * below zero, and ranks past the end of their vow.
 *
 * Run on the way in rather than on the way out, so a stored list and the number
 * derived from it always agree. Storage is a JSON blob a person can edit and an
 * import can carry, and neither is trusted here.
 */
export function tidyVows(taken: VowsTaken | undefined): VowsTaken {
  const out: Record<string, number> = {}
  for (const [id, rank] of Object.entries(taken ?? {})) {
    const vow = byId.get(id)
    if (!vow) continue
    const held = Math.min(Math.floor(rank), vow.ranks.length)
    if (held > 0) out[id] = held
  }
  return out
}

/** Set one vow's rank. Zero or less clears it, so there is one way to say no. */
export function setVow(taken: VowsTaken, id: string, rank: number): VowsTaken {
  const next = { ...taken }
  const vow = byId.get(id)
  if (!vow || rank <= 0) delete next[id]
  else next[id] = Math.min(Math.floor(rank), vow.ranks.length)
  return next
}

/** One row of a vow sheet: the vow, how far it is taken, and what that costs. */
export type VowRow = { vow: Vow; rank: number; fear: number }

/**
 * Every vow in the shrine's own order, taken or not, for drawing a sheet.
 *
 * The full seventeen rather than only what is taken, because the control is a
 * sheet you tick rather than a list you add to, and the shrine's order is the
 * one a player already knows.
 */
export function vowSheet(taken: VowsTaken): VowRow[] {
  return vows.map((vow) => {
    const rank = taken[vow.id] ?? 0
    return { vow, rank, fear: fearOfVow(vow, rank) }
  })
}

/** How many vows are on, for a count beside a total. */
export function vowsTakenCount(taken: VowsTaken): number {
  return Object.values(taken).filter((rank) => rank > 0).length
}

/**
 * Whether a set is complete enough to stand in for a typed total.
 *
 * A player who itemises every vow gets the number for free. One who itemises
 * some of them has said something true but partial, and the typed total still
 * has to win, or recording two vows would silently drop a Fear 30 run to 4.
 */
export function coversTotal(taken: VowsTaken, total: number | undefined): boolean {
  if (total === undefined) return vowsTakenCount(taken) > 0
  return fearOf(taken) === total
}

/** The ceiling, re-exported so a vow sheet does not import from two places. */
export { MAX_FEAR }
