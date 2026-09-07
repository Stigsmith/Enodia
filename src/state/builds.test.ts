/**
 * Saved builds: identity, migration, and the record of how one has played.
 *
 * `DESIGN.md` 11: a green build proves nothing, because Vite does not check
 * that a component receives the prop it uses. These are the checks that do.
 *
 * **`migrateBuilds` is pure, so most of this runs in Node.** The one thing that
 * genuinely needs a browser is the round trip through localStorage, and that is
 * the last block, behind the jsdom docblock `vite.config.ts` documents.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { winRate } from '../data/builds.ts'
import { blockers, checkBuild } from '../engine/build-check.ts'
import { BUILD_SCHEMA, deleteBuild, duplicateBuild, emptyBin, loadBin, loadBuilds, migrateBuilds, newBuildId, restoreBuild, saveBuild } from './builds.ts'

const KEY = 'enodia.builds'

/** A build as it was stored before any of this existed: no identity fields. */
const oldShape = (over: Partial<ShownBuild> = {}): ShownBuild => ({
  id: 'mine-before-this-work',
  name: 'Written last week',
  say: 'One line.',
  how: 'A paragraph.',
  by: 'owner',
  weapon: FIRST_BUILD.weapon,
  aspect: FIRST_BUILD.aspect,
  centrepiece: FIRST_BUILD.centrepiece,
  boons: [...FIRST_BUILD.boons],
  hex: FIRST_BUILD.hex,
  hammers: [...FIRST_BUILD.hammers],
  keepsake: FIRST_BUILD.keepsake,
  familiar: FIRST_BUILD.familiar,
  arcana: [...FIRST_BUILD.arcana],
  ...over,
})

const store = (builds: ShownBuild[]) => JSON.stringify({ version: 1, builds })

beforeEach(() => {
  window.localStorage.clear()
})

describe('the migration', () => {
  it('leaves no build missing an id, created, modified or schemaVersion', () => {
    const { builds, migrated } = migrateBuilds(
      { version: 1, builds: [oldShape(), oldShape({ id: 'mine-two' })] },
      '2026-08-31T00:00:00.000Z',
    )

    const missing = builds.filter(
      (one) => !one.id || !one.created || !one.modified || typeof one.schemaVersion !== 'number',
    )
    expect(missing).toHaveLength(0)
    expect(migrated).toBe(2)
    for (const one of builds) expect(one.schemaVersion).toBe(BUILD_SCHEMA)
  })

  it('reports nothing migrated when every build already has the four', () => {
    const done = migrateBuilds({ version: 1, builds: [oldShape()] }, 'now').builds
    expect(migrateBuilds({ version: 1, builds: done }, 'later').migrated).toBe(0)
  })

  it('keeps an id it was given rather than minting a new one', () => {
    // The whole point of the id: a build already sent to another install has to
    // keep the identity that install knows it by.
    const { builds } = migrateBuilds({ version: 1, builds: [oldShape({ id: 'mine-keep-me' })] }, 'now')
    expect(builds[0]?.id).toBe('mine-keep-me')
  })

  it('sets modified to created when there is nothing better to say', () => {
    const { builds } = migrateBuilds({ version: 1, builds: [oldShape()] }, 'now')
    expect(builds[0]?.created).toBe('now')
    expect(builds[0]?.modified).toBe('now')
  })

  it('does not invent a play record', () => {
    const { builds } = migrateBuilds({ version: 1, builds: [oldShape()] }, 'now')
    expect(builds[0]?.play).toBeUndefined()
  })

  it('loses no field a build already carried', () => {
    const before = oldShape({ optional: ['SomeBoon'], derivedFrom: 'mine-parent' })
    const after = migrateBuilds({ version: 1, builds: [before] }, 'now').builds[0]
    for (const key of Object.keys(before) as (keyof ShownBuild)[]) {
      expect(after?.[key]).toEqual(before[key])
    }
  })

  it('yields nothing from an envelope it did not write', () => {
    expect(migrateBuilds({ version: 99, builds: [oldShape()] }).builds).toEqual([])
    expect(migrateBuilds(null).builds).toEqual([])
    expect(migrateBuilds('nonsense').builds).toEqual([])
  })
})

