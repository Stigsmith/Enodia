/**
 * The picture behind the tool.
 *
 * `Hecate.tsx` lights the page with jade and nothing else, which is right and
 * is also very empty. This puts one of the game's own run-select splashes
 * underneath that light, far enough down that it reads as a room rather than
 * as a picture.
 *
 * ## How dim "very dim" is, and why it is not a taste
 *
 * A wallpaper behind a dark UI fails in two ways: it lifts the whole page off
 * black, and it has bright spots that pull the eye off the text. So each
 * option is dimmed until both are false, against the app's own ink ramp:
 *
 * - its **mean** must not come out brighter than `--ink-900`, the panel colour
 * - its **99th percentile** must not come out brighter than `--ink-800`, the
 *   lightest surface the UI itself draws
 *
 * Composited over `--ink-950` that is `12.1 + a * (L - 12.1)`, solved for `a`
 * and the stricter of the two taken. Measured on the full frame **and on the
 * middle square**, because a portrait phone crops to the middle and the middle
 * of the Crossroads is the lit cauldron. The phone crop is what binds for the
 * Underworld: 0.15 on the wide frame, 0.12 on the slice.
 *
 * | | mean | p99 | lands at |
 * |---|---|---|---|
 * | Underworld | 54.9 | 151.3 | **0.12** |
 * | Surface | 137.0 | 234.2 | **0.04** |
 * | Dream | 75.5 | 209.7 | **0.09** |
 *
 * All three come out at a mean of about 17, just under the panel colour. One
 * rule, three numbers, and the loud gold one is quiet rather than banned.
 *
 * **Only the Underworld is in the palette.** `tokens.css` takes jade from
 * Hecate and `CLAUDE.md` records that gold is not a Hades II chrome colour, so
 * the Surface splash sits against the theme however dim it is. It is offered
 * anyway because that is a look to be chosen or rejected on sight, not
 * argued about.
 */

export type WallpaperOption = {
  id: string
  name: string
  note: string
  /** path under assets/, written whole so the prune scan can see it */
  file: string | null
  /** what survives over the ink. Solved, not picked. See the docblock */
  opacity?: number
}

export const WALLPAPERS: WallpaperOption[] = [
  {
    id: 'none',
    name: 'None',
    note: 'Hecate\u2019s light and nothing behind it',
    file: null,
  },
  {
    id: 'underworld',
    name: 'Underworld',
    note: 'The Crossroads cauldron. The one splash that is already in the palette',
    file: 'shell/splash-underworld.png',
    opacity: 0.12,
  },
  {
    id: 'surface',
    name: 'Surface',
    note: 'Olympus above the cloud. Warm, and it pulls against the jade',
    file: 'shell/splash-surface.png',
    opacity: 0.04,
  },
  {
    id: 'dream',
    name: 'Dream',
    note: 'Poppies and the sleep mask. Red where the tool is green',
    file: 'shell/splash-dreamrun.png',
    opacity: 0.09,
  },
]

/** The Crossroads, because it is the one that does not fight the palette. */
export const DEFAULT_WALLPAPER = 'underworld'

const KEY = 'enodia.wallpaper'

export function readWallpaper(): string {
  try {
    const saved = localStorage.getItem(KEY)
    return WALLPAPERS.some((one) => one.id === saved) ? (saved as string) : DEFAULT_WALLPAPER
  } catch {
    return DEFAULT_WALLPAPER
  }
}

export function writeWallpaper(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // A browser that refuses storage still gets the wallpaper for this session.
  }
}

/**
 * Push a wallpaper onto the document.
 *
 * Two custom properties, so adding an option is one entry in `WALLPAPERS` and
 * no CSS at all. The same shape `frames.ts` uses, for the same reason.
 */
export function applyWallpaper(id: string) {
  const found = WALLPAPERS.find((one) => one.id === id) ?? WALLPAPERS[0]
  if (!found) return
  const root = document.documentElement
  root.dataset.wallpaper = found.id
  root.style.setProperty('--wall-src', found.file ? `url('/${found.file}')` : 'none')
  root.style.setProperty('--wall-opacity', String(found.opacity ?? 0))
}
