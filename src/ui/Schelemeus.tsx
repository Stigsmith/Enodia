/**
 * Schelemeus, standing at the edge of your side of Builds.
 *
 * Charon keeps the exchange, which is his trade. Your side is where you work
 * on builds of your own, and the Crossroads' training master is who stands
 * there. He is `NPC_Skelly_01` in `HelpText.en.sjson`, "Schelemeus, Training
 * Master", and his art is in `Skelly.pkg`.
 *
 * ## The same rules Charon follows, and one he does not need
 *
 * **Bottom-anchored and cropped by the window**, fixed so the shelf scrolls past
 * him, `aria-hidden` and `pointer-events: none` because he is scenery. **Not in
 * the page at all where there is no room**, so a phone never downloads him:
 * `SCHELEMEUS_ROOM` is the only place the width is written, as `CHARON_ROOM`
 * is for Charon, and it is the same 96rem, for the same reason and with the
 * same caveat about how many card columns it leaves.
 *
 * **He stands on the left, so he has to stand clear of the pinned menu.**
 * Charon is fixed to the right edge, where nothing else is. On the left a
 * figure at `left: 0` would stand under the pane, so his left edge is
 * `--pane-left`, which `surface.css` sets to the pane's width when it is pinned
 * and to nothing when it is not. The grid that draws the pane reads the same
 * token, so the two cannot disagree.
 *
 * ## One small thing moves
 *
 * He blinks, which is the game's own `Portrait_Skelly_Blink`. The rest of the
 * figure is still. `builds.css` has the timing and where the eyes are.
 */

import { useEffect, useState } from 'react'

/**
 * Where there is room for Schelemeus, and the only place the number is
 * written. See `CHARON_ROOM` in `Exchange.tsx`, which this mirrors.
 */
export const SCHELEMEUS_ROOM = '(min-width: 96rem)'

export function SchelemeusStand() {
  const [room, setRoom] = useState(() => window.matchMedia(SCHELEMEUS_ROOM).matches)

  useEffect(() => {
    const query = window.matchMedia(SCHELEMEUS_ROOM)
    const sync = () => setRoom(query.matches)
    // Once on subscribing, for a window that crossed the line between the first
    // render and this effect.
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  if (!room) return null

  return (
    <div className="skelly-stand" aria-hidden="true">
      {/* Not lazy, for the reason Charon's portrait is not: he is above the
        * fold by construction, and a lazy image in a fixed box sized by that
        * image never decides it is on screen. */}
      <img className="skelly-stand-art" src="/characters/schelemeus-stand.png" alt="" decoding="async" />
      <span className="skelly-blink" />
    </div>
  )
}
