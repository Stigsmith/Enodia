// @vitest-environment jsdom

/**
 * Reading a guide.
 *
 * The claims this screen exists for: a build named in a sentence carries its
 * verdict while a run is live, a build its author has withdrawn or changed
 * says which, and the whole thing costs one request however many builds it
 * names. The last of those is the one nothing on screen would show: a guide
 * that quietly made a request per mention would look identical and would spend
 * a reader's rate limit on a long guide.
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { olympians, traits } from '../data/app.ts'
import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { RunContext } from '../data/types.ts'
import { verdictForShown } from '../engine/build-run.ts'
import type { GuideRead, NamedBuild } from '../state/guides.ts'
import { forgetMentioned } from '../state/mentioned.ts'
import type { RichNode } from '../state/rich.ts'
import { packBuild, packText } from '../state/transfer.ts'
import { LiveRunProvider } from './BuildMention.tsx'
import { GuideReader } from './GuideReader.tsx'

const MENTION = '@[Old Name](b:aB3xK9pQmR)'

/**
 * A guide as it was stored before the rich body: sections of plain text. Packed
 * in that shape on purpose, so every test here also says that a guide
 * published before 4 October 2026 still reads.
 */
const doc = (sections: { heading: string; text: string }[]) => ({ title: 'How to beat the RNG', sections })

const runContext = (over: Partial<RunContext> = {}): RunContext => ({
  weapon: null,
  aspect: null,
  path: null,
  exitsLeft: 12,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
  ...over,
})

const asked: string[] = []

/** A server holding one guide, answering `/api/g/<id>` and nothing else. */
async function aGuide(
  over: Partial<GuideRead> = {},
  sections = [{ heading: 'How it goes', text: `Go for ${MENTION}.` }],
  body?: RichNode,
) {
  const named: NamedBuild[] = over.named ?? [
    {
      id: 'aB3xK9pQmR',
      state: 'live',
      name: 'Killer Current',
      payload: await packBuild({ ...FIRST_BUILD, name: 'Killer Current' }),
      revision: 1,
      changed: false,
    },
  ]
  const guide: GuideRead = {
    id: 'Guide12345',
    title: 'How to beat the RNG',
    payload: await packText(JSON.stringify(body ? { title: 'How to beat the RNG', body } : doc(sections))),
    by: 'Ana',
    createdAt: Date.UTC(2026, 8, 18),
    updatedAt: null,
    revision: 1,
    takenDown: false,
    stats: { saves: 2, likes: 1 },
    saved: false,
    liked: false,
    builds: ['aB3xK9pQmR'],
    ...over,
    named,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      asked.push(`${init?.method ?? 'GET'} ${path}${init?.body ? ` ${String(init.body)}` : ''}`)
      if (path === '/api/g/Guide12345') return new Response(JSON.stringify(guide), { status: 200 })
      if (path.startsWith('/api/guides/')) return new Response('{"ok":true}', { status: 200 })
      return new Response('{"error":"no"}', { status: 404 })
    }),
  )
  return guide
}

const shown = () => document.body.textContent ?? ''
const verdict = () => document.querySelector('.mention-verdict')
const press = async (label: string) => {
  const button = [...document.querySelectorAll('button')].find((one) => one.textContent === label)
  await act(async () => button?.click())
}

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
  asked.length = 0
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const open = (props: Partial<Parameters<typeof GuideReader>[0]> = {}) =>
  render(<GuideReader id="Guide12345" signedIn={false} onBack={() => {}} {...props} />)

describe('one request, and the builds come with it', () => {
  it('draws a build it names without asking anybody about the build', async () => {
    await aGuide()
    open()
    await vi.waitFor(() => expect(document.querySelector('.mention-build')).not.toBeNull())
    expect(document.querySelector('.mention-name')?.textContent).toBe('Killer Current')
    expect(asked).toEqual(['GET /api/g/Guide12345'])
  })
})

