/**
 * The browser half of sync: what it offers, and what it does with an answer.
 *
 * `worker/sync.test.ts` covers the merge. This covers the translation either
 * side of it, which is where the browser's seven different storage shapes get
 * flattened into one and back again. A mistake here does not produce an error,
 * it produces a library that quietly loses a build.
 *
 * The one worth reading twice is "does not stamp what it applies". A stamp
 * means this device changed something. Stamping an arriving change makes it
 * look like a local edit, so it goes back to the server as news, comes back to
 * the other device, and the two hand the same item to each other forever.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { apply, backfillStamps, gather } from './sync.ts'
import { stampOf, tombstones } from './stamps.ts'

const put = (key: string, value: unknown) =>
  window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))

const find = (kind: string, id: string) =>
  gather().find((one) => one.kind === kind && one.id === id)

beforeEach(() => {
  window.localStorage.clear()
})

describe('what a device offers', () => {
  it('offers each build separately, dated by its own modified', () => {
    put('enodia.builds', {
      version: 1,
      builds: [
        { id: 'b1', name: 'One', modified: '2026-09-01T10:00:00.000Z' },
        { id: 'b2', name: 'Two', modified: '2026-09-02T10:00:00.000Z' },
      ],
    })

    const one = find('build', 'b1')
    const two = find('build', 'b2')
    expect(one?.modified).toBe(Date.parse('2026-09-01T10:00:00.000Z'))
    expect(two?.modified).toBe(Date.parse('2026-09-02T10:00:00.000Z'))
    // Separate items, so editing one on each device is not a conflict.
    expect(one?.id).not.toBe(two?.id)
  })

  /** A build saved before `modified` existed still has to travel. */
  it('falls back to created when a build has no modified', () => {
    put('enodia.builds', {
      version: 1,
      builds: [{ id: 'old', name: 'Old', created: '2026-08-01T10:00:00.000Z' }],
    })
    expect(find('build', 'old')?.modified).toBe(Date.parse('2026-08-01T10:00:00.000Z'))
  })

  it('offers the bin as its own kind, dated by when it was binned', () => {
    put('enodia.bin', {
      version: 1,
      builds: [{ id: 'b1', name: 'Gone', binnedAt: '2026-09-03T10:00:00.000Z' }],
    })
    expect(find('bin', 'b1')?.modified).toBe(Date.parse('2026-09-03T10:00:00.000Z'))
  })

  /** A finished run has no id of its own, so its end time is both. */
  it('identifies a run by when it ended', () => {
    put('enodia.runs', { version: 1, runs: [{ at: '2026-09-03T12:00:00.000Z', outcome: 'died' }] })
    const run = find('run', '2026-09-03T12:00:00.000Z')
    expect(run?.modified).toBe(Date.parse('2026-09-03T12:00:00.000Z'))
  })

  it('offers a setting with the stamp its writer left', () => {
    put('enodia.theme', 'nightmare')
    put('enodia.stamps', { 'enodia.theme': 12345 })
    expect(find('setting', 'enodia.theme')).toMatchObject({
      payload: 'nightmare',
      modified: 12345,
    })
  })

  /**
   * **A device that has never set a theme is not a device that deleted one.**
   *
   * Without this, a fresh phone would offer every setting as an unstamped
   * delete, and every one of those would be older than the desktop's real
   * values, so they would lose. That is the right answer by luck rather than by
   * design, and a clock skew would turn the luck the other way and wipe the
   * account's settings on first sign-in.
   */
  it('says nothing about a setting this device has never had', () => {
    expect(find('setting', 'enodia.theme')).toBeUndefined()
  })

  /** Cleared, but stamped, is a delete and has to travel as one. */
  it('offers a cleared setting as a delete', () => {
    put('enodia.stamps', { 'enodia.name': 9999 })
    expect(find('setting', 'enodia.name')).toMatchObject({ deleted: true, modified: 9999 })
  })

  it('offers what was thrown away', () => {
    put('enodia.tombstones', [{ kind: 'build', id: 'dead', at: 4242 }])
    expect(find('build', 'dead')).toMatchObject({ deleted: true, modified: 4242 })
  })

  /** Its own bookkeeping is not content and must never travel. */
  it('never offers its own sync bookkeeping', () => {
    put('enodia.stamps', { 'enodia.theme': 1 })
    put('enodia.sync.since', 500)
    put('enodia.tombstones', [])
    const ids = gather().map((one) => one.id)
    expect(ids).not.toContain('enodia.stamps')
    expect(ids).not.toContain('enodia.sync.since')
    expect(ids).not.toContain('enodia.tombstones')
  })
})

describe('settings that predate stamps', () => {
  /**
   * The migration everybody already using the tool will hit exactly once.
   * Their theme and name were written by a version that stamped nothing, and
   * `gather` offers nothing unstamped, so without the backfill those choices
   * would sit on one device forever while the account stayed empty.
   */
  it('gives a date to what was already here', () => {
    put('enodia.theme', 'nightmare')
    expect(find('setting', 'enodia.theme')).toBeUndefined()

    backfillStamps(7777)
    expect(find('setting', 'enodia.theme')).toMatchObject({
      payload: 'nightmare',
      modified: 7777,
    })
  })

  /**
   * **Once, ever.** A second run would stamp whatever `apply` had written since,
   * which is exactly what `apply` refuses to do, and those would go back to the
   * server as this device's own news.
   */
  it('never runs twice', () => {
    put('enodia.theme', 'dawn')
    backfillStamps(1000)

    apply([{ kind: 'setting', id: 'enodia.name', payload: 'Mel', modified: 5000 }])
    backfillStamps(9999)

    expect(stampOf('enodia.name')).toBe(0)
    expect(find('setting', 'enodia.name')).toBeUndefined()
    // And the first backfill is untouched.
    expect(stampOf('enodia.theme')).toBe(1000)
  })

  it('leaves settings that were never set alone', () => {
    backfillStamps(7777)
    expect(find('setting', 'enodia.theme')).toBeUndefined()
  })
})

