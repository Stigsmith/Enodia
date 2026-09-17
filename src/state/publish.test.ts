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

/**
 * Whether a listing is on the shelves, kept on the build that owns it.
 *
 * Take it down shipped without this and it was half a feature: `putBackBuild`
 * had no caller anywhere, so a listing could be taken down and never restored,
 * and the menu offered Take it down for a build already down because nothing on
 * this side knew which state it was in.
 */
describe('knowing whether your listing is on the shelves', () => {
  it('records it when you take one down, and clears it when you put it back', async () => {
    shelve([mine({ publishedAs: 'KmUkC9VotY', publishedHash: 'abc' })])
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })))

    const { takeDownBuild, putBackBuild } = await import('./publish.ts')

    await takeDownBuild('KmUkC9VotY')
    expect(loadBuilds()[0]?.publishedDown).toBe(true)

    await putBackBuild('KmUkC9VotY')
    expect(loadBuilds()[0]?.publishedDown).toBe(false)
  })

  /* The flag can go stale without this browser doing anything: take a listing
     down on a laptop and the phone has to be told. */
  it('catches up with a takedown made somewhere else', async () => {
    shelve([mine({ publishedAs: 'KmUkC9VotY', publishedHash: 'abc' })])
    stubServer([{ id: 'KmUkC9VotY', name: 'Whatever' }], {})
    vi.mocked(fetch).mockImplementationOnce(
      async () =>
        new Response(
          JSON.stringify({
            builds: [
              {
                id: 'KmUkC9VotY',
                name: 'Whatever',
                createdAt: 0,
                revision: 0,
                updatedAt: null,
                takenDownAt: 1788600000000,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )

    await reconnect()

    expect(loadBuilds()[0]?.publishedDown).toBe(true)
  })
})

/**
 * The token that says which version a listing is.
 *
 * `republishBuild` sent one from the day the column existed and `publishBuild`
 * never did, so every listing published and never replaced was stored under an
 * empty token. The follower's browser sends its real fingerprint with each run,
 * the worker compared the two, and dropped every run as though the follower
 * were holding a version the author had moved on from.
 *
 * Nothing could see it. The counts stayed at zero and zero is what a build
 * nobody has played looks like, `stamp` wrote the correct hash locally so the
 * build itself looked right, and takes kept counting because `take` files
 * under whatever the listing says rather than comparing.
 */
describe('the shape a listing goes up as', () => {
  it('is sent when a build is published, not only when it is replaced', async () => {
    const build = mine()
    shelve([build])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'KmUkC9VotY' }), { status: 201 })),
    )

    const { publishBuild } = await import('./publish.ts')
    await publishBuild(build)

    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string) as {
      shape?: string
    }
    expect(sent.shape).toBe(fingerprint(shapeOf(build)))
  })

  /* The pair has to agree. A listing stored under one token and a local build
     stamped with another is the same bug wearing a different hat. */
  it('matches what it stamps on the build', async () => {
    const build = mine()
    shelve([build])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'KmUkC9VotY' }), { status: 201 })),
    )

    const { publishBuild } = await import('./publish.ts')
    await publishBuild(build)

    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string) as {
      shape?: string
    }
    expect(loadBuilds()[0]?.publishedHash).toBe(sent.shape)
  })
})

/**
 * The way back for a listing whose build is not in the library.
 *
 * The Mine shelf was where these showed, and it moved to your side of Builds.
 * What has to hold is that the build comes back as yours and stamped as that
 * listing, so Replace and Take it down work on it again, and that nothing
 * already here is written over on the way.
 */
describe('putting a listing of yours back in the library', () => {
  const reclaim = async (id: string) => (await import('./publish.ts')).reclaimListing(id)

  it('writes the published version as yours, stamped as the listing', async () => {
    const published = mine({ id: 'mine-gone', name: 'Gone Build' })
    shelve([])
    stubServer([], { KmUkC9VotY: await packBuild(published) })

    const outcome = await reclaim('KmUkC9VotY')

    expect(outcome.ok).toBe(true)
    const back = loadBuilds()[0]!
    expect(back).toMatchObject({ id: 'mine-gone', by: 'owner', publishedAs: 'KmUkC9VotY', publishedDown: false })
    expect(back.publishedHash).toBe(fingerprint(shapeOf(published)))
  })

  it('remembers that the listing is off the shelves', async () => {
    shelve([])
    const payload = await packBuild(mine({ id: 'mine-gone' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ payload, name: 'X', revision: 0, takenDown: true }), { status: 200 }),
      ),
    )
    await reclaim('KmUkC9VotY')
    expect(loadBuilds()[0]?.publishedDown).toBe(true)
  })

  it('gives it a new id rather than writing over a build that has its old one', async () => {
    shelve([mine({ id: 'mine-gone', name: 'Something else entirely' })])
    stubServer([], { KmUkC9VotY: await packBuild(mine({ id: 'mine-gone', name: 'Gone Build' })) })

    await reclaim('KmUkC9VotY')

    const after = loadBuilds()
    expect(after).toHaveLength(2)
    expect(after.find((one) => one.id === 'mine-gone')?.name).toBe('Something else entirely')
    expect(after.find((one) => one.publishedAs === 'KmUkC9VotY')?.id).not.toBe('mine-gone')
  })

  it('refuses a listing a build here is already published as', async () => {
    shelve([mine({ publishedAs: 'KmUkC9VotY' })])
    const fetched = vi.fn()
    vi.stubGlobal('fetch', fetched)
    expect(await reclaim('KmUkC9VotY')).toMatchObject({ ok: false })
    expect(fetched).not.toHaveBeenCalled()
  })

  /* Putting the binned build back keeps whatever changed after publishing,
     and the published version is older, so the bin is the way back. */
  it('points at the bin when the build is in it', async () => {
    shelve([])
    window.localStorage.setItem(
      'enodia.bin',
      JSON.stringify({
        version: 1,
        builds: [{ ...mine({ publishedAs: 'KmUkC9VotY' }), binnedAt: '2026-09-02T00:00:00.000Z' }],
      }),
    )
    const outcome = await reclaim('KmUkC9VotY')
    expect(outcome.ok ? '' : outcome.say).toMatch(/bin/)
    expect(loadBuilds()).toHaveLength(0)
  })

  it('writes nothing when the listing cannot be read', async () => {
    shelve([])
    stubServer([], {})
    expect(await reclaim('KmUkC9VotY')).toMatchObject({ ok: false })
    expect(loadBuilds()).toHaveLength(0)
  })
})
