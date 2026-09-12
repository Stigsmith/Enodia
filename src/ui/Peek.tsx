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

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ElementWord } from './Elements.tsx'
import { ProseText } from './ProseText.tsx'
import { StatLines } from './StatLines.tsx'
import type { StatLine } from '../data/types.ts'

/** What is being pointed at. `kind` decides which backing it wears. */
export type Peeked = {
  name: string
  text: string | null
  /** the word above the name, when there is one worth saying */
  kind: string | null
  /** true for a boon, which is the one thing that wears the boon plate */
  boon: boolean
  /**
   * The art, and the gods behind it. Drawn for a boon and nothing else.
   *
   * **The panel used to be three lines of text for everything.** Pointing at a
   * boon in a build told you its name and its sentence and left out the one
   * thing the layouts around it are organised by, which is whose boon it is.
   * `PieceCard`, the click-through dialog, has always shown all three, so the
   * hover was the poor relation of a thing one click away.
   *
   * Both are optional because a familiar and an Arcana card keep the plain box:
   * an Arcana card has no god, and drawing an empty line where one goes reads
   * as missing rather than as absent.
   */
  icon?: string | null
  gods?: string[]
  /** The element a boon carries, on its kind line. */
  elements?: string[]
  /**
   * The lines the game draws under the sentence, "Blitz Damage: 80" and so
   * on. The game's own tooltip is the sentence plus these, so a hover without
   * them was showing less than the game does.
   */
  stats?: StatLine[]
  /**
   * The build author's note on the pick being pointed at. A person's words,
   * so it goes under the game's lines with its own label rather than into them.
   */
  note?: { by: string; text: string }
}

/** The author's note, under the game's own lines and marked as theirs. */
function PeekNote({ note }: { note: Peeked['note'] }) {
  if (!note) return null
  return (
    <span className="peek-note">
      <span className="peek-note-by">{note.by}</span>
      <span className="peek-note-text">
        <ProseText text={note.text} />
      </span>
    </span>
  )
}

/**
 * The panel itself. Rendered once, near the top of a screen, and told what to
 * show rather than one per mark.
 */
export function Peek({ peeked, at }: { peeked: Peeked | null; at: { x: number; y: number } | null }) {
  /**
   * How tall the panel came out, measured once it is drawn.
   *
   * It used to be placed as though it were never taller than 160 pixels. That
   * stopped being true when the game's stat lines and then the author's note
   * went into it, and a mark near the bottom of the screen put the end of the
   * panel below the edge. Measured after layout and before paint, so the panel
   * never shows in the wrong place first.
   */
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(160)
  useLayoutEffect(() => {
    if (box.current) setHeight(box.current.offsetHeight)
  }, [peeked])

  if (!peeked || !at) return null

  /**
   * Kept inside the viewport.
   *
   * The panel is up to 20rem wide and pointing at something on the right of the
   * screen would push it off. Flipping to the left of the pointer past the
   * halfway mark is cheaper than measuring, and is right for every width.
   * Height is measured, above, because it varies far more than width does.
   */
  const flip = at.x > window.innerWidth / 2
  const style: React.CSSProperties = {
    top: Math.max(8, Math.min(at.y + 16, window.innerHeight - height - 8)),
    ...(flip ? { right: window.innerWidth - at.x + 16 } : { left: at.x + 16 }),
  }

  /**
   * A boon gets the slate, everything else keeps the box.
   *
   * The slate is `PieceCard`'s body without the dialog around it: the art, the
   * name, a line of slot and gods, then the sentence. Same information, same
   * order, so pointing at a boon and clicking it do not describe it two
   * different ways.
   */
  if (peeked.boon) {
    return (
      <div ref={box} className="peek is-boon is-slate" style={style} role="tooltip">
        <div className="peek-head">
          {peeked.icon ? <img className="peek-art" src={`/${peeked.icon}`} alt="" /> : null}
          <div className="peek-titles">
            <span className="peek-name">{peeked.name}</span>
            <span className="peek-line">
              {peeked.kind ? <span>{peeked.kind}</span> : null}
              {peeked.gods?.length ? <span>{peeked.gods.join(' + ')}</span> : null}
              {peeked.elements?.map((element) => <ElementWord key={element} element={element} />)}
            </span>
          </div>
        </div>
        {peeked.text ? <span className="peek-text">{peeked.text}</span> : null}
        <StatLines lines={peeked.stats} />
        <PeekNote note={peeked.note} />
      </div>
    )
  }

  return (
    <div ref={box} className="peek is-other" style={style} role="tooltip">
      {peeked.kind ? <span className="peek-kind">{peeked.kind}</span> : null}
      <span className="peek-name">{peeked.name}</span>
      {peeked.text ? <span className="peek-text">{peeked.text}</span> : null}
      <StatLines lines={peeked.stats} />
      <PeekNote note={peeked.note} />
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
