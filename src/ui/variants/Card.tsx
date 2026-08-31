/**
 * One build in the overview grid, on the game's own save slot.
 *
 * This was the Contact Sheet variant. It went through two shapes and landed on
 * a third, which is worth recording because the second was wrong for a reason
 * that only showed up after the first fix.
 *
 * **First it was too big**: a card showing a whole build meant two per screen,
 * and the whole argument for a contact sheet is seeing several at once. So it
 * lost the Arcana strip, the loose boons and the crossroads band.
 *
 * **Then it went onto `SaveProfileSlot`**, which is 425 by 630 portrait. That
 * fixes the card's height whether anything fills it or not, and the stripped
 * card filled about a third: a name, a row of slots and two lines, floating in
 * an empty plate.
 *
 * So the bands are back. The height is spent either way, and content is a
 * better thing to spend it on than air. What the shrink was actually protecting
 * against was a card taller than its neighbours, and the plate now guarantees
 * they are all the same height, which was the real fix.
 *
 * **The bands stay in fixed positions**, which was the contact sheet's whole
 * argument and survives all of it: the Attack tile is in the same place on
 * every card, so a scan down a column is a scan of every build's Attack.
 */

import { Mark } from '../BuildMark.tsx'
import type { Assembled } from '../build-pieces.ts'

export function Card({ built, onOpen }: { built: Assembled; onOpen: (id: string) => void }) {
  const { build } = built
  const rest = built.run.pieces.filter((piece) => !piece.slot)
  const arcana = built.crossroads.pieces.filter((piece) => piece.kind === 'arcana')
  const kit = built.crossroads.pieces.filter((piece) => piece.kind !== 'arcana')

  return (
    <li className="bcard">
      <button type="button" className="bcard-hit" onClick={() => onOpen(build.id)}>
        <span className="bcard-head">
          <span className="bcard-name">{build.name}</span>
          <span className="bcard-arm">
            {built.arm}
            {built.gods.length ? <span className="bcard-gods">{built.gods.join(' + ')}</span> : null}
          </span>
        </span>

        <Band label="Slots">
          {built.slots.map((entry) => (
            <span key={entry.slot} className={`bcard-tile${entry.piece ? '' : ' is-open'}`}>
              {entry.piece ? (
                <Mark piece={entry.piece} size="var(--mark-s)" showGlyph={false} />
              ) : (
                <span className="bcard-empty">
                  {entry.glyph ? <img src={`/${entry.glyph}`} alt="" loading="lazy" /> : null}
                </span>
              )}
            </span>
          ))}
        </Band>

        {rest.length ? (
          <Band label="Beyond the slots">
            {rest.map((piece) => (
              <span key={piece.key} className="bcard-tile" title={piece.name}>
                <Mark piece={piece} size="var(--mark-s)" />
              </span>
            ))}
          </Band>
        ) : null}

        <Band label="Before you go">
          {kit.map((piece) => (
            <span key={piece.key} className="bcard-tile" title={piece.name}>
              <Mark piece={piece} size="var(--mark-s)" />
            </span>
          ))}
        </Band>

        {/* The Arcana keep their own shape: they are tall painted cards and a
          * square crop loses the figure. Their own row, so the tiles above stay
          * on a grid. */}
        {arcana.length ? (
          <span className="bcard-arcana">
            {arcana.map((piece) => (
              <span key={piece.key} className="bcard-card" title={piece.name}>
                {piece.icon ? <img src={`/${piece.icon}`} alt="" loading="lazy" /> : null}
              </span>
            ))}
          </span>
        ) : null}

        {/* Last, and pushed to the foot of the plate, so every card's sentence
          * sits on the same line however many bands are above it. */}
        <span className="bcard-say">{build.say}</span>
      </button>
    </li>
  )
}

function Band({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="bcard-band">
      <span className="bcard-rule">{label}</span>
      <span className="bcard-tiles">{children}</span>
    </span>
  )
}
