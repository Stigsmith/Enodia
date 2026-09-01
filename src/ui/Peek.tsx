/**
 * What a thing is, on hover, without opening anything.
 *
 * **Nothing happened when you pointed at a boon.** Clicking one opens
 * `PieceCard`, which is a dialog and is the right shape for reading properly.
 * Hovering should answer "what is this" for the price of moving the mouse, and
 * on the detail views it answered nothing at all.
 *
 * ## Two backings, because the game uses two
 *
 * A boon gets `plate-common.png`, which is the bar the game draws behind a
 * boon's name. Everything that is not a boon, a keepsake or a familiar or a Hex
 * or an Arcana card, gets `tooltip-backing.png`, which is what the game puts
 * behind a line of explanation. That split is the owner's and it is right: a
 * boon plate around an Arcana card would be saying it is a boon.
 *
 * ## Why it is fixed-position and follows the pointer
 *
 * A tooltip anchored inside its trigger gets clipped by every scrolling
 * container it sits in, and marks live inside three of them here: the tray, the
 * picker and the detail layouts. Fixed to the viewport, positioned from the
 * pointer, clipped by nothing.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/** What is being pointed at. `kind` decides which backing it wears. */
export type Peeked = {
  name: string
  text: string | null
  /** the word above the name, when there is one worth saying */
  kind: string | null
  /** true for a boon, which is the one thing that wears the boon plate */
  boon: boolean
}

/**
 * The panel itself. Rendered once, near the top of a screen, and told what to
 * show rather than one per mark.
 */
export function Peek({ peeked, at }: { peeked: Peeked | null; at: { x: number; y: number } | null }) {
  if (!peeked || !at) return null

  /**
   * Kept inside the viewport.
   *
   * The panel is up to 20rem wide and pointing at something on the right of the
   * screen would push it off. Flipping to the left of the pointer past the
   * halfway mark is cheaper than measuring, and is right for every width.
   */
  const flip = at.x > window.innerWidth / 2
  const style: React.CSSProperties = {
    top: Math.min(at.y + 16, window.innerHeight - 160),
    ...(flip ? { right: window.innerWidth - at.x + 16 } : { left: at.x + 16 }),
  }

  return (
    <div className={`peek is-${peeked.boon ? 'boon' : 'other'}`} style={style} role="tooltip">
      {peeked.kind ? <span className="peek-kind">{peeked.kind}</span> : null}
      <span className="peek-name">{peeked.name}</span>
      {peeked.text ? <span className="peek-text">{peeked.text}</span> : null}
    </div>
  )
}

/**
 * The state behind it, so a screen wires this up once rather than per mark.
 *
 * Returns the props for `Peek` and a `bind` to spread onto anything hoverable.
 * `onFocus` and `onBlur` come along with the pointer handlers, so a keyboard
 * gets the same answer a mouse does.
 */
export function usePeek() {
  const [peeked, setPeeked] = useState<Peeked | null>(null)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  // A peek that outlives the thing it describes is worse than none: closing a
  // detail view with the pointer over a mark would leave it on screen.
  useEffect(() => {
    const clear = () => setPeeked(null)
    window.addEventListener('scroll', clear, true)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('blur', clear)
    }
  }, [])

  /**
   * Stable across renders, because it is the context value.
   *
   * Both setters are stable, so this has no dependencies. Without the callback
   * it would be a new function on every pointer move and every mark on the
   * screen would re-render along with it.
   */
  const bind = useCallback((what: Peeked | null) => ({
    onPointerEnter: (event: React.PointerEvent) => {
      if (!what) return
      // A touch is a tap on its way to a click, and a tooltip under a finger is
      // in the way of the thing it describes.
      if (event.pointerType === 'touch') return
      setPeeked(what)
      setAt({ x: event.clientX, y: event.clientY })
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (!what || event.pointerType === 'touch') return
      setAt({ x: event.clientX, y: event.clientY })
    },
    onPointerLeave: () => setPeeked(null),
    onFocus: (event: React.FocusEvent) => {
      if (!what) return
      const box = event.currentTarget.getBoundingClientRect()
      setPeeked(what)
      setAt({ x: box.left + box.width / 2, y: box.bottom })
    },
    onBlur: () => setPeeked(null),
  }), [])

  return { peeked, at, bind, clear: () => setPeeked(null) }
}


// ---------------------------------------------------------------------------
// The provider, so every mark gets this without being handed it
// ---------------------------------------------------------------------------

type Bind = ReturnType<typeof usePeek>['bind']

/**
 * **A context rather than a prop, deliberately.**
 *
 * The owner asked for a preview "anywhere a boon is shown", and a boon is drawn
 * by `Mark` inside the tray, the picker, the card, the Poster, the
 * Constellation and the detail view. Threading a handler through six layouts
 * and every wrapper between them would mean six chances to forget one, and
 * forgetting one is exactly the bug being fixed.
 *
 * The default is a no-op, so a `Mark` rendered outside a provider is silent
 * rather than broken.
 */
const PeekContext = createContext<Bind>(() => ({}) as ReturnType<Bind>)

export function PeekProvider({ children }: { children: React.ReactNode }) {
  const { peeked, at, bind } = usePeek()

  return (
    <PeekContext.Provider value={bind}>
      {children}
      <Peek peeked={peeked} at={at} />
    </PeekContext.Provider>
  )
}

/** The handlers to spread onto something hoverable. */
export const usePeekBind = () => useContext(PeekContext)
