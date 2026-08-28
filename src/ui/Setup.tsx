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
import { Radial } from './Radial.tsx'
import type { RadialItem } from './Radial.tsx'
import type { RunPath, TraitId, WeaponId } from '../data/types.ts'

export function Setup({
  onStart,
}: {
  onStart: (weapon: WeaponId, aspect: TraitId | null, path: RunPath | null) => void
}) {
  const [weapon, setWeapon] = useState<WeaponId | null>(null)
  const [aspect, setAspect] = useState<TraitId | null>(null)
  const [path, setPath] = useState<RunPath | null>(null)

  const chosenWeapon = weapons.find((entry) => entry.id === weapon) ?? null

  // The weapon settles into the middle and its four aspects take the ring.
  const items: RadialItem[] = chosenWeapon
    ? aspectsOf(chosenWeapon.id).map((entry) => ({
        id: entry.id,
        name: entry.name?.replace(/^Aspect of /, '') ?? entry.id,
        icon: iconOf.get(entry.id) ?? null,
        note: entry.text,
      }))
    : weapons.map((entry) => ({ id: entry.id, name: entry.name, icon: entry.icon }))

  return (
    <section className="setup">
      <Radial
        variant={chosenWeapon ? 'default' : 'cards'}
        label={chosenWeapon ? 'Which aspect' : 'Which arm'}
        items={items}
        chosen={chosenWeapon ? aspect : weapon}
        centre={chosenWeapon ? { id: chosenWeapon.id, name: chosenWeapon.name, icon: chosenWeapon.icon } : null}
        onChoose={(id) => {
          if (chosenWeapon) setAspect(id)
          else {
            setWeapon(id)
            setAspect(null)
          }
        }}
      />

      {chosenWeapon ? (
        <div className="setup-tail">
          <button type="button" className="quiet" onClick={() => { setWeapon(null); setAspect(null) }}>
            Pick a different arm
          </button>

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

          <button type="button" className="begin" onClick={() => onStart(chosenWeapon.id, aspect, path)}>
            Begin the run
          </button>
        </div>
      ) : null}
    </section>
  )
}
