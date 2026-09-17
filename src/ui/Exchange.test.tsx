// @vitest-environment jsdom

/**
 * Charon, and the phones that downloaded him without ever drawing him.
 *
 * `CharonShop` rendered a plain `<img>` inside a wrapper that `builds.css` hid
 * below 96rem, so every narrow screen that opened the exchange fetched
 * `charon-shop.png`, 348 KB, and never showed it. Measured on enodia.me on 13
 * September 2026 at 375x812: requested with a 200, `complete` true,
 * `naturalWidth` 768, and the wrapper `display: none`.
 *
 * jsdom has no layout and fetches no images, so these check what decides the
 * request: whether the image element exists at all. The window's width is a
 * `matchMedia` stand-in the test can move.
 */

import { act, cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import { saveBuild } from '../state/builds.ts'
import { packBuild } from '../state/transfer.ts'
import { Exchange } from './Exchange.tsx'

const CSS = readFileSync(join(import.meta.dirname, 'builds.css'), 'utf8')

/**
 * A window that is wide enough for him or is not, and can change.
 *
 * Every query gets the same answer, which holds while Charon is the only thing
 * on this screen that asks.
 */
function aWindow(wide: boolean) {
  let matches = wide
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return matches
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => list })

  const resize = (toWide: boolean) => {
    matches = toWide
    for (const listener of listeners) listener()
  }
  return { widen: () => resize(true), narrow: () => resize(false) }
}

/** The exchange once its shelf has answered, which with no API is the empty shelf. */
async function openTheExchange() {
  const view = render(<Exchange />)
  await view.findByText(/Nothing published yet/)
}

const charon = () => document.querySelector('.xchange-charon')
const portrait = () => document.querySelector('img[src*="charon-shop"]')

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Charon in the exchange', () => {
  /* The one every phone paid for. */
  it('is not in the page, and so not downloaded, where there is no room to draw him', async () => {
    aWindow(false)
    await openTheExchange()

    expect(charon()).toBeNull()
    expect(portrait()).toBeNull()
  })

  /**
   * Where he is drawn, and the one thing the stylesheet needs from the page.
   *
   * The shelf makes room for him with `.xchange-charon + .xchange-shelf`, so the
   * inset follows whether he is there and never restates the breakpoint. That
   * only holds while he is the shelf's previous sibling, and nothing else in the
   * code says so.
   */
  it('is drawn where there is room, directly before the shelf that makes room for him', async () => {
    aWindow(true)
    await openTheExchange()

    expect(portrait()?.getAttribute('src')).toBe('/characters/charon-shop.png')
    expect(charon()?.nextElementSibling?.classList.contains('xchange-shelf')).toBe(true)
    expect(CSS).toContain('.xchange-charon + .xchange-shelf')
  })

  it('arrives and leaves as the window crosses the breakpoint', async () => {
    const size = aWindow(false)
    await openTheExchange()

    act(() => size.widen())
    expect(portrait()).not.toBeNull()

    act(() => size.narrow())
    expect(charon()).toBeNull()
  })
})

/**
 * A listing of yours on the All shelf.
 *
 * It said "It is already in your builds" whatever the library held, so a build
 * deleted after publishing, with the bin emptied, was described as present
 * while its listing was the only copy left.
 */
describe('a listing of yours', () => {
  async function shelfWith(held: boolean) {
    aWindow(false)
    window.localStorage.clear()
    if (held) saveBuild({ ...FIRST_BUILD, id: 'mine-1', by: 'owner', publishedAs: 'KmUkC9VotY' })
    const payload = await packBuild({ ...FIRST_BUILD, id: 'mine-1', by: 'owner' })
    const row = {
      id: 'KmUkC9VotY',
      name: 'My Listing',
      payload,
      by: 'Owner',
      createdAt: 0,
      mine: true,
      stats: { takes: 0, players: 0, runs: 0, clears: 0, bestFear: null, rating: null, raters: 0 },
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ builds: [row] }), { status: 200 })))
    const view = render(<Exchange />)
    await view.findByText('My Listing')
  }

  it('says so when its build is in your builds', async () => {
    await shelfWith(true)
    expect(document.querySelector('.xchange-yours')?.textContent).toBe('This one is yours. It is in your builds.')
  })

  it('offers it back when its build is not', async () => {
    await shelfWith(false)
    expect(document.querySelector('.xchange-yours')?.textContent).toMatch(/not in your builds/)
    expect(document.querySelector('.xchange-yours button')?.textContent).toBe('Put it back')
  })
})
