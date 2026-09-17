// @vitest-environment jsdom

/**
 * Builds, with yours on one side and everybody's on the other.
 *
 * What has to hold: the switch is one pair of buttons that stays put while the
 * page under it changes, so focus stays where it was pressed; the side not
 * showing keeps its state; everybody's side is not asked for until it is
 * shown; and the counts that lived on the Mine shelf reach the library's own
 * cards, with a way back for a listing whose build is gone.
 */

import { act, cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { saveBuild } from '../state/builds.ts'
import type { BuildSide } from '../state/prefs.ts'
import { packBuild } from '../state/transfer.ts'
import { BuildsScreen } from './BuildsScreen.tsx'

const stats = (over = {}) => ({
  takes: 0,
  players: 0,
  runs: 0,
  clears: 0,
  bestFear: null,
  rating: null,
  raters: 0,
  ...over,
})

type Row = { id: string; build: ShownBuild; takenDown?: boolean; stats?: ReturnType<typeof stats> }

/** A server with a shelf for each path, and a record of what was asked. */
function aServer(shelves: Record<string, Row[]> = {}) {
  const asked: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      asked.push(path)
      const rows = shelves[path]
      if (!rows) return new Response('{"error":"not signed in"}', { status: 401 })
      const builds = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          name: row.build.name,
          payload: await packBuild(row.build),
          by: 'Owner',
          createdAt: 0,
          mine: true,
          ...(row.takenDown === undefined ? {} : { takenDown: row.takenDown }),
          stats: row.stats ?? stats(),
        })),
      )
      return new Response(JSON.stringify({ builds }), { status: 200 })
    }),
  )
  return asked
}

function Screen({ start = 'mine', signedIn = false }: { start?: BuildSide; signedIn?: boolean }) {
  const [side, setSide] = useState<BuildSide>(start)
  return (
    <BuildsScreen
      side={side}
      onSide={setSide}
      onGo={() => {}}
      libraryAt={0}
      onLibrary={() => {}}
      reveal={null}
      onRevealed={() => {}}
      signedIn={signedIn}
    />
  )
}

const half = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.side-switch-half')].find((one) => one.textContent === label)!
const panes = () => [...document.querySelectorAll<HTMLElement>('.sides-pane')]
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)))

beforeEach(() => {
  window.localStorage.clear()
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
    expect(half('Yours').getAttribute('aria-pressed')).toBe('true')
    expect(half('The exchange').getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps focus on the half that was pressed, because it is the same button afterwards', async () => {
    aServer({ '/api/exchange': [] })
    render(<Screen />)
    const pressed = half('The exchange')
    pressed.focus()
    await act(async () => pressed.click())
    expect(document.activeElement).toBe(pressed)
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.side-switch')?.classList.contains('is-right')).toBe(true)
  })

  it('slides the side in only once the side has changed, from the side it is on', async () => {
    aServer({ '/api/exchange': [] })
    render(<Screen />)
    expect(panes().some((one) => /is-from/.test(one.className))).toBe(false)
    await act(async () => half('The exchange').click())
    expect(panes()[1]?.className).toContain('is-from-right')
    await act(async () => half('Yours').click())
    expect(panes()[0]?.className).toContain('is-from-left')
  })
})

