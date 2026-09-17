/**
 * The figures standing at the edges of the screens that have one.
 *
 * Charon keeps the exchange, which is his trade, and lives in `Exchange.tsx`.
 * Your side of Builds has the Crossroads' training master, and the Wiki has
 * Odysseus, who keeps the Crossroads' records. Dora keeps the tour and the
 * rooms under construction. Utility pages have nobody.
 *
 * ## The rules all of them follow
 *
 * **Bottom-anchored and cropped by the window**, fixed so the page scrolls past
 * them, `aria-hidden` and `pointer-events: none` because they are scenery.
 * **Not in the page at all where there is no room**, so a phone never
 * downloads one: `FIGURE_ROOM` is the only place the width is written for
 * these two, and it is Charon's 96rem, for his reason and with his caveat
 * about how many card columns it leaves. Each stands directly before the
 * wrapper that makes room for it, and the stylesheet keys the room on that,
 * so the room follows whether the figure is drawn.
 *
 * **A figure on the left stands clear of the pinned menu.** Charon and
 * Odysseus are fixed to the right edge, where nothing else is. On the left a
 * figure at `left: 0` would stand under the pane, so Schelemeus stands at
 * `--pane-left`, which `surface.css` sets to the pane's width while it is
 * pinned. The grid that draws the pane reads the same token.
 *
 * ## One small thing moves on each
 *
 * They blink, which is each portrait's own `_Blink` animation, and the two
 * records are the same shape. Everything else about them is still.
 * `builds.css` has the timing and where each pair of eyes is.
 */

import { useEffect, useState } from 'react'

/**
 * Where there is room for a figure, and the only place the number is written
 * for these two. See `CHARON_ROOM` in `Exchange.tsx`, which this mirrors.
 */
export const FIGURE_ROOM = '(min-width: 96rem)'

function useRoom(query: string): boolean {
  const [room, setRoom] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const sync = () => setRoom(list.matches)
    // Once on subscribing, for a window that crossed the line between the first
    // render and this effect.
    sync()
    list.addEventListener('change', sync)
    return () => list.removeEventListener('change', sync)
  }, [query])

  return room
}

/**
 * One figure: the portrait and its blink.
 *
 * Not lazy, for the reason Charon's portrait is not: a figure is above the fold
 * by construction, and a lazy image in a fixed box sized by that image never
 * decides it is on screen.
 */
function Standing({ who, src }: { who: string; src: string }) {
  const room = useRoom(FIGURE_ROOM)
  if (!room) return null
  return (
    <div className={`figure-stand is-${who}`} aria-hidden="true">
      <img className="figure-stand-art" src={src} alt="" decoding="async" />
      <span className="figure-blink" />
    </div>
  )
}

/**
 * Schelemeus, on your side of Builds, before `.builds-shelf`.
 *
 * He is `NPC_Skelly_01` in `HelpText.en.sjson`, "Schelemeus, Training
 * Master", and his art is `Skelly.pkg`.
 */
export const SchelemeusStand = () => <Standing who="schelemeus" src="/characters/schelemeus-stand.png" />

/** Odysseus, on the Wiki, before `.wiki-shelf`. His art is `Odysseus.pkg`. */
export const OdysseusStand = () => <Standing who="odysseus" src="/characters/odysseus-stand.png" />
