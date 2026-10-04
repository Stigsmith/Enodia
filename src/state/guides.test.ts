/**
 * A guide, before anything draws it.
 *
 * The claims worth holding are the derived ones, because nobody types them and
 * nothing on screen would say they had gone wrong: what a guide is about is
 * counted out of its own mentions, and the builds it names are read out of the
 * same text in the order it names them. A wrong answer there is a card that
 * quietly describes the wrong guide, and a publish that sends the server a
 * build list that does not match the writing.
 */

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { traits } from '../data/app.ts'
import { FIRST_BUILD } from '../data/builds.fixture.ts'
import { saveBuild } from './builds.ts'
import { fingerprint, shapeOf } from './exchange.ts'
import {
  asGuide,
  blankGuide,
  clearDraft,
  counted,
  enough,
  guideInUrl,
  loadDraft,
  namedBuilds,
  opening,
  packGuide,
  publishGuide,
  saveDraft,
  shapesFor,
  unpackGuide,
} from './guides.ts'
import type { GuideDoc } from './guides.ts'
import { forgetMentioned } from './mentioned.ts'
import { MAX_RICH_TEXT } from './rich.ts'

/**
 * A guide from sections of plain text, the way one was written before the rich
 * body. Built through `asGuide`, so every test below also runs the conversion
 * a guide published before 4 October 2026 goes through when it is read.
 */
const guide = (sections: string[], title = 'How to beat the RNG'): GuideDoc =>
  asGuide({ title, sections: sections.map((text, at) => ({ heading: `Part ${at + 1}`, text })) })!

const HESTIA = '@[Hestia’s Boon](t:HestiaWeaponBoon)'
const ZEUS = '@[Zeus’s Boon](t:ZeusWeaponBoon)'
const BUILD = '@[Killer Current](b:aB3xK9pQmR)'

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the shape of a new one', () => {
  it('starts as one empty field, with no outline', () => {
    const fresh = blankGuide()
    expect(fresh.body).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(enough(fresh)).toBe(false)
  })

  it('needs a title and a word somewhere before it can go up', () => {
    expect(enough({ ...blankGuide(), title: 'A title' })).toBe(false)
    expect(enough(guide(['', '', 'Something.']))).toBe(true)
    expect(enough(guide(['', '', 'Something.'], '   '))).toBe(false)
  })

  it('will not go up longer than a guide can be', () => {
    expect(enough(guide(['x'.repeat(MAX_RICH_TEXT)]))).toBe(false)
    expect(enough(guide(['x'.repeat(MAX_RICH_TEXT - 200)]))).toBe(true)
  })
})

describe('a guide written as sections', () => {
  it('reads as a heading per section with something in it, and its paragraphs under it', () => {
    const doc = guide(['For anybody.', '   ', 'One.\n\nTwo, with a\nline break.'])
    expect(doc.body.content?.map((one) => one.type)).toEqual(['heading', 'paragraph', 'heading', 'paragraph', 'paragraph'])
    expect(doc.body.content?.[4]?.content?.map((one) => one.type)).toEqual(['text', 'hardBreak', 'text'])
  })

  it('keeps its mentions as mentions', () => {
    const doc = guide([`Take ${HESTIA}.`])
    expect(doc.body.content?.[1]?.content?.[1]).toEqual({
      type: 'mention',
      attrs: { kind: 'trait', id: 'HestiaWeaponBoon', label: 'Hestia’s Boon' },
    })
  })
})

describe('what a guide is about, counted rather than typed', () => {
  it('is the things it names most, over every section', () => {
    const doc = guide([`Take ${HESTIA}.`, `${ZEUS} then ${HESTIA}.`, `${HESTIA} again, and ${BUILD}.`])
    expect(counted(doc).map((one) => [one.name, one.times])).toEqual([
      ['Hestia’s Boon', 3],
      ['Zeus’s Boon', 1],
      ['Killer Current', 1],
    ])
  })

  it('keeps the order they were written in when two are named as often', () => {
    const doc = guide([`${ZEUS} and ${HESTIA}.`])
    expect(counted(doc).map((one) => one.name)).toEqual(['Zeus’s Boon', 'Hestia’s Boon'])
  })

  it('shows three, because a card is not a contents page', () => {
    const doc = guide([`${HESTIA} ${ZEUS} ${BUILD} @[Aphrodite’s Boon](t:AphroditeWeaponBoon)`])
    expect(counted(doc)).toHaveLength(3)
  })

  it('is nothing at all for a guide that names nothing', () => {
    expect(counted(guide(['Just words.']))).toEqual([])
  })
})

