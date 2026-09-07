/**
 * The coin sheet, and the two ways it has already been wrong.
 *
 * Neither of them was visible to a type check, a build or a screenshot of one
 * frame, and both reached the owner. They are different mistakes with the same
 * shape as the rest of this project's: a number assumed rather than read.
 *
 * 1. **The step.** `background-position: -6000%` looks like an offset and is
 *    not. The spec resolves a percentage there against
 *    `(positioning area - image size)`, so with a sheet sixty times the box, 59
 *    of the 60 steps painted thousands of box-widths off the sheet and drew
 *    nothing at all. The coins appeared for one frame in sixty.
 * 2. **The sheet.** The sixty extracted PNGs are each the full 314x454 canvas
 *    with the frame already placed on it, so they arrive aligned. The first
 *    sheet did not keep that: every frame's content ran into the right edge of
 *    its cell, where the source frames stop as much as 24px short, so each
 *    frame had been fitted to its cell rather than cropped to a shared box. On
 *    screen the coins jumped around, which is what the owner reported.
 *
 * `extracted/` is 364 MB of scratch and is not in git, so these check the
 * shipped sheet against properties that hold whatever the source is, rather
 * than against the source.
 *
 * **Two of the four were watched failing against the real old code**, which is
 * the only reason to keep a test. "Does not fit each frame to its cell" reports
 * 41 of 60 on the old sheet against a limit of 15. "Steps with jump-none" fails
 * when the old declaration is put back, and it alone fails, which is what makes
 * it a regression test for that step and not for something near it. The other
 * two never broke and are here as pins: they are the arithmetic the other two
 * assume.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(import.meta.dirname, '..', '..')
const SHEET = join(ROOT, 'assets', 'characters', 'charon-coins.png')
const CSS = readFileSync(join(ROOT, 'src', 'ui', 'builds.css'), 'utf8')

/** The one place the frame count is written down for a human. */
const FRAMES = 60

describe('the coin sheet', () => {
  it('divides into exactly sixty equal cells', async () => {
    const { width } = await sharp(SHEET).metadata()
    expect(width).toBeDefined()
    expect(width! % FRAMES).toBe(0)
  })

  /**
   * **The one that caught the jumping.**
   *
   * Every frame cropped to the same box means only the frames that define that
   * box reach its edges, and the rest stop short by however far the coins moved
   * that frame. Frames fitted to their cell all reach the edge instead.
   *
   * Measured by this check: the old sheet had **41 of 60** frames flush to a
   * side edge and the rebuilt one has **5**, which is the count of frames that
   * actually define the union box. Fifteen is a threshold with room either side
   * of that gap rather than a number tuned to today's art.
   */
  it('does not fit each frame to its cell', async () => {
    const { width, height } = await sharp(SHEET).metadata()
    const cell = width! / FRAMES
    const raw = await sharp(SHEET).ensureAlpha().raw().toBuffer()

    let flush = 0
    for (let f = 0; f < FRAMES; f += 1) {
      let touchesSide = false
      for (let y = 0; y < height! && !touchesSide; y += 1) {
        for (const x of [f * cell, f * cell + cell - 1]) {
          if (raw[(y * width! + x) * 4 + 3]! > 10) {
            touchesSide = true
            break
          }
        }
      }
      if (touchesSide) flush += 1
    }

    expect(flush).toBeLessThan(15)
  })
})

describe('the coin animation', () => {
  /**
   * `steps(60)` emits `k/60` and `steps(60, jump-none)` emits `k/59`, and only
   * the second is the frame series: with `background-size: 6000%`, frame `k`
   * sits at exactly `k/59 x 100%` because `0%` aligns the left edges and `100%`
   * the right. Plain `steps` is a fifty-ninth of a frame out on every frame but
   * the first, which is the kind of wrong that reads as softness rather than as
   * a bug.
   */
  it('steps with jump-none, across a closed range', () => {
    expect(CSS).toContain(`animation: charon-coins 2s steps(${FRAMES}, jump-none) infinite`)
    expect(CSS).toContain('background-position-x: 100%')
  })

  /** The sheet's cell count and the sheet's declared width have to agree. */
  it('declares a background six thousand percent wide, which is sixty frames', () => {
    expect(CSS).toContain(`/ ${FRAMES * 100}% 100% no-repeat`)
  })
})
