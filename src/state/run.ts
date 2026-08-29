/**
 * The active run, and where it lives between page loads.
 *
 * `DESIGN.md` 9: localStorage, one key per concern, versioned with a migration
 * function. This owns `enodia.run.active`. The verdict trail the briefing diffs
 * against is its own key and its own file, `state/snapshot.ts`, but it is
 * written here because a snapshot belongs to a pick and the pick happens here.
 *
 * Storage is treated as hostile: a private window can refuse it, a browser can
 * clear it, and a stored run can predate a rename. Every read is guarded and a
 * run that cannot be understood is dropped rather than crashing the surface a
 * player opened mid run.
 */

import { useCallback, useEffect, useState } from 'react'

import { olympians, offerRules, traits } from '../data/app.ts'
import { snapshotOf } from '../engine/briefing.ts'
import { reachable } from '../engine/reachability.ts'
import { clearTrail, loadTrail, saveTrail, withSnapshot } from './snapshot.ts'
import type { GodId, HeldTrait, RunContext, RunPath, TraitId, WeaponId } from '../data/types.ts'

const KEY = 'enodia.run.active'
const VERSION = 1

/**
 * One Exit, after the fact.
 *
 * `died` is the point of the whole structure. Committing a slot can close a
 * dozen duos at once, and this entry is the only place in the product where
 * the cause and the consequence sit next to each other. A separate targets
 * screen would put the death somewhere the player has to go looking.
 */
export type RunEntry = {
  /**
   * Which Exit this happened at, 1-based.
   *
   * An Encounter shares the number of the Exit that led to the Location it
   * happened in, because that is where it happened.
   */
  exit: number
  /**
   * **An Encounter is not an Exit.**
   *
   * `RoomLogic.BeginAthenaEncounter` reads `CurrentRun.CurrentRoom.Encounters`,
   * plural, so an Encounter runs inside a Location the player has already
   * reached. The Location's own reward is separate and still theirs. Artemis,
   * Athena, Dionysus and Hades have no `LootData` entry at all and appear in no
   * reward store: `RewardStoreData.RunProgress` is 18 slots and none of them is
   * an Encounter god.
   *
   * So logging one costs no Exit, and it used to.
   */
  kind: 'exit' | 'encounter'
  god: GodId | null
  taken: TraitId | null
  rarity: HeldTrait['rarity'] | null
  /** targets that went DEAD at this pick, and not before */
  died: TraitId[]
}

type Stored = {
  version: number
  run: RunContext
  entries: RunEntry[]
  /** the target the player says they are chasing. The briefing's headline */
  pinned: TraitId | null
  /**
   * ISO, and the briefing's clock.
   *
   * Written on every pick rather than on every save, because `DESIGN.md` 6.3
   * measures staleness from the last pick. Saving on mount would reset it and
   * a run left overnight would look fresh every time it was reopened.
   */
  lastPickAt: string | null
  /** ISO. When the run was last written at all */
  savedAt: string
}

/**
 * How many Exits a run has.
 *
 * **An estimate, and never a question for the player, in either direction.**
 * Setup used to ask. That was wrong because nobody knows their Exit count when
 * they start, so it became a default the player could correct from the run
 * header with a plus and a minus. That was wrong for the same reason: a player
 * cannot correct a number they have no way of knowing either. Both were asking
 * the tool's question rather than answering the player's.
 *
 * So it is derived now, and the only input is the thing the player does know,
 * which is how many Exits they have taken. It is labelled an estimate wherever
 * it shows.
 *
 * The real number wants the region data, which is a map generator rather than a
 * table, so this stays an estimate until somebody measures real runs.
 */
export const ESTIMATED_EXITS = 12

export function newRun(
  weapon: WeaponId,
  aspect: TraitId | null,
  path: RunPath | null = null,
  exits = ESTIMATED_EXITS,
): RunContext {
  return {
    weapon,
    aspect,
    path,
    exitsLeft: exits,
    held: [],
    godsTaken: [],
    godsSeen: [],
    maxOlympians: offerRules.maxGodsPerRun,
    olympians,
  }
}

function isRunContext(value: unknown): value is RunContext {
  if (typeof value !== 'object' || value === null) return false
  const run = value as Partial<RunContext>
  return (
    Array.isArray(run.held) &&
    Array.isArray(run.godsTaken) &&
    Array.isArray(run.godsSeen) &&
    typeof run.exitsLeft === 'number'
  )
}

export type ActiveRun = {
  run: RunContext
  entries: RunEntry[]
  pinned: TraitId | null
  lastPickAt: string | null
}

