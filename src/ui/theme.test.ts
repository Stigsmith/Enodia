/**
 * The four themes, held to the claims their comments make.
 *
 * `DESIGN.md` 11: a green build proves nothing. A theme is a table of colours,
 * and a colour that fails is invisible rather than loud, so these read the
 * tokens straight out of `tokens.css` and check the arithmetic.
 *
 * The claim under test is the one that lets four themes share one set of
 * screens: **every ramp hits the same contrast against its own ground.** The
 * first pass rotated jade's hue and kept its HSL numbers, which passed a naive
 * check and put Cthonic's dim step at 1.9 against its own ground. Equal
 * lightness is not equal contrast, and only the second of those is legibility.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { THEMES, DEFAULT_THEME, themeById, wallpaperOf } from './theme.ts'

const CSS = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')

/** Every custom property inside one selector's block. */
function tokensOf(selector: string): Record<string, string> {
  const at = CSS.indexOf(selector + ' {')
  if (at < 0) throw new Error(`no block for ${selector}`)
  const body = CSS.slice(at, CSS.indexOf('}', at))
  const out: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[name!.trim()] = value!.trim()
  }
  return out
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.trim().replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

const relative = (hex: string): number => {
  const channel = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = rgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [relative(a), relative(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const hue = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

const apart = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** The shipped ramp, and the shape every theme is held to. */
const ROOT = tokensOf(':root')
const TARGET = [
  contrast(ROOT['--lit-dim']!, ROOT['--ink-950']!),
  contrast(ROOT['--lit']!, ROOT['--ink-950']!),
  contrast(ROOT['--lit-hot']!, ROOT['--ink-950']!),
]

const BLOCKS = THEMES.map((theme) => ({ theme, tokens: tokensOf(`[data-theme='${theme.id}']`) }))

describe('the token blocks', () => {
  it('gives every theme a block, including the default', () => {
    // Unseen lives in :root so a page with no attribute renders, and it needs a
    // block of its own as well, or a picker card marked unseen would inherit
    // whichever theme the page happens to be wearing.
    for (const { theme, tokens } of BLOCKS) {
      expect(Object.keys(tokens).length, theme.id).toBeGreaterThan(10)
    }
  })

  it('has every theme define exactly the same tokens', () => {
    // A token defined in three blocks and forgotten in the fourth is how one
    // theme ends up wearing another theme's colour.
    const names = BLOCKS.map(({ tokens }) => Object.keys(tokens).sort().join(','))
    expect(new Set(names).size).toBe(1)
  })

  it('defines nothing that :root does not', () => {
    // The classic unreadable-theme bug: a colour whose only definition sits
    // behind [data-theme] simply does not exist in the un-stamped state.
    for (const { theme, tokens } of BLOCKS) {
      for (const name of Object.keys(tokens)) {
        expect(ROOT[name], `${name} is only defined under ${theme.id}`).toBeDefined()
      }
    }
  })

  it('matches :root to the default theme exactly', () => {
    const unseen = tokensOf(`[data-theme='${DEFAULT_THEME}']`)
    for (const [name, value] of Object.entries(unseen)) {
      expect(ROOT[name], name).toBe(value)
    }
  })
})

describe('every ramp reads the same against its own ground', () => {
  it.each(THEMES.map((t) => t.id))('%s', (id) => {
    const tokens = tokensOf(`[data-theme='${id}']`)
    const ground = tokens['--ink-950']!
    const steps = ['--lit-dim', '--lit', '--lit-hot'].map((n) => contrast(tokens[n]!, ground))
    steps.forEach((got, i) => expect(got).toBeCloseTo(TARGET[i]!, 0))
  })

  it('keeps body text legible on all four grounds', () => {
    for (const { theme, tokens } of BLOCKS) {
      expect(contrast(ROOT['--bone']!, tokens['--ink-950']!), theme.id).toBeGreaterThan(4.5)
    }
  })

  it('keeps a plate readable, whichever way round it is', () => {
    // Olympian's plate is pale, so its text is dark. The pair has to work in
    // both directions and this is the check that says so.
    for (const { theme, tokens } of BLOCKS) {
      expect(contrast(tokens['--on-plate']!, tokens['--plate']!), theme.id).toBeGreaterThan(4.5)
    }
  })

  it('keeps the dim step usable as a border', () => {
    for (const { theme, tokens } of BLOCKS) {
      expect(contrast(tokens['--lit-dim']!, tokens['--ink-950']!), theme.id).toBeGreaterThan(2.8)
    }
  })
})

describe('the event colours stay tellable apart', () => {
  const magenta = hue(ROOT['--rim-magenta']!)
  const cyan = hue(ROOT['--rim-cyan']!)

  it('holds every accent at least 30 degrees off both', () => {
    // A death must never read as decoration, which is what an accent sitting
    // on top of the event hue would make it.
    for (const { theme, tokens } of BLOCKS) {
      const h = hue(tokens['--lit-accent']!)
      expect(apart(h, magenta), `${theme.id} vs magenta`).toBeGreaterThanOrEqual(30)
      expect(apart(h, cyan), `${theme.id} vs cyan`).toBeGreaterThanOrEqual(30)
    }
  })

  it('never lets a theme redefine an event colour', () => {
    for (const { theme, tokens } of BLOCKS) {
      expect(tokens['--rim-magenta'], theme.id).toBeUndefined()
      expect(tokens['--rim-cyan'], theme.id).toBeUndefined()
      expect(tokens['--unbuilt'], theme.id).toBeUndefined()
      expect(tokens['--bone'], theme.id).toBeUndefined()
    }
  })
})

describe('the wallpapers', () => {
  it('gives every theme a lead and keeps every path under its own folder', () => {
    for (const theme of THEMES) {
      expect(theme.wallpapers.length, theme.id).toBeGreaterThan(0)
      expect(theme.wallpapers[0]!.id).toBeTruthy()
      for (const wall of theme.wallpapers) {
        expect(wall.file.startsWith(`themes/${theme.id}/`), wall.file).toBe(true)
      }
    }
  })

  it('dims every one of them, and none to nothing', () => {
    for (const theme of THEMES) {
      for (const wall of theme.wallpapers) {
        expect(wall.opacity, wall.file).toBeGreaterThan(0)
        expect(wall.opacity, wall.file).toBeLessThanOrEqual(0.2)
      }
    }
  })

  it('falls back to the lead, and honours none', () => {
    const unseen = themeById('unseen')
    expect(wallpaperOf(unseen, {})?.id).toBe(unseen.wallpapers[0]!.id)
    expect(wallpaperOf(unseen, { unseen: 'nonsense' })?.id).toBe(unseen.wallpapers[0]!.id)
    expect(wallpaperOf(unseen, { unseen: 'none' })).toBeNull()
  })

  it('gives no two wallpapers in a theme the same id', () => {
    for (const theme of THEMES) {
      const ids = theme.wallpapers.map((one) => one.id)
      expect(new Set(ids).size, theme.id).toBe(ids.length)
    }
  })
})
