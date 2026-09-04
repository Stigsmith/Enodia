/**
 * Syncing an account between devices, run inside workerd against a real D1.
 *
 * The merge is one SQL statement with a `where` on it, and everything that can
 * go wrong with sync goes wrong in that clause. These drive it through the real
 * endpoint with two independent sessions standing in for two devices, because
 * the interesting cases are all about what one device does to another.
 *
 * The one that matters most is the resurrection test. A delete that is stored as
 * an absence rather than a fact comes back from the dead on the next sync from
 * a device that never saw it, and it does so silently, weeks later, on somebody
 * else's machine.
 */

import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const ORIGIN = 'https://enodia.me'
const PASSWORD = 'a-long-enough-password-here'

let seq = 0

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

/** An account, and two cookies for it: one per device. */
async function withTwoDevices() {
  const email = `s${Date.now()}-${seq++}@example.invalid`
  const ip = `203.0.113.${150 + (seq % 90)}`
  const first = await post(
    '/api/auth/sign-up/email',
    { name: 'Syncer', email, password: PASSWORD },
    { 'cf-connecting-ip': ip },
  )
  const phone = (first.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

  const second = await post(
    '/api/auth/sign-in/email',
    { email, password: PASSWORD },
    { 'cf-connecting-ip': ip },
  )
  const desktop = (second.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  return { phone, desktop }
}

type Item = { kind: string; id: string; payload: string; modified: number; deleted?: boolean }

/** One exchange, as a device makes it. */
async function syncAs(
  cookie: string,
  items: Item[] = [],
  since = 0,
): Promise<{ now: number; items: Item[] }> {
  const response = await post('/api/sync', { since, items }, { cookie })
  expect(response.status).toBe(200)
  return response.json()
}

const byId = (items: Item[], id: string) => items.find((one) => one.id === id)

beforeEach(async () => {
  await env.DB.prepare('delete from rate_limit').run()
  await env.DB.prepare('delete from api_rate_limit').run()
})

describe('the gate', () => {
  it('refuses a stranger', async () => {
    const response = await post('/api/sync', { since: 0, items: [] })
    expect(response.status).toBe(401)
  })

  /** One account must never see another's things. */
  it('keeps two accounts apart', async () => {
    const one = await withTwoDevices()
    const two = await withTwoDevices()

    await syncAs(one.phone, [
      { kind: 'build', id: 'mine', payload: 'Zmine', modified: 1000 },
    ])

    const theirs = await syncAs(two.phone)
    expect(theirs.items).toHaveLength(0)
  })
})

describe('carrying things between devices', () => {
  it('sends what one device has to the other', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(phone, [
      { kind: 'build', id: 'b1', payload: 'Zone', modified: 1000 },
      { kind: 'setting', id: 'theme', payload: 'nightmare', modified: 1000 },
    ])

    const got = await syncAs(desktop)
    expect(got.items).toHaveLength(2)
    expect(byId(got.items, 'b1')?.payload).toBe('Zone')
    expect(byId(got.items, 'theme')?.payload).toBe('nightmare')
  })

  /**
   * The first sign-in the owner asked about: three things here, twenty there,
   * and nothing is destroyed by signing in.
   */
  it('merges rather than replacing, on a first sign-in', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(desktop, [
      { kind: 'build', id: 'd1', payload: 'Zdesk1', modified: 1000 },
      { kind: 'build', id: 'd2', payload: 'Zdesk2', modified: 1000 },
    ])

    // The phone arrives with its own, and has never synced.
    const merged = await syncAs(phone, [
      { kind: 'build', id: 'p1', payload: 'Zphone1', modified: 2000 },
    ])

    const ids = merged.items.map((one) => one.id).sort()
    expect(ids).toEqual(['d1', 'd2', 'p1'])
  })

  /** Only what changed since last time, so a sync is not a full download. */
  it('sends only what changed since the caller last asked', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(phone, [{ kind: 'build', id: 'old', payload: 'Zold', modified: 1000 }])
    const first = await syncAs(desktop)
    expect(first.items).toHaveLength(1)

    await syncAs(phone, [{ kind: 'build', id: 'new', payload: 'Znew', modified: 5000 }])

    const second = await syncAs(desktop, [], first.now)
    expect(second.items).toHaveLength(1)
    expect(second.items[0]?.id).toBe('new')
  })

  /** Nothing changed anywhere means nothing comes back. */
  it('says nothing when there is nothing to say', async () => {
    const { phone, desktop } = await withTwoDevices()
    await syncAs(phone, [{ kind: 'build', id: 'b1', payload: 'Z1', modified: 1000 }])
    const caught = await syncAs(desktop)

    const again = await syncAs(desktop, [], caught.now)
    expect(again.items).toHaveLength(0)
  })
})

