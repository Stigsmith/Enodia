/**
 * Getting things out and back in again.
 *
 * The claims worth testing are the ones a person would only discover after
 * losing something: that an export carries a key this version has never heard
 * of, that a link never carries the play record, and that an import refuses a
 * file naming storage it does not own.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import {
  buildInUrl,
  collect,
  daysSince,
  describe as describeBundle,
  linkFor,
  markExported,
  packBuild,
  readBundle,
  readExportedAt,
  received,
  restore,
  shareable,
  unpackBuild,
} from './transfer.ts'

const store = () => window.localStorage

const build = (over: Partial<ShownBuild> = {}): ShownBuild => ({
  ...FIRST_BUILD,
  id: 'mine-shared-001',
  by: 'owner',
  ...over,
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('taking everything out', () => {
  it('collects every key this tool owns and nothing else', () => {
    store().setItem('enodia.builds', '{"version":1,"builds":[]}')
    store().setItem('enodia.theme', 'infernal')
    store().setItem('somebody.else', 'not mine')

    const bundle = collect(store())
    expect(Object.keys(bundle.data).sort()).toEqual(['enodia.builds', 'enodia.theme'])
    expect(bundle.app).toBe('enodia')
  })

  it('carries a key it has never heard of, untouched', () => {
    // The file has to survive being written by a newer version of the tool than
    // the one reading it back, which is the whole reason values are kept as
    // their stored strings rather than parsed and re-emitted.
    store().setItem('enodia.somethingNew', '{"invented":"later"}')
    const bundle = collect(store())
    expect(bundle.data['enodia.somethingNew']).toBe('{"invented":"later"}')
  })

  it('says what is in a file before anything is written', () => {
    store().setItem('enodia.builds', JSON.stringify({ version: 1, builds: [build(), build({ id: 'b' })] }))
    store().setItem('enodia.runs', JSON.stringify({ version: 1, runs: [{}, {}, {}] }))
    const said = describeBundle(collect(store()))
    expect(said.builds).toBe(2)
    expect(said.runs).toBe(3)
    expect(said.keys).toBe(2)
  })
})

describe('putting a file back in', () => {
  it('refuses a file this tool did not write, and says why', () => {
    expect(readBundle('not json at all')).toEqual({ error: 'That file is not readable as JSON.' })
    expect(readBundle('{"app":"something-else","data":{}}')).toEqual({
      error: 'That file was not written by Enodia.',
    })
  })

  it('drops a key that is not this tool\'s to write', () => {
    // A file naming a key outside the prefix is broken or hostile, and writing
    // it would let a file reach storage it does not own.
    const read = readBundle(
      JSON.stringify({ app: 'enodia', version: 1, data: { 'enodia.theme': 'cthonic', 'evil.key': 'x' } }),
    )
    expect('bundle' in read).toBe(true)
    if (!('bundle' in read)) return
    expect(Object.keys(read.bundle.data)).toEqual(['enodia.theme'])
  })

  it('replaces rather than merges', () => {
    // A merge leaves a build the file does not have next to the ones it does,
    // which is neither the state exported nor the state that was here.
    store().setItem('enodia.builds', 'mine')
    store().setItem('enodia.theme', 'unseen')
    restore({ app: 'enodia', version: 1, exportedAt: '', data: { 'enodia.theme': 'infernal' } }, store())

    expect(store().getItem('enodia.builds')).toBeNull()
    expect(store().getItem('enodia.theme')).toBe('infernal')
  })

  it('leaves storage that is not this tool\'s alone', () => {
    store().setItem('somebody.else', 'keep me')
    restore({ app: 'enodia', version: 1, exportedAt: '', data: { 'enodia.theme': 'unseen' } }, store())
    expect(store().getItem('somebody.else')).toBe('keep me')
  })

  it('survives a round trip', () => {
    store().setItem('enodia.builds', JSON.stringify({ version: 1, builds: [build()] }))
    store().setItem('enodia.theme', 'olympian')
    const text = JSON.stringify(collect(store()))

    store().clear()
    const read = readBundle(text)
    expect('bundle' in read).toBe(true)
    if (!('bundle' in read)) return
    restore(read.bundle, store())

    expect(store().getItem('enodia.theme')).toBe('olympian')
    expect(JSON.parse(store().getItem('enodia.builds')!).builds[0].id).toBe('mine-shared-001')
  })
})

describe('one build, as a link', () => {
  it('never sends the play record', async () => {
    // It is how a build has gone *here*. Sending it would have the receiver's
    // copy claiming twelve runs it has never had.
    // Fear is in here on purpose: a link saying "cleared Fear 40" would be
    // claiming something about the recipient's runs rather than the sender's.
    const mine = build({ play: { rating: 5, runs: 12, clears: 7, assembles: 'reliably', fear: 40 } })
    expect(shareable(mine)).not.toHaveProperty('play')

    const back = await unpackBuild(await packBuild(mine))
    expect(back).toBeTruthy()
    expect(back).not.toHaveProperty('play')
  })

  it('carries everything else through unchanged', async () => {
    const mine = build({ optional: ['SomeBoon'], derivedFrom: 'sample-killer-current' })
    const back = await unpackBuild(await packBuild(mine))
    expect(back?.id).toBe(mine.id)
    expect(back?.name).toBe(mine.name)
    expect(back?.boons).toEqual(mine.boons)
    expect(back?.arcana).toEqual(mine.arcana)
    expect(back?.optional).toEqual(['SomeBoon'])
    expect(back?.derivedFrom).toBe('sample-killer-current')
  })

  it('keeps the id, because identity is the point of sending it', async () => {
    const back = await unpackBuild(await packBuild(build()))
    expect(back?.id).toBe('mine-shared-001')
  })

  it('makes a link short enough to paste in a chat', async () => {
    const link = await linkFor(build(), 'https://enodia.example/')
    expect(link.startsWith('https://enodia.example/#build=')).toBe(true)
    // The shipped build is the worst case on purpose: 21 boons, 10 Arcana and
    // a long paragraph, which comes out around 1250 characters. Browsers and
    // chat clients handle a URL of that length; the number worth guarding is
    // the one where they stop, which is nearer 2000.
    expect(link.length).toBeLessThan(2000)
  })

  it('finds the payload in a URL and ignores anything else in the fragment', () => {
    expect(buildInUrl('#build=zABC')).toBe('zABC')
    expect(buildInUrl('#other=1&build=zABC')).toBe('zABC')
    expect(buildInUrl('#build=zABC&other=1')).toBe('zABC')
    expect(buildInUrl('#nothing')).toBeNull()
    expect(buildInUrl('')).toBeNull()
  })

  it('returns nothing rather than throwing on a mangled link', async () => {
    // A link pasted into a chat gets wrapped, truncated and re-wrapped.
    expect(await unpackBuild('znonsense')).toBeNull()
    expect(await unpackBuild('')).toBeNull()
    expect(await unpackBuild('qwhat-marker-is-this')).toBeNull()
    expect(await unpackBuild('p' + btoa('{"not":"a build"}'))).toBeNull()
  })

  it('stamps a received build as arriving now, keeping what it was told', () => {
    const arrived = received(build({ created: '2020-01-01T00:00:00.000Z' }), '2026-09-01T00:00:00.000Z')
    expect(arrived.created).toBe('2020-01-01T00:00:00.000Z')
    expect(arrived.modified).toBe('2026-09-01T00:00:00.000Z')
    expect(arrived.schemaVersion).toBe(1)
  })
})

describe('how long since the last export', () => {
  it('is nothing at all before there has been one', () => {
    expect(daysSince(null)).toBeNull()
    expect(daysSince('not a date')).toBeNull()
    expect(readExportedAt(store())).toBeNull()
  })

  it('counts whole days', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z')
    expect(daysSince('2026-09-10T11:00:00.000Z', now)).toBe(0)
    expect(daysSince('2026-09-09T11:00:00.000Z', now)).toBe(1)
    expect(daysSince('2026-08-31T11:00:00.000Z', now)).toBe(10)
  })

  it('never counts backwards from a clock that moved', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z')
    expect(daysSince('2026-09-20T12:00:00.000Z', now)).toBe(0)
  })

  it('remembers when the last one was taken', () => {
    const iso = markExported(store(), new Date('2026-09-01T10:00:00.000Z'))
    expect(iso).toBe('2026-09-01T10:00:00.000Z')
    expect(readExportedAt(store())).toBe('2026-09-01T10:00:00.000Z')
  })

  it('rides along in the export, so a restored install knows too', () => {
    markExported(store(), new Date('2026-09-01T10:00:00.000Z'))
    expect(collect(store()).data['enodia.exportedAt']).toBe('2026-09-01T10:00:00.000Z')
  })
})

/**
 * A share link must not carry a claim on a listing.
 *
 * `shareable` is what goes in a URL fragment and what `packBuild` sends to the
 * server, so anything left in it travels to whoever opens the link. `play` was
 * already stripped because it is your record and not theirs. `publishedAs` and
 * `publishedHash` are a stronger case: they say this build is the one behind a
 * particular listing, and a stranger's copy offering to replace what your
 * followers read is the failure this whole batch exists to prevent.
 */
describe('what a share link is not allowed to carry', () => {
  it('strips the published id and its shape along with play', () => {
    const out = shareable({
      ...FIRST_BUILD,
      play: { runs: 3, clears: 1 },
      publishedAs: 'KmUkC9VotY',
      publishedHash: 'abc123',
      publishedDown: true,
    })
    expect(out.play).toBeUndefined()
    expect(out.publishedAs).toBeUndefined()
    expect(out.publishedHash).toBeUndefined()
    expect(out.publishedDown).toBeUndefined()
  })
})
