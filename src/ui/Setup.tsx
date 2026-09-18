/**
 * Setup. Weapon, aspect, and which way the run goes.
 *
 * `DESIGN.md` 8: setup happens once, before the run, and is its own screen.
 *
 * **It does not ask how many Exits the run has.** A player does not know that
 * when they start, so the question produced a worse number than a default does.
 * The estimate lives in the run header where it can be corrected once the run
 * makes it obvious.
 *
 * **It does ask which build you are going for.** The arm and the aspect are
 * already chosen by then, and an aspect settles most of the field on its own,
 * so the shortlist is short and it is the moment the question is cheapest to
 * answer. Saying nothing is a real answer: plenty of runs are not going for
 * anything in particular, and the run tracks what turns up either way.
 */

import { useState } from 'react'

import { aspectsOf, iconOf, renderOf, traits, weapons } from '../data/app.ts'
import { SAMPLE_BUILDS } from '../data/builds.ts'
import { loadBuilds } from '../state/builds.ts'
import { Radial } from './Radial.tsx'
import type { RadialItem } from './Radial.tsx'
import type { RunPath, TraitId, WeaponId } from '../data/types.ts'

export function Setup({
  onStart,
}: {
  onStart: (weapon: WeaponId, aspect: TraitId | null, path: RunPath | null, build: string | null) => void
}) {
  const [weapon, setWeapon] = useState<WeaponId | null>(null)
  const [aspect, setAspect] = useState<TraitId | null>(null)
  const [path, setPath] = useState<RunPath | null>(null)
  const [build, setBuild] = useState<string | null>(null)

  const chosenWeapon = weapons.find((entry) => entry.id === weapon) ?? null

  const chosenAspect = aspect ? traits.get(aspect) : null

  /**
   * What a run can go for: the shipped builds and your library, your own and
   * the ones you follow. Read once, when the screen opens.
   *
   * **This read the shipped list alone, and that list is empty**, so the step
   * below said nothing was on the aspect however many builds you had.
   */
  const [library] = useState(() => [...SAMPLE_BUILDS, ...loadBuilds()])

  // An aspect is what makes the shortlist short. Before one is chosen there is
  // nothing worth showing, and after one there are rarely more than a few.
  const onAspect = aspect ? library.filter((one) => one.aspect === aspect) : []

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
          // A build belongs to an aspect, so changing either one drops it
          // rather than leaving a build the run can no longer reach selected.
          setBuild(null)
          if (chosenWeapon) setAspect(id)
          else {
            setWeapon(id)
            setAspect(null)
          }
        }}
      />

      {chosenWeapon ? (
        <div className="setup-tail">
          <button type="button" className="quiet" onClick={() => { setWeapon(null); setAspect(null); setBuild(null) }}>
            Pick a different arm
          </button>

          {/* Which build, out of the ones on this aspect.
            *
            * Shown only once there is an aspect, because that is what makes the
            * list short enough to read. An aspect with nothing written for it
            * says so rather than showing an empty row. */}
          {aspect ? (
            <>
              <h2 className="step-heading" data-tour="setup-from-build">Going for a build</h2>
              {onAspect.length ? (
                <ul className="path-row">
                  {onAspect.map((one) => {
                    const mark = iconOf.get(one.centrepiece)
                    return (
                      <li key={one.id}>
                        <button
                          type="button"
                          className={`aspect-card${build === one.id ? ' is-chosen' : ''}`}
                          aria-pressed={build === one.id}
                          title={one.say}
                          onClick={() => setBuild(build === one.id ? null : one.id)}
                        >
                          {mark ? <img src={`/${mark}`} alt="" loading="lazy" /> : null}
                          <span>{one.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="step-none">
                  None of your builds is on this aspect yet. The run still tracks what you pick
                  up.
                </p>
              )}
            </>
          ) : null}

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

          <button type="button" className="begin" onClick={() => onStart(chosenWeapon.id, aspect, path, build)}>
            Begin the run
          </button>
        </div>
      ) : null}
    </section>
  )
}
