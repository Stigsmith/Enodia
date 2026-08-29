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

import { godPools, sources, traits } from '../data/app.ts'
import type { RewardSource } from '../data/app.ts'
import { canBeOffered } from '../engine/slots.ts'
import { satisfiesRequirement } from '../engine/reachability.ts'
import { eligibleGods } from '../engine/runsim.ts'
import { Offer } from './Offer.tsx'
import { Radial } from './Radial.tsx'
import type { ArtShape, RadialItem } from './Radial.tsx'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'
import type { RunEntry } from '../state/run.ts'

type Kind = 'boon' | 'other' | 'chaos' | 'hammer' | 'shop' | 'story' | 'encounter' | 'artifact'

const KINDS: (RadialItem & { id: Kind; note: string })[] = [
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
    id: 'chaos',
    name: 'A Chaos gate',
    // Items/Loot/PreviewOnly/ChaosGate.png, the preview the game draws on one.
    icon: 'icons/chaos-gate.png',
    art: 'icon',
    scale: 1.12,
    note: 'Its own Exit, and its own price. Costs no Olympian slot',
  },
  {
    id: 'encounter',
    name: 'An Encounter',
    icon: 'gods/artemis.webp',
    art: 'portrait',
    note: 'Not an Exit at all, and costs no slot',
  },
  {
    id: 'shop',
    name: "Charon's shop",
    icon: 'characters/charon.webp',
    art: 'portrait',
    note: 'An Exit like any other. What you bought is what counts',
  },
  {
    id: 'story',
    name: 'A Story Exit',
    // Items/Loot/PreviewOnly/Story.png, which is the preview the game draws on
    // one. `ChosenRewardType == "Story"` is a real reward type beside Boon,
    // Devotion and Shop.
    icon: 'icons/story.png',
    art: 'icon',
    // Its art fills 42 percent of its own canvas, against 90 for the Chaos
    // gate beside it, so at the same width it renders half the size.
    scale: 1.5,
    note: 'Echo, Medea and the rest. Costs an Exit, and what it gives is theirs to decide',
  },
  {
    id: 'artifact',
    name: 'Something else',
    // The game's MysteryResource, not a Pom. A Pom is one of the things this
    // covers and standing for all of them made it look like the only one.
    icon: 'icons/mystery.png',
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
    /**
     * What Charon stocks, from `StoreData.WorldShop`.
     *
     * `RandomLoot` and `BoostedRandomLoot` are a boon from any god, so buying
     * one **does** spend an Olympian slot. `ShopHermesUpgrade` is Hermes,
     * `SpellDrop` is Selene's Hex, `WeaponUpgradeDrop` is a Daedalus Hammer.
     * The rest of his stock is Poms, health, Magick and Talents, which move no
     * verdict and are logged under "Something else".
     *
     * So a shop is not its own family of rewards. It is another route to the
     * families that already exist, and it asks the same question they do.
     */
    if (which === 'shop') {
      return sources.filter(
        (s) =>
          (s.kind === 'olympian' && openGods.has(s.id)) ||
          s.kind === 'hex' ||
          (s.kind === 'other' && s.id === 'Hermes') ||
          (s.kind === 'hammer' && s.weapon === run.weapon),
      )
    }
    /**
     * Chaos, on its own.
     *
     * It sat under the Encounters, which was wrong twice over. `LootData_Chaos`
     * carries a `DoorIcon`, so a Chaos gate is a real Exit reward and costs an
     * Exit, where an Encounter costs none. And Chaos is not one of the four
     * gods who turn up inside a Location.
     */
    if (which === 'chaos') return sources.filter((s) => s.kind === 'other' && s.id === 'Chaos')
    if (which === 'encounter') {
      return sources.filter((s) => {
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
          items={KINDS}
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

  /**
   * A Story Exit ends the step where it starts.
   *
   * `ChosenRewardType == "Story"` is its own reward type, and what is behind
   * one is a scene rather than a loot table: Medea can be worth a great deal
   * and the files do not say so anywhere this project could read. It costs an
   * Exit, which is the part that matters to the engine, and the rest is the
   * player's to remember.
   */
  if (kind === 'story') {
    onSkip(null, 'exit')
    reset()
    return null
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

  // Step 3. Which one, ranked.
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

      {/* Build order step 11. The list is ranked and each card carries one
          sentence about this run, from engine/offer.ts. */}
      <Offer
        run={run}
        candidates={options}
        god={source.kind === 'olympian' ? source.id : null}
        rarity={rarity}
        onTake={(id) => {
          onTake(id, rarity, source.kind === 'olympian' ? source.id : null, where(kind))
          reset()
        }}
      />

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
