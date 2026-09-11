// @vitest-environment jsdom

/**
 * The library, while a sync brings something in.
 *
 * `App` rendered `<Builds key={libraryAt}>`, and `libraryAt` is bumped whenever
 * storage changes underneath the screen: a sync that applied something, a
 * followed build that moved, a listing that reconnected, a shared build kept.
 * A new key is a new component, so every one of those threw away whatever the
 * reader had open: the build they were reading, the dialog, the filters, and
 * the editor's unsaved draft. A sync runs on every focus and visibility change,
 * and this is a second-screen tool people alt-tab out of to play, so coming back
 * to the tab was enough. The owner lost a build halfway through writing it.
 *
 * These go through the real `App` and the real `Builds`, because the fault was
 * in how one renders the other: a test of `Builds` on its own passes against
 * the broken code. Only `useSync` is replaced, by a stand-in that hands the test
 * the callback `App` gives it, so "a sync brought something in" is one call.
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App.tsx'
import { FIRST_BUILD } from './data/builds.fixture.ts'
import type { ShownBuild } from './data/builds.ts'
import { saveBuild } from './state/builds.ts'
import { setOffers } from './state/offers.ts'
import { loadPrefs, savePrefs } from './state/prefs.ts'

const sync = vi.hoisted(() => ({ fire: () => {} }))

vi.mock('./state/useSync.ts', () => ({
  useSync: (_signedIn: boolean, onChanged: () => void) => {
    sync.fire = onChanged
  },
}))

const owned = (over: Partial<ShownBuild> = {}): ShownBuild => ({
  ...FIRST_BUILD,
  id: 'mine-one',
  by: 'owner',
  created: '2026-09-01T10:00:00.000Z',
  modified: '2026-09-01T10:00:00.000Z',
  schemaVersion: 1,
  ...over,
})

/** What jsdom does not have and the app touches on the way to the library. */
function stubTheBrowser() {
  const media = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: media })
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
  Element.prototype.scrollIntoView = () => {}
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
}

const detail = () => document.querySelector('.builds.is-detail')

function openTheBuild() {
  const card = document.querySelector<HTMLButtonElement>('.bcard-hit')
  expect(card, 'the library shows the build').not.toBeNull()
  fireEvent.click(card as HTMLButtonElement)
  expect(detail(), 'clicking it opens it').not.toBeNull()
}

const aSyncBringsSomethingIn = () =>
  act(() => {
    sync.fire()
  })

beforeEach(() => {
  window.localStorage.clear()
  stubTheBrowser()
  // Straight to the library, rather than the one-time landing page.
  savePrefs({ ...loadPrefs(), seenLanding: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the library while a sync brings something in', () => {
  it('keeps the build you are reading open', () => {
    saveBuild(owned())
    render(<App />)
    openTheBuild()

    aSyncBringsSomethingIn()

    expect(detail()).not.toBeNull()
  })

  /* The one that cost the owner a build. */
  it('keeps an edit you have not saved yet', () => {
    saveBuild(owned())
    render(<App />)
    openTheBuild()
    const button = (label: string) =>
      [...document.querySelectorAll('button')].find((one) => one.textContent?.trim() === label)
    fireEvent.click(button('Edit') as HTMLButtonElement)
    // The name lives on the Notes tab, and the editor opens on Boons.
    fireEvent.click(button('Notes') as HTMLButtonElement)
    const name = () => document.querySelector<HTMLInputElement>('input[data-field="name"]')
    fireEvent.change(name() as HTMLInputElement, { target: { value: 'Halfway through' } })
    expect(name()?.value, 'the draft is in the editor before anything happens').toBe('Halfway through')

    aSyncBringsSomethingIn()

    expect(name()?.value).toBe('Halfway through')
  })

  /* Not remounting must not mean not refreshing: what arrived still shows. */
  it('shows what the sync brought in, without closing anything', () => {
    const build = owned()
    saveBuild(build)
    render(<App />)
    openTheBuild()

    saveBuild({ ...build, name: 'Renamed on the phone' })
    aSyncBringsSomethingIn()

    expect(detail()).not.toBeNull()
    expect(document.body.textContent).toContain('Renamed on the phone')
  })

  /**
   * A part of the screen that read storage once, on mount.
   *
   * `FollowNews` read the offer for the open build when the build's id changed
   * and at no other time, which only ever worked because the whole screen was
   * remounted underneath it. Without the remount it would go on saying nothing
   * about an offer that had arrived.
   */
  it('shows an offer that arrived while the build was open', () => {
    const build = owned({ id: 'followed-one', by: 'community', derivedFrom: 'KmUkC9VotY', author: 'Tester' })
    saveBuild(build)
    render(<App />)
    openTheBuild()
    expect(document.body.textContent).not.toContain('has taken this off the exchange')

    setOffers({ [build.id]: { kind: 'takenDown', from: 'KmUkC9VotY', at: Date.now() } })
    aSyncBringsSomethingIn()

    expect(detail()).not.toBeNull()
    expect(document.body.textContent).toContain('has taken this off the exchange')
  })
})
