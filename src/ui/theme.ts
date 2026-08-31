/**
 * The four rooms the tool can stand in.
 *
 * A theme is a palette, a light, a weather and a set of wallpapers. The
 * palette lives in `tokens.css` behind `[data-theme]`; this file is the list,
 * the wallpapers, and the words a reader sees.
 *
 * ## Where the colours came from
 *
 * Each theme has a lead image in `assets/themes/<id>/lead-*`, and its ramp was
 * measured off that image and then solved so every theme hits the same three
 * contrast ratios against its own ground. `tokens.css` carries the reasoning
 * and `theme.test.ts` holds it to numbers.
 *
 * ## Two of four are evidence, two are judgement
 *
 * The game ships its dialogue box twice, default and Olympian, which is where
 * `--plate` and `--metal` come from for those two: a near-black plate with
 * jade-cyan crescents, and a pale stone plate with a gold laurel. It does not
 * ship an Infernal or a Cthonic one, so those two plates are derived from
 * their lead art rather than taken. Worth knowing which is which.
 *
 * ## The wallpaper belongs to the theme
 *
 * Each theme owns its pictures, the first being its lead and its default. The
 * opacity on each one is measured rather than chosen: dimmed until its mean
 * sits under the panel colour and its brightest 1 percent under the lightest
 * surface the UI draws, taken on the wide frame and the phone crop both. The
 * phone crop is what usually binds, because covering a wide picture on a
 * portrait screen shows only its middle.
 */

export type Weather = 'dust' | 'pollen' | 'embers' | 'stars'

export type Wallpaper = {
  id: string
  name: string
  /** path under assets/, written whole so the prune scan can see it */
  file: string
  /** measured, not picked. See the docblock */
  opacity: number
}

export type Theme = {
  id: string
  name: string
  /** one line, what room this is */
  say: string
  /** what the particles do, which differs by more than colour */
  weather: Weather
  /** where the fog banks, as a CSS gradient position */
  fog: string
  /** true where the game itself draws this theme's plate */
  platedByTheGame: boolean
  wallpapers: Wallpaper[]
}

export const THEMES: Theme[] = [
  {
    id: 'unseen',
    name: 'Unseen',
    say: 'Green witch-fire on near-black. Hecate’s light, and where the tool started.',
    weather: 'dust',
    fog: '70% 55% at 50% 100%',
    platedByTheGame: true,
    wallpapers: [
      { id: 'melinoe', name: 'Melinoë', file: 'themes/unseen/lead-melinoe-witchfire.jpg', opacity: 0.12 },
      { id: 'crossroads', name: 'The Crossroads', file: 'themes/unseen/crossroads-cauldron.png', opacity: 0.12 },
      { id: 'thanatos', name: 'Thanatos', file: 'themes/unseen/thanatos.jpg', opacity: 0.11 },
      { id: 'ruins', name: 'Green ruins', file: 'themes/unseen/green-ruins.jpg', opacity: 0.11 },
      { id: 'warsong', name: 'Warsong', file: 'themes/unseen/warsong.jpg', opacity: 0.12 },
    ],
  },
  {
    id: 'olympian',
    name: 'Olympian',
    say: 'Gold over cloud at the last hour of the light. The only theme the game draws in stone.',
    weather: 'pollen',
    fog: '80% 60% at 50% 0%',
    platedByTheGame: true,
    wallpapers: [
      { id: 'cloud', name: 'Above the cloud', file: 'themes/olympian/lead-above-the-cloud.png', opacity: 0.04 },
      { id: 'sunburst', name: 'Sunburst', file: 'themes/olympian/sunburst-leap.png', opacity: 0.1 },
      { id: 'pantheon', name: 'The pantheon', file: 'themes/olympian/the-pantheon.jpg', opacity: 0.09 },
    ],
  },
  {
    id: 'infernal',
    name: 'Infernal',
    say: 'Molten orange on black rock, small and hot, with the smoke banked low.',
    weather: 'embers',
    fog: '85% 60% at 50% 100%',
    platedByTheGame: false,
    wallpapers: [
      { id: 'asphodel', name: 'Asphodel', file: 'themes/infernal/lead-asphodel.jpg', opacity: 0.1 },
      { id: 'titan', name: 'The titan, chained', file: 'themes/infernal/titan-chained.jpg', opacity: 0.12 },
      { id: 'gate', name: 'The gate', file: 'themes/infernal/zagreus-gate.jpg', opacity: 0.1 },
      { id: 'ridge', name: 'Asphodel ridge', file: 'themes/infernal/asphodel-ridge.jpg', opacity: 0.12 },
      { id: 'lord', name: 'Lord of the dead', file: 'themes/infernal/lord-of-the-dead.jpg', opacity: 0.15 },
      { id: 'red', name: 'Red blade', file: 'themes/infernal/zagreus-red.jpg', opacity: 0.14 },
    ],
  },
  {
    id: 'cthonic',
    name: 'Cthonic',
    say: 'Violet in open space. The one theme whose particles are stars, so they hold still.',
    weather: 'stars',
    fog: '90% 70% at 50% 50%',
    platedByTheGame: false,
    wallpapers: [
      { id: 'chaos', name: 'Chaos', file: 'themes/cthonic/lead-chaos.jpg', opacity: 0.09 },
      { id: 'dream', name: 'The dream', file: 'themes/cthonic/dream-poppies.png', opacity: 0.09 },
      { id: 'blacksun', name: 'Black sun', file: 'themes/cthonic/black-sun.png', opacity: 0.13 },
    ],
  },
]