describe('a build named in a sentence', () => {
  it('carries the run screen’s own verdict while a run is being logged', async () => {
    await aGuide()
    const ctx = runContext()
    render(
      <LiveRunProvider value={ctx}>
        <GuideReader id="Guide12345" signedIn={false} onBack={() => {}} />
      </LiveRunProvider>,
    )
    await vi.waitFor(() => expect(verdict()).not.toBeNull())
    const expected = verdictForShown({ ...FIRST_BUILD, name: 'Killer Current' }, ctx, traits)
    const said = expected.why.slice('Killer Current '.length, -1)
    expect(document.querySelector('.rich > p')?.textContent).toBe(`Go for Killer Current (${said}).`)
  })

  it('says withdrawn, with no payload ever handed over, and asks nobody', async () => {
    await aGuide({ named: [{ id: 'aB3xK9pQmR', state: 'withdrawn' }] })
    open()
    await vi.waitFor(() => expect(verdict()?.textContent).toBe('withdrawn'))
    expect(document.querySelector('.mention-build')?.textContent).toBe('Old Name (withdrawn)')
    expect(asked).toEqual(['GET /api/g/Guide12345'])
  })

  it('says a build whose picks moved has moved, without saying it is gone', async () => {
    await aGuide({
      named: [
        {
          id: 'aB3xK9pQmR',
          state: 'live',
          name: 'Killer Current',
          payload: await packBuild({ ...FIRST_BUILD, name: 'Killer Current' }),
          revision: 2,
          changed: true,
        },
      ],
    })
    open()
    await vi.waitFor(() => expect(verdict()?.textContent).toBe('changed since this was written'))
    expect(document.querySelector('.mention-build')?.classList.contains('is-withdrawn')).toBe(false)
  })
})

describe('a guide written as sections, before the rich body', () => {
  it('skips the prompts nobody answered, and keeps the ones they did', async () => {
    await aGuide({}, [
      { heading: 'What this is', text: 'For anybody on the Staff.' },
      { heading: 'What you need', text: '   ' },
      { heading: 'How it goes', text: 'First paragraph.\n\nSecond paragraph.' },
    ])
    open()
    await vi.waitFor(() => expect(document.querySelectorAll('.rich .rich-h2')).toHaveLength(2))
    expect([...document.querySelectorAll('.rich .rich-h2')].map((one) => one.textContent)).toEqual([
      'What this is',
      'How it goes',
    ])
    /* A blank line was a paragraph, which was the whole of the formatting. */
    expect([...document.querySelectorAll('.rich > p')].map((one) => one.textContent)).toEqual([
      'For anybody on the Staff.',
      'First paragraph.',
      'Second paragraph.',
    ])
  })
})

describe('a rich body', () => {
  const text = (value: string, marks?: RichNode['marks']): RichNode => ({
    type: 'text',
    text: value,
    ...(marks ? { marks } : {}),
  })
  const para = (...content: RichNode[]): RichNode => ({ type: 'paragraph', content })

  it('draws its blocks, and keeps a spoiler closed until it is opened', async () => {
    await aGuide({}, [], {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('The cap')] },
        para(text('Bold', [{ type: 'bold' }]), text(' and '), text('marked', [{ type: 'highlight' }])),
        { type: 'callout', attrs: { tone: 'warn' }, content: [para(text('Careful.'))] },
        { type: 'spoiler', attrs: { title: 'The ending' }, content: [para(text('Hidden.'))] },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(text('God'))] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [para(text('Zeus'))] }] },
          ],
        },
      ],
    })
    open()
    await vi.waitFor(() => expect(document.querySelector('.rich-h2')?.textContent).toBe('The cap'))
    expect(document.querySelector('.rich strong')?.textContent).toBe('Bold')
    expect(document.querySelector('.rich mark')?.textContent).toBe('marked')
    expect(document.querySelector('.rich-callout.is-warn')?.textContent).toContain('Careful.')
    const spoiler = document.querySelector('details.rich-spoiler') as HTMLDetailsElement | null
    expect(spoiler?.open).toBe(false)
    expect(spoiler?.querySelector('summary')?.textContent).toBe('The ending')
    expect([...document.querySelectorAll('.rich th, .rich td')].map((one) => one.textContent)).toEqual(['God', 'Zeus'])
  })

  it('sends a link out as somebody else’s, and drops one that is not a web address', async () => {
    await aGuide({}, [], {
      type: 'doc',
      content: [
        para(
          text('a video', [{ type: 'link', attrs: { href: 'https://example.com/run' } }]),
          text(' and '),
          text('a trap', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
        ),
      ],
    })
    open()
    await vi.waitFor(() => expect(document.querySelectorAll('.rich a.rich-link')).toHaveLength(1))
    const link = document.querySelector('.rich a.rich-link')
    expect(link?.getAttribute('href')).toBe('https://example.com/run')
    expect(link?.getAttribute('rel')).toBe('nofollow ugc noopener noreferrer')
    expect(document.querySelector('.rich')?.textContent).toContain('a trap')
  })

  it('never draws markup it was sent, whatever node it claimed to be', async () => {
    await aGuide({}, [], {
      type: 'doc',
      content: [
        { type: 'html', attrs: { html: '<img src=x onerror=alert(1)>' }, content: [para(text('<b>kept as text</b>'))] },
      ],
    })
    open()
    await vi.waitFor(() => expect(document.querySelector('.rich')?.textContent).toContain('<b>kept as text</b>'))
    expect(document.querySelector('.rich img, .rich b')).toBeNull()
  })

  it('names a god by the section of the wiki the god is', async () => {
    await aGuide({}, [], {
      type: 'doc',
      content: [para(text('Ask '), { type: 'mention', attrs: { kind: 'place', id: 'olympians/zeus', label: 'Zeus' } })],
    })
    open()
    await vi.waitFor(() => expect(document.querySelector('.rich a.mention')).not.toBeNull())
    expect(document.querySelector('.rich a.mention')?.getAttribute('href')).toBe('/wiki/c/olympians/zeus')
    expect(document.querySelector('.rich a.mention .mention-name')?.textContent).toBe('Zeus')
  })
})

