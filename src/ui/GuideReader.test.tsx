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
import { packGuide } from '../state/guides.ts'
import type { GuideDoc, GuideRead, NamedBuild } from '../state/guides.ts'
import { forgetMentioned } from '../state/mentioned.ts'
import { packBuild } from '../state/transfer.ts'
import { LiveRunProvider } from './BuildMention.tsx'
import { GuideReader } from './GuideReader.tsx'

const MENTION = '@[Old Name](b:aB3xK9pQmR)'

const doc = (sections: { heading: string; text: string }[]): GuideDoc => ({
  title: 'How to beat the RNG',
  sections,
})

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
async function aGuide(over: Partial<GuideRead> = {}, sections = [{ heading: 'How it goes', text: `Go for ${MENTION}.` }]) {
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
    payload: await packGuide(doc(sections)),
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
    expect(document.querySelector('.guide-section p')?.textContent).toBe(`Go for Killer Current (${said}).`)
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

describe('the sections', () => {
  it('skips the prompts nobody answered, and keeps the ones they did', async () => {
    await aGuide({}, [
      { heading: 'What this is', text: 'For anybody on the Staff.' },
      { heading: 'What you need', text: '   ' },
      { heading: 'How it goes', text: 'First paragraph.\n\nSecond paragraph.' },
    ])
    open()
    await vi.waitFor(() => expect(document.querySelectorAll('.guide-section')).toHaveLength(2))
    expect([...document.querySelectorAll('.guide-section h3')].map((one) => one.textContent)).toEqual([
      'What this is',
      'How it goes',
    ])
    /* A blank line is a paragraph, which is the whole of the formatting. */
    expect(document.querySelectorAll('.guide-section')[1]?.querySelectorAll('p')).toHaveLength(2)
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
