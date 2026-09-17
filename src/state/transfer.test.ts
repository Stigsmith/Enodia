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

import { arcanaById, familiarById, traits } from '../data/app.ts'
import { FIRST_BUILD } from '../data/builds.fixture.ts'
import { NOTE_MAX, NOTES_BUDGET, notesLength, picksOf } from '../data/builds.ts'
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
    // The fixture is the worst case on purpose: 21 boons and two paragraphs
    // near their limits, which came to 1598 characters when last measured.
    // 2000 is the number worth guarding, because it is where a Discord
    // message stops.
    expect(link.length).toBeLessThan(2000)
  })

  it('stays under 2000 with the notes on the picks filled to their budget', async () => {
    /* The case `NOTES_BUDGET` was measured against: the fixture's 29 picks,
       every other field of prose at its limit, and notes up to the budget. The
       notes are the game's own sentences with a mention in front, which is as
       near to what an author writes as a test can get without inventing it. */
    const fill = (text: string, length: number, filler: string) => {
      let out = text
      while (out.length < length) out += ` ${filler}`
      return out.slice(0, length)
    }
    const picks = picksOf(FIRST_BUILD)
    const named = picks.filter((id) => traits.get(id)?.name)
    const said = (id: string) => traits.get(id)?.text ?? arcanaById.get(id)?.text ?? familiarById.get(id)?.text ?? ''
    const words = picks.map(said).join(' ')
    const notes: Record<string, string> = {}
    let left = NOTES_BUDGET
    let from = 0
    picks.forEach((id, at) => {
      if (left <= 0) return
      const other = named[(at + 3) % named.length] ?? id
      const length = Math.min(NOTE_MAX, left)
      const note = `@[${traits.get(other)?.name}](t:${other}) ${words.slice(from, from + length)}`.slice(0, length)
      from = (from + length) % (words.length - NOTE_MAX)
      notes[id] = note
      left -= note.length
    })
    const full = build({
      name: fill(FIRST_BUILD.name, 60, 'x'),
      say: fill(FIRST_BUILD.say, 140, 'y'),
      how: fill(FIRST_BUILD.how, 900, FIRST_BUILD.luck ?? ''),
      luck: fill(FIRST_BUILD.luck ?? '', 700, FIRST_BUILD.how),
      notes,
    })

    expect(notesLength(full)).toBe(NOTES_BUDGET)
    expect((await linkFor(full, 'https://enodia.example/')).length).toBeLessThan(2000)

    /* The same notes, each naming a different published build instead of a
       boon. A build id is ten random characters from the worker's alphabet,
       which packs worse than a trait id made of words, so it is measured
       rather than assumed. Measured on 17 September 2026: 1963 with the boons,
       and 1979 to 1998 with four builds across 1000 random sets of ids, none
       reaching 2000. These ids give 1997. **Two characters of room.**

       **This is a claim about this shape and no stronger one.** The same build
       with eight mentions of either kind at the front of How it works and If
       the run goes your way came to 2022 with boons and 2035 with builds, so
       the 2000 guard has only ever held for those two fields written as words. */
    let seen = 0
    const ids = ['aB3xK9pQmR', 'Zz9yX8wV7u', 'Qq2wE3rT4y', 'Hn5jK6mP7s', 'Wd8fG9hJ2k']
    const asBuilds = Object.fromEntries(
      Object.entries(notes).map(([pick, note]) => {
        const said = note.replace(/^@\[[^\]]*\]\(t:\w+\)/, '')
        if (said === note) return [pick, note]
        const named = `@[Killer Current](b:${ids[seen++ % ids.length]})`
        // Topped up from the same sentences, so every note keeps its length.
        return [pick, `${named}${said} ${words}`.slice(0, note.length)]
      }),
    )
    expect(seen).toBeGreaterThan(2)
    const withBuilds = build({ ...full, notes: asBuilds })
    expect(notesLength(withBuilds)).toBe(NOTES_BUDGET)
    expect((await linkFor(withBuilds, 'https://enodia.example/')).length).toBeLessThan(2000)
  })

  it('carries the notes on the picks', async () => {
    const back = await unpackBuild(await packBuild(build({ notes: { HestiaWeaponBoon: 'Why this one.' } })))
    expect(back?.notes).toEqual({ HestiaWeaponBoon: 'Why this one.' })
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