describe('ids', () => {
  it('does not repeat itself', () => {
    // Several installs across two people mint ids with nothing arbitrating
    // between them, so the only defence is that a collision is not reachable.
    const seen = new Set(Array.from({ length: 2000 }, newBuildId))
    expect(seen.size).toBe(2000)
  })

  it('keeps the prefix that separates these from the samples', () => {
    expect(newBuildId().startsWith('mine-')).toBe(true)
    expect(FIRST_BUILD.id.startsWith('sample-')).toBe(true)
  })

  it('leaves no two builds in storage sharing one', () => {
    window.localStorage.setItem(KEY, store([oldShape(), oldShape({ id: 'mine-two' })]))
    const after = duplicateBuild(loadBuilds()[0]!).builds
    expect(new Set(after.map((one) => one.id)).size).toBe(after.length)
  })
})

describe('saving an edit', () => {
  it('moves modified and leaves id and created alone', () => {
    window.localStorage.setItem(KEY, store([oldShape()]))
    const first = loadBuilds()[0]!

    const edited = saveBuild({ ...first, name: 'Renamed' }, '2026-09-01T12:00:00.000Z')[0]!
    expect(edited.id).toBe(first.id)
    expect(edited.created).toBe(first.created)
    expect(edited.modified).toBe('2026-09-01T12:00:00.000Z')
    expect(edited.name).toBe('Renamed')
  })
})

describe('duplicating', () => {
  it('writes a new id and points derivedFrom at the source', () => {
    window.localStorage.setItem(KEY, store([oldShape()]))
    const source = loadBuilds()[0]!
    const { copy } = duplicateBuild(source, 'now')

    expect(copy.id).not.toBe(source.id)
    expect(copy.derivedFrom).toBe(source.id)
    expect(copy.created).toBe('now')
    expect(copy.modified).toBe('now')
  })

  it('carries no play record', () => {
    window.localStorage.setItem(KEY, store([oldShape({ play: { rating: 5, runs: 12, clears: 7 } })]))
    expect(duplicateBuild(loadBuilds()[0]!).copy.play).toBeUndefined()
  })

  it('forks a sample into an owner build, and leaves the sample alone', () => {
    // The samples were read-only dead ends. This is the change that makes one a
    // starting point rather than a thing to look at.
    const { copy } = duplicateBuild(FIRST_BUILD, 'now')
    expect(copy.by).toBe('owner')
    expect(copy.derivedFrom).toBe(FIRST_BUILD.id)
    expect(copy.boons).toEqual(FIRST_BUILD.boons)
    expect(FIRST_BUILD.by).toBe('sample')
    expect(FIRST_BUILD).not.toHaveProperty('derivedFrom')
  })

  it('does not leave two builds wearing the same name', () => {
    expect(duplicateBuild(FIRST_BUILD).copy.name).not.toBe(FIRST_BUILD.name)
  })

  it('keeps the name inside the 60 the form allows', () => {
    const long = { ...FIRST_BUILD, name: 'x'.repeat(60) }
    expect(duplicateBuild(long).copy.name.length).toBeLessThanOrEqual(60)
  })
})

describe('the win rate', () => {
  it('is nothing at all before a run is logged', () => {
    expect(winRate(undefined)).toBeNull()
    expect(winRate({})).toBeNull()
    expect(winRate({ runs: 0, clears: 0 })).toBeNull()
  })

  it('divides clears by runs', () => {
    expect(winRate({ runs: 12, clears: 7 })).toBeCloseTo(7 / 12)
  })

  it('can never exceed 1, whatever storage says', () => {
    // The editor refuses clears above runs, but storage is a text file a person
    // can edit and a build can arrive from another install. A rate over 100
    // percent has to be unreachable here rather than in the one control.
    expect(winRate({ runs: 3, clears: 99 })).toBe(1)
    expect(winRate({ runs: 3, clears: -5 })).toBe(0)
  })
})

describe('the count that reads "1 to fix"', () => {
  it('says exactly the same thing with a play record as without one', () => {
    // None of the four new fields is required, so a build with no rating must
    // report what it reported before this work existed.
    const bare = oldShape()
    const rated = oldShape({ play: { rating: 4, runs: 12, clears: 7, assembles: 'reliably' } })
    expect(checkBuild(rated)).toEqual(checkBuild(bare))
    expect(blockers(checkBuild(rated)).length).toBe(blockers(checkBuild(bare)).length)
  })

  it('still finds nothing at all to say about an unfilled build', () => {
    // `build-check.test.ts` asserts an empty array rather than merely no
    // blockers, so a new field must not add so much as a note.
    const sketch = oldShape({ boons: [], hex: null, hammers: [], arcana: [], centrepiece: '' })
    expect(checkBuild({ ...sketch, play: { rating: 3 } })).toEqual(checkBuild(sketch))
  })
})

