/**
 * What rings a bubble, as a set of options rather than a decision.
 *
 * The stone ring went in on 28 August 2026 and came straight back out: it is
 * one answer and the owner wanted to see the rest before settling. So the frame
 * is a setting now. It writes `data-frame` on the root element, `surface.css`
 * keys off that, and the menu lists them.
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
  /** path under assets/, or null for no frame at all */
  file: string | null
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
    id: 'filigree',
    name: 'Filigree',
    note: 'UnlockTextCircleBacking. A filled disc with gold flourishes, so it tints the art it sits on',
    file: 'chrome/circle-filigree.png',
    width: 1.75,
    opacity: 0.42,
    aspect: '482 / 269',
  },
  {
    id: 'stone',
    name: 'Stone ring',
    note: "BoonSelect's carved ring. A closed circle, so neighbours never collide",
    file: 'frames/circle.png',
    hole: 0.77,
    opacity: 0.92,
  },
  {
    id: 'starburst-dark',
    name: 'Starburst, dark',
    note: 'The Talent tree, locked. Silver points on a black ring',
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
    id: 'halo',
    name: 'Halo',
    note: 'The Talent tree highlight. A filled glow that sits behind rather than around',
    file: 'frames/halo.png',
    width: 1.5,
    opacity: 0.5,
  },
  {
    id: 'orbit',
    name: 'Orbit',
    note: 'A cauldron ring. A thin band across the middle, not a full circle',
    file: 'frames/orbit.png',
    width: 1.35,
    opacity: 0.9,
  },
  {
    id: 'boon-common',
    name: 'Boon frame',
    note: "The game's own Common boon frame. Square bubbles",
    file: 'frames/frame-common.png',
    width: 1.0,
    square: true,
    opacity: 1,
  },
  {
    id: 'boon-legendary',
    name: 'Boon frame, gold',
    note: 'The Legendary frame. Square bubbles',
    file: 'frames/frame-legendary.png',
    width: 1.0,
    square: true,
    opacity: 1,
  },
  {
    id: 'boon-primary',
    name: 'Boon frame, plain',
    note: 'The unrarified frame, which is the quietest of the seven. Square bubbles',
    file: 'frames/frame-primary.png',
    width: 1.0,
    square: true,
    opacity: 1,
  },
  { id: 'none', name: 'None', note: 'Just the bubble', file: null },
]

export const DEFAULT_FRAME = 'filigree'

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

/** The three numbers a frame is, as CSS custom properties. */
export function frameVars(frame: FrameOption): Record<string, string> {
  return {
    '--frame-src': frame.file ? `url('/${frame.file}')` : 'none',
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