/**
 * Unseen, because it is the room the tool was built in and every colour in it
 * was sampled from the game rather than derived from a picture.
 */
export const DEFAULT_THEME = 'unseen'

const THEME_KEY = 'enodia.theme'
const WALL_KEY = 'enodia.wallpaper'

export const themeById = (id: string): Theme =>
  THEMES.find((one) => one.id === id) ?? THEMES[0]!

export function readTheme(): string {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return THEMES.some((one) => one.id === saved) ? (saved as string) : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function writeTheme(id: string) {
  try {
    localStorage.setItem(THEME_KEY, id)
  } catch {
    // A browser that refuses storage still gets the theme for this session.
  }
}

/**
 * Which wallpaper each theme is wearing.
 *
 * A map rather than one value, so switching to Infernal and back does not
 * forget that Unseen was set to the Crossroads. Anything unreadable, including
 * the single string this key used to hold, falls back to every theme's lead.
 */
export function readWallpapers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WALL_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, string> = {}
    for (const theme of THEMES) {
      const want = (parsed as Record<string, unknown>)[theme.id]
      if (typeof want === 'string' && theme.wallpapers.some((w) => w.id === want)) out[theme.id] = want
    }
    return out
  } catch {
    return {}
  }
}

export function writeWallpapers(map: Record<string, string>) {
  try {
    localStorage.setItem(WALL_KEY, JSON.stringify(map))
  } catch {
    // Same as above. A default is not a failure state.
  }
}

/** The wallpaper a theme is wearing, or its lead. `none` for no picture. */
export function wallpaperOf(theme: Theme, chosen: Record<string, string>): Wallpaper | null {
  const want = chosen[theme.id]
  if (want === 'none') return null
  return theme.wallpapers.find((one) => one.id === want) ?? theme.wallpapers[0] ?? null
}

/**
 * Push a theme onto the document.
 *
 * `data-theme` selects the palette out of `tokens.css`, `data-weather` selects
 * what the particles do, and the wallpaper and fog go on as custom properties.
 * One attribute and three properties, so adding a theme is one entry in
 * `THEMES` plus one block of tokens, and no new CSS anywhere else.
 */
export function applyTheme(id: string, chosen: Record<string, string> = readWallpapers()) {
  const theme = themeById(id)
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.weather = theme.weather

  const wall = wallpaperOf(theme, chosen)
  root.style.setProperty('--wall-src', wall ? `url('/${wall.file}')` : 'none')
  root.style.setProperty('--wall-opacity', String(wall?.opacity ?? 0))
  root.style.setProperty('--fog-at', theme.fog)
}
