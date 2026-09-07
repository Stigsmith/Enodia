/**
 * The browser half of the exchange: taking a copy, and reporting runs back.
 *
 * `worker/exchange.test.ts` covers the counting. This covers the one decision
 * the browser owns and the server cannot check: **is this copy still the build
 * it came from**. Get that wrong in either direction and the shelf's numbers
 * stop meaning anything. Too strict and a build nobody has edited reports
 * nothing, so the counts stay at zero and look like a dead shelf. Too loose and
 * a gutted copy's runs are counted toward somebody else's build.
 *
 * The first of those is what actually shipped, and it is the reason this file
 * exists: `derivedHash` was a hash of the *packed payload*, and `duplicateBuild`
 * rewrites the id, the name, the author and three timestamps on the way past. So
 * the two could never match and `reportRun` returned false every time, silently,
 * on a path with no visible result. Nothing about it was a type error.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fingerprint,
  followBuild,
  listShelf,
  rateBuild,
  reportRun,
  reportsTo,
  shapeOf,
  takeBuild,
} from './exchange.ts'
import { packBuild } from './transfer.ts'
import { DEFAULT_PREFS, loadPrefs, savePrefs } from './prefs.ts'
import { duplicateBuild, loadBuilds } from './builds.ts'
import type { ShownBuild } from '../data/builds.ts'

const BUILD: ShownBuild = {
  id: 'theirs',
  name: 'Killer Current',
  say: 'Zeus, and everything feeding it',
  how: 'Storm Ring on, and stay in things.',
  by: 'owner',
  weapon: 'WeaponAxe',
  aspect: 'AxeAspectCharon',
  centrepiece: 'ZeusWeaponBoon',
  boons: ['ZeusWeaponBoon', 'ZeusSpecialBoon'],
  hex: null,
  hammers: [],
  keepsake: null,
  familiar: null,
  arcana: ['Death', 'Strength'],
  author: 'Somebody',
  created: '2026-08-01T10:00:00.000Z',
  modified: '2026-08-02T10:00:00.000Z',
}

/** One canned response, and the calls it saw, for a test to read back. */
function stubFetch(reply: (path: string) => { status?: number; body?: unknown }) {
  const seen: { path: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      seen.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const { status = 200, body = {} } = reply(path)
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
  return seen
}

beforeEach(() => {
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('what a fingerprint is taken of', () => {
  it('is the picks, so renaming a copy does not stop it reporting', async () => {
    const renamed = { ...BUILD, name: 'Killer Current copy' }
    expect(shapeOf(renamed)).toBe(shapeOf(BUILD))
  })

  it('ignores who wrote it and when, which a copy always changes', async () => {
    const forked = { ...BUILD, id: 'mine', author: 'Me', created: 'later', modified: 'later' }
    expect(shapeOf(forked)).toBe(shapeOf(BUILD))
  })

  it('ignores the play record, which is what logging a run writes', () => {
    expect(shapeOf({ ...BUILD, play: { runs: 3, clears: 1 } })).toBe(shapeOf(BUILD))
  })

  it('moves when a boon is swapped, which is the whole point', () => {
    expect(shapeOf({ ...BUILD, boons: ['ZeusWeaponBoon', 'HestiaSpecialBoon'] })).not.toBe(
      shapeOf(BUILD),
    )
  })

  it('moves when the order of the boons changes, because the order is the build', () => {
    expect(shapeOf({ ...BUILD, boons: ['ZeusSpecialBoon', 'ZeusWeaponBoon'] })).not.toBe(
      shapeOf(BUILD),
    )
  })

  /**
   * Worth adding is a ranked wishlist, and re-ranking is advice rather than a
   * change to the build. A copy whose owner reorders their preferences has to
   * keep reporting its runs; one that adds or drops a pick has not.
   */
  it('ignores the order of Worth adding, but not its members', () => {
    const one = { ...BUILD, optional: ['A', 'B', 'C'] }
    expect(shapeOf({ ...one, optional: ['C', 'A', 'B'] })).toBe(shapeOf(one))
    expect(shapeOf({ ...one, optional: ['A', 'B'] })).not.toBe(shapeOf(one))
    expect(shapeOf({ ...one, optional: ['A', 'B', 'C', 'D'] })).not.toBe(shapeOf(one))
  })

  it('still cares about the order of the boons, which is the build', () => {
    const one = { ...BUILD, boons: ['A', 'B', 'C'] }
    expect(shapeOf({ ...one, boons: ['C', 'A', 'B'] })).not.toBe(shapeOf(one))
  })

  it('separates the fields, so two picks cannot swap and read the same', () => {
    const a = { ...BUILD, boons: ['AB'], optional: ['C'] }
    const b = { ...BUILD, boons: ['A'], optional: ['BC'] }
    expect(shapeOf(a)).not.toBe(shapeOf(b))
  })
})

describe('taking a copy and reporting a run against it', () => {
  /**
   * The whole loop, end to end, and the test that would have caught the bug.
   *
   * Take a build, log a run against the copy, and the run reaches the original.
   * Every step is real except the network: `takeBuild` unpacks a payload this
   * test packed, and `reportRun` re-derives the shape from the copy that
   * `duplicateBuild` actually produced.
   */
  it('reports the run to the build the copy came from', async () => {
    const payload = await packBuild(BUILD)
    const seen = stubFetch((path) =>
      path.endsWith('/take') ? { body: { payload } } : { body: { ok: true } },
    )

    const taken = await takeBuild('pub1')
    expect(taken.ok).toBe(true)
    if (!taken.ok) return

    // A fork is a build of yours: new id, your name, and no runs on it yet.
    expect(taken.build.id).not.toBe(BUILD.id)
    expect(taken.build.derivedFrom).toBe('pub1')

    const sent = await reportRun(taken.build, true, 20)
    expect(sent).toBe(true)

    const report = seen.find((call) => call.path.endsWith('/played'))
    expect(report?.path).toBe('/api/exchange/pub1/played')
    expect(report?.body).toEqual({ cleared: true, fear: 20 })
  })

  it('keeps reporting after the copy is renamed, because a name is not a build', async () => {
    const payload = await packBuild(BUILD)
    stubFetch((path) => (path.endsWith('/take') ? { body: { payload } } : { body: { ok: true } }))

    const taken = await takeBuild('pub1')
    if (!taken.ok) return
    expect(await reportRun({ ...taken.build, name: 'My version' }, false, null)).toBe(true)
  })

  it('stops reporting once a boon is swapped out', async () => {
    const payload = await packBuild(BUILD)
    const seen = stubFetch((path) =>
      path.endsWith('/take') ? { body: { payload } } : { body: { ok: true } },
    )

    const taken = await takeBuild('pub1')
    if (!taken.ok) return

    const edited = { ...taken.build, boons: ['ApolloWeaponBoon'] }
    expect(await reportRun(edited, true, 30)).toBe(false)
    expect(seen.some((call) => call.path.endsWith('/played'))).toBe(false)
  })

  it('reports nothing for a build that came from nowhere', async () => {
    const seen = stubFetch(() => ({ body: { ok: true } }))
    expect(await reportRun(BUILD, true, 10)).toBe(false)
    expect(seen).toEqual([])
  })

  /**
   * A fork of your own build carries `derivedFrom` and no `derivedHash`, which
   * is the pair that means "this came from somewhere local". It must not report:
   * `derivedFrom` there is another build's own id, not a published one.
   */
  it('reports nothing for a local fork, which has no hash', async () => {
    const seen = stubFetch(() => ({ body: { ok: true } }))
    expect(await reportRun({ ...BUILD, derivedFrom: 'some-local-build' }, true, 10)).toBe(false)
    expect(seen).toEqual([])
  })

  it('says it did not send when the server refuses', async () => {
    const payload = await packBuild(BUILD)
    stubFetch((path) =>
      path.endsWith('/take') ? { body: { payload } } : { status: 401, body: { error: 'no' } },
    )
    const taken = await takeBuild('pub1')
    if (!taken.ok) return
    expect(await reportRun(taken.build, true, null)).toBe(false)
  })
})

/**
 * `reportsTo` is what the screen asks, so it has to agree with what is sent.
 *
 * `LogRun` tells somebody their stars will count toward the build they took.
 * The first version of that hint read `derivedFrom` and `derivedHash` directly,
 * and so it went on promising a report after the copy had been edited, which
 * the hash check then refused. These are written so the promise and the send
 * are the same answer: every case checks both.
 */
describe('what the screen is allowed to promise', () => {
  const both = async (build: ShownBuild) => ({
    promises: reportsTo(build) !== null,
    sends: await reportRun(build, true, null),
  })

  const taken = async () => {
    const payload = await packBuild(BUILD)
    stubFetch((path) => (path.endsWith('/take') ? { body: { payload } } : { body: { ok: true } }))
    const outcome = await takeBuild('pub1')
    if (!outcome.ok) throw new Error('take failed')
    return outcome.build
  }

  it('promises and sends for an untouched copy', async () => {
    expect(await both(await taken())).toEqual({ promises: true, sends: true })
  })

  it('promises neither once the copy has been edited', async () => {
    const copy = await taken()
    expect(await both({ ...copy, aspect: 'StaffClearCastAspect' })).toEqual({
      promises: false,
      sends: false,
    })
  })

  it('promises neither while the switch is off', async () => {
    const copy = await taken()
    window.localStorage.setItem(
      'enodia.prefs',
      JSON.stringify({ ...DEFAULT_PREFS, reportRuns: false }),
    )
    expect(await both(copy)).toEqual({ promises: false, sends: false })
  })

  it('promises neither for a build of your own', async () => {
    expect(await both(BUILD)).toEqual({ promises: false, sends: false })
  })

  it('names the published build rather than the copy', async () => {
    const copy = await taken()
    expect(reportsTo(copy)).toBe('pub1')
    expect(reportsTo(copy)).not.toBe(copy.id)
  })
})

/**
 * The switch, checked at the one place that sends rather than at the callers.
 *
 * A privacy switch honoured by whoever remembers to check it is a switch the
 * second caller forgets, so these are written against `reportRun` and
 * `rateBuild` themselves. If a third path to `/played` ever appears, the way to
 * make these pass is to route it through here.
 */
describe('the off switch', () => {
  const setSwitch = (on: boolean) =>
    window.localStorage.setItem(
      'enodia.prefs',
      JSON.stringify({ ...DEFAULT_PREFS, reportRuns: on }),
    )

  it('is on for an install that has never seen the setting', () => {
    window.localStorage.setItem(
      'enodia.prefs',
      // What was stored before the switch existed: every other field, not this one.
      JSON.stringify({ version: 1, staleAfterHours: 3, buildDetail: 'poster', graspLimit: 10 }),
    )
    expect(loadPrefs().reportRuns).toBe(true)
  })

  it('stays off once it is explicitly off, rather than defaulting back on', () => {
    setSwitch(false)
    expect(loadPrefs().reportRuns).toBe(false)
  })

  it('sends nothing at all when it is off', async () => {
    const payload = await packBuild(BUILD)
    const seen = stubFetch((path) =>
      path.endsWith('/take') ? { body: { payload } } : { body: { ok: true } },
    )
    const taken = await takeBuild('pub1')
    if (!taken.ok) return

    setSwitch(false)
    expect(await reportRun(taken.build, true, 20)).toBe(false)
    expect(seen.some((call) => call.path.endsWith('/played'))).toBe(false)
  })

  it('refuses a rating in words, rather than letting the server say no', async () => {
    setSwitch(false)
    const seen = stubFetch(() => ({ body: { ok: true } }))
    const outcome = await rateBuild('pub1', 4)
    expect(outcome.ok).toBe(false)
    expect(seen).toEqual([])
  })
})

describe('rating', () => {
  it('posts the rating to the build the copy came from', async () => {
    const seen = stubFetch(() => ({ body: { ok: true } }))
    expect(await rateBuild('pub1', 4)).toEqual({ ok: true })
    expect(seen[0]?.path).toBe('/api/exchange/pub1/rate')
    expect(seen[0]?.body).toEqual({ rating: 4 })
  })

  it('carries the refusal back rather than inventing one', async () => {
    stubFetch(() => ({ status: 409, body: { error: 'Log a run against this build first.' } }))
    expect(await rateBuild('pub1', 4)).toEqual({
      ok: false,
      say: 'Log a run against this build first.',
    })
  })
})

describe('the hash itself', () => {
  it('is stable for the same input', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'))
  })

  it('differs for a one character change', () => {
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'))
  })
})

/**
 * Duplicating a build that was itself taken off the exchange.
 *
 * **This promised a report it could not deliver.** `duplicateBuild` overwrote
 * `derivedFrom` always and `derivedHash` only when handed an `origin`, so a
 * plain Duplicate in the build manager left the published hash behind through
 * the spread while `derivedFrom` became a local `mine-<uuid>`. Duplicating
 * changes no picks, so the hash still matched and `reportsTo` handed back a
 * local build id. `LogRun` showed "your stars count toward it there" and posted
 * to `/api/exchange/mine-<uuid>/played`, which does not match the route's id
 * pattern and 404s.
 *
 * Watched failing before the fix: it returned the local id rather than null.
 */
describe('a fork of a build you took', () => {
  it('reports to nothing, rather than to a local id', () => {
    window.localStorage.clear()
    savePrefs({ ...loadPrefs(), reportRuns: true })

    // Take one off the exchange the way `takeBuild` does.
    const { copy: taken } = duplicateBuild(BUILD, '2026-09-06T00:00:00.000Z', {
      id: 'pub1',
      hash: fingerprint(shapeOf(BUILD)),
    })
    expect(reportsTo(taken)).toBe('pub1')

    // Then duplicate it in the build manager, which passes no origin.
    const { copy: fork } = duplicateBuild(taken, '2026-09-06T00:00:00.000Z')
    expect(fork.derivedFrom).toBe(taken.id)
    expect(fork.derivedHash).toBeUndefined()
    expect(reportsTo(fork)).toBeNull()
  })
})

/**
 * Whether a listing is one of yours, and the fact that the answer never arrived.
 *
 * `Listed` has declared `mine?: boolean` since the author checks went in, the
 * worker has computed it since then too, and `Relation` in `Exchange.tsx` has
 * had a branch for it that says "This one is yours". None of that ever ran:
 * `Wire` did not declare the field and `shelfAt` built its object field by
 * field without copying it, so the value was dropped between the response and
 * the screen. Every listing offered Follow, including your own, and following
 * your own wrote a second copy of it into your library marked as somebody
 * else's. The owner found that by using it.
 *
 * **Absent is a third state and must survive as one.** The worker omits `mine`
 * entirely when nobody is signed in, because "not yours" and "we do not know
 * whose this is" are different answers and a screen that collapses them would
 * offer Follow to a signed-out reader as though it had checked.
 */
describe('whether a listing is one of yours', () => {
  const shelfOf = async (extra: Record<string, unknown>) => {
    const payload = await packBuild(BUILD)
    stubFetch(() => ({
      body: {
        builds: [
          {
            id: 'KmUkC9VotY',
            name: 'Killer Current',
            payload,
            by: 'Tester',
            createdAt: 1788521975798,
            stats: {
              takes: 0,
              players: 0,
              runs: 0,
              clears: 0,
              bestFear: null,
              rating: null,
              raters: 0,
            },
            ...extra,
          },
        ],
      },
    }))
    return (await listShelf('picked'))[0]
  }

  it('carries a true through from the worker', async () => {
    expect((await shelfOf({ mine: true }))?.mine).toBe(true)
  })

  it('carries a false through, which is not the same as saying nothing', async () => {
    expect((await shelfOf({ mine: false }))?.mine).toBe(false)
  })

  it('leaves it absent when the worker said nothing, rather than inventing a false', async () => {
    const row = await shelfOf({})
    expect(row).toBeDefined()
    expect(row && 'mine' in row).toBe(false)
  })
})

/**
 * You cannot follow your own build.
 *
 * The shelf covers this now that `mine` reaches it, but the shelf is not the
 * only door: `/api/b/:id` takes no session, so a raw link to your own listing
 * would hand it straight back to you and following it would put a second copy
 * of your own build in your library, marked as somebody else's.
 *
 * The check has to be local, because the server genuinely does not know who is
 * asking on that route. `publishedAs` is what makes it possible at all.
 */
describe('following a build of your own', () => {
  it('refuses, rather than making a second copy of it', async () => {
    window.localStorage.setItem(
      'enodia.builds',
      JSON.stringify({
        version: 1,
        builds: [{ ...BUILD, id: 'mine-original', publishedAs: 'KmUkC9VotY' }],
      }),
    )
    const seen = stubFetch(() => ({ body: {} }))

    const outcome = await followBuild('KmUkC9VotY')

    expect(outcome.ok).toBe(false)
    expect(seen).toHaveLength(0)
    expect(JSON.parse(window.localStorage.getItem('enodia.builds') ?? '{}').builds).toHaveLength(1)
  })

  it('still follows somebody else\u2019s', async () => {
    const payload = await packBuild(BUILD)
    window.localStorage.setItem(
      'enodia.builds',
      JSON.stringify({
        version: 1,
        builds: [{ ...BUILD, id: 'mine-original', publishedAs: 'SomethingElse' }],
      }),
    )
    stubFetch(() => ({ body: { payload, name: 'Killer Current', revision: 0 } }))

    const outcome = await followBuild('KmUkC9VotY')

    expect(outcome.ok).toBe(true)
    expect(loadBuilds()).toHaveLength(2)
  })
})
