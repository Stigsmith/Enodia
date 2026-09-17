/**
 * A write-up with its mentions drawn, each one a link to its wiki record with
 * the game's own tooltip on hover. A mentioned build links to the build, and
 * carries its verdict while a run is being logged: `BuildMention` says how.
 *
 * `ProseText` is the same without the link and the hover, and says where each
 * one belongs and why the text in both is safe to show a stranger.
 */

import { Fragment, useEffect, useRef } from 'react'

import { usePiecePeek } from './BuildMark.tsx'
import { BuildMention } from './BuildMention.tsx'
import { pieceOf } from './build-pieces.ts'
import type { Piece } from './build-pieces.ts'
import { parseProse } from './mentions.ts'
import type { WikiAt } from './wiki-route.ts'
import { MentionFace } from './ProseText.tsx'
import { WikiLink } from './WikiLink.tsx'

export function Prose({ text }: { text: string }) {
  return (
    <>
      {parseProse(text).map((bit, at) => {
        if (!('at' in bit)) return <Fragment key={at}>{bit.text}</Fragment>
        if (bit.at.kind === 'build') return <BuildMention key={at} id={bit.at.id} name={bit.name} linked />
        const piece = pieceOf(bit.at)
        return piece ? <Mention key={at} at={bit.at} piece={piece} /> : <Fragment key={at}>{bit.name}</Fragment>
      })}
    </>
  )
}

function Mention({ at, piece }: { at: NonNullable<WikiAt>; piece: Piece }) {
  const peek = usePiecePeek(piece)

  /**
   * Taken down on the way out, and only if it is this one's.
   *
   * Following the link leaves the screen, so the pointer never gets to leave
   * the link, and the tooltip would have stayed up over the record it opened.
   * The handlers are optional-called because a mention drawn outside a
   * `PeekProvider` is handed an empty set of them.
   */
  const showing = useRef(false)
  const hide = useRef(peek.onPointerLeave)
  hide.current = peek.onPointerLeave
  useEffect(
    () => () => {
      if (showing.current) hide.current?.()
    },
    [],
  )

  return (
    <WikiLink
      className="mention"
      at={at}
      onPointerEnter={(event) => {
        showing.current = true
        peek.onPointerEnter?.(event)
      }}
      onPointerMove={(event) => peek.onPointerMove?.(event)}
      onPointerLeave={() => {
        showing.current = false
        peek.onPointerLeave?.()
      }}
      onFocus={(event) => {
        showing.current = true
        peek.onFocus?.(event)
      }}
      onBlur={() => {
        showing.current = false
        peek.onBlur?.()
      }}
    >
      <MentionFace piece={piece} />
    </WikiLink>
  )
}
