/**
 * Variant 2: the Poster. One build, treated as a thing worth looking at.
 *
 * **The design approach is editorial.** Every other variant is a container for
 * items. This one is a page about a build: the aspect's full cutout at the top
 * at a size the art deserves, the build's name in display type, its one line
 * under that, and everything else demoted to small marks in a single column
 * beneath. Nothing competes with the picture.
 *
 * The hierarchy is deliberate and steep. The **centrepiece** is called out on
 * its own with the game's sentence about it, because that is what makes a build
 * a build rather than a list. Everything else is support and is drawn as such.
 *
 * **What it is good at**: the first question, "what shall I try this run". It
 * makes a build look like something you would want to play.
 *
 * **What it gives up**: comparison, and density. One build fills a screen, and
 * on a phone it is a scroll. It cannot answer "which of these covers my gaps"
 * because you can only see one at a time.
 */

import { useState } from 'react'

import { PlayStrip } from '../PlayStrip.tsx'
import { Mark, Named } from '../BuildMark.tsx'
import type { Assembled, Piece } from '../build-pieces.ts'

export function Poster({ built, onOpen }: { built: Assembled; onOpen?: (piece: Piece) => void }) {
  const { build } = built
  /** The Arcana card being pointed at, so its own sentence can be read. */
  const [peek, setPeek] = useState<Piece | null>(null)
  const slotted = built.slots.flatMap((entry) => (entry.piece ? [entry.piece] : []))
  const rest = built.run.pieces.filter((piece) => !piece.slot && !piece.centrepiece)
  const arcana = built.crossroads.pieces.filter((piece) => piece.kind === 'arcana')
  const kit = built.crossroads.pieces.filter((piece) => piece.kind !== 'arcana' && piece.kind !== 'aspect')

  return (
    <article className="poster">
      <header className="poster-head">
        {built.render ? <img className="poster-render" src={`/${built.render}`} alt="" /> : null}
        <div className="poster-title">
          <p className="poster-arm">
            {built.arm}
            {built.aspect ? <span>{built.aspect.name.replace(/^Aspect of /, '')}</span> : null}
          </p>
          <h3>{build.name}</h3>
          <p className="poster-say">{build.say}</p>
          {/* Under the title and the one line, above everything the build is
            * made of. It draws nothing when there is nothing to say. */}
          <PlayStrip build={build} />
        </div>
      </header>

      {built.centrepiece ? (
        <section className="poster-centre" aria-label="Built around">
          <Mark piece={built.centrepiece} size="var(--mark-xl)" onOpen={onOpen} />
          <div>
            <h4>{built.centrepiece.name}</h4>
            {built.centrepiece.text ? <p>{built.centrepiece.text}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="poster-run" aria-label="What to look for">
        <h4 className="poster-rule">The five slots</h4>
        <div className="poster-row">
          {slotted.map((piece) => (
            <Named key={piece.key} piece={piece} size="var(--mark-l)" onOpen={onOpen} />
          ))}
        </div>

        {rest.length ? (
          <>
            <h4 className="poster-rule">And beyond them</h4>
            <div className="poster-row">
              {rest.map((piece) => (
                <Named key={piece.key} piece={piece} size="var(--mark-l)" onOpen={onOpen} />
              ))}
            </div>
          </>
        ) : null}
      </section>

      {/* Boons that raise the ceiling without being the build.
        *
        * **A field the build has carried since it was added and neither layout
        * ever drew.** It is a separate list for a reason, so it gets a separate
        * band rather than being folded in beside the boons that are the build:
        * the whole point of `optional` is the difference between the two.
        *
        * The Olympians it would add are named with it, because one boon from a
        * god you take for nothing else still spends a slot, and that cost is
        * the thing a reader needs to weigh. */}
      {/* `is-optional` is load bearing, not decoration. Above 100rem the poster
        * is a named-area grid and `.poster-run` names one cell, so two sections
        * wearing that class alone were both placed into it and drew on top of
        * each other. The Constellation hit the same thing and its fix is the
        * one copied here: give the band an area of its own. */}
      {built.optional.length ? (
        <section className="poster-run is-optional" aria-label="Worth adding">
          <h4 className="poster-rule">Worth adding</h4>
          <div className="poster-row">
            {built.optional.map((piece) => (
              <Named key={piece.key} piece={piece} size="var(--mark-l)" onOpen={onOpen} />
            ))}
          </div>
          {built.optionalGods.length ? (
            <p className="poster-optional-cost">
              {built.optionalGods.length === 1
                ? `Taking these adds ${built.optionalGods[0]} to the build.`
                : `Taking these adds ${built.optionalGods.join(' and ')} to the build.`}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="poster-crossroads" aria-label="Before you go">
        <h4 className="poster-rule">{built.crossroads.name}</h4>
        <div className="poster-row">
          {kit.map((piece) => (
            <Named key={piece.key} piece={piece} size="var(--mark-l)" onOpen={onOpen} />
          ))}
        </div>
        <div className="poster-arcana">
          {arcana.map((piece) => (
            <figure
              key={piece.key}
              className={`poster-card${peek?.key === piece.key ? ' is-peeked' : ''}`}
              onMouseEnter={() => setPeek(piece)}
              onMouseLeave={() => setPeek((was) => (was?.key === piece.key ? null : was))}
            >
              {piece.icon ? <img src={`/${piece.icon}`} alt="" loading="lazy" /> : null}
              <figcaption>{piece.name}</figcaption>
            </figure>
          ))}
        </div>
        {/* The hovered card's own sentence, in a strip that keeps its height so
          * the layout below it does not move as the pointer crosses the row. */}
        <p className="poster-arcana-say" aria-live="polite">
          {peek ? (
            <>
              <strong>{peek.name}</strong>
              {peek.text ? <span>{peek.text}</span> : null}
            </>
          ) : (
            <span className="is-idle">Point at a card to read it.</span>
          )}
        </p>
      </section>
    </article>
  )
}