describe('what a reader can do', () => {
  it('offers nothing to press while signed out, and says why in one line', async () => {
    await aGuide()
    open()
    await vi.waitFor(() => expect(shown()).toContain('Sign in to save this'))
    expect([...document.querySelectorAll('button')].map((one) => one.textContent)).toEqual(['All guides'])
  })

  it('moves the count on a save, and puts it back when the server refuses', async () => {
    await aGuide()
    open({ signedIn: true })
    await vi.waitFor(() => expect(shown()).toContain('Saved by 2'))

    await press('Save it')
    expect(shown()).toContain('Saved by 3')
    expect(asked.at(-1)).toBe('POST /api/guides/Guide12345/save {"on":true}')

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"That guide is yours already."}', { status: 409 })))
    await press('Saved')
    await vi.waitFor(() => expect(shown()).toContain('That guide is yours already.'))
    expect(shown()).toContain('Saved by 3')
  })

  it('sends a report with what was said, and says nothing about it afterwards', async () => {
    await aGuide()
    open({ signedIn: true })
    await vi.waitFor(() => expect(shown()).toContain('Report it'))
    await press('Report it')
    const box = document.querySelector<HTMLTextAreaElement>('#guide-reason')!
    fireEvent.change(box, { target: { value: 'It is a wall of adverts.' } })
    await press('Send it')
    await vi.waitFor(() => expect(shown()).toContain('Reported. Somebody will read it.'))
    expect(asked.at(-1)).toBe('POST /api/guides/Guide12345/report {"reason":"It is a wall of adverts."}')
  })
})

describe('your own', () => {
  it('offers the author’s levers rather than the reader’s', async () => {
    await aGuide({ mine: true })
    open({ signedIn: true, onEdit: () => {} })
    await vi.waitFor(() => expect(shown()).toContain('Edit it'))
    expect([...document.querySelectorAll('button')].map((one) => one.textContent)).toEqual([
      'All guides',
      'Edit it',
      'Take it down',
      'Copy the link',
    ])
  })

  it('says when a moderator hid it, because a guide you cannot see is one you cannot fix', async () => {
    await aGuide({ mine: true, hidden: true })
    open({ signedIn: true })
    await vi.waitFor(() => expect(shown()).toContain('A moderator hid this guide.'))
  })
})

describe('a guide that is not there', () => {
  it('says so rather than sitting on One moment', async () => {
    await aGuide()
    render(<GuideReader id="Missing123" signedIn={false} onBack={() => {}} />)
    await vi.waitFor(() => expect(shown()).toContain('That guide is not there.'))
  })
})
