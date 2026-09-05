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

import { Mark, usePiecePeek } from '../BuildMark.tsx'
import { Stamp } from '../Stamp.tsx'
import { olympians, traits } from '../../data/app.ts'
import { readRepeat } from '../../engine/repeat.ts'
import type { Assembled, Piece } from '../build-pieces.ts'

/**
 * How many marks a band draws before it starts counting instead.
 *
 * The plate is a fixed 425 by 630 with `overflow: hidden`, so the interior is
 * about 177 by 333 at a 277px column. A mark is a flat 32px whatever the count,
 * which makes five marks and their gaps 172px: exactly one row, which is what
 * the Slots band was tuned to.
 *
 * Everything past that wrapped into rows the fixed height had no room for, so
 * the Arcana and the sentence were clipped off the bottom of any build big
 * enough to need them. Every Pair has 16 boons beyond its slots and 10 Arcana.
 *
 * The fix is not a taller card. The overview is for scanning a shelf, and a
 * card that grows to fit its contents stops being comparable to its neighbours,
 * which was the contact sheet's whole argument. So each band draws what fits and
 * says how much it is not drawing. The count is the honest part: a reader can
 * see there is more and click in for it.
 */
const BAND_CAP = 5
/**
 * Five, which is what `build-check.ts` allows a build to name, so the row never
 * truncates. It was four while a build could carry a whole board of ten; now
 * that Arcana are a couple of suggestions there is nothing to hide.
 */
const ARCANA_CAP = 5

export function Card({
  built,
  onOpen,
  first,
  foot,
}: {
  built: Assembled
  onOpen: (id: string) => void
  /** the one the tour points at, so it lights a card rather than the whole grid */
  first?: boolean
  /**
   * Anything the shelf this card is on wants under it.
   *
   * The library needs nothing. The exchange puts who published a build and what
   * happened when people played it, which is a fact about the listing rather
   * than about the build: two people can hold the same build with different
   * counts behind it. A slot rather than a second card component, so a change
   * to how a build is drawn cannot land on one shelf and not the other.
   *
   * Outside the button on purpose. A count is not a control, and a link inside
   * a button is not a thing a browser will honour.
   */
  foot?: React.ReactNode
}) {
  const { build } = built
  const rest = built.run.pieces.filter((piece) => !piece.slot)
  const arcana = built.crossroads.pieces.filter((piece) => piece.kind === 'arcana')
  const kit = built.crossroads.pieces.filter((piece) => piece.kind !== 'arcana')
  const read = readRepeat(build, traits, olympians)

  return (
    <li className="bcard" {...(first ? { 'data-tour': 'builds-card' } : {})}>
      <button type="button" className="bcard-hit" onClick={() => onOpen(build.id)}>
        <span className="bcard-head">
          <span className="bcard-name">{build.name}</span>
          <span className="bcard-arm">
            {built.arm}
            {built.gods.length ? <span className="bcard-gods">{built.gods.join(' + ')}</span> : null}
          </span>
          {/* The word only. The reasons live in the builder, where somebody can
            * act on them; here it is one more thing to sort a shelf by. */}
          <Stamp read={read} size="small" />
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
            {rest.slice(0, BAND_CAP).map((piece) => (
              <span key={piece.key} className="bcard-tile">
                <Mark piece={piece} size="var(--mark-s)" />
              </span>
            ))}
            <More count={rest.length - BAND_CAP} />
          </Band>
        ) : null}

        <Band label="Before you go">
          {kit.map((piece) => (
            <span key={piece.key} className="bcard-tile">
              <Mark piece={piece} size="var(--mark-s)" />
            </span>
          ))}
        </Band>

        {/* The Arcana keep their own shape: they are tall painted cards and a
          * square crop loses the figure. Their own row, so the tiles above stay
          * on a grid. */}
        {arcana.length ? (
          <span className="bcard-arcana">
            {arcana.slice(0, ARCANA_CAP).map((piece) => (
              <ArcanaTile key={piece.key} piece={piece} />
            ))}
            <More count={arcana.length - ARCANA_CAP} />
          </span>
        ) : null}

        {/* Last, and pushed to the foot of the plate, so every card's sentence
          * sits on the same line however many bands are above it. */}
        <span className="bcard-say">{build.say}</span>
      </button>
      {foot}
    </li>
  )
}

/** What a band is not drawing, or nothing at all when it is drawing all of it. */
function More({ count }: { count: number }) {
  if (count <= 0) return null
  return <span className="bcard-more">+{count}</span>
}

function Band({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="bcard-band">
      <span className="bcard-rule">{label}</span>
      <span className="bcard-tiles">{children}</span>
    </span>
  )
}

/** The same card, on an overview tile, with the same hover. */
function ArcanaTile({ piece }: { piece: Piece }) {
  return (
    <span className="bcard-card" {...usePiecePeek(piece)}>
      {piece.icon ? <img src={`/${piece.icon}`} alt="" loading="lazy" /> : null}
    </span>
  )
}
