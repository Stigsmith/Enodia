/**
 * The briefing, against the real trait data.
 *
 * The diff is the whole feature, so most of this is about what counts as a
 * change and what does not. The two failure modes that matter are a card that
 * reports everything, which nobody reads, and a card that reports nothing,
 * which looks broken.
 */

import { describe, expect, it } from 'vitest'

import { traits } from '../data/app.ts'
import { brief, changesSince, heldBySlot, isWorthShowing, snapshotOf } from './briefing.ts'
import { reachable } from './reachability.ts'
import { CORE_SLOTS } from './slots.ts'
import type { Snapshot } from './briefing.ts'
import type { RunContext } from '../data/types.ts'

const olympians = ['Aphrodite', 'Apollo', 'Ares', 'Demeter', 'Hephaestus', 'Hera', 'Hestia', 'Poseidon', 'Zeus']

const run = (over: Partial<RunContext> = {}): RunContext => ({
  weapon: 'WeaponStaffSwing',
  aspect: null,
  path: 'underworld',
  exitsLeft: 10,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
  ...over,
})

describe('changesSince', () => {
  it('reports nothing without a snapshot, because there is nothing to diff', () => {
    expect(changesSince(null, reachable(run(), traits))).toEqual([])
  })

  it('reports nothing when nothing moved', () => {
    const ctx = run()
    const verdicts = reachable(ctx, traits)
    expect(changesSince(snapshotOf(1, verdicts), verdicts)).toEqual([])
  })

  it('reports only the targets that moved', () => {
    const before = run()
    const snapshot = snapshotOf(1, reachable(before, traits))

    // Four Olympians settles the pool: ReachedMaxGods freezes the Exit store to
    // those held, so every duo needing a fifth god dies at once.
    const after = run({
      held: [
        { id: 'ZeusWeaponBoon', rarity: 'Common' },
        { id: 'HestiaSpecialBoon', rarity: 'Common' },
        { id: 'PoseidonCastBoon', rarity: 'Common' },
        { id: 'DemeterSprintBoon', rarity: 'Common' },
      ],
      godsTaken: ['Zeus', 'Hestia', 'Poseidon', 'Demeter'],
      godsSeen: ['Zeus', 'Hestia', 'Poseidon', 'Demeter'],
    })

    const changes = changesSince(snapshot, reachable(after, traits))
    expect(changes.length).toBeGreaterThan(0)
    // A diff that reports every target is a diff nobody reads.
    expect(changes.length).toBeLessThan(snapshot.verdicts.length)
    for (const change of changes) expect(change.from).not.toBe(change.to)
  })

  it('puts deaths first', () => {
    const before = run()
    const snapshot = snapshotOf(1, reachable(before, traits))
    const after = run({
      held: [
        { id: 'ZeusWeaponBoon', rarity: 'Common' },
        { id: 'HestiaSpecialBoon', rarity: 'Common' },
        { id: 'PoseidonCastBoon', rarity: 'Common' },
        { id: 'DemeterSprintBoon', rarity: 'Common' },
      ],
      godsTaken: ['Zeus', 'Hestia', 'Poseidon', 'Demeter'],
      godsSeen: ['Zeus', 'Hestia', 'Poseidon', 'Demeter'],
    })

    const changes = changesSince(snapshot, reachable(after, traits))
    const states = changes.map((change) => change.to)

    // A conditional assertion here would pass on an empty diff, which is the
    // exact bug this is watching for. Settling four Olympians must kill things.
    expect(states).toContain('DEAD')
    expect(states.lastIndexOf('DEAD')).toBe(states.filter((state) => state === 'DEAD').length - 1)
  })

  it('ignores targets the snapshot never saw, rather than calling them new', () => {
    const ctx = run()
    const verdicts = reachable(ctx, traits)
    const partial: Snapshot = { exit: 1, at: new Date().toISOString(), verdicts: [] }
    expect(changesSince(partial, verdicts)).toEqual([])
  })
})

