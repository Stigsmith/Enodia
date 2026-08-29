/**
 * Variant 5: the Contact Sheet. Built to be compared, not admired.
 *
 * **The design approach is uniformity on purpose.** Every other variant makes
 * one build look good. This one makes several builds look like each other, so
 * the differences are the only thing you see. Equal square tiles, equal
 * spacing, nothing emphasised, tiny rules naming each band. It is a proof
 * sheet.
 *
 * The bands are in the same order and the same place for every build, which is
 * the whole trick: with three of these stacked, the Attack tile is always in
 * the same column, so a scan down that column is a scan of every build's
 * Attack.
 *
 * This is the variant that answers the owner's second question directly. "I
 * default to this playstyle, which build covers my gaps" is a comparison, and a
 * comparison needs the things being compared to be drawn identically.
 *
 * **What it is good at**: two or three builds at once, and difference.
 *
 * **What it gives up**: everything else. No build has any character in it, the
 * centrepiece is a tile like any other, and it tells you nothing about what to
 * do with any of it.
 */

import { Mark } from '../BuildMark.tsx'
import type { Assembled, Piece } from '../build-pieces.ts'

export function Contact({
  built,
  onOpen,
  compact = false,
}: {
  built: Assembled
  onOpen?: (piece: Piece) => void
  /** several builds at once, so the header shrinks to a line */
  compact?: boolean
}) {
  const rest = built.run.pieces.filter((piece) => !piece.slot)
  const arcana = built.crossroads.pieces.filter((piece) => piece.kind === 'arcana')
  const kit = built.crossroads.pieces.filter((piece) => piece.kind !== 'arcana')

  return (
    <section className={`contact${compact ? ' is-compact' : ''}`} aria-label={built.build.name}>
      <header className="contact-head">
        <h3>{built.build.name}</h3>
        <p>
          {built.arm}
          {built.gods.length ? <span className="contact-gods">{built.gods.join(' + ')}</span> : null}
        </p>
      </header>

      <div className="contact-band" data-band="slots">
        <span className="contact-rule">Slots</span>
        <div className="contact-tiles">
          {built.slots.map((entry) => (
            <span key={entry.slot} className={`contact-tile${entry.piece ? '' : ' is-open'}`}>
              {entry.piece ? (
                <Mark piece={entry.piece} size="var(--mark-s)" showGlyph={false} onOpen={onOpen} />
              ) : (
                <span className="contact-empty">
                  {entry.glyph ? (
                    <img src={`/${entry.glyph}`} alt={`${entry.name}, open`} loading="lazy" />
                  ) : null}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="contact-band" data-band="rest">
        <span className="contact-rule">Beyond the slots</span>
        <div className="contact-tiles">
          {rest.map((piece) => (
            <span key={piece.key} className="contact-tile" title={piece.name}>
              <Mark piece={piece} size="var(--mark-s)" onOpen={onOpen} />
            </span>
          ))}
        </div>
      </div>

      <div className="contact-band" data-band="kit">
        <span className="contact-rule">Before you go</span>
        <div className="contact-tiles">
          {kit.map((piece) => (
            <span key={piece.key} className="contact-tile" title={piece.name}>
              <Mark piece={piece} size="var(--mark-s)" onOpen={onOpen} />
            </span>
          ))}
          {arcana.map((piece) => (
            <span key={piece.key} className="contact-tile is-card" title={piece.name}>
              {piece.icon ? <img src={`/${piece.icon}`} alt={piece.name} loading="lazy" /> : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
