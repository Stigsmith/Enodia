/**
 * The briefing. What was I doing.
 *
 * `DESIGN.md` 6. A player opens this tool beside a game, closes the tab, and
 * comes back. Sometimes an hour later, sometimes a week. The timeline still has
 * everything, but a wall of Exits is not an answer to the only question they
 * are asking, which is where they had got to.
 *
 * Three registers, and `DESIGN.md` 8 requires they stay visibly separate:
 *
 * | Register | Field | Phase 1 |
 * |---|---|---|
 * | Fact | `held`, `position`, `away` | rendered |
 * | Derivation | `changedWhileAway`, `pinned` | rendered |
 * | Advice | `advice`, `centre` | **null, on purpose** |
 *
 * **The advice register is empty and stays empty until the curated layer
 * exists.** `centre` is the sentence a player actually wants, "your weight is
 * on Cast", and it cannot be computed from the game files: `Slot` says which
 * slot a boon *occupies*, and the boons that make a Cast build a Cast build
 * mostly occupy no slot at all. That needs a curated `feeds` tag per boon,
 * which is `DESIGN.md` 12 item 8 and the owner's to write. A briefing with no
 * advice line is worth opening. A briefing with a wrong one is not.
 *
 * Pure. No react, no storage, no clock of its own.
 */

import { reachable, verdictFor } from './reachability.ts'
import { CORE_SLOTS } from './slots.ts'
import type { ReachState, Verdict } from './reachability.ts'
import type { RunContext, RunPath, Slot, TraitId, TraitIndex } from '../data/types.ts'

/**
 * One target's state at one moment, which is all a diff needs.
 *
 * Deliberately not a whole `Verdict`. A verdict carries its sentence, its
 * needs and its blockers, all of which are recomputed from the run and none of
 * which is worth storing once per pick for the life of a run.
 */
export type VerdictMark = { target: TraitId; state: ReachState }

/** The verdicts as they stood after one pick. */
export type Snapshot = {
  /** the Exit this was taken after, 1-based, matching `RunEntry.exit` */
  exit: number
  /** ISO */
  at: string
  verdicts: VerdictMark[]
}

/** One target that moved, with the verdict explaining where it landed. */
export type Change = {
  target: TraitId
  from: ReachState
  to: ReachState
  verdict: Verdict
}

export type Briefing = {
  /** fact: what is held, by slot. Everything slotless lands under `null` */
  held: { slot: Slot | null; traits: TraitId[] }[]
  /**
   * Derivation, and null for the whole of Phase 1. See the docblock: this is
   * the one field that cannot be honest without the curated `feeds` tag.
   */
  centre: { slot: Slot; share: number; contributors: TraitId[] } | null
  /** our opinion. null until the curated layer exists */
  advice: string | null
  /** the target the player said they were chasing, judged now */
  pinned: Verdict | null
  /** targets whose state moved since the snapshot, deaths first */
  changedWhileAway: Change[]
  /**
   * Where the run is.
   *
   * `region` and `nextBoss` are null and say so. The run records which way it
   * went and nothing finer: `RoomData` places the Encounter gods in three
   * lettered room sets and says nothing about Athena, so the letter to region
   * mapping is not established. Rendering a guess here would be exactly the
   * invented fact this project keeps out.
   */
  position: {
    path: RunPath | null
    exitsLeft: number
    region: null
    nextBoss: null
  }
  /** how much happened since the snapshot, which is what makes a card worth opening */
  away: { exits: number; since: string | null }
}

/** DEAD first, then the rest by how bad the move was. */
const CHANGE_ORDER: Record<ReachState, number> = {
  DEAD: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
  REACHABLE: 3,
}

/**
 * What moved between two moments.
 *
 * Only transitions, never a full list. A target that was REACHABLE and still is
 * has nothing to report, and a card that reports it is a card nobody reads.
 * Targets absent from the snapshot are skipped rather than treated as new: an
 * empty `from` would render every target as a change on the first briefing.
 */
export function changesSince(since: Snapshot | null, now: Verdict[]): Change[] {
  if (!since) return []
  const before = new Map(since.verdicts.map((mark) => [mark.target, mark.state]))

  const changes: Change[] = []
  for (const verdict of now) {
    const from = before.get(verdict.target)
    if (from === undefined || from === verdict.state) continue
    changes.push({ target: verdict.target, from, to: verdict.state, verdict })
  }

  return changes.sort(
    (a, b) => CHANGE_ORDER[a.to] - CHANGE_ORDER[b.to] || a.target.localeCompare(b.target),
  )
}

/** The verdicts as a snapshot, which is what gets stored after a pick. */
export function snapshotOf(exit: number, verdicts: Verdict[], at = new Date().toISOString()): Snapshot {
  return {
    exit,
    at,
    verdicts: verdicts.map((verdict) => ({ target: verdict.target, state: verdict.state })),
  }
}

/**
 * What is held, by slot.
 *
 * Core slots first and always all five, because an empty one is the warning
 * `DESIGN.md` 8 wants visible and a slot missing from a list says nothing.
 * Everything else lands under `null`, which is most of a run: only 45 boons
 * occupy a core slot at all.
 */
export function heldBySlot(ctx: RunContext, traits: TraitIndex): Briefing['held'] {
  const bySlot = new Map<Slot | null, TraitId[]>()
  for (const slot of CORE_SLOTS) bySlot.set(slot, [])

  for (const entry of ctx.held) {
    const slot = traits.get(entry.id)?.slot ?? null
    const key = slot && CORE_SLOTS.includes(slot) ? slot : null
    const list = bySlot.get(key)
    if (list) list.push(entry.id)
    else bySlot.set(key, [entry.id])
  }

  return [...bySlot].map(([slot, list]) => ({ slot, traits: list }))
}

/**
 * The card.
 *
 * `since` is the snapshot the player last saw, not the most recent one. Diffing
 * against the most recent would always be empty: it is taken at the same pick
 * the player is standing on.
 */
export function brief(
  ctx: RunContext,
  since: Snapshot | null,
  traits: TraitIndex,
  options: { pinned?: TraitId | null; exit?: number } = {},
): Briefing {
  const verdicts = reachable(ctx, traits)
  const pinned = options.pinned ? verdictFor(options.pinned, ctx, traits) : null

  return {
    held: heldBySlot(ctx, traits),
    centre: null,
    advice: null,
    pinned,
    changedWhileAway: changesSince(since, verdicts),
    position: {
      path: ctx.path,
      exitsLeft: ctx.exitsLeft,
      region: null,
      nextBoss: null,
    },
    away: {
      exits: since && options.exit !== undefined ? Math.max(0, options.exit - since.exit) : 0,
      since: since?.at ?? null,
    },
  }
}

/**
 * Whether a card is worth opening.
 *
 * Two triggers, and either is enough. Wall clock, because the tab may have sat
 * open for a week and `DESIGN.md` 6.3 says staleness is not a session boundary.
 * And unread picks, because logging five Exits without reading anything leaves
 * exactly the same gap in the player's head that a week away does.
 *
 * A card with nothing on it is never worth opening, so both are gated on there
 * being something to say.
 */
export function isWorthShowing(
  briefing: Briefing,
  facts: { lastPickAt: string | null; now: number; staleAfterHours: number },
): boolean {
  if (!briefing.changedWhileAway.length && !briefing.pinned) return false
  if (briefing.away.exits > 1) return true
  if (!facts.lastPickAt) return false
  const elapsed = facts.now - Date.parse(facts.lastPickAt)
  return Number.isFinite(elapsed) && elapsed >= facts.staleAfterHours * 3600_000
}
