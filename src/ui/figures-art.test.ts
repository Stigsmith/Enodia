/**
 * The standing figures: the art, the blinks, and the room they stand in.
 *
 * `Skelly.pkg` and `Odysseus.pkg` are extracted into scratch and are not in
 * git, so, as with Charon's coins, these hold the shipped files to properties
 * that come from the game's records rather than to the source images.
 *
 * - Both blink records have the same slides: a gap of 120 to 250, then frames
 *   two to six for 2, 4, 2, 2 and 2. The gap is fixed at 185 here.
 * - Each figure is its portrait's trimmed rect, saved 760 tall.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
const art = (name: string) => join(ROOT, 'assets', 'characters', name)
const CSS = readFileSync(join(ROOT, 'src', 'ui', 'builds.css'), 'utf8')
const SURFACE = readFileSync(join(ROOT, 'src', 'ui', 'surface.css'), 'utf8')

/** Each portrait's trimmed rect, from its sidecar, and where it stands. */
const FIGURES = [
  { who: 'schelemeus', rect: [1000, 1250], file: [608, 760], shelf: 'builds-shelf', side: 'left', room: '26rem' },
  { who: 'odysseus', rect: [1102, 1242], file: [674, 760], shelf: 'wiki-shelf', side: 'right', room: '29rem' },
] as const

/** Frames two to six of each `_Blink`, and how long each is held. */
const BLINK = [2, 4, 2, 2, 2]
const GAP = 185
/** The first slide, an empty sprite held for one frame. */
const LEAD = 1
const LOOP = LEAD + GAP + BLINK.reduce((sum, n) => sum + n, 0)
const RATE = 30

/** The first rule or at-rule starting with `head`, braces and all. */
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

describe.each(FIGURES)('$who', ({ who, rect, file, shelf, side, room }) => {
  it('is the portrait’s trimmed rect at 760 tall, and the stylesheet says so', async () => {
    const { width, height } = await sharp(art(`${who}-stand.png`)).metadata()
    expect([width, height]).toEqual(file)
    expect(rect[0] / rect[1]).toBeCloseTo(width! / height!, 2)
    expect(block(CSS, `.is-${who} .figure-stand-art {`)).toContain(`aspect-ratio: ${file[0]} / ${file[1]}`)
  })

  it('makes room for itself on its own side, only where it is drawn', () => {
    expect(block(CSS, `.is-${who} + .${shelf} {`)).toContain(`padding-${side}: ${room}`)
  })

  it('has a blink of five equal cells', async () => {
    const { width } = await sharp(art(`${who}-blink.png`)).metadata()
    expect(width! % BLINK.length).toBe(0)
    expect(block(CSS, `.is-${who} .figure-blink {`)).toContain(`url('/characters/${who}-blink.png?v=`)
  })
})

describe('where they stand', () => {
  /**
   * The error the pane token exists for. A left-hand figure copied from
   * Charon's `left: 0` stands under the pinned menu.
   */
  it('stands clear of the pinned pane on the left, by the number the pane is drawn with', () => {
    expect(block(CSS, '.figure-stand.is-schelemeus {')).toContain('left: var(--pane-left)')
    expect(SURFACE).toContain('grid-template-columns: var(--pane-width) minmax(0, 1fr)')
    expect(SURFACE).toContain('--pane-left: var(--pane-width)')
    expect(SURFACE).not.toMatch(/grid-template-columns: 17rem minmax/)
  })

  it('stands on the right where the figure faces left, as Charon does', () => {
    expect(block(CSS, '.figure-stand.is-odysseus {')).toContain('right: 0')
  })
})

describe('the blink', () => {
  it('draws five cells, one for each drawn frame', () => {
    expect(block(CSS, '.figure-blink {')).toContain(`background-size: ${BLINK.length * 100}% 100%`)
  })

  it('loops at the game’s frame counts, with the random gap fixed at its middle', () => {
    expect(GAP).toBe((120 + 250) / 2)
    expect(block(CSS, '.figure-blink {')).toContain(`animation: portrait-blink ${LOOP / RATE}s step-end infinite`)
  })

  /**
   * Each drawn frame starts where the records say, and sits at `k/4` of the
   * sheet. Written out rather than derived in the stylesheet, so this is the
   * derivation.
   */
  it('shows each frame at its own moment and in its own cell', () => {
    const frames = block(CSS, '@keyframes portrait-blink')
    let at = LEAD + GAP
    BLINK.forEach((held, k) => {
      const percent = Number(((at / LOOP) * 100).toFixed(3))
      const rule = new RegExp(
        `\\n\\s*${String(percent).replace('.', '\\.')}% \\{[^}]*background-position-x: ${(k / 4) * 100}%`,
      )
      expect(frames, `frame ${k + 2} at ${percent}%`).toMatch(rule)
      at += held
    })
    expect(at).toBe(LOOP)
  })

  it('is hidden between blinks, and stops under reduced motion', () => {
    expect(block(CSS, '.figure-blink {')).toContain('opacity: 0')
    expect(CSS).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.figure-blink \{\s*animation: none/)
  })
})
