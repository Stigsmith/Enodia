/**
 * The picker, which is the live end of the path rather than a screen under it.
 *
 * Three steps, each a ring, each one narrowing the last:
 *
 *   what kind of reward  ->  who gave it  ->  which one
 *
 * A step that has only one answer is skipped, so a Daedalus Hammer goes
 * straight to its upgrades and never asks who handed it over.
 *
 * On the last tap the run advances and the path scrolls to the next Exit, the
 * same way the weapon ring hands you to the aspect ring. Nothing here is a
 * separate surface and nothing has to be dismissed.
 *
 * **"Not an Olympian" is the term.** Hermes and Selene hand out boons and never
 * touch `MaxGodsPerRun`, because `ReachedMaxGods` counts loot carrying
 * `GodLoot` and theirs does not. "Costs no slot" described the consequence;
 * this describes the thing.
 */

import { useState } from 'react'

import { godPools, iconOf, sources, traits } from '../data/app.ts'
import type { RewardSource } from '../data/app.ts'
import { canBeOffered } from '../engine/slots.ts'
import { satisfiesRequirement } from '../engine/reachability.ts'
import { eligibleGods } from '../engine/runsim.ts'
import { Radial } from './Radial.tsx'
import type { ArtShape } from './Radial.tsx'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'
import type { RunEntry } from '../state/run.ts'

type Kind = 'boon' | 'other' | 'hammer' | 'encounter' | 'artifact'

const KINDS: { id: Kind; name: string; icon: string | null; art: ArtShape; note: string }[] = [
  {
    id: 'boon',
    name: 'A boon',
    // The game's own `Icons/Boon.png`, not the wiki's redraw of it.
    icon: 'icons/boon.png',
    art: 'icon',
    note: 'From one of the nine Olympians. Spends a slot',
  },
  {
    id: 'hammer',
    name: 'A hammer',
    icon: 'artifacts/daedalus-hammer.webp',
    art: 'icon',
    note: 'Two of the eighteen reward slots',
  },
  {
    id: 'other',
    name: 'Not an Olympian',
    icon: 'gods/hermes.webp',
    art: 'portrait',
    note: 'Hermes or Selene. Neither counts against the cap',
  },
  {
    id: 'encounter',
    name: 'An Encounter',
    icon: 'gods/artemis.webp',
    art: 'portrait',
    note: 'Not an Exit at all, and costs no slot',
  },
  {
    id: 'artifact',
    name: 'Something else',
    icon: 'artifacts/pom-of-power.webp',
    art: 'icon',
    note: 'A Pom, health, gold. Half the reward slots, and none of them move a verdict',
  },
]

const RARITIES: HeldTrait['rarity'][] = ['Common', 'Rare', 'Epic', 'Heroic']

const ARTIFACTS: { id: string; name: string; icon: string | null; art: ArtShape }[] = [
  { id: 'pom', name: 'Pom of Power', icon: 'artifacts/pom-of-power.webp', art: 'icon' },
  { id: 'heart', name: 'Centaur Heart', icon: 'artifacts/centaur-heart.webp', art: 'icon' },
  { id: 'gold', name: 'Gold or resources', icon: 'artifacts/golden-crowns.webp', art: 'icon' },
  { id: 'nothing', name: 'Nothing', icon: null, art: 'icon' },
]