describe('the round trip through storage', () => {
  it('survives a reload with all four fields set', () => {
    const saved = saveBuild(oldShape({ play: { rating: 4, runs: 12, clears: 7, assembles: 'reliably' } }))
    expect(saved).toHaveLength(1)

    const reloaded = loadBuilds()[0]
    expect(reloaded?.play).toEqual({ rating: 4, runs: 12, clears: 7, assembles: 'reliably' })
    expect(winRate(reloaded?.play)).toBeCloseTo(7 / 12)
  })

  it('opens a build written before this work with no field lost', () => {
    window.localStorage.setItem(KEY, store([oldShape()]))
    const loaded = loadBuilds()[0]!
    expect(loaded.name).toBe('Written last week')
    expect(loaded.boons).toEqual(FIRST_BUILD.boons)
    expect(loaded.arcana).toEqual(FIRST_BUILD.arcana)
    expect(loaded.created).toBeTruthy()
  })

  it('pays for the migration once', () => {
    window.localStorage.setItem(KEY, store([oldShape()]))
    loadBuilds()
    const written = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as { builds: ShownBuild[] }
    expect(written.builds[0]?.created).toBeTruthy()
    expect(migrateBuilds(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).migrated).toBe(0)
  })

  it('is still gone after a delete and a reload', () => {
    window.localStorage.setItem(KEY, store([oldShape(), oldShape({ id: 'mine-two' })]))
    deleteBuild('mine-two')
    expect(loadBuilds().map((one) => one.id)).toEqual(['mine-before-this-work'])
  })
})

describe('the bin', () => {
  /**
   * Deleting was the end of a build: one browser, no server, and a mis-click
   * was final. The confirm step stops the accident and not the change of mind
   * an hour later.
   */
  const build = (id: string): ShownBuild => ({ ...FIRST_BUILD, id, name: id })

  beforeEach(() => window.localStorage.clear())

  it('keeps a deleted build rather than destroying it', () => {
    saveBuild(build('keeper'))
    expect(deleteBuild('keeper')).toEqual([])

    const bin = loadBin()
    expect(bin).toHaveLength(1)
    expect(bin[0]?.id).toBe('keeper')
    expect(bin[0]?.binnedAt).toBeTruthy()
  })

  it('puts one back, and takes it out of the bin', () => {
    saveBuild(build('keeper'))
    deleteBuild('keeper')

    const back = restoreBuild('keeper')
    expect(back.builds.map((one) => one.id)).toEqual(['keeper'])
    expect(back.bin).toEqual([])
    // The bin stamp is not part of the build and does not come back with it.
    expect(back.builds[0]).not.toHaveProperty('binnedAt')
  })

  it('empties one, or all of it', () => {
    saveBuild(build('a'))
    saveBuild(build('b'))
    deleteBuild('a')
    deleteBuild('b')
    expect(loadBin()).toHaveLength(2)

    expect(emptyBin('a')).toHaveLength(1)
    expect(emptyBin()).toEqual([])
  })

  it('rides along in an export, because it is under the same prefix', () => {
    // `transfer.ts` collects every `enodia.` key, so the bin travels with
    // everything else and a restored install still has its undo.
    saveBuild(build('keeper'))
    deleteBuild('keeper')
    expect(window.localStorage.getItem('enodia.bin')).toBeTruthy()
  })
})

/**
 * A duplicate must not inherit a claim on somebody's listing.
 *
 * `publishedAs` says "this build is the one behind that listing, and updating
 * it replaces what people are following". A copy that inherited it would offer
 * exactly that, and replacing the original with a copy is not something anybody
 * asked for.
 *
 * **This is the same failure as the `derivedFrom` bug recorded above**, one
 * field along: a field that means "I am the original" travelling through a
 * spread into something that is not. Written as a test rather than trusted to
 * the docblock, because the docblock existed the last time too.
 */
describe('duplicating a build that is published', () => {
  it('carries neither the published id nor its shape', () => {
    window.localStorage.setItem(
      KEY,
      store([oldShape({ publishedAs: 'KmUkC9VotY', publishedHash: 'abc123' })]),
    )
    const { copy } = duplicateBuild(loadBuilds()[0]!)
    expect(copy.publishedAs).toBeUndefined()
    expect(copy.publishedHash).toBeUndefined()
  })
})
