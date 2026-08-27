/**
 * Slots, and the lockout that started this project.
 *
 * "I kept trying for that Zeus legendary, turns out I needed it on my Cast."
 * Everything here traces to the game's own code, because the shape of the rule
 * is not what it looks like from the outside.
 *
 * **A god's five core boons are offered through a slot filter.**
 * `UpgradeChoiceLogic.GetPriorityTraits` builds `occupiedSlots` from every
 * trait the player holds, then offers a priority boon only when
 * `not HeroHasTrait(name) and not occupiedSlots[TraitData[name].Slot]`. So a
 * Cast slot filled by Zeus removes every other god's Cast boon from the normal
 * offer. That is the lockout, and it is real.
 *
 * **It is not absolute, and DESIGN.md 4.2 needs to know it.**
 * `GetReplacementTraits` offers a swap into an occupied slot instead. It fires
 * on `RandomChance(CurrentRun.Hero.BoonData.ReplaceChance)`, which is 0.1, and
 * only once `GameState.CompletedRunsCache >= 2`. It also requires
 * `GetUpgradedRarity(heldRarity)` to exist, and `RarityUpgradeOrder` is
 * `Common, Rare, Epic, Heroic`, so **a slot holding a Heroic boon can never be
 * swapped**. A swap replaces rather than adds: `HandleUpgradeChoiceSelection`
 * calls `RemoveWeaponTrait(TraitToReplace)` first.
 *
 * The consequence for reachability, in one line: a target blocked only by a
 * filled slot is not proof-of-impossible unless that slot is held at Heroic.
 *
 * Pure. No react, no storage, no fetch, no imports outside data/types.
 */

import type { Held, Rarity, Slot, TraitId, TraitIndex } from '../data/types.ts'

/** Every slot the game defines, core first. */
export const SLOTS: readonly Slot[] = [
  'Melee',
  'Secondary',
  'Ranged',
  'Rush',
  'Mana',
  'Spell',
  'Keepsake',
  'Aspect',
]

/** The five an Olympian's priority boons compete for. */
export const CORE_SLOTS: readonly Slot[] = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana']

/**
 * The game's published words for its own internal ones, from the Keywords
 * glossary. The UI says these and never the left-hand side.
 */
export const SLOT_LABELS: Record<Slot, string> = {
  Melee: 'Attack',
  Secondary: 'Special',
  Ranged: 'Cast',
  Rush: 'Sprint',
  Mana: 'Magick',
  Spell: 'Hex',
  Keepsake: 'Keepsake',
  Aspect: 'Aspect',
}

/**
 * `GetPriorityTraits` keeps one Attack or Special in the offer when the roll
 * would otherwise contain none. Worth knowing before anyone concludes from
 * play that Attack boons are commoner than the pool suggests.
 */
export const GUARANTEED_SLOTS: readonly Slot[] = ['Melee', 'Secondary']

/** `HeroData.BoonData.ReplaceChance`. Gated on two completed runs. */
export const REPLACE_CHANCE = 0.1

/** `TraitRarityData.RarityUpgradeOrder`. Heroic is the top, so Heroic is a lock. */
export const RARITY_UPGRADE_ORDER: readonly Rarity[] = ['Common', 'Rare', 'Epic', 'Heroic']

export function slotLabel(slot: Slot): string {
  return SLOT_LABELS[slot]
}

/** `GetUpgradedRarity`. null when there is no rung above this one. */
export function upgradedRarity(rarity: Rarity): Rarity | null {
  const index = RARITY_UPGRADE_ORDER.indexOf(rarity)
  if (index === -1) return null
  return RARITY_UPGRADE_ORDER[index + 1] ?? null
}

export type SlotState = {
  slot: Slot
  /** the trait holding it, or null */
  occupant: TraitId | null
  /** the best rarity held in this slot, which is what a swap is measured against */
  rarity: Rarity | null
  /**
   * Whether a replacement offer could ever appear for this slot. False when the
   * slot is empty, because then the boon is offered outright, and false when the
   * occupant is at the top of the upgrade ladder.
   */
  swappable: boolean
}

