/**
 * Setup. Weapon, aspect, and which way the run goes.
 *
 * `DESIGN.md` 8: setup happens once, before the run, and is its own screen.
 *
 * **It does not ask how many Exits the run has.** A player does not know that
 * when they start, so the question produced a worse number than a default does.
 * The estimate lives in the run header where it can be corrected once the run
 * makes it obvious.
 */

import { useState } from 'react'

import { aspectsOf, iconOf, weapons } from '../data/app.ts'
import type { RunPath, TraitId, WeaponId } from '../data/types.ts'

export function Setup({
  onStart,
}: {
  onStart: (weapon: WeaponId, aspect: TraitId | null, path: RunPath | null) => void
}) {
  const [weapon, setWeapon] = useState<WeaponId | null>(null)
  const [aspect, setAspect] = useState<TraitId | null>(null)
  const [path, setPath] = useState<RunPath | null>(null)

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

          <h2 className="step-heading">Which way</h2>
          <ul className="path-row">
            {(
              [
                { id: 'underworld' as const, name: 'Underworld', icon: 'ui/underworldicon.webp' },
                { id: 'surface' as const, name: 'Surface', icon: 'ui/surfaceicon.webp' },
              ]
            ).map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={`aspect-card${path === option.id ? ' is-chosen' : ''}`}
                  aria-pressed={path === option.id}
                  onClick={() => setPath(option.id)}
                >
                  <img src={`/${option.icon}`} alt="" loading="lazy" />
                  <span>{option.name}</span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="begin" onClick={() => onStart(weapon, aspect, path)}>
            Begin the run
          </button>
        </>
      ) : null}
    </section>
  )
}
