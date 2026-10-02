/**
 * What the interface itself is drawn with: the game's own chrome art, or CSS.
 *
 * **Only the furniture changes.** Buttons, panels, trays, tabs, toggles, the
 * rings round a bubble and the plates behind a boon's name are chrome, and
 * `plain.css` redraws every one of them out of the theme's tokens. Boon and god
 * icons, rarity frames on an icon, portraits, Charon, Dora and the wallpapers
 * are content or flavour and are the same in both.
 *
 * `applySkin` writes `data-skin` on the root, the same way `applyTheme` writes
 * `data-theme`, and `plain.css` keys every rule off it. The game's art stays the
 * default because it is what the tool has always looked like.
 *
 * **The plain skin follows the theme all the way.** The game's chrome is fixed
 * art and a theme can only turn its hue (`--art-hue` in `tokens.css`); the CSS
 * version is made of `--metal`, `--lit` and the ink ramp, so Olympian gets gold
 * edges and Infernal gets copper ones rather than a rotated teal.
 */

import { writeStamped } from '../state/stamps.ts'

export type SkinOption = {
  id: string
  name: string
}

export const SKINS: SkinOption[] = [
  { id: 'game', name: 'The game’s own art' },
  { id: 'plain', name: 'Plain' },
]

export const DEFAULT_SKIN = 'game'

const KEY = 'enodia.skin'

export function readSkin(): string {
  try {
    const saved = localStorage.getItem(KEY)
    return SKINS.some((one) => one.id === saved) ? (saved as string) : DEFAULT_SKIN
  } catch {
    return DEFAULT_SKIN
  }
}

export function writeSkin(id: string) {
  try {
    writeStamped(KEY, id)
  } catch {
    // A browser that refuses storage still gets the skin for this session.
  }
}

export function applySkin(id: string) {
  const found = SKINS.find((one) => one.id === id) ?? SKINS[0]
  if (!found) return
  document.documentElement.dataset.skin = found.id
}
