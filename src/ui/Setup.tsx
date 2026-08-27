/**
 * Setup. Weapon, aspect, and how many Exits the run has.
 *
 * `DESIGN.md` 8: setup happens once, before the run, and is its own screen.
 * Everything after it is one surface. Two taps to a run, and the Exit count is
 * a number the player can correct later rather than a question they have to
 * answer well.
 */

import { useState } from 'react'

import { aspectsOf, iconOf, weapons } from '../data/app.ts'
import { DEFAULT_EXITS } from '../state/run.ts'
import type { TraitId, WeaponId } from '../data/types.ts'

export function Setup({ onStart }: { onStart: (weapon: WeaponId, aspect: TraitId | null, exits: number) => void }) {
  const [weapon, setWeapon] = useState<WeaponId | null>(null)
  const [aspect, setAspect] = useState<TraitId | null>(null)
  const [exits, setExits] = useState(DEFAULT_EXITS)

  const aspects = weapon ? aspectsOf(weapon) : []

  return (
    <section className="setup">
      <h2 className="step-heading">Which arm</h2>
      <ul className="weapon-grid">
        {weapons.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={`weapon-card${weapon === entry.id ? ' is-chosen' : ''}`}
              aria-pressed={weapon === entry.id}
              onClick={() => {
                setWeapon(entry.id)
                setAspect(null)
              }}
            >
              {entry.icon ? <img src={`/${entry.icon}`} alt="" loading="lazy" /> : null}
              <span>{entry.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {weapon ? (
        <>
          <h2 className="step-heading">Which aspect</h2>
          <ul className="aspect-row">
            {aspects.map((entry) => {
              const icon = iconOf.get(entry.id)
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`aspect-card${aspect === entry.id ? ' is-chosen' : ''}`}
                    aria-pressed={aspect === entry.id}
                    onClick={() => setAspect(entry.id)}
                  >
                    {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : null}
                    <span>{entry.name?.replace(/^Aspect of /, '')}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <h2 className="step-heading">How many Exits</h2>
          <p className="step-note">
            Counted from here to the end of the run. Correct it later if the run is longer or shorter, it only
            moves what counts as running out of time.
          </p>
          <div className="exits-field">
            <button type="button" onClick={() => setExits((n) => Math.max(1, n - 1))} aria-label="One fewer Exit">
              &minus;
            </button>
            <output>{exits}</output>
            <button type="button" onClick={() => setExits((n) => Math.min(30, n + 1))} aria-label="One more Exit">
              +
            </button>
          </div>

          <button type="button" className="begin" onClick={() => onStart(weapon, aspect, exits)}>
            Begin the run
          </button>
        </>
      ) : null}
    </section>
  )
}
