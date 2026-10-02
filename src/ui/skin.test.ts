/**
 * The plain skin: the switch, and the stylesheet keeping up with the chrome.
 *
 * The second half is the one that matters later. `plain.css` overrides rules
 * by name, so a new rule in `surface.css` or `builds.css` that draws the game's
 * chrome art would show that art under the plain skin too, and nothing on the
 * game skin would look wrong. This reads both stylesheets for every rule that
 * draws chrome and fails on any selector `plain.css` does not answer.
 */

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { gather } from '../state/sync.ts'
import { DEFAULT_SKIN, applySkin, readSkin, writeSkin } from './skin.ts'

const UI = join(import.meta.dirname)
/* Comments out first: a brace inside one would split a rule in the wrong place. */
const read = (name: string) => readFileSync(join(UI, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const PLAIN = read('plain.css')

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.skin
})

describe('the switch', () => {
  it('is the game’s art until somebody chooses otherwise', () => {
    expect(readSkin()).toBe(DEFAULT_SKIN)
    expect(DEFAULT_SKIN).toBe('game')
  })

  it('remembers plain, and drops a value that is not a skin', () => {
    writeSkin('plain')
    expect(readSkin()).toBe('plain')
    window.localStorage.setItem('enodia.skin', 'chrome')
    expect(readSkin()).toBe('game')
  })

  it('goes on the root, where every rule in plain.css looks for it', () => {
    applySkin('plain')
    expect(document.documentElement.dataset.skin).toBe('plain')
    applySkin('nonsense')
    expect(document.documentElement.dataset.skin).toBe('game')
  })

  /** A setting left off the sync list is kept faithfully on one device and nowhere else. */
  it('travels with the account like the theme does', () => {
    writeSkin('plain')
    const sent = gather().find((one) => one.kind === 'setting' && one.id === 'enodia.skin')
    expect(sent?.payload).toBe('plain')
  })
})

/**
 * The selectors of every rule that draws chrome art, from one stylesheet.
 *
 * Chrome is the game's interface art: `shell/`, the name plates in `frames/`
 * and the Arcana highlights. Icons are not chrome, and the two sync glyphs in
 * `shell/` are icons in a stylesheet rather than furniture, so they stay.
 */
const chromeSelectors = (css: string): string[] => {
  const out: string[] = []
  const rule = /([^{}]+)\{([^{}]*)\}/g
  for (const [, head, body] of css.matchAll(rule)) {
    if (!/url\(['"]?\/(shell|frames\/plate-|arcana)\//.test(body!)) continue
    if (/cloud(success|fail)\.png/.test(body!)) continue
    const selectors = head!
      .split(',')
      .map((one) => one.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
    out.push(...selectors)
  }
  return out
}

/** Every selector `plain.css` scopes to the plain skin. */
const answered = new Set(
  [...PLAIN.matchAll(/:root\[data-skin='plain'\] ([^,{]+?)\s*[,{]/g)].map(([, one]) => one!.trim().replace(/\s+/g, ' ')),
)

describe.each(['surface.css', 'builds.css'])('%s', (name) => {
  const found = chromeSelectors(read(name))

  it('has chrome to answer for, so this is checking something', () => {
    expect(found.length).toBeGreaterThan(10)
  })

  it.each(found)('%s has a plain counterpart', (selector) => {
    expect(answered.has(selector), `plain.css has no rule for ${selector}`).toBe(true)
  })
})

/**
 * The build's minifier writes `border-image: none` out as `border-image:` with
 * nothing after it, and the browser drops an empty declaration. Every
 * `border-image: none` in this plain skin vanished that way on its first build,
 * and so had the one in `surface.css` that was meant to take the frame off an
 * empty radial caption. The longhand survives. Measured in `dist/` on
 * 2 October 2026.
 */
describe('what the minifier does to a shorthand', () => {
  it.each(['surface.css', 'builds.css', 'guides.css', 'wiki.css', 'plain.css'])(
    '%s takes a border image off with the longhand',
    (name) => {
      expect(read(name)).not.toMatch(/border-image:\s*none/)
    },
  )
})

describe('the chrome that is an image in the markup', () => {
  it('is pushed out of its box and redrawn, for each arrow and the offer selector', () => {
    for (const selector of ['.fear-arrow img', '.tour-arrow img', '.offer-selector']) {
      expect(answered.has(selector), selector).toBe(true)
    }
    expect(PLAIN).toMatch(/\.offer-selector \{[^}]*object-position: 100vw 100vw/)
  })

  it('turns off the hue rotation the game’s art needs, wherever it is set', () => {
    for (const selector of ['.quiet', '.tray-handle', '.radial-caption', '.objective-bar', '.bcard-hit::after']) {
      expect(PLAIN, selector).toMatch(new RegExp(`${selector.replace(/[.:]/g, '\\$&')} \\{[^}]*filter: none`))
    }
  })
})
