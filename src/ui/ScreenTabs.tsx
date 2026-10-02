/**
 * The tabs across the top of a screen that took other screens in.
 *
 * The menu had sixteen rows, which the owner said would put people off before
 * they had pressed one, and several of them were the same kind of thing told
 * apart: four pages about the tool, two about how it looks, two about the
 * game's rules. Each family is one menu row now, and its members are tabs
 * across the top of whichever one is open.
 *
 * **A tab is still its own view.** Pressing one goes to that view the way the
 * menu row used to, so every screen keeps its own help tour, its own scroll and,
 * for the wiki, its own address. Only where it is reached from has moved.
 *
 * Built on `Tabs`, so it wears whichever look the interface is drawn in.
 */

import { Tabs } from './Tabs.tsx'
import type { View } from './nav.ts'

export type Bundle = {
  /** the view its menu row opens */
  home: View
  label: string
  tabs: { id: View; label: string }[]
}

export const BUNDLES: Bundle[] = [
  {
    home: 'help',
    label: 'Help',
    tabs: [
      { id: 'help', label: 'How it works' },
      { id: 'changelog', label: 'What’s new' },
      { id: 'roadmap', label: 'What’s coming' },
      { id: 'landing', label: 'About' },
    ],
  },
  {
    home: 'settings',
    label: 'Settings',
    tabs: [
      { id: 'settings', label: 'General' },
      { id: 'themes', label: 'Appearance' },
    ],
  },
  {
    home: 'wiki',
    label: 'Wiki',
    tabs: [
      { id: 'wiki', label: 'Records' },
      { id: 'underhood', label: 'Under the hood' },
    ],
  },
]

/** The family a view belongs to, or null for a view that is its own row. */
export const bundleOf = (view: View): Bundle | null =>
  BUNDLES.find((one) => one.tabs.some((tab) => tab.id === view)) ?? null

export function ScreenTabs({ view, onGo }: { view: View; onGo: (view: View) => void }) {
  const bundle = bundleOf(view)
  if (!bundle) return null
  return (
    <nav className="screen-tabs" aria-label={bundle.label}>
      <Tabs tabs={bundle.tabs} open={view} onOpen={onGo} label={bundle.label} />
    </nav>
  )
}
