/**
 * The skins: the switch, and the stylesheet keeping up with the chrome.
 *
 * The second half is the one that matters later. `skins.css` overrides rules
 * by name, so a new rule in `surface.css` or `builds.css` that draws the game's
 * chrome art would show that art under every CSS look too, and nothing on the
 * game skin would look wrong. This reads both stylesheets for every rule that
 * draws chrome and fails on any selector `skins.css` does not answer, and it
 * fails on a look that leaves out a value the structure reads.
 */

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { gather } from '../state/sync.ts'
import { DEFAULT_SKIN, SKINS, applySkin, readSkin, writeSkin } from './skin.ts'

const UI = join(import.meta.dirname)
/* Comments out first: a brace inside one would split a rule in the wrong place. */
const read = (name: string) => readFileSync(join(UI, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const SKIN_CSS = read('skins.css')

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.skin
  delete document.documentElement.dataset.chrome
})

describe('the switch', () => {
  it('is the game’s art until somebody chooses otherwise', () => {
    expect(readSkin()).toBe(DEFAULT_SKIN)
    expect(DEFAULT_SKIN).toBe('game')
  })

  it('remembers a look, and drops a value that is not one', () => {
    writeSkin('carved')
    expect(readSkin()).toBe('carved')
    window.localStorage.setItem('enodia.skin', 'chrome')
    expect(readSkin()).toBe('game')
  })

  it('names the look on the root, and marks every look but the game’s as CSS', () => {
    applySkin('soft')
    expect(document.documentElement.dataset.skin).toBe('soft')
    expect(document.documentElement.dataset.chrome).toBe('css')
    applySkin('game')
    expect(document.documentElement.dataset.skin).toBe('game')
    expect(document.documentElement.dataset.chrome).toBeUndefined()
    applySkin('nonsense')
    expect(document.documentElement.dataset.skin).toBe('game')
  })

  /** A setting left off the sync list is kept faithfully on one device and nowhere else. */
  it('travels with the account like the theme does', () => {
    writeSkin('hairline')
    const sent = gather().find((one) => one.kind === 'setting' && one.id === 'enodia.skin')
    expect(sent?.payload).toBe('hairline')
  })
})

/** The declarations block for one selector, the first time it opens a rule. */
const blockOf = (css: string, head: string) => {
  const at = css.indexOf(`${head} {`)
  if (at < 0) return ''
  return css.slice(at, css.indexOf('}', at))
}

describe('each look', () => {
  const used = [...new Set([...SKIN_CSS.matchAll(/var\((--sk-[a-z-]+)\)/g)].map(([, name]) => name!))]
  const looks = SKINS.filter((one) => one.id !== DEFAULT_SKIN)

  it('has values to give, so this is checking something', () => {
    expect(used.length).toBeGreaterThan(20)
    expect(looks.length).toBe(3)
  })

  /** A look missing one value draws that part of the page with nothing at all. */
  it.each(looks.map((one) => one.id))('%s gives every value the structure reads', (id) => {
    const block = blockOf(SKIN_CSS, `:root[data-skin='${id}']`)
    expect(block, `no block for ${id}`).not.toBe('')
    for (const name of used) expect(block, `${id} has no ${name}`).toContain(`${name}:`)
  })
})

/**
 * The selectors of every rule that draws chrome art, from one stylesheet.
 *
 * Chrome is the game's interface art: `shell/`, the name plates in `frames/`
 * and the Arcana highlights. Some of `shell/` is not furniture and every look
 * keeps it: the two sync glyphs and the help mark are icons, and the sorcery
 * circle behind a radial is flavour. The owner caught the first CSS look
 * drawing those over, so they are named here rather than answered.
 */
const KEPT = /(cloudsuccess|cloudfail|info-button|info-button-highlight|sorcery-circle)\.png/

const chromeSelectors = (css: string): string[] => {
  const out: string[] = []
  const rule = /([^{}]+)\{([^{}]*)\}/g
  for (const [, head, body] of css.matchAll(rule)) {
    if (!/url\(['"]?\/(shell|frames\/plate-|arcana)\//.test(body!)) continue
    if (KEPT.test(body!)) continue
    const selectors = head!
      .split(',')
      .map((one) => one.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
    out.push(...selectors)
  }
  return out
}

/** Every selector `skins.css` puts under the CSS chrome. */
const answered = new Set(
  [...SKIN_CSS.matchAll(/:root\[data-chrome='css'\] ([^,{]+?)\s*[,{]/g)].map(([, one]) =>
    one!.trim().replace(/\s+/g, ' '),
  ),
)

describe.each(['surface.css', 'builds.css'])('%s', (name) => {
  const found = chromeSelectors(read(name))

  it('has chrome to answer for, so this is checking something', () => {
    expect(found.length).toBeGreaterThan(10)
  })

  it.each(found)('%s has a CSS counterpart', (selector) => {
    expect(answered.has(selector), `skins.css has no rule for ${selector}`).toBe(true)
  })
})

/**
 * The build's minifier writes `border-image: none` out as `border-image:` with
 * nothing after it, and the browser drops an empty declaration. Every
 * `border-image: none` in the first CSS skin vanished that way on its first
 * build, and so had the one in `surface.css` that was meant to take the frame
 * off an empty radial caption. The longhand survives. Measured in `dist/` on
 * 2 October 2026.
 */
describe('what the minifier does to a shorthand', () => {
  it.each(['surface.css', 'builds.css', 'guides.css', 'wiki.css', 'skins.css'])(
    '%s takes a border image off with the longhand',
    (name) => {
      expect(read(name)).not.toMatch(/border-image:\s*none/)
    },
  )
})

describe('what every look keeps', () => {
  it('leaves the sigil, the bubble rings and the help mark to the game’s art', () => {
    for (const selector of ['.radial-ring-area::before', '.radial-ring li::after', '.pagehelp-open', '.topbar-frame']) {
      expect(answered.has(selector), `skins.css redraws ${selector}`).toBe(false)
    }
  })
})

describe('the chrome that is an image in the markup', () => {
  it('is pushed out of its box and redrawn, for each arrow and the offer selector', () => {
    for (const selector of ['.fear-arrow img', '.tour-arrow img', '.offer-selector']) {
      expect(answered.has(selector), selector).toBe(true)
    }
    expect(SKIN_CSS).toMatch(/\.offer-selector \{[^}]*object-position: 100vw 100vw/)
  })

  it('turns off the hue rotation the game’s art needs, wherever it is set', () => {
    for (const selector of ['.quiet', '.tray-handle', '.radial-caption', '.objective-bar', '.bcard-hit::after']) {
      expect(SKIN_CSS, selector).toMatch(new RegExp(`${selector.replace(/[.:]/g, '\\$&')} \\{[^}]*filter: none`))
    }
  })
})