describe('the builds it names', () => {
  it('is whatever the text names, in the order it names them, each once', () => {
    const doc = guide([
      `Start with ${BUILD}.`,
      `Or @[Other](b:Zz9yX8wV7u), then ${BUILD} again.`,
    ])
    expect(namedBuilds(doc)).toEqual(['aB3xK9pQmR', 'Zz9yX8wV7u'])
  })

  it('is not the boons, the cards or the familiars', () => {
    expect(namedBuilds(guide([`${HESTIA} @[Frinos](f:FrinosFamiliar) @[The Sorceress](a:Sorceress)`]))).toEqual([])
  })

  it('sends each one up with the shape this browser holds for it', async () => {
    const build = { ...FIRST_BUILD, id: 'mine-1', by: 'owner' as const, publishedAs: 'aB3xK9pQmR' }
    saveBuild(build)
    /* Nothing is asked about a build the library holds. */
    const fetched = vi.fn()
    vi.stubGlobal('fetch', fetched)
    expect(await shapesFor(['aB3xK9pQmR'])).toEqual([
      { id: 'aB3xK9pQmR', shape: fingerprint(shapeOf(build)) },
    ])
    expect(fetched).not.toHaveBeenCalled()
  })

  it('sends an empty token for one nobody could find, which is never a version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await shapesFor(['Zz9yX8wV7u'])).toEqual([{ id: 'Zz9yX8wV7u', shape: '' }])
  })
})

describe('the opening line, for a card', () => {
  /**
   * **The current name, not the stored one.** The mention holds
   * `HestiaWeaponBoon` and was written as "Hestia's Boon"; the trait is called
   * Flame Strike, so that is what a card says. Drawing the written name here
   * while the subjects beside it drew the record's was one card disagreeing
   * with itself, and `nameOfMention` is the one rule both go through now.
   */
  it('is the writing from the top without its headings, mentions flattened to their current names', () => {
    expect(traits.get('HestiaWeaponBoon')?.name).toBe('Flame Strike')
    expect(opening(guide(['', '', `Take ${HESTIA} early.`]))).toBe('Take Flame Strike early.')
  })

  it('gives away nothing a spoiler hides', () => {
    const doc: GuideDoc = {
      title: 'x',
      body: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Open.' }] },
          { type: 'spoiler', attrs: { title: 'End' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Secret.' }] }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
        ],
      },
    }
    expect(opening(doc)).toBe('Open. After.')
  })

  it('stops on a word rather than mid one, and says it was cut', () => {
    const long = `${'word '.repeat(60)}end`
    const said = opening(guide([long]), 40)
    expect(said.endsWith('...')).toBe(true)
    expect(said.length).toBeLessThanOrEqual(43)
    expect(said).not.toMatch(/wo\.\.\.$/)
  })

  it('is empty for a guide with nothing written in it', () => {
    expect(opening(blankGuide())).toBe('')
  })
})

describe('packing', () => {
  it('goes there and back', async () => {
    const doc = guide([`Take ${HESTIA}.`, '', 'Watch the Magick.'])
    expect(await unpackGuide(await packGuide(doc))).toEqual(doc)
  })

  it('refuses anything that is not a guide, rather than drawing half of one', async () => {
    expect(await unpackGuide('znonsense')).toBeNull()
    expect(await unpackGuide('')).toBeNull()
    expect(await unpackGuide(`p${btoa('{"title":"Neither a body nor sections"}')}`)).toBeNull()
    expect(await unpackGuide(`p${btoa('{"title":"x","sections":[{"heading":1}]}')}`)).toBeNull()
  })
})

describe('publishing', () => {
  it('sends the packed guide, its title trimmed, and the builds it names', async () => {
    saveBuild({ ...FIRST_BUILD, id: 'mine-1', by: 'owner', publishedAs: 'aB3xK9pQmR' })
    const fetched = vi.fn(async () => new Response('{"id":"NewGuide1"}', { status: 201 }))
    vi.stubGlobal('fetch', fetched)

    const doc = guide([`Start with ${BUILD}.`], '  How to beat the RNG  ')
    const outcome = await publishGuide(doc)
    expect(outcome).toEqual({ ok: true, id: 'NewGuide1' })

    const [path, init] = fetched.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('/api/guides')
    const body = JSON.parse(String(init.body)) as { title: string; payload: string; builds: unknown[] }
    expect(body.title).toBe('How to beat the RNG')
    expect(body.builds).toEqual([{ id: 'aB3xK9pQmR', shape: expect.any(String) }])
    expect(await unpackGuide(body.payload)).toEqual(doc)
  })

  it('says what went wrong rather than throwing it away', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    expect(await publishGuide(guide(['Words.']))).toEqual({
      ok: false,
      say: 'You need to be signed in to publish a guide.',
    })
  })
})

describe('the draft', () => {
  it('survives a reload, with what it is a draft of', () => {
    const doc = guide(['Half written.'])
    saveDraft({ of: 'Guide12345', doc })
    expect(loadDraft()).toEqual({ of: 'Guide12345', doc })
    clearDraft()
    expect(loadDraft()).toBeNull()
  })

  it('is nothing rather than half a screen of somebody else’s storage', () => {
    window.localStorage.setItem('enodia.guide.draft', 'not json')
    expect(loadDraft()).toBeNull()
    window.localStorage.setItem('enodia.guide.draft', '{"of":null,"doc":{"title":"x"}}')
    expect(loadDraft()).toBeNull()
  })
})

describe('the address', () => {
  it('reads a guide id out of `/g/<id>` and nothing else', () => {
    expect(guideInUrl('/g/aB3xK9pQmR')).toBe('aB3xK9pQmR')
    expect(guideInUrl('/g/aB3xK9pQmR/')).toBe('aB3xK9pQmR')
    expect(guideInUrl('/b/aB3xK9pQmR')).toBeNull()
    expect(guideInUrl('/g/')).toBeNull()
    expect(guideInUrl('/g/not an id')).toBeNull()
  })
})