export function Picker({
  run,
  onTake,
  onSkip,
}: {
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null, kind: RunEntry['kind']) => void
  onSkip: (god: string | null, kind: RunEntry['kind']) => void
}) {
  const [kind, setKind] = useState<Kind | null>(null)
  // An Encounter happens inside a Location the player already reached, so it
  // spends no Exit. Everything else here is an Exit reward.
  const where = (which: Kind | null): RunEntry['kind'] => (which === 'encounter' ? 'encounter' : 'exit')
  const [source, setSource] = useState<RewardSource | null>(null)
  const [rarity, setRarity] = useState<HeldTrait['rarity']>('Common')

  const reset = () => {
    setKind(null)
    setSource(null)
    setRarity('Common')
  }

  const openGods = new Set(eligibleGods(run, traits, godPools))
  const held = new Set(run.held.map((h) => h.id))

  const sourcesFor = (which: Kind): RewardSource[] => {
    if (which === 'boon') return sources.filter((s) => s.kind === 'olympian' && openGods.has(s.id))
    if (which === 'hammer') return sources.filter((s) => s.kind === 'hammer' && s.weapon === run.weapon)
    if (which === 'other') return sources.filter((s) => s.kind === 'hex' || (s.kind === 'other' && s.id === 'Hermes'))
    if (which === 'encounter') {
      return sources.filter((s) => {
        if (s.kind === 'other' && s.id === 'Chaos') return true
        if (s.kind !== 'encounter') return false
        return !s.path || !run.path || s.path === run.path
      })
    }
    return []
  }

  const offerable = (from: RewardSource) =>
    from.traits
      .filter((id) => {
        const trait = traits.get(id)
        if (!trait || held.has(id)) return false
        if (!satisfiesRequirement(trait.requires, held)) return false
        return canBeOffered(id, run.held, traits).route === 'offer'
      })
      .sort((a, b) => (traits.get(a)?.name ?? '').localeCompare(traits.get(b)?.name ?? ''))

  // Step 1. What kind of thing did this Exit hand over.
  if (!kind) {
    return (
      <PickerStep label="What did this Exit give">
        <Radial
          label="What did this Exit give"
          variant="portraits"
          items={KINDS.map((entry) => ({
            id: entry.id,
            name: entry.name,
            icon: entry.icon,
            art: entry.art,
            note: entry.note,
          }))}
          chosen={null}
          onChoose={(id) => {
            const next = id as Kind
            if (next === 'artifact') {
              setKind(next)
              return
            }
            const list = sourcesFor(next)
            // A step with one answer does not get asked.
            if (list.length === 1) {
              setKind(next)
              setSource(list[0] ?? null)
            } else {
              setKind(next)
            }
          }}
        />
      </PickerStep>
    )
  }

  // The artifacts end the step early: none of them changes what is reachable.
  if (kind === 'artifact') {
    return (
      <PickerStep label="Something else" onBack={reset}>
        <Radial
          label="Something else"
          variant="portraits"
          items={ARTIFACTS}
          chosen={null}
          onChoose={() => {
            onSkip(null, 'exit')
            reset()
          }}
        />
      </PickerStep>
    )
  }

  // Step 2. Who gave it.
  if (!source) {
    const list = sourcesFor(kind)
    return (
      <PickerStep label="Who gave it" onBack={reset}>
        <Radial
          label="Who gave it"
          variant="portraits"
          items={list.map((entry) => ({
            id: entry.id,
            name: entry.name,
            icon: entry.icon,
            // Every source in every one of these rings is a face.
            art: 'portrait' as const,
          }))}
          chosen={null}
          onChoose={(id) => setSource(list.find((entry) => entry.id === id) ?? null)}
        />
      </PickerStep>
    )
  }

  // Step 3. Which one.
  const options = offerable(source)
  return (
    <PickerStep label={`What ${source.name} gave`} onBack={reset}>
      <div className="rarity-step" role="group" aria-label="Rarity, optional">
        <button
          type="button"
          onClick={() => setRarity((was) => RARITIES[Math.max(0, RARITIES.indexOf(was) - 1)] ?? 'Common')}
          aria-label="Lower rarity"
          disabled={rarity === RARITIES[0]}
        >
          &minus;
        </button>
        <output className={`rarity is-${rarity.toLowerCase()}`}>
          <img src={`/rarity/${rarity.toLowerCase()}.png`} alt="" />
          {rarity}
        </output>
        <button
          type="button"
          onClick={() =>
            setRarity((was) => RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(was) + 1)] ?? 'Heroic')
          }
          aria-label="Higher rarity"
          disabled={rarity === RARITIES[RARITIES.length - 1]}
        >
          +
        </button>
      </div>

      <ul className="boon-list">
        {options.map((id) => {
          const trait = traits.get(id)
          const icon = iconOf.get(id)
          return (
            <li key={id}>
              <button
                type="button"
                className="boon"
                onClick={() => {
                  onTake(id, rarity, source.kind === 'olympian' ? source.id : null, where(kind))
                  reset()
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

      <button
        type="button"
        className="quiet"
        onClick={() => {
          onSkip(source.kind === 'olympian' ? source.id : null, where(kind))
          reset()
        }}
      >
        Took nothing from {source.name}
      </button>
    </PickerStep>
  )
}

function PickerStep({
  label,
  onBack,
  children,
}: {
  label: string
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="picker-step">
      <h2 className="picker-label">{label}</h2>
      {children}
      {onBack ? (
        <button type="button" className="quiet picker-back" onClick={onBack}>
          Back
        </button>
      ) : null}
    </div>
  )
}
