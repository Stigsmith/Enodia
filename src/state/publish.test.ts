/**
 * Reconnecting listings to the builds they came from.
 *
 * A listing whose local build carries no `publishedAs` is orphaned: nothing
 * offers to update it or take it down, it holds one of the account's slots, and
 * pressing Publish on the build it came from mints a second listing instead of
 * replacing the first. Everything published before that field existed is in
 * exactly that state.
 *
 * **The failure to guard against is a wrong match, not a missed one.**
 * `publishedAs` says updating this build replaces that listing, so stamping the
 * wrong build hands somebody a button that overwrites a listing with something
 * else. Skipping costs one manual republish; guessing costs somebody's build.
 * Most of what is below is about refusing to guess.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { loadBuilds } from './builds.ts'
import { fingerprint, shapeOf } from './exchange.ts'
import { packBuild } from './transfer.ts'

const KEY = 'enodia.builds'

const mine = (over: Partial<ShownBuild> = {}): ShownBuild => ({
  ...FIRST_BUILD,
  id: 'mine-one',
  by: 'owner',
  created: '2026-09-01T10:00:00.000Z',
  modified: '2026-09-01T10:00:00.000Z',
  schemaVersion: 1,
  ...over,
})

const shelve = (builds: ShownBuild[]) =>
  window.localStorage.setItem(KEY, JSON.stringify({ version: 1, builds }))

/**
 * `reconnectPublished` runs once per page by design, so each test needs a fresh
 * module. Without this the second test in the file silently does nothing.
 */
async function reconnect() {
  vi.resetModules()
  const fresh = await import('./publish.ts')
  return fresh.reconnectPublished()
}

/** The listing index, then a payload per listing. */
function stubServer(listings: { id: string; name: string }[], payloads: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/builds') {
        return new Response(
          JSON.stringify({
            builds: listings.map((one) => ({
              ...one,
              createdAt: 0,
              revision: 0,
              updatedAt: null,
              takenDownAt: null,
            })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      const id = path.replace('/api/b/', '')
      if (!payloads[id]) return new Response('{}', { status: 404 })
      return new Response(JSON.stringify({ payload: payloads[id], name: '', revision: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('reconnecting a listing published before the stamp existed', () => {
  it('stamps the build whose picks the listing holds', async () => {
    const build = mine()
    shelve([build])
    stubServer([{ id: 'KmUkC9VotY', name: build.name }], {
      KmUkC9VotY: await packBuild(build),
    })

    expect(await reconnect()).toBe(1)

    const after = loadBuilds()[0]!
    expect(after.publishedAs).toBe('KmUkC9VotY')
    expect(after.publishedHash).toBe(fingerprint(shapeOf(build)))
  })

  it('leaves a build whose picks do not match the listing alone', async () => {
    const build = mine()
    const listed = { ...build, boons: ['ZeusWeaponBoon'] }
    shelve([build])
    stubServer([{ id: 'KmUkC9VotY', name: build.name }], {
      KmUkC9VotY: await packBuild(listed),
    })

    expect(await reconnect()).toBe(0)
    expect(loadBuilds()[0]?.publishedAs).toBeUndefined()
  })

  /**
   * The one that matters. Two builds with the same picks is an ordinary thing
   * to have: a duplicate, or a fork you kept. Neither is more the published one
   * than the other, and stamping either would be a coin toss.
   */
  it('refuses to guess between two builds with the same picks', async () => {
    const build = mine()
    shelve([build, mine({ id: 'mine-two', name: 'A different name' })])
    stubServer([{ id: 'KmUkC9VotY', name: 'Neither of those' }], {
      KmUkC9VotY: await packBuild(build),
    })

    expect(await reconnect()).toBe(0)
    expect(loadBuilds().every((one) => !one.publishedAs)).toBe(true)
  })

  it('settles that tie when exactly one of them has the listing’s name', async () => {
    const build = mine({ name: 'Riposte, Rinse, Repeat..' })
    shelve([build, mine({ id: 'mine-two', name: 'Something else' })])
    stubServer([{ id: 'KmUkC9VotY', name: 'Riposte, Rinse, Repeat..' }], {
      KmUkC9VotY: await packBuild(build),
    })

    expect(await reconnect()).toBe(1)
    expect(loadBuilds().find((one) => one.id === 'mine-one')?.publishedAs).toBe('KmUkC9VotY')
    expect(loadBuilds().find((one) => one.id === 'mine-two')?.publishedAs).toBeUndefined()
  })

  /* A build you follow is somebody else's. Stamping it would claim their
     listing as yours to replace. */
  it('never stamps a build you follow', async () => {
    const build = mine({ by: 'community', derivedFrom: 'KmUkC9VotY' })
    shelve([build])
    stubServer([{ id: 'KmUkC9VotY', name: build.name }], {
      KmUkC9VotY: await packBuild(build),
    })

    expect(await reconnect()).toBe(0)
    expect(loadBuilds()[0]?.publishedAs).toBeUndefined()
  })

  it('leaves a listing alone once something already claims it', async () => {
    const build = mine({ publishedAs: 'KmUkC9VotY', publishedHash: 'whatever' })
    shelve([build])
    stubServer([{ id: 'KmUkC9VotY', name: build.name }], {})

    expect(await reconnect()).toBe(0)
    // Not re-fetched either: a claimed listing costs nothing to skip.
    expect(loadBuilds()[0]?.publishedHash).toBe('whatever')
  })

  it('asks for nothing when the account has published nothing', async () => {
    shelve([mine()])
    stubServer([], {})

    expect(await reconnect()).toBe(0)
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1)
  })
})
