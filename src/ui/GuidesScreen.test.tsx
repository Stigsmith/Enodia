// @vitest-environment jsdom

/**
 * Guides, with yours on one side and everybody's on the other.
 *
 * The same properties `BuildsScreen.test.tsx` holds its screen to, because it
 * is the same control doing the same job: one pair of buttons that stays put
 * while the page under it changes, a side that is hidden rather than
 * unmounted, and everybody's side left unasked for until it is shown.
 *
 * What this screen adds is that **both sides open a guide**, so the shared
 * heading has to step aside for either of them and come back on the way out.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { asGuide, packGuide } from '../state/guides.ts'
import type { GuideListing } from '../state/guides.ts'
import { forgetMentioned } from '../state/mentioned.ts'
import type { GuideSide } from '../state/prefs.ts'
import { GuidesScreen } from './GuidesScreen.tsx'

const CSS = readFileSync(join(import.meta.dirname, 'builds.css'), 'utf8')

const asked: string[] = []

async function listing(over: Partial<GuideListing> = {}): Promise<GuideListing> {
  return {
    id: 'Guide12345',
    title: 'How to beat the RNG',
    payload: await packGuide(
      asGuide({
        title: 'How to beat the RNG',
        sections: [{ heading: 'How it goes', text: 'Take @[Hestia’s Boon](t:HestiaWeaponBoon) twice.' }],
      })!,
    ),
    by: 'Ana',
    createdAt: Date.UTC(2026, 8, 18),
    updatedAt: null,
    revision: 1,
    stats: { saves: 0, likes: 0 },
    builds: [],
    ...over,
  }
}

function aServer(shelves: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      asked.push(path)
      const body = shelves[path]
      if (body === undefined) return new Response('{"error":"not signed in"}', { status: 401 })
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
}

function Screen({ start = 'mine', signedIn = false }: { start?: GuideSide; signedIn?: boolean }) {
  const [side, setSide] = useState<GuideSide>(start)
  return <GuidesScreen side={side} onSide={setSide} signedIn={signedIn} />
}

const half = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.side-switch-half')].find((one) => one.textContent === label)!
const panes = () => [...document.querySelectorAll<HTMLElement>('.sides-pane')]

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
  asked.length = 0
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the switch', () => {
  it('is two buttons, one pressed, under one title', () => {
    aServer()
    render(<Screen />)
    expect(document.querySelectorAll('h2')).toHaveLength(1)
    expect(document.querySelector('h2')?.textContent).toBe('Guides')
    expect(half('Yours').getAttribute('aria-pressed')).toBe('true')
    expect(half('Everybody').getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps focus on the half that was pressed, because it is the same button afterwards', async () => {
    aServer({ '/api/guides': { guides: [] } })
    render(<Screen />)
    const pressed = half('Everybody')
    pressed.focus()
    await act(async () => pressed.click())
    expect(document.activeElement).toBe(pressed)
    expect(document.querySelector('.side-switch')?.classList.contains('is-right')).toBe(true)
  })
})

describe('the two sides', () => {
  it('does not ask for everybody’s guides until that side is shown', async () => {
    aServer({ '/api/guides': { guides: [] } })
    render(<Screen />)
    expect(asked).not.toContain('/api/guides')
    expect(panes()).toHaveLength(1)

    await act(async () => half('Everybody').click())
    await vi.waitFor(() => expect(asked.filter((one) => one === '/api/guides')).toHaveLength(1))
  })

  it('keeps the side not showing as it was, hidden rather than gone', async () => {
    aServer({ '/api/guides': { guides: [] } })
    render(<Screen />)
    await act(async () => half('Everybody').click())
    await act(async () => half('Yours').click())

    expect(panes()[0]?.hidden).toBe(false)
    expect(panes()[1]?.hidden).toBe(true)
    // One read of the shelf for two visits.
    expect(asked.filter((one) => one === '/api/guides')).toHaveLength(1)
  })

  it('opens on everybody’s side when that is where it was left', async () => {
    aServer({ '/api/guides': { guides: [] } })
    render(<Screen start="all" />)
    expect(half('Everybody').getAttribute('aria-pressed')).toBe('true')
    await vi.waitFor(() =>
      expect(panes().find((one) => !one.hidden)?.textContent).toContain('Nobody has published a guide yet'),
    )
  })
})

describe('a guide open on either side', () => {
  it('takes the shared heading away, and gives it back', async () => {
    aServer({ '/api/guides': { guides: [await listing()] } })
    render(<Screen start="all" />)
    await vi.waitFor(() => expect(document.querySelector('.gcard-title')).not.toBeNull())

    await act(async () => document.querySelector<HTMLButtonElement>('.gcard-hit')?.click())
    await vi.waitFor(() => expect(document.querySelector('.side-switch')).toBeNull())
    expect(document.querySelector('.guide-top h2')).not.toBeNull()

    await act(async () =>
      [...document.querySelectorAll('button')].find((one) => one.textContent === 'All guides')?.click(),
    )
    expect(document.querySelector('.side-switch')).not.toBeNull()
  })
})

describe('the card, which nobody types', () => {
  /**
   * The name is the record's, never the one that was stored: the mention was
   * written as "Hestia's Boon" and the trait is called Flame Strike. The
   * subject and the opening line both have to say so, which they did not until
   * `nameOfMention` was the one rule for it.
   */
  it('says what the guide keeps naming, counted out of its own words', async () => {
    aServer({ '/api/guides': { guides: [await listing()] } })
    render(<Screen start="all" />)
    await vi.waitFor(() => expect(document.querySelector('.gcard-subject')).not.toBeNull())
    expect(document.querySelector('.gcard-subject')?.textContent).toBe('Flame Strike')
    expect(document.querySelector('.gcard-open')?.textContent).toBe('Take Flame Strike twice.')
  })
})

describe('your side, signed out', () => {
  it('asks nobody anything, and says what an account buys', () => {
    aServer()
    render(<Screen />)
    expect(asked).toEqual([])
    expect(document.body.textContent).toContain('Publishing needs an account')
  })
})

/**
 * The figures. Both are `Figures.tsx` now, including Charon, who used to be
 * `Exchange.tsx`'s alone, and the room each stands in is keyed on the wrapper
 * that follows him rather than on a media query.
 */
describe('the figures have room on both sides', () => {
  it('insets the shelf beside each of them', () => {
    expect(CSS).toContain('.is-schelemeus + .guides-shelf')
    expect(CSS).toContain('.xchange-charon + .guides-shelf')
  })
})
