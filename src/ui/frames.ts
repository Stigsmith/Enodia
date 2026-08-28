/**
 * What rings a bubble, as a set of options rather than a decision.
 *
 * The stone ring went in on 28 August 2026 and came straight back out: it is
 * one answer and the owner wanted to see the rest before settling. So the frame
 * is a setting now. It writes `data-frame` on the root element, `surface.css`
 * keys off that, and the menu lists them.
 *
 * **The defaults are drawn, not taken.** Every ring the package offers turned
 * out not to be a circle: the filigree is a 482 by 269 disc with wings, the
 * starburst is a four pointed star, the orbit is a band across the middle. Only
 * BoonSelect's is round and it is carved stone at 2475 square. So the first
 * three options are authored here out of two radial gradients and a mask, in
 * the palette's own silver, and the game's own art is kept below them as a
 * second group for comparison.
 *
 * **`hole` is the whole geometry.** A frame with a hole is drawn so its hole
 * lands exactly on the bubble: at hole 0.77 the frame is 1/0.77 = 130 percent
 * of the bubble, and a portrait filling the bubble sits flush inside it. A
 * frame with no hole is an overlay or a backing and is drawn at a fixed share
 * instead, named by `width`.
 *
 * `square` turns the bubble into a rounded square, because the BoonIconFrames
 * are rounded squares and a circular portrait inside one looks like a mistake.
 */

export type FrameOption = {
  id: string
  name: string
  note: string
  /** path under assets/, or null for a drawn frame and for none at all */
  file: string | null
  /**
   * A drawn frame, in CSS rather than in art.
   *
   * `band` is what fills it and `hole` doubles as the mask radius, so a band
   * of 0.8 leaves the outer fifth of the box as ring and the rest transparent.
   * `width` still sizes the whole thing against the bubble.
   */
  band?: string
  /** a drawn frame's inner edge, as a fraction of its own radius */
  inner?: number
  /** the frame's interior as a fraction of its own width, when it has one */
  hole?: number
  /** frame width as a share of the bubble, when there is no hole to fit */
  width?: number
  /** the bubble becomes a rounded square */
  square?: boolean
  /** default opacity, for art that is louder or quieter than the rest */
  opacity?: number
  /**
   * The art's own aspect, when it is not square. Only the filigree is not: it
   * is 482 by 269 with the circle filling the height and flourishes either
   * side, and forcing it to 1/1 cuts the flourishes off.
   */
  aspect?: string
}

export const FRAMES: FrameOption[] = [
  {
    id: 'ring',
    name: 'Ring',
    note: 'Two hairlines with a dark band between them. Drawn, and actually a circle',
    file: null,
    width: 1.22,
    inner: 0.8,
    opacity: 1,
    band: [
      // the inner hairline, sitting on the bubble's own edge
      'radial-gradient(closest-side, transparent 79.5%, var(--silver-sh) 80%, var(--silver) 82%, transparent 83%)',
      // the outer one
      'radial-gradient(closest-side, transparent 95%, var(--silver) 96%, var(--silver-sh) 99%, transparent 100%)',
      // and the metal between, lit from the top left the way the game lights it
      'linear-gradient(155deg, var(--silver-sh), var(--ink-850) 42%, var(--silver-deep) 64%, var(--silver-sh))',
    ].join(', '),
  },
  {
    id: 'hairline',
    name: 'Hairline',
    note: 'One thin silver circle and nothing else. The quietest it gets',
    file: null,
    width: 1.1,
    inner: 0.9,
    opacity: 1,
    band: 'radial-gradient(closest-side, transparent 89%, var(--silver) 91%, var(--silver-sh) 97%, transparent 100%)',
  },
  {
    id: 'double',
    name: 'Engraved',
    note: 'Two hairlines with the ground showing between them',
    file: null,
    width: 1.28,
    inner: 0.74,
    opacity: 1,
    band: [
      'radial-gradient(closest-side, transparent 77%, var(--silver-sh) 78%, var(--silver) 80%, transparent 81%)',
      'radial-gradient(closest-side, transparent 92%, var(--silver) 93%, var(--silver-sh) 96%, transparent 97%)',
    ].join(', '),
  },

  // The game's own, kept for comparison. None of them is a plain circle.
  {
    id: 'filigree',
    name: 'Filigree',
    note: 'UnlockTextCircleBacking. A filled disc with wings, so it tints what it sits on',
    file: 'chrome/circle-filigree.png',
    width: 1.75,
    opacity: 0.42,
    aspect: '482 / 269',
  },
  {
    id: 'stone',
    name: 'Stone ring',
    note: "BoonSelect's carved ring. The one round thing in the package",
    file: 'frames/circle.png',
    hole: 0.77,
    opacity: 0.92,
  },
  {
    id: 'starburst-dark',
    name: 'Starburst, dark',
    note: 'The Talent tree, locked. A four pointed star, not a ring',
    file: 'frames/starburst-dark.png',
    hole: 0.62,
    opacity: 0.95,
  },
  {
    id: 'starburst',
    name: 'Starburst, bright',
    note: 'The Talent tree, unlocked. The loudest thing in the package',
    file: 'frames/starburst.png',
    hole: 0.62,
    opacity: 0.85,
  },
  {
    id: 'boon-primary',
    name: 'Boon frame',
    note: "The game's unrarified boon frame. Square bubbles",
    file: 'frames/frame-primary.png',
    width: 1.0,
    square: true,
    opacity: 1,
  },
  { id: 'none', name: 'None', note: 'Just the bubble', file: null },
]

export const DEFAULT_FRAME = 'ring'

const KEY = 'enodia.frame'

export function readFrame(): string {
  try {
    const saved = localStorage.getItem(KEY)
    return FRAMES.some((frame) => frame.id === saved) ? (saved as string) : DEFAULT_FRAME
  } catch {
    return DEFAULT_FRAME
  }
}

export function writeFrame(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // A browser that refuses storage still gets the frame for this session.
  }
}

/**
 * A frame as CSS custom properties.
 *
 * One rule in `surface.css` reads these, so drawn and taken frames go through
 * the same path and the menu swatch draws exactly what the ring will. A drawn
 * frame masks its own middle out; a taken one is already a ring and does not.
 */
export function frameVars(frame: FrameOption): Record<string, string> {
  const inner = frame.inner
  return {
    '--frame-src': frame.file ? `url('/${frame.file}')` : 'none',
    '--frame-band': frame.band ?? 'none',
    '--frame-mask': inner
      ? `radial-gradient(closest-side, transparent ${(inner * 100).toFixed(1)}%, #000 ${(inner * 100 + 0.5).toFixed(1)}%)`
      : 'none',
    '--frame-width': `${((frame.hole ? 1 / frame.hole : (frame.width ?? 1)) * 100).toFixed(1)}%`,
    '--frame-opacity': String(frame.opacity ?? 0.9),
    '--frame-aspect': frame.aspect ?? '1 / 1',
    '--bubble-radius': frame.square ? '22%' : '50%',
  }
}

/**
 * Push a frame onto the document.
 *
 * The geometry goes on as custom properties rather than as a class per option,
 * so adding an option is one entry in `FRAMES` and no CSS at all.
 */
export function applyFrame(id: string) {
  const frame = FRAMES.find((entry) => entry.id === id) ?? FRAMES[0]
  if (!frame) return
  const root = document.documentElement
  root.dataset.frame = frame.id
  for (const [name, value] of Object.entries(frameVars(frame))) root.style.setProperty(name, value)
}