describe('heldBySlot', () => {
  it('always names all five core slots, because an empty one is the warning', () => {
    const held = heldBySlot(run(), traits)
    for (const slot of CORE_SLOTS) {
      const row = held.find((entry) => entry.slot === slot)
      expect(row, `${slot} missing`).toBeDefined()
      expect(row?.traits).toEqual([])
    }
  })

  it('files a slotless boon under null rather than dropping it', () => {
    // Buried Treasure, RoomRewardBonusBoon, occupies no slot at all, which is
    // true of most of a run: only 45 boons take a core slot.
    const held = heldBySlot(run({ held: [{ id: 'RoomRewardBonusBoon', rarity: 'Common' }] }), traits)
    const slotless = held.find((entry) => entry.slot === null)
    expect(slotless?.traits).toContain('RoomRewardBonusBoon')
  })

  it('puts a core boon under its own slot', () => {
    const held = heldBySlot(run({ held: [{ id: 'ZeusWeaponBoon', rarity: 'Common' }] }), traits)
    expect(held.find((entry) => entry.slot === 'Melee')?.traits).toEqual(['ZeusWeaponBoon'])
  })
})

describe('brief', () => {
  it('leaves the advice register empty in Phase 1', () => {
    const card = brief(run(), null, traits)
    expect(card.advice).toBeNull()
    expect(card.centre).toBeNull()
  })

  it('says what it does not know about position rather than guessing', () => {
    const card = brief(run({ path: 'surface', exitsLeft: 7 }), null, traits)
    expect(card.position).toEqual({ path: 'surface', exitsLeft: 7, region: null, nextBoss: null })
  })

  it('judges the pinned target now, not when it was pinned', () => {
    const ctx = run({
      held: [{ id: 'ZeusWeaponBoon', rarity: 'Common' }],
      godsTaken: ['Zeus'],
      godsSeen: ['Zeus'],
    })
    // Killer Current, the Poseidon and Zeus duo.
    const card = brief(ctx, null, traits, { pinned: 'LightningVulnerabilityBoon' })
    expect(card.pinned?.target).toBe('LightningVulnerabilityBoon')
    expect(card.pinned?.why).toBeTruthy()
    // Holding a Zeus boon satisfies its Zeus half, so it cannot read as
    // untouched. If this ever says DEAD the ids have rotted again.
    expect(card.pinned?.state).not.toBe('DEAD')
  })

  it('counts the Exits since the snapshot', () => {
    const ctx = run()
    const snapshot = snapshotOf(2, reachable(ctx, traits))
    expect(brief(ctx, snapshot, traits, { exit: 6 }).away.exits).toBe(4)
  })
})

describe('isWorthShowing', () => {
  const card = (over: Partial<ReturnType<typeof brief>>) => ({ ...brief(run(), null, traits), ...over })
  const now = Date.parse('2026-08-28T12:00:00.000Z')
  const hoursAgo = (n: number) => new Date(now - n * 3600_000).toISOString()

  it('never shows a card with nothing on it', () => {
    expect(
      isWorthShowing(card({ changedWhileAway: [], pinned: null, away: { exits: 9, since: null } }), {
        lastPickAt: hoursAgo(100),
        now,
        staleAfterHours: 3,
      }),
    ).toBe(false)
  })

  it('shows one when picks piled up unread', () => {
    const ctx = run()
    const pinned = brief(ctx, null, traits, { pinned: 'LightningVulnerabilityBoon' }).pinned
    expect(
      isWorthShowing(card({ pinned, away: { exits: 4, since: hoursAgo(0.1) } }), {
        lastPickAt: hoursAgo(0.1),
        now,
        staleAfterHours: 3,
      }),
    ).toBe(true)
  })

  it('shows one when the clock says the player has been away', () => {
    const ctx = run()
    const pinned = brief(ctx, null, traits, { pinned: 'LightningVulnerabilityBoon' }).pinned
    const facts = { lastPickAt: hoursAgo(9), now, staleAfterHours: 3 }
    expect(isWorthShowing(card({ pinned, away: { exits: 0, since: null } }), facts)).toBe(true)
  })

  it('stays quiet inside the same sitting', () => {
    const ctx = run()
    const pinned = brief(ctx, null, traits, { pinned: 'LightningVulnerabilityBoon' }).pinned
    const facts = { lastPickAt: hoursAgo(0.5), now, staleAfterHours: 3 }
    expect(isWorthShowing(card({ pinned, away: { exits: 1, since: null } }), facts)).toBe(false)
  })
})
