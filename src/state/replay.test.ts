/**
 * Correcting a mistake.
 *
 * The thing worth testing is not that an entry disappears. It is that
 * everything downstream of it comes back: what is held, which gods are spent,
 * how many Exits are left, and above all **what each remaining pick closed**.
 * A target killed at Exit 5 by a pick at Exit 3 has to be alive again once
 * that pick is gone, and a splice would leave it dead forever.
 */

import { describe, expect, it } from 'vitest'

import { traits } from '../data/app.ts'
import { reachable } from '../engine/reachability.ts'
import { replay } from './run.ts'
import type { RunEntry } from './run.ts'
import type { RunContext } from '../data/types.ts'

const olympians = ['Aphrodite', 'Apollo', 'Ares', 'Demeter', 'Hephaestus', 'Hera', 'Hestia', 'Poseidon', 'Zeus']

const base: RunContext = {
  weapon: 'WeaponStaffSwing',
  aspect: null,
  path: 'underworld',
  exitsLeft: 12,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
}

const entry = (over: Partial<RunEntry>): RunEntry => ({
  exit: 1,
  kind: 'exit',
  god: null,
  taken: null,
  rarity: null,
  died: [],
  ...over,
})

/** Four Olympians, which settles the pool and kills three dozen duos. */
const FOUR: RunEntry[] = [
  entry({ exit: 1, god: 'Zeus', taken: 'ZeusCastBoon', rarity: 'Common' }),
  entry({ exit: 2, god: 'Hestia', taken: 'HestiaSpecialBoon', rarity: 'Common' }),
  entry({ exit: 3, god: 'Demeter', taken: 'DemeterSprintBoon', rarity: 'Common' }),
  entry({ exit: 4, god: 'Poseidon', taken: 'PoseidonWeaponBoon', rarity: 'Common' }),
]

const deadCount = (run: RunContext) =>
  reachable(run, traits).filter((verdict) => verdict.state === 'DEAD').length

describe('replay', () => {
  it('rebuilds what is held, who is spent and what is left', () => {
    const { run, entries } = replay(base, FOUR, 12)
    expect(run.held.map((h) => h.id)).toEqual([
      'ZeusCastBoon',
      'HestiaSpecialBoon',
      'DemeterSprintBoon',
      'PoseidonWeaponBoon',
    ])
    expect(run.godsTaken.sort()).toEqual(['Demeter', 'Hestia', 'Poseidon', 'Zeus'])
    expect(run.exitsLeft).toBe(8)
    expect(entries).toHaveLength(4)
  })

  it('brings back what a removed pick had killed', () => {
    const withFourth = replay(base, FOUR, 12)
    const withoutFourth = replay(base, FOUR.slice(0, 3), 12)

    // The fourth Olympian is the pick that settles the pool. Taking it back
    // out has to revive everything it closed, and a splice would not.
    expect(deadCount(withFourth.run)).toBeGreaterThan(deadCount(withoutFourth.run))
    expect(deadCount(withoutFourth.run)).toBe(0)
  })

  it('recomputes what each remaining pick closed, not just the run', () => {
    // Five entries with a skip in the middle. The fourth god is what settles
    // the pool, so that entry carries the deaths and nothing before it does.
    const five: RunEntry[] = [
      FOUR[0] as RunEntry,
      FOUR[1] as RunEntry,
      entry({ exit: 3, god: 'Hera', taken: null }),
      FOUR[2] as RunEntry,
      FOUR[3] as RunEntry,
    ]
    const before = replay(base, five, 12)
    expect(before.entries.at(-1)?.died.length).toBeGreaterThan(0)
    expect(before.entries.slice(0, -1).every((e) => e.died.length === 0)).toBe(true)

    // Take the skip out. The same pick still settles the pool, so it still
    // carries the deaths, and it has moved up an Exit.
    const after = replay(base, five.filter((e) => e.taken !== null), 12)
    expect(after.entries.at(-1)?.exit).toBe(4)
    expect(after.entries.at(-1)?.died.length).toBe(before.entries.at(-1)?.died.length)
    expect(after.run.exitsLeft).toBe(8)
  })

  it('moves the deaths onto whichever pick now settles the pool', () => {
    // Four gods, and the deaths sit on the fourth. Remove the second, and the
    // pool is no longer settled at all: nothing should still be dead, and no
    // entry should still be claiming a death.
    const withFour = replay(base, FOUR, 12)
    expect(withFour.entries.at(-1)?.died.length).toBeGreaterThan(0)

    const withThree = replay(base, [FOUR[0], FOUR[2], FOUR[3]].filter(Boolean) as RunEntry[], 12)
    expect(withThree.entries.every((e) => e.died.length === 0)).toBe(true)
    expect(deadCount(withThree.run)).toBe(0)
  })

  it('renumbers the Exits so the timeline has no gap', () => {
    const trimmed = [FOUR[0], FOUR[2], FOUR[3]].filter(Boolean) as RunEntry[]
    const { entries } = replay(base, trimmed, 12)
    expect(entries.map((e) => e.exit)).toEqual([1, 2, 3])
  })

  it('does not let an Encounter consume an Exit on the way back', () => {
    const withEncounter: RunEntry[] = [
      entry({ exit: 1, god: 'Zeus', taken: 'ZeusCastBoon', rarity: 'Common' }),
      entry({ exit: 1, kind: 'encounter', god: null, taken: 'RoomRewardBonusBoon', rarity: 'Common' }),
      entry({ exit: 2, god: 'Hestia', taken: 'HestiaSpecialBoon', rarity: 'Common' }),
    ]
    const { run, entries } = replay(base, withEncounter, 12)
    expect(run.exitsLeft).toBe(10)
    expect(entries.map((e) => e.exit)).toEqual([1, 1, 2])
    expect(run.held).toHaveLength(3)
  })

  it('is the identity on a history nothing was removed from', () => {
    const once = replay(base, FOUR, 12)
    const twice = replay(base, once.entries, 12)
    expect(twice.run).toEqual(once.run)
    expect(twice.entries).toEqual(once.entries)
  })
})
