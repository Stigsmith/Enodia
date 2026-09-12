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
import type { Advice } from './Offer.tsx'
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
    icon: 'gifts/hermes-gift.png',
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
    icon: 'gifts/artemis-gift.png',
    art: 'portrait',
    note: 'Not an Exit at all, and costs no slot',
  },
  {
    id: 'shop',
    name: "Charon's shop",
    icon: 'gifts/charon-gift.png',
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
    // gate beside it, so at the same width it renders half the size. 1.5 was
    // still reading small next to the marks around it, so it is a notch up.
    scale: 1.62,
    note: 'Medea on the Surface, Echo below. Costs an Exit, and what it gives is theirs',
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
  advice = null,
}: {
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null, kind: RunEntry['kind']) => void
  onSkip: (god: string | null, kind: RunEntry['kind'], note?: string) => void
  /** the notes of the build this run is going for, for the offer cards */
  advice?: Advice | null
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

  /**
   * What this source can still hand over, **in the game's own order**.
   *
   * This used to sort alphabetically, and a tester read that as no order at
   * all. It was worse than unordered: a god's list opens with its five core
   * boons in the game's own Attack, Special, Cast, Sprint, Magick sequence, and
   * the alphabet shuffled them into the middle of twenty others. The duos went
   * with them, which is most likely why the same tester reported seeing no duo
   * boons: they were there, scattered.
   *
   * `source.traits` is already right. `build-app-data.ts` writes it as
   * `[...priority, ...pool]`, which is `LootData`'s own order, so the fix is to
   * stop reordering it.
   */
  const offerable = (from: RewardSource) =>
    from.traits.filter((id) => {
      const trait = traits.get(id)
      if (!trait || held.has(id)) return false
      if (!satisfiesRequirement(trait.requires, held)) return false
      /**
       * **The aspect gate, which the run was missing.**
       *
       * Twenty hammer upgrades across the six arms only exist on one aspect:
       * the etchings and the ankhs want Anubis, and every arm has a pair or two
       * like it. The editor learned this when the owner reported being offered
       * Anubis's hammers on a Circe build; the run was offering the same
       * sixteen on every aspect and nobody had looked.
       *
       * `needsAspect` comes off `GameStateRequirements` as
       * `LastWeaponUpgradeName`. A run with no aspect chosen is not filtered,
       * because then nothing is ruled out yet.
       */
      const needs = trait.needsAspect
      if (needs && run.aspect && !needs.includes(run.aspect)) return false
      return canBeOffered(id, run.held, traits).route === 'offer'
    })

  // Step 1. What kind of thing did this Exit hand over.
  if (!kind) {
    return (
      <PickerStep label="What did this Exit give" bare>
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
   * one is a scene rather than a loot table. **They are not interchangeable
   * and they are not path-agnostic**: the owner reports Medea on the Surface
   * and Echo in the Underworld, and Medea's upgrades can be significant rather
   * than flavour, so a Story Exit is not always "nothing that changes what is
   * reachable".
   *
   * It still ends here, because the thing it gives is not in any file this
   * project reads and guessing at it would put a made-up pick in the run. It
   * costs an Exit, which is the part the engine needs, and it now says which
   * Exit it was rather than logging as a blank.
   */
  if (kind === 'story') {
    onSkip(null, 'exit', run.path === 'surface' ? 'A Story Exit, Medea' : 'A Story Exit, Echo')
    reset()
    return null
  }

  // The artifacts end the step early: none of them changes what is reachable.
  if (kind === 'artifact') {
    return (
      <PickerStep label="Something else" bare onBack={reset}>
        <Radial
          label="Something else"
          variant="portraits"
          items={ARTIFACTS}
          chosen={null}
          onChoose={(id) => {
            // Name it. "Nothing that changes what is reachable" is true and is
            // not what a player wants to read back a week later.
            onSkip(null, 'exit', ARTIFACTS.find((one) => one.id === id)?.name)
            reset()
          }}
        />
      </PickerStep>
    )
  }

  // Step 2. Who gave it.
  if (!source) {
    const list = sourcesFor(kind)
    /**
     * Every Olympian, not just the ones still open.
     *
     * `eligibleGods` hides gods a run can no longer be offered, which is right
     * for planning and wrong for logging: the owner had Hermes hand over a
     * random Hephaestus boon while three slots were spent and a keepsake was
     * pointed at Hestia. That happened, the tool has to be able to record it,
     * and the filtered ring could not.
     *
     * So the filtered ring stays the default, because it is right nearly
     * always, and this opens the rest rather than replacing them.
     */
    const everyGod = sources.filter(
      (entry) => entry.kind === 'olympian' && !list.some((shown) => shown.id === entry.id),
    )
    return (
      <PickerStep label="Who gave it" bare onBack={reset}>
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
        {/**
          * Also on Hermes and on the shop, which is where a delivery comes
          * from. A Hermes delivery hands over another god's boon, and the
          * owner's example is exactly that: Hephaestus arriving from Hermes
          * with three Olympian slots already spent. The boon is the boon and it
          * still spends a slot, so it is logged under the god who owns it, and
          * this is the way to reach that god when the run had stopped offering
          * them.
          */}
        {(kind === 'boon' || kind === 'other' || kind === 'shop') && everyGod.length ? (
          <details className="picker-more-gods">
            <summary>Another god</summary>
            <p>
              A reward can name a god this run had stopped offering. Hermes hands out random
              boons, and a Shop or an Encounter can too.
            </p>
            <div className="picker-more-gods-list">
              {everyGod.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setSource(entry)}>
                  {entry.icon ? <img src={`/${entry.icon}`} alt="" loading="lazy" /> : null}
                  {entry.name}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </PickerStep>
    )
  }

  // Step 3. Which one, ranked.
  const options = offerable(source)

  /**
   * A Daedalus Hammer is always Common, so it is not asked.
   *
   * `LootData.WeaponUpgrade` states `ForceCommon = true`, and
   * `RoomLogic.IsRarityForcedCommon` returns true for `WeaponUpgrade` before it
   * consults anything else. `StackUpgrade`, the Poms, is the only other one,
   * and that is logged under "Something else" rather than here.
   *
   * So the stepper was asking a question with one answer. **Everything else
   * keeps it**: the same function falls through to `BoonData`, which is
   * `ForceCommon = false` with real `RarityChances`, and that covers the gods,
   * Hermes, Selene and Chaos alike.
   */
  const rarityVaries = source.kind !== 'hammer'

  return (
    <PickerStep name={source.name} onBack={reset}>
      {rarityVaries ? (
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
      ) : null}

      {/* Build order step 11. The list is ranked and each card carries one
          sentence about this run, from engine/offer.ts. */}
      <Offer
        run={run}
        candidates={options}
        god={source.kind === 'olympian' ? source.id : null}
        rarity={rarity}
        advice={advice}
        onTake={(id) => {
          onTake(id, rarity, source.kind === 'olympian' ? source.id : null, where(kind))
          reset()
        }}
      />

      {/**
        * "Took nothing from Daedalus Hammer" is not a thing that happens.
        *
        * A hammer forces a choice: you interact with it and take one of the
        * three. The owner reports it is not declinable and nothing in
        * `LootData.WeaponUpgrade` offers a reject, so the option is not shown
        * for one. **This rests on the owner's play rather than on a citation**,
        * which is a weaker footing than the rest of this file and is why it is
        * written down. A hammer Exit you walked past is a different Exit, not a
        * hammer you declined.
        */}
      {source.kind !== 'hammer' ? (
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
      ) : null}
    </PickerStep>
  )
}

function PickerStep({
  label,
  name,
  bare = false,
  onBack,
  children,
}: {
  label?: string
  /** a character's own name, which gets the game's name face */
  name?: string
  /**
   * No plate, and the heading only for a screen reader.
   *
   * **A radial says its own name.** `Radial` carries a live caption under the
   * ring that reads the hovered item, or the ring's label when nothing is
   * hovered, so a bar above it was the same sentence twice. It was also the
   * sentence that kept overflowing the plate, because "What did this Exit
   * give" is long and a title bar is a fixed shape.
   *
   * The heading stays in the document. Dropping it outright would leave the
   * step with no accessible name at all.
   */
  bare?: boolean
  onBack?: () => void
  children: React.ReactNode
}) {
  const heading = name ?? label ?? ''
  return (
    <div className="picker-step">
      <h2 className={bare ? 'visually-hidden' : 'picker-label'}>
        {bare || !name ? heading : <span className="picker-label-name">{name}</span>}
      </h2>
      {children}
      {onBack ? (
        <button type="button" className="quiet picker-back" onClick={onBack}>
          Back
        </button>
      ) : null}
    </div>
  )
}
