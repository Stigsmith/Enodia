/**
 * A write-up with its mentions drawn as the thing's art and name, and nothing
 * to press.
 *
 * For the two places a mention cannot be a link: a tooltip, which is gone the
 * moment the pointer leaves for it, and the offer card at an Exit, which is one
 * big button already, and a link inside a button is not something a browser
 * can click. `Prose` is the same thing with the link and the hover.
 *
 * **Text stays text.** React escapes every character of it, so nothing a
 * stranger writes can become markup. A mention is drawn with the thing's
 * current name rather than the one it was written with, so it cannot be made to
 * call a boon something it is not, and one whose id no longer resolves is the
 * name it was written with, as plain text.
 */

import { Fragment } from 'react'

import { pieceOf } from './build-pieces.ts'
import type { Piece } from './build-pieces.ts'
import { parseProse } from './mentions.ts'

/** The inside of a mention, shared with `Prose` so the two draw it the same. */
export function MentionFace({ piece }: { piece: Piece }) {
  return (
    <>
      {piece.icon ? <img className="mention-art" src={`/${piece.icon}`} alt="" loading="lazy" /> : null}
      <span className="mention-name">{piece.name}</span>
    </>
  )
}

export function ProseText({ text }: { text: string }) {
  return (
    <>
      {parseProse(text).map((bit, at) => {
        if (!('at' in bit)) return <Fragment key={at}>{bit.text}</Fragment>
        const piece = pieceOf(bit.at)
        return piece ? (
          <span key={at} className="mention">
            <MentionFace piece={piece} />
          </span>
        ) : (
          <Fragment key={at}>{bit.name}</Fragment>
        )
      })}
    </>
  )
}
