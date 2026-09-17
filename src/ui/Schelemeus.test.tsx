// @vitest-environment jsdom

/**
 * Schelemeus on your side of Builds, and the phones that must not download him.
 *
 * The same checks `Exchange.test.tsx` makes of Charon, for the same reason: a
 * figure the stylesheet hides and the markup still renders is a figure every
 * phone pays for. jsdom fetches no images, so these check what decides the
 * request, which is whether the image element exists.
 */

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Builds } from './Builds.tsx'

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

const stand = () => document.querySelector('.skelly-stand')
const portrait = () => document.querySelector('img[src*="schelemeus-stand"]')

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Schelemeus on your side', () => {
  it('is not in the page, and so not downloaded, where there is no room for him', () => {
    aWindow(false)
    render(<Builds />)
    expect(stand()).toBeNull()
    expect(portrait()).toBeNull()
  })

  it('is drawn where there is room, directly before the shelf that makes room for him', () => {
    aWindow(true)
    render(<Builds />)
    expect(portrait()?.getAttribute('src')).toBe('/characters/schelemeus-stand.png')
    expect(stand()?.getAttribute('aria-hidden')).toBe('true')
    expect(stand()?.nextElementSibling?.classList.contains('builds-shelf')).toBe(true)
  })

  it('arrives and leaves as the window crosses the breakpoint', () => {
    const size = aWindow(false)
    render(<Builds />)
    act(() => size.widen())
    expect(portrait()).not.toBeNull()
    act(() => size.narrow())
    expect(stand()).toBeNull()
  })

  /* A single build has its own layout and nothing inset for him. */
  it('is only on the shelf', () => {
    aWindow(true)
    window.localStorage.setItem(
      'enodia.builds',
      JSON.stringify({
        version: 1,
        builds: [
          {
            id: 'mine-1',
            name: 'Open Me',
            say: '',
            how: '',
            by: 'owner',
            weapon: 'WeaponStaffSwing',
            aspect: 'StaffClearCastAspect',
            centrepiece: '',
            boons: [],
            hex: null,
            hammers: [],
            keepsake: null,
            familiar: null,
            arcana: [],
          },
        ],
      }),
    )
    render(<Builds reveal="mine-1" />)
    expect(document.querySelector('.builds.is-detail')).not.toBeNull()
    expect(stand()).toBeNull()
  })
})
