/**
 * The active run, and where it lives between page loads.
 *
 * `DESIGN.md` 9: localStorage, one key per concern, versioned with a migration
 * function. This owns `enodia.run.active` and nothing else.
 *
 * Storage is treated as hostile: a private window can refuse it, a browser can
 * clear it, and a stored run can predate a rename. Every read is guarded and a
 * run that cannot be understood is dropped rather than crashing the surface a
 * player opened mid run.
 */

import { useCallback, useEffect, useState } from 'react'

import { olympians, offerRules, traits } from '../data/app.ts'
import { reachable } from '../engine/reachability.ts'
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
  /** 1-based, in the order they happened */
  exit: number
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
  /** ISO, used by the re-entry briefing at step 9 to notice a gap */
  savedAt: string
}

/**
 * How many Exits a fresh run has left.
 *
 * **An estimate, and never a question for the player.** Nobody knows their Exit
 * count when they start, and asking produced a number that was worse than a
 * default. It is corrected from the run surface, and it only moves what counts
 * as running out of time.
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

export type ActiveRun = { run: RunContext; entries: RunEntry[] }

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
    entries: Array.isArray(record.entries) ? record.entries : [],
  }
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
}

export type RunStore = {
  run: RunContext | null
  entries: RunEntry[]
  start: (weapon: WeaponId, aspect: TraitId | null, path: RunPath | null) => void
  /** the Exit estimate is the player's to correct, and only theirs */
  setExitsLeft: (exits: number) => void
  end: () => void
  /** record a pick: the boon, its rarity, and the god who offered it */
  take: (trait: TraitId, rarity: HeldTrait['rarity'], god: GodId | null) => void
  /** an Exit passed without taking a boon, which is a real move */
  skip: (god: GodId | null) => void
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
    setActive({ run: newRun(weapon, aspect, path), entries: [] })
  }, [])

  const setExitsLeft = useCallback((exits: number) => {
    setActive((current) =>
      current ? { ...current, run: { ...current.run, exitsLeft: Math.max(0, exits) } } : current,
    )
  }, [])

  const end = useCallback(() => setActive(null), [])

  /**
   * One Exit passes.
   *
   * The death diff is taken here, between the run before the pick and the run
   * after it, so the entry records what this pick closed rather than what was
   * already closed. That is the difference between a timeline and a list.
   */
  const advance = useCallback((god: GodId | null, held?: HeldTrait) => {
    setActive((current) => {
      if (!current) return current
      const before = current.run
      const after: RunContext = {
        ...before,
        exitsLeft: Math.max(0, before.exitsLeft - 1),
        godsSeen: god && !before.godsSeen.includes(god) ? [...before.godsSeen, god] : before.godsSeen,
        godsTaken:
          held && god && !before.godsTaken.includes(god) ? [...before.godsTaken, god] : before.godsTaken,
        held: held ? [...before.held, held] : before.held,
      }

      const wasDead = deadTargets(before)
      const died = [...deadTargets(after)].filter((target) => !wasDead.has(target))

      const entry: RunEntry = {
        exit: current.entries.length + 1,
        god,
        taken: held?.id ?? null,
        rarity: held?.rarity ?? null,
        died,
      }
      return { run: after, entries: [...current.entries, entry] }
    })
  }, [])

  const take = useCallback(
    (trait: TraitId, rarity: HeldTrait['rarity'], god: GodId | null) => advance(god, { id: trait, rarity }),
    [advance],
  )

  const skip = useCallback((god: GodId | null) => advance(god), [advance])

  return { run: active?.run ?? null, entries: active?.entries ?? [], start, end, take, skip, setExitsLeft }
}
