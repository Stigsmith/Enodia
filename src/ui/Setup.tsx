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

import { aspectsOf, iconOf, renderOf, traits, weapons } from '../data/app.ts'
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

  const chosenAspect = aspect ? traits.get(aspect) : null

  // The weapon settles into the middle and its four aspects take the ring,
  // shown as the large cutouts rather than the 90 pixel icons. Once an aspect
  // is chosen it takes the middle, because that is what the run is now.
  const items: RadialItem[] = chosenWeapon
    ? aspectsOf(chosenWeapon.id).map((entry) => ({
        id: entry.id,
        name: entry.name?.replace(/^Aspect of /, '') ?? entry.id,
        icon: renderOf.get(entry.id) ?? iconOf.get(entry.id) ?? null,
        note: entry.text,
      }))
    : weapons.map((entry) => ({ id: entry.id, name: entry.name, icon: entry.icon }))

  const centre: RadialItem | null = chosenAspect
    ? {
        id: chosenAspect.id,
        name: chosenAspect.name?.replace(/^Aspect of /, '') ?? chosenAspect.id,
        icon: renderOf.get(chosenAspect.id) ?? iconOf.get(chosenAspect.id) ?? null,
      }
    : chosenWeapon
      ? { id: chosenWeapon.id, name: chosenWeapon.name, icon: chosenWeapon.icon }
      : null

  return (
    <section className="setup">
      <Radial
        // The plain ring, always: a weapon is a diagonal cutout and the game's
        // reward marker has wings that reach past the circle and tangle with it.
        frame="ring"
        variant="renders"
        label={chosenWeapon ? 'Which aspect' : 'Which arm'}
        items={items}
        chosen={chosenWeapon ? aspect : weapon}
        centre={centre}
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
