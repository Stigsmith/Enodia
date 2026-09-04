/**
 * `enodia.run.snapshot`. The verdict trail the briefing diffs against.
 *
 * `DESIGN.md` 6.2: the changed-while-away line is a diff, so there has to be
 * something to diff against, and 9 budgets "one array of small records per
 * run". This is that array: one record per pick, each holding only a target and
 * a state.
 *
 * **A trail rather than a single snapshot, and that is the whole design.** One
 * snapshot taken on every pick is always the state the player is standing on,
 * so diffing against it is always empty. What makes the card work is the
 * snapshot from *before the gap*, which means keeping the ones in between and
 * remembering which the player last read. `seen` is that mark.
 *
 * `DESIGN.md` 10 step 9 sits where it does for exactly this reason: a run
 * logged before snapshotting existed has no trail and the briefing stays silent
 * about it, which looks broken on the runs a returning player cares about most.
 *
 * Storage is hostile, same as `run.ts`. Every read is guarded and a trail that
 * cannot be understood is dropped, never repaired.
 */

import type { Snapshot } from '../engine/briefing.ts'
import { clearStamped, writeStamped } from './stamps.ts'

const KEY = 'enodia.run.snapshot'
const VERSION = 1

/**
 * A run's worth of snapshots.
 *
 * `seen` is the Exit number the player last read a briefing at. 0 means they
 * have not read one, which is not the same as there being nothing to say.
 */
export type Trail = {
  version: number
  seen: number
  snapshots: Snapshot[]
}

/**
 * A run is about twelve Exits and the Fields can add a few. Fifty is far past
 * any real run and keeps a trail that somehow never gets cleared from growing
 * without limit.
 */
const CAP = 50

export const emptyTrail = (): Trail => ({ version: VERSION, seen: 0, snapshots: [] })

function migrate(stored: unknown): Trail | null {
  if (typeof stored !== 'object' || stored === null) return null
  const record = stored as Partial<Trail>
  if (record.version !== VERSION) return null
  if (!Array.isArray(record.snapshots)) return null
  return {
    version: VERSION,
    seen: typeof record.seen === 'number' ? record.seen : 0,
    snapshots: record.snapshots.filter(
      (entry): entry is Snapshot =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Snapshot).exit === 'number' &&
        Array.isArray((entry as Snapshot).verdicts),
    ),
  }
}

export function loadTrail(): Trail {
  try {
    const raw = window.localStorage.getItem(KEY)
    return (raw ? migrate(JSON.parse(raw)) : null) ?? emptyTrail()
  } catch {
    return emptyTrail()
  }
}

export function saveTrail(trail: Trail): void {
  try {
    writeStamped(KEY, JSON.stringify(trail))
  } catch {
    // A trail that cannot be saved costs the briefing, not the run.
  }
}

export function clearTrail(): void {
  try {
    clearStamped(KEY)
  } catch {
    // Nothing to do, and nothing worth saying.
  }
}

/** Append a snapshot, replacing any already recorded for that Exit. */
export function withSnapshot(trail: Trail, snapshot: Snapshot): Trail {
  const kept = trail.snapshots.filter((entry) => entry.exit !== snapshot.exit)
  return { ...trail, snapshots: [...kept, snapshot].sort((a, b) => a.exit - b.exit).slice(-CAP) }
}

/**
 * The snapshot the player last saw, which is what a diff is taken against.
 *
 * With nothing read yet the earliest snapshot is the right answer: the whole
 * run is news to them. Never the most recent, which is the state they are
 * standing on and would diff to nothing.
 */
export function lastSeen(trail: Trail): Snapshot | null {
  if (!trail.snapshots.length) return null
  const at = trail.snapshots.findLast((entry) => entry.exit <= trail.seen)
  return at ?? trail.snapshots[0] ?? null
}

/** Mark the briefing read as of an Exit. */
export function markSeen(trail: Trail, exit: number): Trail {
  return { ...trail, seen: Math.max(trail.seen, exit) }
}
