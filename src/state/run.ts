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

import { olympians, offerRules } from '../data/app.ts'
import type { HeldTrait, RunContext, TraitId, WeaponId } from '../data/types.ts'

const KEY = 'enodia.run.active'
const VERSION = 1

type Stored = {
  version: number
  run: RunContext
  /** ISO, used by the re-entry briefing at step 9 to notice a gap */
  savedAt: string
}

/**
 * How many Exits a fresh run gets.
 *
 * A placeholder, and knowingly so. The real number comes from the region data,
 * which is not extracted yet, and the run surface will let it be corrected. A
 * wrong count moves AT_RISK around and nothing else.
 */
export const DEFAULT_EXITS = 12

export function newRun(weapon: WeaponId, aspect: TraitId | null, exits = DEFAULT_EXITS): RunContext {
  return {
    weapon,
    aspect,
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

/** Older shapes come through here. Return null to drop a run we cannot read. */
function migrate(stored: unknown): RunContext | null {
  if (typeof stored !== 'object' || stored === null) return null
  const record = stored as Partial<Stored>
  if (record.version !== VERSION) return null
  if (!isRunContext(record.run)) return null
  // The roster and the cap come from the data, never from storage, so a patch
  // that changes either applies to a run already in progress.
  return { ...record.run, olympians, maxOlympians: record.run.maxOlympians || offerRules.maxGodsPerRun }
}

export function loadRun(): RunContext | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? migrate(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function saveRun(run: RunContext): void {
  try {
    const stored: Stored = { version: VERSION, run, savedAt: new Date().toISOString() }
    window.localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // A run that cannot be saved is still a run that can be played.
  }
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
  start: (weapon: WeaponId, aspect: TraitId | null, exits?: number) => void
  end: () => void
  /** record a pick: the boon, its rarity, and the god who offered it */
  take: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null) => void
  /** an Exit passed without taking a boon, which is a real move */
  skip: (god: string | null) => void
  update: (next: RunContext) => void
}

export function useRun(): RunStore {
  const [run, setRun] = useState<RunContext | null>(() => (typeof window === 'undefined' ? null : loadRun()))

  useEffect(() => {
    if (run) saveRun(run)
    else clearRun()
  }, [run])

  const update = useCallback((next: RunContext) => setRun(next), [])

  const start = useCallback((weapon: WeaponId, aspect: TraitId | null, exits?: number) => {
    setRun(newRun(weapon, aspect, exits))
  }, [])

  const end = useCallback(() => setRun(null), [])

  const advance = useCallback((god: string | null, held?: HeldTrait) => {
    setRun((current) => {
      if (!current) return current
      const seen = god && !current.godsSeen.includes(god) ? [...current.godsSeen, god] : current.godsSeen
      const taken = held && god && !current.godsTaken.includes(god) ? [...current.godsTaken, god] : current.godsTaken
      return {
        ...current,
        exitsLeft: Math.max(0, current.exitsLeft - 1),
        godsSeen: seen,
        godsTaken: taken,
        held: held ? [...current.held, held] : current.held,
      }
    })
  }, [])

  const take = useCallback(
    (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null) => advance(god, { id: trait, rarity }),
    [advance],
  )

  const skip = useCallback((god: string | null) => advance(god), [advance])

  return { run, start, end, take, skip, update }
}