describe('what a device does with an answer', () => {
  it('adds a build it has never seen', () => {
    apply([
      {
        kind: 'build',
        id: 'new',
        payload: JSON.stringify({ id: 'new', name: 'Arrived' }),
        modified: 1000,
      },
    ])
    const stored = JSON.parse(window.localStorage.getItem('enodia.builds') ?? '{}')
    expect(stored.builds).toHaveLength(1)
    expect(stored.builds[0].name).toBe('Arrived')
  })

  it('replaces a build it already had', () => {
    put('enodia.builds', { version: 1, builds: [{ id: 'b1', name: 'Old' }] })
    apply([
      {
        kind: 'build',
        id: 'b1',
        payload: JSON.stringify({ id: 'b1', name: 'New' }),
        modified: 2000,
      },
    ])
    const stored = JSON.parse(window.localStorage.getItem('enodia.builds') ?? '{}')
    expect(stored.builds).toHaveLength(1)
    expect(stored.builds[0].name).toBe('New')
  })

  it('leaves builds it was told nothing about alone', () => {
    put('enodia.builds', { version: 1, builds: [{ id: 'keep', name: 'Mine' }] })
    apply([
      { kind: 'build', id: 'other', payload: JSON.stringify({ id: 'other' }), modified: 1 },
    ])
    const ids = JSON.parse(window.localStorage.getItem('enodia.builds') ?? '{}').builds.map(
      (one: { id: string }) => one.id,
    )
    expect(ids).toContain('keep')
    expect(ids).toContain('other')
  })

  it('removes a build the server says is gone', () => {
    put('enodia.builds', { version: 1, builds: [{ id: 'doomed', name: 'Bye' }] })
    apply([{ kind: 'build', id: 'doomed', payload: '', modified: 3000, deleted: true }])
    const stored = JSON.parse(window.localStorage.getItem('enodia.builds') ?? '{}')
    expect(stored.builds).toHaveLength(0)
  })

  /**
   * And remembers that it did, or it offers the thing back next time and the
   * two devices argue about it forever.
   */
  it('remembers a delete it was told about', () => {
    apply([{ kind: 'build', id: 'doomed', payload: '', modified: 3000, deleted: true }])
    expect(tombstones()).toContainEqual({ kind: 'build', id: 'doomed', at: 3000 })
  })

  it('writes a setting, and clears one', () => {
    apply([{ kind: 'setting', id: 'enodia.theme', payload: 'nightmare', modified: 1 }])
    expect(window.localStorage.getItem('enodia.theme')).toBe('nightmare')

    apply([{ kind: 'setting', id: 'enodia.theme', payload: '', modified: 2, deleted: true }])
    expect(window.localStorage.getItem('enodia.theme')).toBeNull()
  })

  /**
   * **The load bearing one.**
   *
   * A stamp means this device changed something. If applying stamped, the
   * arriving change would look like a local edit and go straight back as news,
   * and two devices would pass the same item between them without end.
   */
  it('does not stamp what it applies', () => {
    apply([{ kind: 'setting', id: 'enodia.theme', payload: 'nightmare', modified: 5000 }])
    expect(stampOf('enodia.theme')).toBe(0)
    // And so it is not offered back.
    expect(find('setting', 'enodia.theme')).toBeUndefined()
  })

  /** A payload from a newer client is skipped, never fatal. */
  it('survives a payload it cannot read', () => {
    put('enodia.builds', { version: 1, builds: [{ id: 'keep', name: 'Mine' }] })
    expect(() =>
      apply([{ kind: 'build', id: 'weird', payload: '{not json', modified: 1 }]),
    ).not.toThrow()
    const stored = JSON.parse(window.localStorage.getItem('enodia.builds') ?? '{}')
    expect(stored.builds.map((one: { id: string }) => one.id)).toContain('keep')
  })

  it('does nothing at all when there is nothing to do', () => {
    put('enodia.builds', { version: 1, builds: [{ id: 'keep' }] })
    const before = window.localStorage.getItem('enodia.builds')
    apply([])
    expect(window.localStorage.getItem('enodia.builds')).toBe(before)
  })
})

describe('a round trip', () => {
  /**
   * What one device offers, another can take, and the second then offers
   * nothing new back. If it did, the two would never settle.
   */
  it('settles: what one device sends, the other takes and does not return', () => {
    put('enodia.builds', {
      version: 1,
      builds: [{ id: 'b1', name: 'One', modified: '2026-09-01T10:00:00.000Z' }],
    })
    put('enodia.theme', 'nightmare')
    put('enodia.stamps', { 'enodia.theme': 12345 })
    const sent = gather()

    // A second device, empty.
    window.localStorage.clear()
    apply(sent)

    const offeredBack = gather()
    expect(offeredBack.find((one) => one.kind === 'setting')).toBeUndefined()
    // The build is offered back, because it genuinely is in this library now,
    // and it carries the same date so the server sees no change.
    const build = offeredBack.find((one) => one.kind === 'build')
    expect(build?.modified).toBe(Date.parse('2026-09-01T10:00:00.000Z'))
  })
})
