/**
 * Variant 1: the Loadout. Mimic the game.
 *
 * **The design approach is deference.** Hades II already solved showing a
 * player everything they hold, and the answer is the Boon tray: a fixed column
 * of slots down one side, each wearing the game's own glyph, and everything
 * slotless in a labelled tray beside it. A player who has put 300 hours into
 * that screen can read this one without being taught it.
 *
 * So this is built on the game's own furniture. `tray-backing.png` behind it,
 * `tray-header.png` on the section headers, the slot glyphs and rarity frames
 * as the game draws them.
 *
 * **What it is good at**: recognition, and density. Everything is on screen at
 * once and nothing needs a scroll.
 *
 * **What it gives up**: it looks like the game rather than like a thing worth
 * looking at, and a build in it has no character. Three of these side by side
 * are hard to tell apart.
 */

import { Mark, Named } from '../BuildMark.tsx'
import type { Assembled, Piece } from '../build-pieces.ts'

export function Loadout({ built, onOpen }: { built: Assembled; onOpen?: (piece: Piece) => void }) {
  const slotless = built.run.pieces.filter((piece) => !piece.slot)

  return (
    <div className="loadout">
      <section className="loadout-slots" aria-label="The five slots">
        <h3 className="tray-head">Slots</h3>
        <ul>
          {built.slots.map((entry) => (
            <li key={entry.slot} className={`loadout-slot${entry.piece ? ' is-filled' : ' is-open'}`}>
              {entry.piece ? (
                <Mark piece={entry.piece} size="var(--mark-l)" showGlyph={false} onOpen={onOpen} />
              ) : (
                <span className="loadout-empty">
                  {entry.glyph ? <img src={`/${entry.glyph}`} alt="" loading="lazy" /> : null}
                </span>
              )}
              <span className="loadout-slot-text">
                <span className="loadout-slot-name">{entry.name}</span>
                <span className="loadout-slot-fill">{entry.piece ? entry.piece.name : 'yours to pick'}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="loadout-trays">
        <section aria-label="Everything else the run gives you">
          <h3 className="tray-head">{built.run.name}</h3>
          <p className="tray-say">{built.run.say}</p>
          <div className="loadout-tray">
            {slotless.map((piece) => (
              <Named key={piece.key} piece={piece} size="var(--mark-m)" layout="beside" onOpen={onOpen} />
            ))}
          </div>
        </section>

        <section aria-label="What you commit to before the run">
          <h3 className="tray-head">{built.crossroads.name}</h3>
          <p className="tray-say">{built.crossroads.say}</p>
          <div className="loadout-tray">
            {built.crossroads.pieces.map((piece) => (
              <Named key={piece.key} piece={piece} size="var(--mark-m)" layout="beside" onOpen={onOpen} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
