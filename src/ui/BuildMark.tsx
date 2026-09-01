/**
 * One piece of a build, drawn.
 *
 * Every layout draws the same mark: the art, the game's frame around it, and
 * the slot glyph tucked in a corner when the piece occupies one. Sizing is the
 * layout's, through `--mark`, so a poster can run these at 5rem and a contact
 * sheet at 2.5rem without either of them reimplementing the mark.
 *
 * **A missing icon is not a hole.** 413 of 567 named traits have art and the
 * rest fall back to the piece's initial in display type, which reads as a
 * deliberate placeholder rather than as a broken image. `assets/README.md`
 * records that every trait a run can offer does have art, so this fires for
 * the traits nothing offers.
 */

import { usePeekBind } from './Peek.tsx'
import type { Peeked } from './Peek.tsx'
import type { Piece } from './build-pieces.ts'

/**
 * A piece, as the hover panel describes it.
 *
 * Only a boon wears the boon plate. A keepsake, a familiar, a Hex, an Arcana
 * card and an aspect are not boons and get the game's tooltip backing instead,
 * which is the owner's split and is right: a boon plate around an Arcana card
 * would be saying it is one.
 */
const KIND_WORD: Record<string, string> = {
  aspect: 'Aspect',
  core: 'Core boon',
  boon: 'Boon',
  duo: 'Duo or legendary',
  hex: 'Hex',
  hammer: 'Daedalus Hammer',
  keepsake: 'Keepsake',
  familiar: 'Familiar',
  arcana: 'Arcana',
}

const BOON_KINDS = new Set(['core', 'boon', 'duo'])

const peekOf = (piece: Piece): Peeked => ({
  name: piece.name,
  text: piece.text,
  kind: piece.slotName ?? KIND_WORD[piece.kind] ?? null,
  boon: BOON_KINDS.has(piece.kind),
})

export function Mark({
  piece,
  size,
  showGlyph = true,
  onOpen,
}: {
  piece: Piece
  /** any CSS length, becoming --mark */
  size?: string
  showGlyph?: boolean
  onOpen?: (piece: Piece) => void
}) {
  // Every mark, everywhere, without any layout having to hand it down. See
  // `Peek.tsx` for why this is a context.
  const peek = usePeekBind()(peekOf(piece))

  const body = (
    <>
      {piece.icon ? (
        <img className="mark-art" src={`/${piece.icon}`} alt="" loading="lazy" />
      ) : (
        <span className="mark-stub" aria-hidden="true">
          {piece.name.slice(0, 1)}
        </span>
      )}
      <img className="mark-frame" src={`/${piece.frame}`} alt="" aria-hidden="true" />
      {showGlyph && piece.glyph ? (
        <img className="mark-glyph" src={`/${piece.glyph}`} alt="" aria-hidden="true" />
      ) : null}
    </>
  )

  const className = `mark is-${piece.kind}${piece.centrepiece ? ' is-centrepiece' : ''}`
  const style = size ? ({ '--mark': size } as React.CSSProperties) : undefined

  if (!onOpen) {
    return (
      <span className={className} style={style} {...peek}>
        {body}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onOpen(piece)}
      {...peek}
    >
      {body}
      <span className="visually-hidden">{piece.name}</span>
    </button>
  )
}

/**
 * A mark with its name beside or beneath it.
 *
 * The common case, and the one that decides whether a grid of these reads as a
 * spreadsheet. The name is a `<span>` rather than a caption element because
 * three of the five layouts put it beside the mark rather than under it.
 */
export function Named({
  piece,
  size,
  layout = 'under',
  onOpen,
}: {
  piece: Piece
  size?: string
  layout?: 'under' | 'beside'
  onOpen?: (piece: Piece) => void
}) {
  return (
    <div className={`named is-${layout}${piece.centrepiece ? ' is-centrepiece' : ''}`}>
      <Mark piece={piece} size={size} onOpen={onOpen} />
      <span className="named-text">
        <span className="named-name">{piece.name}</span>
        {piece.slotName ? <span className="named-slot">{piece.slotName}</span> : null}
      </span>
    </div>
  )
}
