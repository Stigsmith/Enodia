/**
 * The shape of the tool: a short menu, nothing left unreachable by making it
 * short, and pages that fold so they fit on one screen.
 *
 * On 2 October 2026 the menu went from sixteen rows to seven because the owner
 * said a stranger would be put off by it. Shortening a menu is the easiest way
 * to strand a screen, so this walks every row and every tab and fails on a
 * screen nobody can reach any more. It also fails on a fold page whose folds
 * are not one group, which is what makes opening one close the last.
 */

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Menu } from './Menu.tsx'
import { Changelog, Roadmap, UnderHood } from './Pages.tsx'
import { Help } from './Reference.tsx'
import { BUNDLES, bundleOf } from './ScreenTabs.tsx'
import type { View } from './nav.ts'

/** A narrow window, so the menu is the pop-out and Dora stays off the Roadmap. */
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
})

afterEach(cleanup)

/** Every screen the menu reaches, one press of each row. */
function menuReaches(hasRun: boolean): { rows: string[]; reached: View[] } {
  const onGo = vi.fn<(view: View) => void>()
  render(<Menu view="builds" hasRun={hasRun} onGo={onGo} onEndRun={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  const rows = screen.getAllByRole('menuitem')
  const labels = rows.map((row) => row.textContent ?? '')
  for (const row of rows) {
    if (!screen.queryByRole('menu')) fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: row.textContent ?? '' }))
  }
  return { rows: labels, reached: onGo.mock.calls.map(([view]) => view) }
}

describe('the menu', () => {
  it('is seven rows with no run, which is the length the owner asked for', () => {
    const { rows } = menuReaches(false)
    expect(rows).toEqual(['Builds', 'Guides', 'Arcana', 'Wiki', 'Start a run', 'Settings', 'Help'])
  })

  /**
   * Every screen a reader could reach before is one press of a row, or one
   * press of a row and then one tab. Account and Friends are in the corner
   * control, the run is the run, and the three unbuilt rooms are on the
   * Roadmap, so none of those is asked of the menu.
   */
  it('still reaches every screen, through a row or the tabs of one', () => {
    const { reached } = menuReaches(false)
    const viaTabs = reached.flatMap((view) => bundleOf(view)?.tabs.map((tab) => tab.id) ?? [])
    const all = new Set<View>([...reached, ...viaTabs])
    for (const view of [
      'builds',
      'guides',
      'arcana',
      'wiki',
      'underhood',
      'setup',
      'settings',
      'themes',
      'help',
      'changelog',
      'roadmap',
      'landing',
    ] as View[]) {
      expect(all.has(view), `${view} cannot be reached`).toBe(true)
    }
  })

  it('opens the head of each family it took in, never a tab in the middle of one', () => {
    const { reached } = menuReaches(false)
    for (const bundle of BUNDLES) expect(reached).toContain(bundle.home)
  })
})

describe('the families', () => {
  it('put each screen in one family at most', () => {
    const seen = BUNDLES.flatMap((bundle) => bundle.tabs.map((tab) => tab.id))
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('open on their own head, which is their first tab', () => {
    for (const bundle of BUNDLES) expect(bundle.tabs[0]?.id).toBe(bundle.home)
  })
})

/**
 * The owner's rule for long pages: one line each, and opening one closes the
 * last. A `<details>` group does the closing, so every fold on a page has to
 * carry the same `name`, and at most one may start open.
 */
describe.each([
  ['the roadmap', Roadmap, 'roadmap'],
  ['help', Help, 'help'],
  ['under the hood', UnderHood, 'underhood'],
  ['the changelog', Changelog, 'changelog'],
] as const)('%s', (_, Page, group) => {
  it('is one group of folds, at most one of them open', () => {
    const { container } = render(<Page />)
    const folds = [...container.querySelectorAll('details')]
    expect(folds.length).toBeGreaterThan(3)
    for (const fold of folds) expect(fold.getAttribute('name')).toBe(group)
    expect(folds.filter((fold) => fold.open).length).toBeLessThanOrEqual(1)
  })
})
