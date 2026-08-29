/**
 * Variant 3: the Constellation. Position carries the meaning.
 *
 * **The design approach is spatial memory.** The five core slots sit at five
 * fixed clock positions around the aspect, in the same order every time, for
 * every build. Nothing is labelled until you look at it. After three builds a
 * player knows that the top left is always the Attack and reads a build's shape
 * before reading a single word: a build with a dark upper right is a build that
 * does not care about the Special.
 *
 * The rings are meaningful, not decorative. **Inner ring**: the five slots,
 * which are the contested resources. **Between the rings**: the duos and the
 * slotless boons, tied to the ring by nothing but proximity, because they
 * contend for nothing. **Outer arc**: the Arcana, which are fixed before the
 * run and therefore furthest from the middle.
 *
 * This is also the app's existing language. `Radial.tsx` already puts an Exit's
 * offers on a circle, so a player arriving here has seen the geometry.
 *
 * **What it is good at**: shape at a glance, and gaps. An empty spoke is a hole
 * you can see before reading anything, which is the second question the owner
 * asked for.
 *
 * **What it gives up**: names. Text on a circle is either tiny or crowded, so
 * this leans on the art doing the identifying, and a build with several boons
 * from one god looks like several of the same picture.
 */

import { Mark } from '../BuildMark.tsx'
import type { Assembled, Piece } from '../build-pieces.ts'

/**
 * Where each spoke sits, in degrees clockwise from the top.
 *
 * Zero is the top, because the CSS pins each node to the top edge of a box it
 * then rotates. Attack is always at twelve o'clock and the rest follow the
 * order of `CORE_SLOTS`, so a slot is in the same place in every build, which
 * is the entire argument for this layout.
 */
const SPOKE = [0, 72, 144, 216, 288]

export function Constellation({ built, onOpen }: { built: Assembled; onOpen?: (piece: Piece) => void }) {
  const rest = built.run.pieces.filter((piece) => !piece.slot)
  const arcana = built.crossroads.pieces.filter((piece) => piece.kind === 'arcana')
  const kit = built.crossroads.pieces.filter((piece) => piece.kind !== 'arcana' && piece.kind !== 'aspect')

  return (
    <div className="constel">
      <div className="constel-wheel">
        <div className="constel-hub">
          {built.render ? <img className="constel-render" src={`/${built.render}`} alt="" /> : null}
          <span className="constel-hub-name">{built.arm}</span>
        </div>

        {built.slots.map((entry, index) => (
          <div
            key={entry.slot}
            className={`constel-spoke${entry.piece ? '' : ' is-open'}`}
            style={{ '--angle': `${SPOKE[index]}deg` } as React.CSSProperties}
          >
            <span className="constel-node">
              {entry.piece ? (
                <Mark piece={entry.piece} size="var(--mark-l)" showGlyph={false} onOpen={onOpen} />
              ) : (
                <span className="constel-empty">
                  {entry.glyph ? <img src={`/${entry.glyph}`} alt="" loading="lazy" /> : null}
                </span>
              )}
              <span className="constel-node-name">{entry.piece ? entry.piece.name : entry.name}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="constel-field" aria-label="Everything that occupies no slot">
        {rest.map((piece) => (
          <span key={piece.key} className="constel-loose">
            <Mark piece={piece} size="var(--mark-m)" onOpen={onOpen} />
            <span className="constel-loose-name">{piece.name}</span>
          </span>
        ))}
      </div>

      <div className="constel-rim" aria-label="Before you go">
        {kit.map((piece) => (
          <Mark key={piece.key} piece={piece} size="var(--mark-s)" onOpen={onOpen} />
        ))}
        <span className="constel-rim-div" aria-hidden="true" />
        {arcana.map((piece) => (
          <span key={piece.key} className="constel-card" title={piece.name}>
            {piece.icon ? <img src={`/${piece.icon}`} alt={piece.name} loading="lazy" /> : null}
          </span>
        ))}
      </div>
    </div>
  )
}
