/**
 * Dora walks you round the page, one thing at a time.
 *
 * ## How it works
 *
 * A step names an element. The element keeps its own light; everything else
 * dims. She stands next to it and says one line. You click anywhere, or press
 * an arrow, and she moves to the next thing.
 *
 * ## The cutout is a box-shadow, not a mask
 *
 * `box-shadow: 0 0 0 9999px` on a box the size of the target paints the dim
 * everywhere except inside the box. No mask, no clip-path, no second canvas,
 * and it animates: transitioning the box's own position and size makes the
 * light travel between steps, which is most of what makes this read as somebody
 * showing you round rather than a slideshow.
 *
 * Checked before it was built: nothing between `body` and the content sets
 * `transform`, `filter`, `contain` or `will-change`, so `position: fixed` means
 * the viewport here and the cutout cannot be clipped by a scrolling ancestor.
 *
 * ## The page scrolls, and it is not the window that does it
 *
 * **`.shell` is the scroll container.** Measured on Roadmap, Changelog and
 * Settings: `document.scrollingElement.scrollHeight` equals the viewport height
 * on all three, because the page never scrolls, the shell inside it does.
 *
 * That matters twice. `scrollIntoView` handles it for free, since it walks
 * every scrolling ancestor. But the measurement afterwards does not: a rect
 * read before the scroll settles is the rect the element used to have, and the
 * light lands on empty floor. So the rect is re-read on `scroll` in the capture
 * phase, which catches the shell's scrolling as well as the window's.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ROAR_MS } from './Dora.tsx'
import type { Step } from './tour.ts'

/** Breathing space around the lit element, so the ring is not on its edge. */
const HALO = 10

/** How far she stands from the thing she is pointing at. */
const GAP = 22

type Spot = { x: number; y: number; w: number; h: number } | null

