// @vitest-environment jsdom

/**
 * A build named in a write-up, as a reader sees it.
 *
 * The claim the whole guides feature rests on: the same sentence carries the
 * build's verdict while a run is being logged and does not outside one. And
 * the two ways it must not lie: an absent build is marked withdrawn, and a
 * build nobody could reach yet is not.
 */

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { olympians, traits } from '../data/app.ts'
import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { RunContext } from '../data/types.ts'
import { verdictForShown } from '../engine/build-run.ts'
import { saveBuild } from '../state/builds.ts'
import { forgetMentioned } from '../state/mentioned.ts'
import { setOffers } from '../state/offers.ts'
import { LiveRunProvider, OpenBuildProvider } from './BuildMention.tsx'
import { Prose } from './Prose.tsx'
import { ProseText } from './ProseText.tsx'

const run = (over: Partial<RunContext> = {}): RunContext => ({
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

const TEXT = 'Go for @[Old Name](b:aB3xK9pQmR) if the run allows.'

const fetched = vi.fn<(url: string) => Promise<Response>>()

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
  fetched.mockReset()
  fetched.mockRejectedValue(new TypeError('Failed to fetch'))
  vi.stubGlobal('fetch', fetched)
  saveBuild({ ...FIRST_BUILD, id: 'mine-1', name: 'Killer Current', by: 'owner', publishedAs: 'aB3xK9pQmR' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const mention = () => document.querySelector('.mention-build')
const verdict = () => document.querySelector('.mention-verdict')

describe('during a run', () => {
  it('carries the verdict the run screen would give the same build', () => {
    const ctx = run()
    render(
      <LiveRunProvider value={ctx}>
        <p>
          <Prose text={TEXT} />
        </p>
      </LiveRunProvider>,
    )
    const expected = verdictForShown({ ...FIRST_BUILD, name: 'Killer Current' }, ctx, traits)
    expect(expected.why.startsWith('Killer Current ')).toBe(true)
    /* The run screen's own sentence, set apart inside the author's. */
    expect(expected.why.endsWith('.')).toBe(true)
    const said = expected.why.slice('Killer Current '.length, -1)
    expect(document.querySelector('p')?.textContent).toBe(`Go for Killer Current (${said}) if the run allows.`)
    expect(verdict()?.className).toContain(`is-${expected.state.toLowerCase()}`)
  })

  it('says a build on another aspect is closed, with the reason', () => {
    const ctx = run({ aspect: 'StaffRaiseDeadAspect' })
    render(
      <LiveRunProvider value={ctx}>
        <Prose text={TEXT} />
      </LiveRunProvider>,
    )
    expect(verdict()?.className).toContain('is-dead')
    expect(verdict()?.textContent).toMatch(/^is built on /)
  })

  it('carries it in text that cannot hold a link too, such as an offer card', () => {
    render(
      <LiveRunProvider value={run()}>
        <ProseText text={TEXT} />
      </LiveRunProvider>,
    )
    expect(document.querySelector('a')).toBeNull()
    expect(verdict()).not.toBeNull()
  })
})

describe('outside a run', () => {
  it('is the build’s current name and nothing more', () => {
    render(<Prose text={TEXT} />)
    expect(mention()?.textContent).toBe('Killer Current')
    expect(verdict()).toBeNull()
  })

  it('links to the build’s short address, and opens the library’s copy on a click', () => {
    const open = vi.fn()
    render(
      <OpenBuildProvider value={open}>
        <Prose text={TEXT} />
      </OpenBuildProvider>,
    )
    const link = document.querySelector('a.mention-build') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/b/aB3xK9pQmR')
    link.click()
    expect(open).toHaveBeenCalledWith({ local: 'mine-1' })
  })
})

describe('a build that is not there', () => {
  it('is withdrawn when its author took it down, with no verdict even during a run', () => {
    window.localStorage.clear()
    saveBuild({ ...FIRST_BUILD, id: 'theirs-1', name: 'Theirs', by: 'community', derivedFrom: 'aB3xK9pQmR' })
    setOffers({ 'theirs-1': { kind: 'takenDown', from: 'aB3xK9pQmR', at: 1 } })
    render(
      <LiveRunProvider value={run()}>
        <Prose text={TEXT} />
      </LiveRunProvider>,
    )
    expect(mention()?.classList.contains('is-withdrawn')).toBe(true)
    expect(verdict()?.textContent).toBe('withdrawn')
  })

  it('is withdrawn when nothing answers to its id', async () => {
    window.localStorage.clear()
    fetched.mockResolvedValue(new Response('{"error":"no such build"}', { status: 404 }))
    const view = render(<Prose text={TEXT} />)
    await view.findByText('withdrawn')
    expect(mention()?.textContent).toBe('Old Name (withdrawn)')
    expect(document.querySelector('a')).toBeNull()
  })

  it('is only the name it was written with while nobody could be asked', async () => {
    window.localStorage.clear()
    const view = render(<Prose text={TEXT} />)
    await vi.waitFor(() => expect(fetched).toHaveBeenCalled())
    expect(view.container.textContent).toBe('Go for Old Name if the run allows.')
    expect(mention()).toBeNull()
  })
})
