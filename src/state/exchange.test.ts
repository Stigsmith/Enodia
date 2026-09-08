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
  acceptOffer,
  fingerprint,
  followBuild,
  listShelf,
  refreshFollowed,
  republishChangesTheBuild,
  rateBuild,
  reportRun,
  reportsTo,
  shapeOf,
  takeBuild,
} from './exchange.ts'
import { packBuild } from './transfer.ts'
import { DEFAULT_PREFS, loadPrefs, savePrefs } from './prefs.ts'
import { duplicateBuild, loadBuilds, saveBuild } from './builds.ts'
import { declineOffer, loadOffers } from './offers.ts'
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
    // The shape goes with it, so the server can file the run under the version
    // it was played against rather than whatever the build is now. Asserted
    // exactly rather than loosened: this is the whole request.
    expect(report?.body).toEqual({
      cleared: true,
      fear: 20,
      shape: fingerprint(shapeOf(BUILD)),
    })
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
    return (await listShelf('all'))[0]
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

  /**
   * The counts an earlier version of the build earned.
   *
   * Beside `stats` on the wire, not inside it. This was declared inside `Stats`
   * first and `shelfAt` dropped it exactly the way it dropped `mine`, which is
   * the second time one field has been lost between the response and the screen
   * for want of a line here. Hence a test for the carrying rather than for the
   * arithmetic, which the worker suite already covers.
   */
  it('carries what earlier versions earned, which the worker sends beside the counts', async () => {
    const before = { takes: 1, runs: 6, clears: 4, bestFear: 42, rating: 5, raters: 1 }
    const row = await shelfOf({ before })
    expect(row?.before).toEqual(before)
  })

  it('leaves that absent for a build nobody has changed', async () => {
    const row = await shelfOf({})
    expect(row && 'before' in row).toBe(false)
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

/**
 * A run says which version of the build it was against.
 *
 * `reportsTo` only proves the picks matched the author's as of the last
 * refresh. The author can have replaced them since, and without the token the
 * server would file the run under whatever the build is now: a run against a
 * build nobody played, counted as evidence about it.
 */
describe('what a reported run tells the server', () => {
  it('sends the shape it was played against', async () => {
    const taken = duplicateBuild(BUILD, undefined, { id: 'KmUkC9VotY', hash: fingerprint(shapeOf(BUILD)) }).copy
    const seen = stubFetch(() => ({ body: { ok: true } }))

    await reportRun(taken, true, 30)

    expect(seen).toHaveLength(1)
    expect((seen[0]?.body as { shape?: string }).shape).toBe(fingerprint(shapeOf(BUILD)))
  })
})

/**
 * What reaches you when a build you follow changes.
 *
 * Following used to mean the author's version simply became yours: the refresh
 * compared a revision number and overwrote the record. So an author replacing a
 * good build with a worse one replaced yours too, silently, with nothing to go
 * back to. That is the failure the owner described.
 *
 * The line is `shapeOf`. Words apply, picks wait.
 */
describe('an author changing a build you follow', () => {
  /** Follow BUILD, then answer the next fetch with whatever the author did. */
  const following = async () => {
    const payload = await packBuild(BUILD)
    stubFetch(() => ({ body: { payload, name: BUILD.name, revision: 1 } }))
    const outcome = await followBuild('KmUkC9VotY')
    expect(outcome.ok).toBe(true)
    vi.unstubAllGlobals()
    return loadBuilds().find((one) => one.by === 'community')!
  }

  it('applies a change to the words on its own', async () => {
    const held = await following()
    const payload = await packBuild({ ...BUILD, say: 'Rewritten advice.' })
    stubFetch(() => ({ body: { payload, name: 'A better name', revision: 2 } }))

    const out = await refreshFollowed()

    expect(out.moved).toBe(1)
    expect(out.offered).toBe(0)
    const after = loadBuilds().find((one) => one.id === held.id)!
    expect(after.name).toBe('A better name')
    expect(after.say).toBe('Rewritten advice.')
    expect(loadOffers()[held.id]).toBeUndefined()
  })

  it('offers a change to the picks, and does not apply it', async () => {
    const held = await following()
    const payload = await packBuild({ ...BUILD, boons: ['ZeusWeaponBoon'] })
    stubFetch(() => ({ body: { payload, name: BUILD.name, revision: 2 } }))

    const out = await refreshFollowed()

    expect(out.offered).toBe(1)
    expect(out.moved).toBe(0)
    // The build in the library is untouched. This is the whole point.
    const after = loadBuilds().find((one) => one.id === held.id)!
    expect(after.boons).toEqual(BUILD.boons)
    expect(after.derivedRevision).toBe(1)
    expect(loadOffers()[held.id]?.kind).toBe('changed')
  })

  it('takes the offer when it is accepted, and keeps your play record', async () => {
    const held = await following()
    saveBuild({ ...held, play: { runs: 4, clears: 2 } })
    const payload = await packBuild({ ...BUILD, boons: ['ZeusWeaponBoon'] })
    stubFetch(() => ({ body: { payload, name: BUILD.name, revision: 2 } }))
    await refreshFollowed()

    const outcome = await acceptOffer(loadBuilds().find((one) => one.id === held.id)!)

    expect(outcome.ok).toBe(true)
    const after = loadBuilds().find((one) => one.id === held.id)!
    expect(after.boons).toEqual(['ZeusWeaponBoon'])
    expect(after.play?.runs).toBe(4)
    expect(loadOffers()[held.id]).toBeUndefined()
  })

  it('asks once when it is declined, and again only if the author moves again', async () => {
    const held = await following()
    const changed = await packBuild({ ...BUILD, boons: ['ZeusWeaponBoon'] })
    stubFetch(() => ({ body: { payload: changed, name: BUILD.name, revision: 2 } }))
    await refreshFollowed()

    declineOffer(held.id)
    vi.unstubAllGlobals()
    stubFetch(() => ({ body: { payload: changed, name: BUILD.name, revision: 2 } }))
    expect((await refreshFollowed()).offered).toBe(0)

    // The author edits again. Saying no once is not saying no forever.
    vi.unstubAllGlobals()
    const again = await packBuild({ ...BUILD, boons: ['HeraWeaponBoon'] })
    stubFetch(() => ({ body: { payload: again, name: BUILD.name, revision: 3 } }))
    expect((await refreshFollowed()).offered).toBe(1)
  })

  it('records a takedown, and leaves the build in the library', async () => {
    const held = await following()
    const payload = await packBuild(BUILD)
    stubFetch(() => ({ body: { payload, name: BUILD.name, revision: 2, takenDown: true } }))

    const out = await refreshFollowed()

    expect(out.down).toBe(1)
    expect(loadBuilds().find((one) => one.id === held.id)).toBeDefined()
    expect(loadOffers()[held.id]?.kind).toBe('takenDown')
  })

  it('changes nothing when the server cannot be reached', async () => {
    const held = await following()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const out = await refreshFollowed()

    expect(out).toEqual({ moved: 0, offered: 0, down: 0 })
    expect(loadBuilds().find((one) => one.id === held.id)?.derivedRevision).toBe(1)
  })
})

/**
 * Whether replacing a listing replaces the build or only its write-up.
 *
 * The author is warned before the first, because it starts the listing's counts
 * again and asks everybody following it. The screen and the request read this
 * same function, so a dialog cannot warn on one rule while the server applies
 * another.
 */
describe('what republishing would do', () => {
  const published = (over: Partial<ShownBuild> = {}): ShownBuild => ({
    ...BUILD,
    publishedAs: 'KmUkC9VotY',
    publishedHash: fingerprint(shapeOf(BUILD)),
    ...over,
  })

  it('says no for a rewritten note or a new name', () => {
    expect(republishChangesTheBuild(published({ say: 'Different words.', name: 'New name' }))).toBe(
      false,
    )
  })

  it('says yes for a changed pick', () => {
    expect(republishChangesTheBuild(published({ boons: ['ZeusWeaponBoon'] }))).toBe(true)
  })

  it('says no for a build that was never published', () => {
    expect(republishChangesTheBuild(BUILD)).toBe(false)
  })

  /* Published before the shape was recorded. Nothing to compare, so nothing to
     claim: warning on a guess would be worse than not warning. */
  it('says no when there is no recorded shape to compare against', () => {
    expect(republishChangesTheBuild({ ...BUILD, publishedAs: 'KmUkC9VotY' })).toBe(false)
  })
})

/**
 * What following tells the server, and what it refuses.
 *
 * Following replaced taking a copy, and when it did, nothing was left that
 * writes `taken_at`: `takeBuild` lost its last caller and the count on every
 * listing froze at whatever the copy era had left in it. A number on screen
 * that can never move again is worse than no number, because it reads as
 * current.
 *
 * The `take` route is the right one to reuse rather than a new endpoint: it
 * already refuses your own build, refuses one that has been taken down, and
 * counts a second press as the same relationship rather than a second person.
 */
describe('what following reports', () => {
  const answer = (payload: string, over: Record<string, unknown> = {}) => ({
    body: { payload, name: BUILD.name, revision: 1, takenDown: false, ...over },
  })

  it('tells the server, so the count on the listing can move again', async () => {
    const payload = await packBuild(BUILD)
    const seen = stubFetch((path) => (path.endsWith('/take') ? { body: {} } : answer(payload)))

    const outcome = await followBuild('KmUkC9VotY')

    expect(outcome.ok).toBe(true)
    expect(seen.map((call) => call.path)).toContain('/api/exchange/KmUkC9VotY/take')
  })

  it('follows anyway when the report fails, because the follow is local', async () => {
    const payload = await packBuild(BUILD)
    stubFetch((path) => (path.endsWith('/take') ? { status: 500 } : answer(payload)))

    const outcome = await followBuild('KmUkC9VotY')

    // The build is in the library either way. A count is not worth failing a
    // thing the person asked for.
    expect(outcome.ok).toBe(true)
    expect(loadBuilds().some((one) => one.derivedFrom === 'KmUkC9VotY')).toBe(true)
  })

  /**
   * A build off the shelves keeps working for people who already follow it and
   * takes no new followers. `take` says the same on the server; this is the
   * raw-link path, which never reaches it.
   */
  it('refuses to start following one the author has taken down', async () => {
    const payload = await packBuild(BUILD)
    stubFetch(() => answer(payload, { takenDown: true }))

    const outcome = await followBuild('KmUkC9VotY')

    expect(outcome.ok).toBe(false)
    expect(loadBuilds()).toHaveLength(0)
  })
})
