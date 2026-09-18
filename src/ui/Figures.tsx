/**
 * The figures standing at the edges of the screens that have one.
 *
 * Charon keeps everybody's side of Builds and of Guides, which is his trade.
 * Your side of both has the Crossroads' training master, and the Wiki has
 * Odysseus, who keeps the Crossroads' records. Dora keeps the tour and the
 * rooms under construction. Utility pages have nobody.
 *
 * **Charon lived in `Exchange.tsx` and moved here when Guides arrived.** He
 * had his own copy of the breakpoint and his own copy of the media query hook,
 * both identical to the ones below, and the number that decides whether a
 * phone downloads a 348 KB portrait is not a number to keep two of. His markup
 * and his class names are unchanged, because `builds.css` and
 * `Exchange.test.tsx` are both written against them.
 *
 * ## The rules all of them follow
 *
 * **Bottom-anchored and cropped by the window**, fixed so the page scrolls past
 * them, `aria-hidden` and `pointer-events: none` because they are scenery.
 * **Not in the page at all where there is no room**, so a phone never
 * downloads one: `FIGURE_ROOM` is the only place the width is written, and it
 * is Charon's 96rem, for his reason and with his caveat about how many card
 * columns it leaves. Each stands directly before the wrapper that makes room
 * for it, and the stylesheet keys the room on that, so the room follows
 * whether the figure is drawn.
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
 * Where there is room for a figure, and the only place the number is written.
 *
 * It was Charon's `CHARON_ROOM`, and his docblock is the one that argues for
 * 96rem: a figure is drawn only where the room he takes does not cost the
 * shelf beside him a column of cards. Nothing in `builds.css` states it, so
 * every rule about a figure applies exactly when the figure exists rather than
 * inside a query that has to be kept in step with this one.
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

/**
 * Charon, standing at the foot of his own shop, on everybody's side of Builds
 * and of Guides.
 *
 * The exchange was the build manager with a different list behind it: same
 * cards, same grid, same filters, and nothing on screen saying you had gone
 * anywhere. He says it before the heading does, and he says the same thing one
 * screen over.
 *
 * **Anchored to the bottom and cropped by it**, which is how the game draws
 * every character and how this art is drawn: the portrait runs off the bottom
 * of its own frame, so floating it in the middle of a panel would be wrong on
 * the art's own terms. Fixed rather than scrolled, so the shelf goes past him.
 *
 * **He has a column rather than a corner.** `DoraWatching` is the same idea on
 * the Roadmap and it spent a session covering text, because a page whose
 * content fills its width has no free corner to put a figure in. Dora got a
 * `min-height` gate; that works there because the roadmap's columns end where
 * their content does. A shelf is a grid that fills, so the fix is to give him
 * room instead: the wrapper after him is inset by his width whenever he is
 * drawn, and he is not drawn where that inset would cost a card column.
 *
 * **Not drawn means not in the page at all.** The stylesheet used to hide him
 * below 96rem while the component rendered the portrait regardless, so every
 * phone that opened the exchange downloaded `charon-shop.png`, 348 KB, and
 * never showed it. Measured on enodia.me on 13 September 2026 at 375x812:
 * requested, with `complete` true, `naturalWidth` 768 and the wrapper
 * `display: none`. The coins never had the problem, because a background
 * inside a hidden box is not fetched. `Exchange.test.tsx` pins it.
 *
 * `aria-hidden` and `pointer-events: none`. He is scenery, and a screen reader
 * announcing a decorative portrait between the filters and the shelf is noise.
 *
 * He keeps his own markup rather than `Standing`'s: the coins are a second
 * element none of the others has, and his art is not cropped to its alpha the
 * way theirs are, so the sizing rules in `builds.css` are his own.
 */
export function CharonStand() {
  const room = useRoom(FIGURE_ROOM)
  if (!room) return null

  return (
    <div className="xchange-charon" aria-hidden="true">
      {/**
        * **Not lazy, and that was a deadlock rather than a preference.** The
        * wrapper is `position: fixed; right: 0` and takes its width from this
        * image, so before the image loads the box is zero wide and sits exactly
        * on the right edge of the window. The lazy loader then sees an element
        * that is not on screen and does not fetch it, which keeps the box zero
        * wide. Caught by measuring: `complete` false and `naturalWidth` 0 two
        * seconds after load, while a plain `new Image()` for the same path
        * returned 768 by 760 immediately. He is the largest thing on this screen
        * and is above the fold by construction, so there was nothing to defer.
        */}
      <img className="xchange-charon-art" src="/characters/charon-shop.png" alt="" />
      {/* The coins, over his open palm, where the game puts them. Its own
        * element rather than part of the picture, because it is sixty frames
        * and an additive blend. `builds.css` has the arithmetic. */}
      <span className="xchange-coins" />
    </div>
  )
}
