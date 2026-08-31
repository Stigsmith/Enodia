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
 *
 * **The default is thin.** The first drawn ring carried a lit metal band
 * between its hairlines and read as a bezel around a screen rather than as an
 * edge on a picture. It is still here as "Banded"; the default is two
 * hairlines and the ground between them.
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

/**
 * The three that survived.
 *
 * Fourteen were drawn or extracted so the owner could see the field, and the
 * owner has now seen it: **the Exit reward marker is the answer**, with
 * Hecate's two circles kept as the alternatives. The other eleven were an
 * exploration, the exploration is over, and a settings list of fourteen rings
 * asks a question nobody has any more.
 *
 * They are one `git revert` away if a patch ever breaks the un-warp, and
 * `scripts/reward-frame.ts` still holds the chain the marker was traced
 * through. The drawn CSS rings, the starbursts, the stone ring, the filigree
 * and the bare bubble went with them.
 */
export const FRAMES: FrameOption[] = [
  // The game's own Exit reward marker, which is what it draws on an Exit when
  // there is something behind it. `scripts/reward-frame.ts` has the chain it
  // was traced through and why the disc had to be squared up first.
  {
    id: 'reward',
    name: 'Exit reward',
    note: 'What the game itself puts on an Exit: the disc and its two silver wings',
    file: 'frames/reward-marker.png',
    width: 1.34,
    opacity: 0.95,
  },

  // Hecate's own circles, and the only thing in the whole package that is a
  // circle drawn face on rather than a world object squashed onto a floor.
  // `Fx/HeroTouchdownCircles`, which is what the game draws under Melinoe when
  // she lands.
  {
    id: 'script',
    name: 'Witch circle',
    note: "Hecate's own, script around the rim. Drawn face on, so nothing had to be un-warped",
    file: 'frames/circle-script.png',
    hole: 0.76,
    opacity: 0.9,
  },
  {
    id: 'script-b',
    name: 'Witch circle, sealed',
    note: 'The same with a triangle inscribed, which crosses what it rings',
    file: 'frames/circle-script-b.png',
    hole: 0.76,
    opacity: 0.85,
  },
]

/**
 * The game's own Exit reward marker.
 *
 * It is world art un-warped rather than art that was drawn face on, which is
 * an argument for `script` and was the reason this moved to it for one commit.
 * The owner looked at both and picked this one, which settles it: the run
 * picker asks "what did this Exit give" and this is what the game puts on an
 * Exit that has something behind it.
 *
 * `script` is still here, and it is the honest fallback if the un-warp ever
 * stops matching a patch.
 */
export const DEFAULT_FRAME = 'reward'

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