/** The live rect of a step's anchor, or null for a step about the whole page. */
function rectOf(at: string | undefined): Spot {
  if (!at) return null
  const el = document.querySelector(`[data-tour="${at}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  // A zero-sized anchor is a hidden one, and lighting it would be a bright
  // rectangle around nothing.
  if (r.width < 2 || r.height < 2) return null
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}

export function Tour({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  /**
   * The steps that can actually run, worked out once when the tour opens.
   *
   * A step whose anchor is not on this render is dropped rather than shown
   * empty: an empty library has no cards to point at, and lighting nothing
   * while claiming there is something there is worse than being a step shorter.
   * Steps with no anchor at all are about the page and always survive.
   */
  const live = useMemo(() => steps.filter((step) => !step.at || rectOf(step.at)), [steps])

  const [index, setIndex] = useState(0)
  /**
   * Whether she has dropped the ghost voice on the step she is on.
   *
   * Same two-part line as the poke loop: the capitals first, then her giving up
   * on them. Held here rather than in the step, because it is about where you
   * are in a step rather than about the step itself.
   */
  const [dropped, setDropped] = useState(false)
  const [spot, setSpot] = useState<Spot>(null)
  const [ready, setReady] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const her = useRef<HTMLDivElement>(null)
  /**
   * Her real size, measured rather than assumed.
   *
   * **Both dimensions, and both were caught the hard way.** The height was
   * wrong the moment a line wrapped to three, so the clamp kept her head on
   * screen and let her feet off the bottom. The width was wrong at phone
   * widths, where the stylesheet narrows the group and the constant kept
   * claiming the old figure, so "there is room beside this" came out true when
   * there was not and she was placed off the right edge.
   *
   * A constant cannot know what CSS did. Measured after paint, and again on
   * resize, which is what a longer line and a rotated phone both are.
   */
  const [size, setSize] = useState({ w: 300, h: 300 })

  const step = live[Math.min(index, live.length - 1)]
  const last = index >= live.length - 1
  /** She is mid-voice: the capitals are up and nothing may move on yet. */
  const roaring = Boolean(step?.roar) && !dropped

  const go = useCallback(
    (to: number) => {
      // Locked while she is doing the voice. The climb-down is the punchline
      // and clicking past it before it lands throws the joke away. It unlocks
      // itself, so there is nothing to get stuck behind.
      if (roaring) return
      if (to < 0) return
      if (to >= live.length) return onClose()
      setIndex(to)
    },
    [live.length, onClose, roaring],
  )

  /** The capitals, then her dropping them, on a timer rather than on a click. */
  useEffect(() => {
    setDropped(false)
    if (!step?.roar) return
    const stop = window.setTimeout(() => setDropped(true), ROAR_MS)
    return () => window.clearTimeout(stop)
  }, [step])

  /**
   * Bring the step's anchor into view, then measure it once it has stopped.
   *
   * The wait is the whole point. `scrollIntoView` is asynchronous even when it
   * is not smooth, so measuring on the next line reads the old position.
   */
  useEffect(() => {
    setReady(false)
    if (!step?.at) {
      setSpot(null)
      setReady(true)
      return
    }

    /**
     * A step can open the thing it is about before it points at it.
     *
     * Naming five tabs is not the same as showing you them, and the owner asked
     * for the second one. `press` is another `data-tour` value, so a step drives
     * the page through the same controls a person would, rather than through a
     * handler the editor would have to expose. Nothing here knows what a tab is.
     */
    if (step.press) {
      const control = document.querySelector<HTMLElement>(`[data-tour="${step.press}"]`)
      control?.click()
    }

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /**
     * Measured after the press has rendered, not before.
     *
     * A press changes what is on screen, so the anchor's rect afterwards is not
     * the rect before. One frame for React to commit, then scroll, then settle.
     */
    const settle = window.setTimeout(() => {
      const el = document.querySelector(`[data-tour="${step.at}"]`)
      if (!el) {
        setSpot(null)
        setReady(true)
        return
      }
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: still ? 'instant' : 'smooth' })
      const rest = window.setTimeout(
        () => {
          setSpot(rectOf(step.at))
          setReady(true)
        },
        still ? 0 : 380,
      )
      hold.push(rest)
    }, step.press ? 40 : 0)

    const hold: number[] = [settle]
    return () => hold.forEach((one) => window.clearTimeout(one))
  }, [step])

  /**
   * Keep the light on the element if anything moves under it.
   *
   * Capture phase, because the shell scrolls rather than the window and a
   * bubbling scroll listener on `window` never hears it.
   */
  useEffect(() => {
    if (!step?.at) return
    const track = () => setSpot(rectOf(step.at))
    window.addEventListener('scroll', track, true)
    window.addEventListener('resize', track)
    return () => {
      window.removeEventListener('scroll', track, true)
      window.removeEventListener('resize', track)
    }
  }, [step])

  useEffect(() => {
    box.current?.focus()
    const key = (event: KeyboardEvent) => {
      // Escape is the way out and stays open even mid-voice: locking somebody
      // inside a joke is not the same as making them wait for it.
      if (event.key === 'Escape') return onClose()
      if (roaring) return
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        go(index + 1)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [index, go, onClose, roaring])

  useLayoutEffect(() => {
    const node = her.current
    if (!node) return
    const read = () => {
      const r = node.getBoundingClientRect()
      setSize((was) =>
        Math.abs(was.w - r.width) < 1 && Math.abs(was.h - r.height) < 1
          ? was
          : { w: Math.ceil(r.width), h: Math.ceil(r.height) },
      )
    }
    read()
    const watch = new ResizeObserver(read)
    watch.observe(node)
    return () => watch.disconnect()
  }, [index])

  if (!step) return null

  /**
   * Where she stands.
   *
   * Outside the lit area if there is anywhere to stand: right, left, below,
   * above, in that order. **Standing on the thing she is pointing at is the
   * failure**, and the first version did exactly that whenever the target was
   * wide, because it only ever tried the two sides and then clamped.
   *
   * When the lit thing is most of the screen there is nowhere outside it, so
   * she takes the roomier bottom corner. Still on top of it, but out of the
   * middle of it, which is the part you are being asked to look at.
   *
   * `GROUP` is her height as a constant rather than a measurement. Measuring
   * needs a render to measure, and the only thing it buys is a few pixels of
   * clamp; being generous costs nothing and cannot loop.
   */
  const group = size.w
  const GROUP_H = size.h
  const PAD = 14

  const place = (): { left: number; top: number } => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const clampX = (x: number) => Math.min(Math.max(x, PAD), Math.max(PAD, vw - group - PAD))
    const clampY = (y: number) => Math.min(Math.max(y, PAD), Math.max(PAD, vh - GROUP_H - PAD))

    if (!spot) return { left: (vw - group) / 2, top: clampY((vh - GROUP_H) / 2) }

    const beside = clampY(spot.y + spot.h / 2 - GROUP_H / 2)
    if (vw - (spot.x + spot.w) - GAP >= group) {
      return { left: spot.x + spot.w + GAP, top: beside }
    }
    if (spot.x - GAP >= group) {
      return { left: spot.x - group - GAP, top: beside }
    }
    if (vh - (spot.y + spot.h) - GAP >= GROUP_H) {
      return { left: clampX(spot.x), top: spot.y + spot.h + GAP }
    }
    if (spot.y - GAP >= GROUP_H) {
      return { left: clampX(spot.x), top: spot.y - GROUP_H - GAP }
    }

    const roomRight = vw - (spot.x + spot.w)
    return {
      left: roomRight > spot.x ? clampX(vw - group - PAD) : clampX(PAD),
      top: clampY(vh - GROUP_H - PAD),
    }
  }

  const { left, top } = place()

  return (
    <div
      ref={box}
      className={`tour${ready ? ' is-ready' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="A quick tour of this page"
      tabIndex={-1}
    >
      {/* Catches every click so the page underneath cannot be operated by
        * accident mid-tour, and turns any click into the next step. The cutout
        * is only light: it never takes a press. */}
      <button
        type="button"
        className="tour-catch"
        aria-label="Next"
        onClick={() => go(index + 1)}
      />

      {/* The dim, and the hole in it. One element: the shadow is the dim. */}
      <div
        className={`tour-spot${spot ? '' : ' is-whole'}`}
        style={
          spot
            ? {
                left: spot.x - HALO,
                top: spot.y - HALO,
                width: spot.w + HALO * 2,
                height: spot.h + HALO * 2,
              }
            : undefined
        }
        aria-hidden="true"
      />

      {/* A centred column: what she is saying, then her, then the steps. The
        * named way out is gone on the owner's call. Clicking anywhere advances,
        * the arrows step, Escape leaves, and a button saying so was one more
        * thing to read on a panel whose whole job is to be read quickly. */}
      <div ref={her} className="tour-her" style={{ left, top }}>
        <p className={`tour-say${roaring ? ' is-roaring' : ''}`} role="status">
          {roaring ? step.roar : step.say}
        </p>

        {/* She shifts pose now and then rather than standing in one attitude
          * for eight steps. Keyed to the step rather than random, so it does
          * not flicker on a re-render, and thoughtful stays the usual one:
          * the change should read as her shifting, not as a slideshow. */}
        <img
          className={`tour-dora${roaring ? ' is-roaring' : ''}`}
          src={
            roaring
              ? '/ui/dora-spooky.png'
              : index % 3 === 1
                ? '/ui/dora-default.png'
                : '/ui/dora-thoughtful.png'
          }
          alt=""
          aria-hidden="true"
        />

        {/* The game's own stepper arrows, the pair already on the Fear counter
          * in `Fear.tsx`. Left and right rather than up and down, because this
          * steps forward rather than counts. */}
        <div className="tour-steps">
          <button
            type="button"
            className="tour-arrow"
            disabled={index === 0 || roaring}
            aria-label="Back a step"
            onClick={() => go(index - 1)}
          >
            <img src="/shell/settings-arrow-left.png" alt="" aria-hidden="true" />
          </button>

          <span className="tour-count">
            {index + 1} of {live.length}
          </span>

          <button
            type="button"
            className="tour-arrow"
            disabled={roaring}
            aria-label={last ? 'Finish' : 'Next step'}
            onClick={() => go(index + 1)}
          >
            <img src="/shell/settings-arrow-right.png" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
