/**
 * The Oath of the Unseen, as its own screen inside the log dialog.
 *
 * **It replaces the form rather than opening under it.** The first version was
 * a `<details>` that unfolded a bordered box in the middle of the panel, which
 * put a second frame inside a frame and pushed the form's own buttons through
 * the bottom of the art. A screen the shrine already has does not want to be a
 * drawer. So this takes the whole panel, on `box-halfscreen.png`, and Back puts
 * the form back.
 *
 * ## Why the sheet does not overwrite the number
 *
 * A partial sheet is the normal case. Somebody remembers three of the five vows
 * they were running and ticks those. If the sheet won, their Fear 30 run would
 * silently become a Fear 9 one. So the number a person typed stands, the sheet
 * shows what it comes to, and where the two disagree the screen says so and
 * leaves it alone. `coversTotal` in `engine/vows.ts` is that predicate.
 *
 * ## Four across and one across the bottom, which is the shrine's own layout
 *
 * `ScreenData.Shrine` says `ItemsPerRow = 4`, and `ShrineUpgradeOrder` lists
 * the seventeen in blank-line-separated groups of four with Vow of Rivals alone
 * at the end. Rivals is also the only record in `MetaUpgradeData` carrying
 * `UseWideAnimations`, which gives it a wide backing, a wide button and a place
 * of its own: `ShrineLogic.lua:53` puts it at `ItemStartX + WideItemOffsetX`,
 * 805 + 283 = 1088, against a four-item row running 805 to 1369 whose centre is
 * 1087. The game centres it. So does this.
 *
 * **It earns the place.** 12 Fear, more than double the next highest, and all
 * four of its ranks are the gated Boss Difficulty ones, which is the entire gap
 * between a new save's ceiling of 55 and a finished one's 67.
 *
 * ## The art
 *
 * All seventeen have their real icon now. They are filed under the sprite name
 * rather than the vow name, which is why they looked missing: Vow of Pain draws
 * `VowBlood`, and the mapping is an animation in `Game/Animations`, one
 * indirection past the vow's own record. `scripts/build-app-data.ts` has the
 * whole story where the join happens.
 */

import { coversTotal, fearOf, setVow, tidyVows, vowSheet, vowsTakenCount } from '../engine/vows.ts'
import type { VowsTaken } from '../engine/vows.ts'
import { MAX_FEAR } from '../data/app.ts'

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
  const held = tidyVows(taken)
  const rows = vowSheet(held).filter((row) => row.rank > 0)
  if (!rows.length) return null

  return (
    <span className="vowline" title={`${fearOf(held)} Fear from ${rows.length} vows`}>
      {rows.map(({ vow, rank }) => (
        <span key={vow.id} className="vowline-one">
          {vow.icon ? <img src={`/${vow.icon}`} alt="" aria-hidden="true" /> : null}
          {vow.name.replace(/^Vow of /, '')} <strong>{rank}</strong>
        </span>
      ))}
    </span>
  )
}

/** The whole panel, for as long as somebody is naming vows. */
export function VowScreen({
  taken,
  onChange,
  onBack,
  target,
}: {
  taken: VowsTaken
  onChange: (next: VowsTaken) => void
  onBack: () => void
  /** the Fear the run recorded, so the screen can say when it does not match */
  target?: number
}) {
  const rows = vowSheet(taken)
  const sum = fearOf(taken)
  const on = vowsTakenCount(taken)
  const agrees = coversTotal(taken, target)

  return (
    <div className="vowscreen">
      <h3>The Oath of the Unseen</h3>

      <p className="vowscreen-sum">
        <img src="/icons/fear.png" alt="" aria-hidden="true" />
        <strong>{sum}</strong>
        <span>
          of {MAX_FEAR}, from {on} {on === 1 ? 'vow' : 'vows'}
        </span>
      </p>

      {/* Said once, plainly, and it blocks nothing. A sheet that does not add up
        * to the number is incomplete rather than wrong, and the number is the
        * one that was recorded. */}
      <p className="vowscreen-note">
        {on && target !== undefined && !agrees
          ? `These come to ${sum} and the run is recorded at ${target}. The number stands.`
          : 'Optional. The run keeps the Fear you typed either way.'}
      </p>

      <ul className="vowscreen-grid">
        {rows.map(({ vow, rank, fear }) => (
          <li key={vow.id} className={`${rank ? 'is-on' : ''}${vow.wide ? ' is-wide' : ''}`}>
            {vow.icon ? (
              <img className="vowscreen-art" src={`/${vow.icon}`} alt="" aria-hidden="true" />
            ) : (
              <span className="vowscreen-art is-blank" aria-hidden="true" />
            )}
            <span className="vowscreen-name">{vow.name}</span>
            <span className="vowscreen-ranks" role="group" aria-label={vow.name}>
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
            <span className="vowscreen-fear">{fear ? `${fear}` : ''}</span>
          </li>
        ))}
      </ul>

      <div className="vowscreen-foot">
        <button type="button" onClick={onBack}>
          Back
        </button>
        {on ? (
          <button type="button" className="vowscreen-clear" onClick={() => onChange({})}>
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  )
}
