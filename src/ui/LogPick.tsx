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

  // Three groups, because they cost three different things.
  //
  // An Olympian spends one of your four slots the moment you take a boon. The
  // hammer, Selene and Hermes cost nothing from that budget. The Encounter gods
  // are not Exits at all, and the room data says where each turns up: Artemis
  // and Hades in the Underworld, Dionysus on the Surface. Athena appears in no
  // room data, which fits her arriving through her keepsake, so she is always
  // listed.
  const olympianSources = sources.filter((entry) => entry.kind === 'olympian' && openGods.has(entry.id))

  const noSlotCost = sources.filter((entry) => {
    if (entry.kind === 'hammer') return entry.weapon === run.weapon
    if (entry.kind === 'hex') return true
    return entry.kind === 'other' && entry.id === 'Hermes'
  })

  const elsewhere = sources.filter((entry) => {
    if (entry.kind === 'other' && entry.id === 'Chaos') return true
    if (entry.kind !== 'encounter') return false
    return !entry.path || !run.path || entry.path === run.path
  })

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

  return (
    <section className="log-pick">
      <SourceGroup
        title="An Olympian"
        note="Spends one of your four slots"
        entries={olympianSources}
        onPick={setSource}
      />
      <SourceGroup
        title="Costs no slot"
        note="Never counts against the cap"
        entries={noSlotCost}
        onPick={setSource}
      />
      <SourceGroup
        title="From an Encounter"
        note={run.path ? `Who turns up on the ${run.path === 'surface' ? 'Surface' : 'Underworld'} path` : null}
        entries={elsewhere}
        onPick={setSource}
      />

      {/* Nine of the eighteen reward slots are these, so they are a row rather
          than a footnote. None of them changes what is reachable, so all four
          record the same thing: an Exit passed, nothing added. */}
      <div className="source-group">
        <h3 className="group-heading">
          Something else
          <span>Half the reward slots, and none of them move a verdict</span>
        </h3>
        <ul className="consumables">
          {CONSUMABLES.map((item) => (
            <li key={item.label}>
              <button type="button" className="consumable" onClick={() => onSkip(null)}>
                {item.icon ? <img src={`/${item.icon}`} alt="" loading="lazy" /> : null}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const CONSUMABLES: { label: string; icon: string | null }[] = [
  { label: 'Pom of Power', icon: 'symbols/pom.png' },
  { label: 'Centaur Heart', icon: 'artifacts/centaur-heart.webp' },
  { label: 'Gold or resources', icon: 'artifacts/golden-crowns.webp' },
  { label: 'Nothing', icon: null },
]

function SourceGroup({
  title,
  note,
  entries,
  onPick,
}: {
  title: string
  note: string | null
  entries: RewardSource[]
  onPick: (entry: RewardSource) => void
}) {
  if (!entries.length) return null
  return (
    <div className="source-group">
      <h3 className="group-heading">
        {title}
        {note ? <span>{note}</span> : null}
      </h3>
      <SourceList entries={entries} onPick={onPick} />
    </div>
  )
}

function SourceList({ entries, onPick }: { entries: RewardSource[]; onPick: (entry: RewardSource) => void }) {
  return (
    <ul className="god-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button type="button" className={`plate is-${entry.kind}`} onClick={() => onPick(entry)}>
            <span className="plate-mark">
              {entry.icon ? <img src={`/${entry.icon}`} alt="" loading="lazy" /> : null}
              <img className="plate-frame" src="/frames/frame-primary.png" alt="" aria-hidden="true" />
            </span>
            <span className="plate-name">{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