/** Older shapes come through here. Return null to drop a run we cannot read. */
function migrate(stored: unknown): ActiveRun | null {
  if (typeof stored !== 'object' || stored === null) return null
  const record = stored as Partial<Stored>
  if (record.version !== VERSION) return null
  if (!isRunContext(record.run)) return null
  return {
    // The roster and the cap come from the data, never from storage, so a patch
    // that changes either applies to a run already in progress.
    run: { ...record.run, olympians, maxOlympians: record.run.maxOlympians || offerRules.maxGodsPerRun },
    // Entries stored before `kind` existed were all logged as Exits, because
    // that is the only thing the picker could record then.
    entries: Array.isArray(record.entries)
      ? record.entries.map((entry) => ({ ...entry, kind: entry?.kind === 'encounter' ? 'encounter' : 'exit' }))
      : [],
    pinned: typeof record.pinned === 'string' ? record.pinned : null,
    // A run stored before step 9 has no clock. Its savedAt is close enough to
    // stand in, and the alternative is a briefing that never fires for it.
    lastPickAt: record.lastPickAt ?? record.savedAt ?? null,
  }
}

/**
 * Rebuild a run from its entries.
 *
 * **A mis-tap should cost one tap to fix, not a run.** `DESIGN.md` 8 asks for
 * "the entry point for correcting a mistake" and there was not one: log the
 * wrong boon at Exit 3 and every verdict after it is wrong, with nothing to do
 * about it but start again.
 *
 * Removing an entry cannot just splice the list. What is held, which gods are
 * spent, how many Exits are left and **what each pick closed** are all
 * consequences of the whole history, and the deaths especially: a target that
 * died at Exit 5 because of a pick at Exit 3 has to come back to life when
 * that pick goes. So the run is replayed from empty and every one of them is
 * recomputed.
 *
 * That costs one reachability pass per entry, a dozen for a full run, and it
 * only runs when somebody corrects something. It also makes the stored `died`
 * lists derived rather than authoritative, which is the right way round.
 */
export function replay(base: RunContext, entries: readonly RunEntry[], exits: number): ActiveRun {
  let run: RunContext = { ...base, held: [], godsTaken: [], godsSeen: [], exitsLeft: exits }
  const rebuilt: RunEntry[] = []
  let taken = 0

  for (const entry of entries) {
    const before = run
    const held = entry.taken ? { id: entry.taken, rarity: entry.rarity ?? 'Common' } : undefined
    const costsAnExit = entry.kind === 'exit'
    if (costsAnExit) taken += 1

    run = {
      ...before,
      exitsLeft: Math.max(0, exits - taken),
      godsSeen:
        entry.god && !before.godsSeen.includes(entry.god) ? [...before.godsSeen, entry.god] : before.godsSeen,
      godsTaken:
        held && entry.god && !before.godsTaken.includes(entry.god)
          ? [...before.godsTaken, entry.god]
          : before.godsTaken,
      held: held ? [...before.held, held] : before.held,
    }

    const wasDead = deadTargets(before)
    const died = reachable(run, traits)
      .filter((verdict) => verdict.state === 'DEAD' && !wasDead.has(verdict.target))
      .map((verdict) => verdict.target)

    rebuilt.push({ ...entry, exit: taken, died })
  }

  return { run, entries: rebuilt, pinned: null, lastPickAt: null }
}

export function loadRun(): ActiveRun | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? migrate(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function saveRun(active: ActiveRun): void {
  try {
    const stored: Stored = { version: VERSION, ...active, savedAt: new Date().toISOString() }
    window.localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // A run that cannot be saved is still a run that can be played.
  }
}

/** The targets reachability calls dead right now. */
export function deadTargets(run: RunContext): Set<TraitId> {
  return new Set(
    reachable(run, traits)
      .filter((verdict) => verdict.state === 'DEAD')
      .map((verdict) => verdict.target),
  )
}

export function clearRun(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to do, and nothing worth saying.
  }
  // The trail belongs to the run. A new run diffed against the old one's
  // verdicts would report every target in it as having changed.
  clearTrail()
}

export type RunStore = {
  run: RunContext | null
  entries: RunEntry[]
  start: (weapon: WeaponId, aspect: TraitId | null, path: RunPath | null) => void

  end: () => void
  /** record a pick: the boon, its rarity, the god who offered it, and where */
  take: (trait: TraitId, rarity: HeldTrait['rarity'], god: GodId | null, kind?: RunEntry['kind']) => void
  /** a reward passed over without taking anything, which is a real move */
  skip: (god: GodId | null, kind?: RunEntry['kind']) => void
  /** what the player says they are chasing. Null clears it */
  pinned: TraitId | null
  pin: (target: TraitId | null) => void
  /**
   * Take an entry back out, and rebuild everything after it.
   *
   * The whole history is replayed, so what is held, which gods are spent and
   * what each remaining pick closed all come out right rather than merely
   * consistent.
   */
  forget: (exit: number, kind: RunEntry['kind']) => void
  /** the last thing logged, for the one-tap case */
  undo: () => void
  /** ISO of the last pick, which is the briefing's clock */
  lastPickAt: string | null
}

