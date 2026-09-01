/**
 * The ways to satisfy what a build is missing, as buttons.
 *
 * **What this replaces.** "Exceptional Talent needs prerequisites this build
 * does not hold yet" named a problem and gave nobody a way to solve it: the
 * boons in question are somewhere in a list of two hundred and nothing said
 * which. The owner hit exactly that in playtesting and called it out.
 *
 * `checkBuild` now returns the options, so this draws them. Two things make it
 * an answer rather than a longer message:
 *
 * **It says what each one costs before you press it.** A core boon can only be
 * taken by pushing out whatever holds that slot, so an option that displaces
 * something says so on the button. Three options where one is free and two cost
 * you your Attack is a choice; three names is a puzzle.
 *
 * **Pressing it does the whole thing.** Including the displacement, because
 * doing half would leave two boons in one slot, which is a blocker, and making
 * somebody fix that by hand is the tool creating work it could have finished.
 */

import { iconOf, traits } from '../data/app.ts'
import { slotLabel } from '../engine/slots.ts'
import { FRAME } from './build-pieces.ts'
import type { Fix, FixOption } from '../engine/build-check.ts'
import type { Rarity } from '../data/types.ts'

const rarityOf = (kind: string | undefined): Rarity =>
  kind === 'duo' ? 'Duo' : kind === 'legendary' ? 'Legendary' : 'Common'

export function FixList({ fix, onTake }: { fix: Fix; onTake: (option: FixOption) => void }) {
  return (
    <div className="fixlist">
      {fix.sets.map((set, index) => (
        <div key={index} className="fixlist-set">
          {/* Every set has to be satisfied, so a build missing two says so
            * rather than offering the first and going quiet about the second. */}
          <span className="fixlist-lead">
            {fix.sets.length > 1 ? `Set ${index + 1}, one of` : 'Take one of'}
          </span>

          <span className="fixlist-options">
            {set.options.map((option) => {
              const trait = traits.get(option.id)
              const icon = iconOf.get(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`fixlist-option${option.displaces ? ' is-costly' : ''}`}
                  title={
                    option.displaces
                      ? `Take ${option.name}, replacing ${option.displaces.name} in your ${slotLabel(option.displaces.slot)}`
                      : `Take ${option.name}`
                  }
                  onClick={() => onTake(option)}
                >
                  {icon ? (
                    <span className="fixlist-face">
                      <img className="fixlist-art" src={`/${icon}`} alt="" loading="lazy" />
                      <img
                        className="fixlist-frame"
                        src={`/${FRAME[rarityOf(trait?.kind)]}`}
                        alt=""
                        aria-hidden="true"
                      />
                    </span>
                  ) : null}
                  <span className="fixlist-text">
                    <span className="fixlist-name">{option.name}</span>
                    {option.displaces ? (
                      <span className="fixlist-cost">
                        replaces {option.displaces.name}
                      </span>
                    ) : (
                      <span className="fixlist-free">costs nothing</span>
                    )}
                  </span>
                </button>
              )
            })}
          </span>
        </div>
      ))}
    </div>
  )
}
