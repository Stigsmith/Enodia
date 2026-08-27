/**
 * Recording what an Exit gave you. Tap-only, two taps deep.
 *
 * `DESIGN.md` 8: at an Exit you are shown three boons from at most two or three
 * gods, so the picker is filtered rather than searched. God first, then what
 * that god can actually offer, which is the slot rule doing visible work: a
 * filled Cast means no god lists a Cast boon here either.
 *
 * Rarity is optional. Leaving it Common is a guess the player can correct, and
 * the only thing it changes is whether that slot could still be swapped.
 */

import { useState } from 'react'

import { godPools, iconOf, traits } from '../data/app.ts'
import { canBeOffered } from '../engine/slots.ts'
import { satisfiesRequirement } from '../engine/reachability.ts'
import { eligibleGods } from '../engine/runsim.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'

const RARITIES: HeldTrait['rarity'][] = ['Common', 'Rare', 'Epic', 'Heroic']

export function LogPick({
  run,
  onTake,
  onSkip,
}: {
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string) => void
  onSkip: (god: string | null) => void
}) {
  const [god, setGod] = useState<string | null>(null)
  const [rarity, setRarity] = useState<HeldTrait['rarity']>('Common')

  const gods = eligibleGods(run, traits, godPools)
  const held = new Set(run.held.map((h) => h.id))

  const offerable = god
    ? [...new Set([...(godPools.get(god)?.priority ?? []), ...(godPools.get(god)?.pool ?? [])])]
        .filter((id) => {
          const trait = traits.get(id)
          if (!trait || held.has(id)) return false
          if (!satisfiesRequirement(trait.requires, held)) return false
          return canBeOffered(id, run.held, traits).route === 'offer'
        })
        .sort((a, b) => (traits.get(a)?.name ?? '').localeCompare(traits.get(b)?.name ?? ''))
    : []

  return (
    <section className="log-pick">
      <h2 className="step-heading">{god ? `What ${god} offered` : 'Who was behind the Exit'}</h2>

      {god ? (
        <>
          <div className="rarity-row" role="group" aria-label="Rarity, optional">
            {RARITIES.map((option) => (
              <button
                key={option}
                type="button"
                className={`rarity${rarity === option ? ' is-chosen' : ''}`}
                aria-pressed={rarity === option}
                onClick={() => setRarity(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <ul className="boon-list">
            {offerable.map((id) => {
              const trait = traits.get(id)
              const icon = iconOf.get(id)
              const slot = trait?.slot
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="boon"
                    onClick={() => {
                      onTake(id, rarity, god)
                      setGod(null)
                      setRarity('Common')
                    }}
                  >
                    {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : <span className="boon-blank" />}
                    <span className="boon-name">{trait?.name}</span>
                    {slot ? <span className="boon-slot">{slot}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="pick-actions">
            <button type="button" className="quiet" onClick={() => setGod(null)}>
              Back
            </button>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                onSkip(god)
                setGod(null)
              }}
            >
              Took nothing from {god}
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="god-list">
            {gods.map((name) => (
              <li key={name}>
                <button type="button" className="god" onClick={() => setGod(name)}>
                  <img src={`/gods/${name.toLowerCase()}.webp`} alt="" loading="lazy" />
                  <span>{name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="pick-actions">
            <button type="button" className="quiet" onClick={() => onSkip(null)}>
              This Exit had no god
            </button>
          </div>
        </>
      )}
    </section>
  )
}
