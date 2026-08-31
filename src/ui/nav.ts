/**
 * Where the menu lives.
 *
 * On a phone it is a pop-out and there is nothing to decide: a permanent pane
 * on a 390 wide screen is the screen. On a desktop it is a real choice, so it
 * is a setting rather than a decision.
 *
 * - **Pop-out** is the old behaviour. A button top left, a panel over the page,
 *   and it returns you where you were. `DESIGN.md` 8.
 * - **Pane** pins the same panel open down the left edge. Nothing covers, and
 *   every screen the tool has is one click away without a menu opening first.
 *
 * `applyNav` writes `data-nav` on the root and `surface.css` keys off it,
 * **inside a `min-width: 60rem` query**, so the setting is simply ignored on a
 * narrow screen rather than having to be defended against. A phone gets the
 * pop-out whatever is stored.
 */

/**
 * The four screens.
 *
 * Here rather than in `App.tsx` because the menu is what moves between them
 * and both need the name.
 */
export type View = 'builds' | 'arcana' | 'setup' | 'run'

export type NavOption = {
  id: string
  name: string
  note: string
}

export const NAV_MODES: NavOption[] = [
  {
    id: 'popout',
    name: 'Pop-out',
    note: 'A button top left and a panel over the page. What a phone gets either way',
  },
  {
    id: 'pane',
    name: 'Left pane',
    note: 'Pinned open down the side. Nothing covers, and nothing has to be opened first',
  },
]

/**
 * The pop-out, because it is the one that is true on every screen.
 *
 * A default of `pane` would be a different layout on a desktop and the same
 * layout on a phone, which makes the first thing a new reader learns wrong
 * half the time.
 */
export const DEFAULT_NAV = 'popout'

/** Below this the setting is ignored and the pop-out is the only mode. */
export const PANE_QUERY = '(min-width: 60rem)'

const KEY = 'enodia.nav'

export function readNav(): string {
  try {
    const saved = localStorage.getItem(KEY)
    return NAV_MODES.some((one) => one.id === saved) ? (saved as string) : DEFAULT_NAV
  } catch {
    return DEFAULT_NAV
  }
}

export function writeNav(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // A browser that refuses storage still gets the mode for this session.
  }
}

export function applyNav(id: string) {
  const found = NAV_MODES.find((one) => one.id === id) ?? NAV_MODES[0]
  if (!found) return
  document.documentElement.dataset.nav = found.id
}