describe('when two devices disagree', () => {
  it('keeps the newer edit', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(desktop, [{ kind: 'build', id: 'b1', payload: 'Zolder', modified: 1000 }])
    await syncAs(phone, [{ kind: 'build', id: 'b1', payload: 'Znewer', modified: 2000 }])

    const got = await syncAs(desktop)
    expect(byId(got.items, 'b1')?.payload).toBe('Znewer')
  })

  /**
   * A device that has been offline sends a stale copy when it reconnects. That
   * must not undo work done since, which is the whole point of the `where` on
   * the upsert.
   */
  it('ignores a stale copy from a device that was offline', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(phone, [{ kind: 'build', id: 'b1', payload: 'Znewer', modified: 5000 }])
    await syncAs(desktop, [{ kind: 'build', id: 'b1', payload: 'Zstale', modified: 1000 }])

    const got = await syncAs(phone, [], 0)
    expect(byId(got.items, 'b1')?.payload).toBe('Znewer')
  })

  /**
   * And it is told so in the same breath.
   *
   * The loser gets the winner back in the reply to the very call that lost, so
   * a device that was behind is corrected immediately rather than carrying its
   * own version around until something else happens.
   */
  it('corrects the loser in the same exchange', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(phone, [{ kind: 'build', id: 'b1', payload: 'Znewer', modified: 5000 }])
    const answer = await syncAs(desktop, [
      { kind: 'build', id: 'b1', payload: 'Zstale', modified: 1000 },
    ])

    expect(byId(answer.items, 'b1')?.payload).toBe('Znewer')
  })

  /** Different builds edited on different devices are not a conflict at all. */
  it('keeps both when the edits are to different things', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(desktop, [{ kind: 'build', id: 'b1', payload: 'Zdesk', modified: 1000 }])
    await syncAs(phone, [{ kind: 'build', id: 'b2', payload: 'Zphone', modified: 1000 }])

    const got = await syncAs(desktop, [], 0)
    expect(got.items.map((one) => one.id).sort()).toEqual(['b1', 'b2'])
  })

  /** The same id under two kinds is two things, not one. */
  it('does not confuse a build with a run of the same id', async () => {
    const { phone } = await withTwoDevices()

    await syncAs(phone, [
      { kind: 'build', id: 'same', payload: 'Zbuild', modified: 1000 },
      { kind: 'run', id: 'same', payload: 'Zrun', modified: 1000 },
    ])

    const got = await syncAs(phone, [], 0)
    expect(got.items).toHaveLength(2)
    expect(got.items.find((one) => one.kind === 'build')?.payload).toBe('Zbuild')
    expect(got.items.find((one) => one.kind === 'run')?.payload).toBe('Zrun')
  })
})

describe('deleting', () => {
  /**
   * **The one that matters.**
   *
   * Delete on the desktop, then sync a phone that still holds its copy. If the
   * delete were stored as an absence the phone would see something the server
   * does not have and put it back, weeks later, silently. The tombstone is what
   * makes the delete a fact the phone has to accept.
   */
  it('does not let a deleted thing come back from another device', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(desktop, [{ kind: 'build', id: 'doomed', payload: 'Zbuild', modified: 1000 }])
    const caughtUp = await syncAs(phone, [], 0)
    expect(byId(caughtUp.items, 'doomed')).toBeTruthy()

    // Deleted on the desktop.
    await syncAs(desktop, [
      { kind: 'build', id: 'doomed', payload: '', modified: 3000, deleted: true },
    ])

    // The phone sends the copy it still has, which is older than the delete.
    const answer = await syncAs(phone, [
      { kind: 'build', id: 'doomed', payload: 'Zbuild', modified: 1000 },
    ])

    expect(byId(answer.items, 'doomed')?.deleted).toBe(true)

    // And it stays dead for everybody.
    const onDesktop = await syncAs(desktop, [], 0)
    expect(byId(onDesktop.items, 'doomed')?.deleted).toBe(true)
  })

  /** A delete loses to a later edit, same rule as everything else. */
  it('lets a newer edit beat an older delete', async () => {
    const { phone, desktop } = await withTwoDevices()

    await syncAs(desktop, [
      { kind: 'build', id: 'b1', payload: '', modified: 1000, deleted: true },
    ])
    await syncAs(phone, [{ kind: 'build', id: 'b1', payload: 'Zrevived', modified: 2000 }])

    const got = await syncAs(desktop, [], 0)
    expect(byId(got.items, 'b1')?.deleted).toBe(false)
    expect(byId(got.items, 'b1')?.payload).toBe('Zrevived')
  })
})

describe('what it refuses', () => {
  it('refuses an unknown kind rather than storing it', async () => {
    const { phone } = await withTwoDevices()
    const response = await post(
      '/api/sync',
      { since: 0, items: [{ kind: 'nonsense', id: 'x', payload: 'y', modified: 1 }] },
      { cookie: phone },
    )
    expect(response.status).toBe(400)
  })

  it('refuses a payload being used as free storage', async () => {
    const { phone } = await withTwoDevices()
    const response = await post(
      '/api/sync',
      {
        since: 0,
        items: [{ kind: 'build', id: 'big', payload: 'x'.repeat(17_000), modified: 1 }],
      },
      { cookie: phone },
    )
    expect(response.status).toBe(413)
  })

  /**
   * A non-finite `modified` compares false against everything, so such an item
   * would neither win nor lose and would simply stop syncing forever. Refused
   * at the door instead of stored.
   */
  it('refuses a modification time that cannot be compared', async () => {
    const { phone } = await withTwoDevices()
    for (const modified of ['soon', null, -1]) {
      const response = await post(
        '/api/sync',
        { since: 0, items: [{ kind: 'build', id: 'b', payload: 'Z', modified }] },
        { cookie: phone },
      )
      expect(response.status).toBe(400)
    }
  })

  it('refuses more than it will take in one go', async () => {
    const { phone } = await withTwoDevices()
    const items = Array.from({ length: 501 }, (_, i) => ({
      kind: 'build',
      id: `b${i}`,
      payload: 'Z',
      modified: 1000,
    }))
    const response = await post('/api/sync', { since: 0, items }, { cookie: phone })
    expect(response.status).toBe(413)
  })

  /** An empty exchange is how a device asks "anything new?", and must be fine. */
  it('accepts a call with nothing in it', async () => {
    const { phone } = await withTwoDevices()
    const got = await syncAs(phone)
    expect(got.items).toEqual([])
    expect(got.now).toBe(0)
  })
})