/**
 * Which slots are filled, and by what.
 *
 * `HeroSlotFilled` (TraitLogic.lua:515) counts a trait's `AltSlot` as filling a
 * slot too. The first occupant found holds the slot, and the highest rarity in
 * it is what a swap has to beat, which is how `GetReplacementTraits` reads it.
 */
export function slotStates(held: Held, traits: TraitIndex): Map<Slot, SlotState> {
  const states = new Map<Slot, SlotState>()
  for (const slot of SLOTS) {
    states.set(slot, { slot, occupant: null, rarity: null, swappable: false })
  }

  for (const heldTrait of held) {
    const trait = traits.get(heldTrait.id)
    if (!trait) continue
    for (const slot of [trait.slot, trait.altSlot]) {
      if (!slot) continue
      const state = states.get(slot)
      if (!state) continue
      if (state.occupant === null) {
        state.occupant = trait.id
        state.rarity = heldTrait.rarity
      } else if (rarityValue(heldTrait.rarity) > rarityValue(state.rarity)) {
        state.rarity = heldTrait.rarity
      }
    }
  }

  for (const state of states.values()) {
    state.swappable = state.occupant !== null && upgradedRarity(state.rarity ?? 'Common') !== null
  }
  return states
}

/** `TraitRarityData.RarityValues`. Anything unrecognised is 1, as the game does. */
export function rarityValue(rarity: Rarity | null): number {
  const values: Record<Rarity, number> = {
    Common: 1,
    Rare: 2,
    Epic: 3,
    Heroic: 4,
    Legendary: 5,
    Duo: 5,
    Perfect: 6,
  }
  return rarity ? (values[rarity] ?? 1) : 1
}

export function occupiedSlots(held: Held, traits: TraitIndex): Set<Slot> {
  const filled = new Set<Slot>()
  for (const state of slotStates(held, traits).values()) {
    if (state.occupant !== null) filled.add(state.slot)
  }
  return filled
}

export type OfferVerdict = {
  /** true when the normal priority offer can contain this trait */
  offerable: boolean
  /** the trait sitting in the way, when one is */
  blockedBy: TraitId | null
  /**
   * What is left when the normal offer is blocked. `swap` means a replacement
   * offer could still bring it, at REPLACE_CHANCE. `locked` means not even that,
   * because the occupant is at the top of the rarity ladder.
   */
  route: 'offer' | 'swap' | 'locked' | 'held'
  /** never render a verdict without this */
  why: string
}

/**
 * Can this trait still be offered, given what is held?
 *
 * Answers for one trait against the priority path, which is the path the five
 * core boons come down. A trait with no slot is never blocked by a slot.
 */
export function canBeOffered(traitId: TraitId, held: Held, traits: TraitIndex): OfferVerdict {
  const trait = traits.get(traitId)
  const label = trait?.name ?? traitId

  if (held.some((h) => h.id === traitId)) {
    return { offerable: false, blockedBy: traitId, route: 'held', why: `You already hold ${label}.` }
  }

  const slot = trait?.slot ?? null
  if (!slot) {
    return { offerable: true, blockedBy: null, route: 'offer', why: `${label} occupies no slot, so nothing can block it.` }
  }

  const state = slotStates(held, traits).get(slot)
  if (!state || state.occupant === null) {
    return { offerable: true, blockedBy: null, route: 'offer', why: `Your ${slotLabel(slot)} is open.` }
  }

  const occupantName = traits.get(state.occupant)?.name ?? state.occupant
  if (state.swappable) {
    return {
      offerable: false,
      blockedBy: state.occupant,
      route: 'swap',
      why: `${occupantName} holds your ${slotLabel(slot)}, so ${label} can only arrive as a swap.`,
    }
  }
  return {
    offerable: false,
    blockedBy: state.occupant,
    route: 'locked',
    why: `${occupantName} holds your ${slotLabel(slot)} at ${state.rarity}, which is the top of the ladder, so ${label} cannot arrive at all.`,
  }
}

/**
 * The whole picture at once, for the rail: every slot, what holds it, and what
 * that costs. Ordered core first, since that is the order the HUD uses.
 */
export function slotSummary(held: Held, traits: TraitIndex): SlotState[] {
  const states = slotStates(held, traits)
  return SLOTS.map((slot) => states.get(slot)).filter((state): state is SlotState => state !== undefined)
}
