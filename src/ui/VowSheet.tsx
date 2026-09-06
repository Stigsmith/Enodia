/**
 * The Oath of the Unseen, as a sheet you tick.
 *
 * **Optional detail, not a form.** `Fear.tsx` argued for a number rather than a
 * vow sheet and it was right for the place it was arguing about: seventeen vows
 * over forty ranks does not belong in a row on a panel. It belongs behind an
 * opener, for the run somebody wants to be precise about, and the number stays
 * the thing you type first.
 *
 * ## Why the sheet does not overwrite the number
 *
 * A partial sheet is the normal case. Somebody remembers three of the five vows
 * they were running and ticks those. If the sheet won, their Fear 30 run would
 * silently become a Fear 9 one. So the number a person typed stands, the sheet
 * shows what it comes to, and where the two disagree the screen says so and
 * leaves it alone. `coversTotal` in `engine/vows.ts` is that predicate.
 *
 * ## Why numbered pips rather than a stepper each
 *
 * A rank is one of two, three or four, and which one matters: Vow of Rivals at
 * rank 1 is 3 Fear and at rank 4 it is 12. Numbered buttons show the rank taken
 * and the ranks available in the same glance, and clicking the one that is
 * already on clears it, which is how `Stars` above already behaves.
 *
 * Names, not art. Four of the seventeen have an icon and the other thirteen do
 * not, because `assets/vows/` holds art for a different set of names: a grid
 * four-seventeenths dressed reads as broken rather than sparse.
 */

import { coversTotal, fearOf, setVow, tidyVows, vowSheet, vowsTakenCount } from '../engine/vows.ts'
import type { VowsTaken } from '../engine/vows.ts'

/**
 * The vows behind a Fear number, for anywhere that is reading rather than
 * editing.
 *
 * **Draws nothing when nothing was recorded**, which is the normal case and the
 * same argument `PlayStrip` and `FearMark` both make for themselves: a row of
 * absent detail across a library is furniture claiming to be information.
 *
 * Short names. "Vow of" on all seventeen is fifty-one characters of prefix on
 * one line, and the shrine's own screen does not repeat it either.
 */
export function VowLine({ vows: taken }: { vows: VowsTaken | undefined }) {
  const rows = vowSheet(tidyVows(taken)).filter((row) => row.rank > 0)
  if (!rows.length) return null

  return (
    <span className="vowline" title={`${fearOf(tidyVows(taken))} Fear from ${rows.length} vows`}>
      {rows.map(({ vow, rank }) => (
        <span key={vow.id} className="vowline-one">
          {vow.name.replace(/^Vow of /, '')} <strong>{rank}</strong>
        </span>
      ))}
    </span>
  )
}

export function VowSheet({
  taken,
  onChange,
  target,
}: {
  taken: VowsTaken
  onChange: (next: VowsTaken) => void
  /** the Fear the run recorded, so the sheet can say when it does not match */
  target?: number
}) {
  const rows = vowSheet(taken)
  const sum = fearOf(taken)
  const on = vowsTakenCount(taken)
  const agrees = coversTotal(taken, target)

  return (
    <div className="vowsheet">
      <div className="vowsheet-top">
        <p className="vowsheet-sum">
          <strong>{on}</strong> {on === 1 ? 'vow' : 'vows'}, <strong>{sum}</strong> Fear
        </p>
        {on ? (
          <button type="button" className="vowsheet-clear" onClick={() => onChange({})}>
            Clear
          </button>
        ) : null}
      </div>

      {/* Said once, plainly, and it does not block anything. A sheet that does
        * not add up to the number is incomplete rather than wrong, and the
        * number is the one that was recorded. */}
      {on && target !== undefined && !agrees ? (
        <p className="vowsheet-note">
          These come to {sum}, and the run is recorded at {target}. The number stands; the sheet
          is however much of it you want to write down.
        </p>
      ) : null}

      <ul className="vowsheet-list">
        {rows.map(({ vow, rank, fear }) => (
          <li key={vow.id} className={rank ? 'is-on' : ''}>
            <span className="vowsheet-name">{vow.name}</span>
            <span className="vowsheet-ranks" role="group" aria-label={vow.name}>
              {vow.ranks.map((_, at) => {
                const step = at + 1
                return (
                  <button
                    key={step}
                    type="button"
                    aria-pressed={step <= rank}
                    className={step <= rank ? 'is-on' : ''}
                    title={step === rank ? `Clear ${vow.name}` : `${vow.name}, rank ${step}`}
                    onClick={() => onChange(setVow(taken, vow.id, step === rank ? 0 : step))}
                  >
                    {step}
                  </button>
                )
              })}
            </span>
            <span className="vowsheet-fear">{fear || ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
