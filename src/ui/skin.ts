/**
 * What the interface itself is drawn with: the game's own chrome art, or one
 * of three looks drawn in CSS.
 *
 * **Only the furniture changes.** Buttons, menu rows, panels, trays, tabs,
 * toggles and the plates behind a boon's name are chrome, and `skins.css`
 * redraws every one of them. Boon and god icons, rarity frames on an icon,
 * portraits, Charon, Dora, the wallpapers, the sigil and rings of a radial and
 * the help mark are content or flavour and are the same in all four.
 *
 * `applySkin` writes two attributes on the root. `data-skin` names the look, and
 * `data-chrome="css"` is on for every look that is not the game's, which is
 * what the structural rules in `skins.css` key off: one set of rules takes the
 * game's art away, and each look is only a block of values for them to read.
 * A fourth CSS look is one more block.
 *
 * **They follow the theme all the way.** The game's chrome is fixed art that a
 * theme can only turn (`--art-hue` in `tokens.css`); these are made of `--lit`,
 * `--metal` and the ink ramp, so Olympian's edges come out gold.
 */

import { writeStamped } from '../state/stamps.ts'

export type SkinOption = {
  id: string
  name: string
  /** one line, what it looks like */
  say: string
}

export const SKINS: SkinOption[] = [
  { id: 'game', name: 'The game’s art', say: 'Buttons and panels taken from the game itself.' },
  { id: 'hairline', name: 'Hairline', say: 'Flat, with thin lit edges and almost no fill.' },
  { id: 'carved', name: 'Carved', say: 'Square plates with double edges and small capitals, in the game’s spirit without its art.' },
  { id: 'soft', name: 'Soft', say: 'Filled, rounded blocks with no edges.' },
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
  const root = document.documentElement
  root.dataset.skin = found.id
  if (found.id === DEFAULT_SKIN) delete root.dataset.chrome
  else root.dataset.chrome = 'css'
}
