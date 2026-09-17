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
import { writeStamped } from '../state/stamps.ts'

export type View =
  /**
   * The first screen a stranger sees, and the only one that sells anything.
   * Shown once, skipped entirely for anybody arriving on a share link, and
   * reachable again from the menu. `Landing.tsx` says why it is not a wall.
   *
   * **This is what the menu's About row opens.** There used to be a separate
   * `about` view beside it, and by the time the landing page had been condensed
   * onto one screen the two were saying the same things. The internal name
   * stays `landing`, because that is still what it is: the page a first visit
   * lands on. Only the label people read says About.
   */
  | 'landing'
  | 'builds'
  | 'arcana'
  /**
   * Every entity the tool knows, each with a record at an address of its own,
   * and an index of them all. **The only screen whose address stays in the bar**:
   * a record is a thing people send each other, so `/wiki/t/ZeusWeaponBoon`
   * has to reopen it. `wiki-route.ts` says how, and `App.tsx` keeps the
   * address and the back button in step with it.
   */
  | 'wiki'
  /**
   * Rules the game never states, in three tiers of spoiler. It lived on the
   * page that stood in front of the app and left the product when that page
   * did, which nothing recorded until the gap analysis went looking for it.
   */
  | 'underhood'
  /**
   * Three things on the roadmap that will be screens and are not built.
   *
   * They open onto Dora's empty room rather than being greyed out, for the
   * reason the four Phase 4 rooms opened: a disabled row says a thing exists
   * and then refuses to say anything else. `src/data/roadmap.ts` is where each
   * one says what it will be and what it waits on.
   */
  | 'byaspect'
  | 'playhistory'
  | 'suggested'
  | 'themes'
  | 'settings'
  | 'help'
  | 'roadmap'
  | 'changelog'
  /**
   * Rooms that exist and are empty.
   *
   * These four were `disabled` menu rows, which is honest and dead: a greyed
   * entry says a thing exists and then refuses to say anything else. They open
   * now, onto a page holding a phase marker and Dora in a hard hat. Nothing
   * pretends the feature is closer than it is; "not yet" is just somewhere you
   * can walk into.
   *
   * The exchange was one of them, then a screen of its own, and is now the
   * other side of `builds`, so it has no view.
   */
  | 'account'
  | 'friends'
  | 'leaderboards'
  | 'setup'
  | 'run'

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
    writeStamped(KEY, id)
  } catch {
    // A browser that refuses storage still gets the mode for this session.
  }
}

export function applyNav(id: string) {
  const found = NAV_MODES.find((one) => one.id === id) ?? NAV_MODES[0]
  if (!found) return
  document.documentElement.dataset.nav = found.id
}