export function useRun(): RunStore {
  const [active, setActive] = useState<ActiveRun | null>(() =>
    typeof window === 'undefined' ? null : loadRun(),
  )

  useEffect(() => {
    if (active) saveRun(active)
    else clearRun()
  }, [active])

  const start = useCallback((weapon: WeaponId, aspect: TraitId | null, path: RunPath | null) => {
    clearTrail()
    setActive({ run: newRun(weapon, aspect, path), entries: [], pinned: null, lastPickAt: null })
  }, [])

  const pin = useCallback((target: TraitId | null) => {
    setActive((current) => (current ? { ...current, pinned: target } : current))
  }, [])

  const end = useCallback(() => setActive(null), [])

  /**
   * Rebuild after a correction.
   *
   * **The trail is cleared rather than repaired.** Every snapshot in it was
   * taken against a history that no longer happened, so diffing the corrected
   * run against them would report moves nobody made. The next briefing shows
   * what is held and what is pinned with no diff, which is the truth: there is
   * nothing to compare against any more.
   *
   * The pin survives, because what the player is chasing did not change.
   */
  const rebuild = useCallback((keep: (entries: RunEntry[]) => RunEntry[]) => {
    setActive((current) => {
      if (!current) return current
      const entries = keep(current.entries)
      if (entries.length === current.entries.length) return current

      const exits = current.run.exitsLeft + current.entries.filter((entry) => entry.kind === 'exit').length
      clearTrail()

      return {
        ...replay(current.run, entries, exits),
        pinned: current.pinned,
        lastPickAt: current.lastPickAt,
      }
    })
  }, [])

  const forget = useCallback(
    (exit: number, kind: RunEntry['kind']) =>
      rebuild((entries) => {
        // Exit numbers repeat across kinds: an Encounter carries the number of
        // the Exit it happened at. Match on both, and drop only the first.
        let dropped = false
        return entries.filter((entry) => {
          if (dropped || entry.exit !== exit || entry.kind !== kind) return true
          dropped = true
          return false
        })
      }),
    [rebuild],
  )

  const undo = useCallback(() => rebuild((entries) => entries.slice(0, -1)), [rebuild])

  /**
   * One Exit passes.
   *
   * The death diff is taken here, between the run before the pick and the run
   * after it, so the entry records what this pick closed rather than what was
   * already closed. That is the difference between a timeline and a list.
   */
  const advance = useCallback((god: GodId | null, held: HeldTrait | undefined, kind: RunEntry['kind']) => {
    setActive((current) => {
      if (!current) return current
      const before = current.run
      const costsAnExit = kind === 'exit'
      const after: RunContext = {
        ...before,
        exitsLeft: Math.max(0, before.exitsLeft - (costsAnExit ? 1 : 0)),
        godsSeen: god && !before.godsSeen.includes(god) ? [...before.godsSeen, god] : before.godsSeen,
        godsTaken:
          held && god && !before.godsTaken.includes(god) ? [...before.godsTaken, god] : before.godsTaken,
        held: held ? [...before.held, held] : before.held,
      }

      // One pass over the targets, used twice. The death diff and the snapshot
      // are the same verdicts asked two questions, and reachability is the
      // expensive thing this app does.
      const verdicts = reachable(after, traits)
      const wasDead = deadTargets(before)
      const died = verdicts
        .filter((verdict) => verdict.state === 'DEAD' && !wasDead.has(verdict.target))
        .map((verdict) => verdict.target)

      // Numbered by Exits taken, so an Encounter carries the number of the
      // Exit that led to the Location it happened in rather than claiming one.
      const exitsSoFar = current.entries.filter((entry) => entry.kind === 'exit').length
      const exit = exitsSoFar + (costsAnExit ? 1 : 0)
      const entry: RunEntry = {
        exit,
        kind,
        god,
        taken: held?.id ?? null,
        rarity: held?.rarity ?? null,
        died,
      }

      // The trail, written here because a snapshot belongs to a pick.
      const at = new Date().toISOString()
      saveTrail(withSnapshot(loadTrail(), snapshotOf(exit, verdicts, at)))

      return { ...current, run: after, entries: [...current.entries, entry], lastPickAt: at }
    })
  }, [])

  const take = useCallback(
    (trait: TraitId, rarity: HeldTrait['rarity'], god: GodId | null, kind: RunEntry['kind'] = 'exit') =>
      advance(god, { id: trait, rarity }, kind),
    [advance],
  )

  const skip = useCallback(
    (god: GodId | null, kind: RunEntry['kind'] = 'exit') => advance(god, undefined, kind),
    [advance],
  )

  return {
    run: active?.run ?? null,
    entries: active?.entries ?? [],
    pinned: active?.pinned ?? null,
    lastPickAt: active?.lastPickAt ?? null,
    start,
    end,
    take,
    skip,
    pin,
    forget,
    undo,
  }
}
