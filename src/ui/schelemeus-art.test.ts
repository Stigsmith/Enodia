/**
 * Schelemeus: the figure, his blink, and the room he stands in.
 *
 * `Skelly.pkg` is extracted into scratch and is not in git, so, as with
 * Charon's coins, these hold the shipped files to properties that come from
 * the game's records rather than to the source images.
 *
 * - The blink record's slides give the frame counts: a gap of 120 to 250, then
 *   frames two to six for 2, 4, 2, 2 and 2. The gap is fixed at 185 here.
 * - The figure is the portrait's trimmed rect, 1000 by 1250, saved 760 tall.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
const STAND = join(ROOT, 'assets', 'characters', 'schelemeus-stand.png')
const SHEET = join(ROOT, 'assets', 'characters', 'schelemeus-blink.png')
const CSS = readFileSync(join(ROOT, 'src', 'ui', 'builds.css'), 'utf8')
const SURFACE = readFileSync(join(ROOT, 'src', 'ui', 'surface.css'), 'utf8')

/** Frames two to six of `Portrait_Skelly_Blink`, and how long each is held. */
const BLINK = [2, 4, 2, 2, 2]
const GAP = 185
/** The first slide, an empty sprite held for one frame. */
const LEAD = 1
const LOOP = LEAD + GAP + BLINK.reduce((sum, n) => sum + n, 0)
const RATE = 30

/** The body of one keyframes block, or of the first rule for a selector. */
const block = (css: string, head: string) => {
  const at = css.indexOf(head)
  if (at < 0) return ''
  let depth = 0
  for (let i = css.indexOf('{', at); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') depth -= 1
    if (depth === 0) return css.slice(at, i + 1)
  }
  return ''
}

describe('the figure', () => {
  it('is the portrait’s trimmed rect at 760 tall, and the stylesheet says so', async () => {
    const { width, height } = await sharp(STAND).metadata()
    expect([width, height]).toEqual([608, 760])
    expect(1000 / 1250).toBeCloseTo(width! / height!, 3)
    expect(block(CSS, '.skelly-stand-art {')).toContain('aspect-ratio: 608 / 760')
  })

  /**
   * The error the pane token exists for. A left-hand figure copied from
   * Charon's `left: 0` stands under the pinned menu.
   */
  it('stands clear of the pinned pane, by the number the pane itself is drawn with', () => {
    expect(block(CSS, '.skelly-stand {')).toContain('left: var(--pane-left)')
    expect(SURFACE).toContain('grid-template-columns: var(--pane-width) minmax(0, 1fr)')
    expect(SURFACE).toContain('--pane-left: var(--pane-width)')
    expect(SURFACE).not.toMatch(/grid-template-columns: 17rem minmax/)
  })

  it('makes room for himself only where he is drawn', () => {
    expect(CSS).toContain('.skelly-stand + .builds-shelf {')
  })
})

describe('the blink', () => {
  it('is five equal cells, one for each drawn frame', async () => {
    const { width } = await sharp(SHEET).metadata()
    expect(width! % BLINK.length).toBe(0)
    expect(block(CSS, '.skelly-blink {')).toContain(`/ ${BLINK.length * 100}% 100% no-repeat`)
  })

  it('loops at the game’s frame counts, with the random gap fixed at its middle', () => {
    expect(GAP).toBe((120 + 250) / 2)
    const seconds = LOOP / RATE
    expect(block(CSS, '.skelly-blink {')).toContain(`animation: schelemeus-blink ${seconds}s step-end infinite`)
  })

  /**
   * Each drawn frame starts where the record says, and sits at `k/4` of the
   * sheet. Written out rather than derived in the stylesheet, so this is the
   * derivation.
   */
  it('shows each frame at its own moment and in its own cell', () => {
    const frames = block(CSS, '@keyframes schelemeus-blink')
    let at = LEAD + GAP
    BLINK.forEach((held, k) => {
      const percent = Number(((at / LOOP) * 100).toFixed(3))
      const rule = new RegExp(`\\n\\s*${String(percent).replace('.', '\\.')}% \\{[^}]*background-position-x: ${(k / 4) * 100}%`)
      expect(frames, `frame ${k + 2} at ${percent}%`).toMatch(rule)
      at += held
    })
    expect(at).toBe(LOOP)
  })

  it('is hidden between blinks, and stops under reduced motion', () => {
    expect(block(CSS, '.skelly-blink {')).toContain('opacity: 0')
    expect(CSS).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.skelly-blink \{\s*animation: none/)
  })
})