describe('the two sides', () => {
  it('does not ask for everybody’s builds until that side is shown', async () => {
    const asked = aServer({ '/api/exchange': [] })
    render(<Screen />)
    await settle()
    expect(asked).not.toContain('/api/exchange')
    expect(panes()).toHaveLength(1)

    await act(async () => half('The exchange').click())
    await settle()
    expect(asked.filter((one) => one === '/api/exchange')).toHaveLength(1)
  })

  it('keeps the side not showing as it was, hidden rather than gone', async () => {
    const asked = aServer({ '/api/exchange': [] })
    render(<Screen />)
    saveBuild({ ...FIRST_BUILD, id: 'mine-1', by: 'owner' })
    cleanup()
    render(<Screen />)
    const search = document.querySelector<HTMLInputElement>('.sides-pane input')
    expect(search).not.toBeNull()
    await act(async () => half('The exchange').click())
    await act(async () => half('Yours').click())
    await settle()

    expect(panes()[0]?.hidden).toBe(false)
    expect(panes()[1]?.hidden).toBe(true)
    // The same elements, and one read of the shelf for two visits.
    expect(document.querySelector('.sides-pane input')).toBe(search)
    expect(asked.filter((one) => one === '/api/exchange')).toHaveLength(1)
  })

  it('opens on everybody’s side when that is where it was left', async () => {
    aServer({ '/api/exchange': [] })
    render(<Screen start="all" />)
    await settle()
    expect(half('The exchange').getAttribute('aria-pressed')).toBe('true')
    expect(panes().find((one) => !one.hidden)?.textContent).toContain('Nothing published yet')
  })
})

describe('your listings, on your side', () => {
  const published = { ...FIRST_BUILD, id: 'mine-1', name: 'Listed Build', by: 'owner' as const, publishedAs: 'KmUkC9VotY' }
  const gone = { ...FIRST_BUILD, id: 'mine-2', name: 'Deleted Build', by: 'owner' as const }

  it('asks nothing while signed out', async () => {
    saveBuild(published)
    const asked = aServer()
    render(<Screen />)
    await settle()
    expect(asked).toEqual([])
  })

  it('puts a listing’s counts on the card of the build it was published from', async () => {
    saveBuild(published)
    aServer({
      '/api/exchange/mine': [{ id: 'KmUkC9VotY', build: published, stats: stats({ runs: 5, clears: 3, players: 2 }) }],
      '/api/exchange/followed': [],
    })
    render(<Screen signedIn />)
    await settle()
    const card = [...document.querySelectorAll('.bcard')].find((one) => one.textContent?.includes('Listed Build'))
    expect(card?.querySelector('.xchange-counts')?.textContent).toContain('3 of 5 cleared')
  })

  it('says a listing is off the shelves on its card', async () => {
    saveBuild(published)
    aServer({
      '/api/exchange/mine': [{ id: 'KmUkC9VotY', build: published, takenDown: true }],
      '/api/exchange/followed': [],
    })
    render(<Screen signedIn />)
    await settle()
    expect(document.querySelector('.bcard .xchange-down')?.textContent).toMatch(/^Off the shelves/)
  })

  it('offers back a listing whose build is not in the library', async () => {
    saveBuild(published)
    aServer({
      '/api/exchange/mine': [
        { id: 'KmUkC9VotY', build: published },
        { id: 'Zz9yX8wV7u', build: gone },
      ],
      '/api/exchange/followed': [],
    })
    render(<Screen signedIn />)
    await settle()
    const line = document.querySelector<HTMLButtonElement>('.builds-unheld-line button')
    expect(line?.textContent).toBe('One of your listings has no build here')
    await act(async () => line?.click())
    const rows = [...document.querySelectorAll('.builds-unheld li')]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.textContent).toContain('Deleted Build')
    expect(rows[0]?.querySelector('button')?.textContent).toBe('Put it back')
  })
})

describe('a build open on your side', () => {
  it('has its own heading, so the shared one steps aside', async () => {
    saveBuild({ ...FIRST_BUILD, id: 'mine-1', name: 'Open Me', by: 'owner' })
    aServer()
    render(<Screen />)
    const card = [...document.querySelectorAll('.bcard')].find((one) => one.textContent?.includes('Open Me'))
    await act(async () => card?.querySelector<HTMLButtonElement>('.bcard-hit')?.click())
    expect(document.querySelector('.side-switch')).toBeNull()
    expect([...document.querySelectorAll('button')].some((one) => one.textContent === 'All builds')).toBe(true)

    await act(async () => [...document.querySelectorAll('button')].find((one) => one.textContent === 'All builds')?.click())
    expect(document.querySelector('.side-switch')).not.toBeNull()
  })
})
