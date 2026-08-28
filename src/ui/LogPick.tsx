/**
 * Recording what an Exit gave you. Tap-only, two taps deep.
 *
 * **A god is not the only thing an Exit gives.** The default reward store is
 * `RunProgress` (`RewardLogic.lua:516`) and it is a bag of 18 slots: 4 Boons, 2
 * Daedalus Hammers, 1 Selene, 1 Hermes, 1 Devotion, and 9 slots of Poms,
 * health, Magick and gold. A tool that can only record gods cannot describe a
 * real run, and a hammer changes a build as hard as a boon does.
 *
 * Artemis, Athena, Dionysus and Hades sit in their own group because they are
 * not Exits at all. They have no `LootData` entry, they carry
 * `TreatAsGodLootByShops` in `UnitSetData`, and they arrive through Encounters.
 * That is also why they never spend an Olympian slot.
 *
 * The boon list is filtered by the same engine the verdicts use, so a filled
 * Cast means no source here lists a Cast boon either.
 */

import { useState } from 'react'

import { Radial } from './Radial.tsx'

import { iconOf, sources, traits } from '../data/app.ts'
import type { RewardSource } from '../data/app.ts'
import { canBeOffered } from '../engine/slots.ts'
import { satisfiesRequirement } from '../engine/reachability.ts'
import { eligibleGods } from '../engine/runsim.ts'
import { godPools } from '../data/app.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'

const RARITIES: HeldTrait['rarity'][] = ['Common', 'Rare', 'Epic', 'Heroic']

export function LogPick({
  run,
  onTake,
  onSkip,
}: {
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null) => void
  onSkip: (god: string | null) => void
}) {
  const [source, setSource] = useState<RewardSource | null>(null)
  const [rarity, setRarity] = useState<HeldTrait['rarity']>('Common')

  const openGods = new Set(eligibleGods(run, traits, godPools))
  const held = new Set(run.held.map((h) => h.id))

  // At an Exit. Olympians freeze to those held once the cap is reached, and the
  // hammer is the one for the weapon in hand.
  const atExit = sources.filter((entry) => {
    if (entry.kind === 'olympian') return openGods.has(entry.id)
    if (entry.kind === 'hammer') return entry.weapon === run.weapon
    if (entry.kind === 'hex') return true
    return entry.kind === 'other' && entry.id === 'Hermes'
  })

  const elsewhere = sources.filter(
    (entry) => entry.kind === 'encounter' || (entry.kind === 'other' && entry.id === 'Chaos'),
  )

  const offerable = source
    ? source.traits
        .filter((id) => {
          const trait = traits.get(id)
          if (!trait || held.has(id)) return false
          if (!satisfiesRequirement(trait.requires, held)) return false
          return canBeOffered(id, run.held, traits).route === 'offer'
        })
        .sort((a, b) => (traits.get(a)?.name ?? '').localeCompare(traits.get(b)?.name ?? ''))
    : []

  if (source) {
    return (
      <section className="log-pick">
        <h2 className="step-heading">What {source.name} gave</h2>

        {/* One stepper rather than four buttons. Rarity is optional at pickup
            and the only thing it decides is whether that slot could still be
            swapped, so it should cost one tap at most. */}
        <div className="rarity-step" role="group" aria-label="Rarity, optional">
          <button
            type="button"
            onClick={() => setRarity(RARITIES[Math.max(0, RARITIES.indexOf(rarity) - 1)] ?? 'Common')}
            aria-label="Lower rarity"
            disabled={rarity === RARITIES[0]}
          >
            &minus;
          </button>
          <output className={`rarity is-${rarity.toLowerCase()}`}>{rarity}</output>
          <button
            type="button"
            onClick={() =>
              setRarity(RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(rarity) + 1)] ?? 'Heroic')
            }
            aria-label="Higher rarity"
            disabled={rarity === RARITIES[RARITIES.length - 1]}
          >
            +
          </button>
        </div>

        <ul className="boon-list">
          {offerable.map((id) => {
            const trait = traits.get(id)
            const icon = iconOf.get(id)
            return (
              <li key={id}>
                <button
                  type="button"
                  className="boon"
                  onClick={() => {
                    onTake(id, rarity, source.kind === 'olympian' ? source.id : null)
                    setSource(null)
                    setRarity('Common')
                  }}
                >
                  {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : <span className="boon-blank" />}
                  <span className="boon-name">{trait?.name}</span>
                  {trait?.slot ? <span className="boon-slot">{trait.slot}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="pick-actions">
          <button type="button" className="quiet" onClick={() => setSource(null)}>
            Back
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              onSkip(source.kind === 'olympian' ? source.id : null)
              setSource(null)
            }}
          >
            Took nothing from {source.name}
          </button>
        </div>
      </section>
    )
  }

  const byId = new Map([...atExit, ...elsewhere].map((entry) => [entry.id, entry]))

  return (
    <section className="log-pick">
      <h2 className="step-heading">What did this Exit give</h2>
      <Radial
        label="Who was behind it"
        items={atExit.map((entry) => ({
          id: entry.id,
          name: entry.name,
          icon: entry.icon,
          note: NOTES[entry.kind] ?? null,
        }))}
        chosen={null}
        onChoose={(id) => setSource(byId.get(id) ?? null)}
      />

      <h2 className="step-heading">Or, from an Encounter</h2>
      <SourceList entries={elsewhere} onPick={setSource} />

      <div className="pick-actions">
        <button type="button" className="quiet" onClick={() => onSkip(null)}>
          A Pom, gold, health, or nothing that changes what is reachable
        </button>
      </div>
    </section>
  )
}

/** Why a source is in this ring at all, said once rather than per bubble. */
const NOTES: Record<RewardSource['kind'], string> = {
  olympian: 'Spends one of your four Olympian slots the moment you take a boon',
  other: 'Never counts against the Olympian cap',
  hammer: 'Two of the eighteen reward slots. Changes a weapon more than a boon does',
  hex: 'Selene, and her Hexes never count against the Olympian cap',
  encounter: 'Arrives through an Encounter rather than an Exit, and costs no slot',
}

function SourceList({ entries, onPick }: { entries: RewardSource[]; onPick: (entry: RewardSource) => void }) {
  return (
    <ul className="god-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button type="button" className={`god is-${entry.kind}`} onClick={() => onPick(entry)}>
            {entry.icon ? <img src={`/${entry.icon}`} alt="" loading="lazy" /> : <span className="boon-blank" />}
            <span>{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
