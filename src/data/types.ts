/**
 * The domain, in the game's own terms.
 *
 * Internal names are the stable keys and are never displayed. `DESIGN.md` 2.3:
 * display names change between patches, internal names almost never do. The UI
 * translates through one place, and `slotLabel` in engine/slots.ts is that place
 * for slots.
 */

/** The game's internal trait name, for example `ZeusWeaponBoon`. Stable. */
export type TraitId = string

/** A loot set name, for example `Zeus`. Not every god counts toward the cap. */
export type GodId = string

/**
 * A slot, as the game spells it. Player-facing words live in SLOT_LABELS.
 *
 * The five core slots are what an Olympian's five priority boons compete for.
 * Spell is Selene's Hex, and Keepsake and Aspect are equipped before a run
 * rather than offered inside one.
 */
export type Slot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana' | 'Spell' | 'Keepsake' | 'Aspect'

/**
 * `TraitRarityData.RarityValues`. Duo and Legendary both value 5: they are not
 * rungs on the ladder, they are what a duo or a legendary always is.
 */
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary' | 'Duo' | 'Perfect'

/**
 * What kind of thing a trait is, by the marker the game itself uses rather than
 * by counting anything. See scripts/validate/checks.ts classifyTraits.
 */
export type TraitKind = 'boon' | 'duo' | 'legendary' | 'hex' | 'aspect' | 'keepsake' | 'other'

/**
 * A prerequisite, exactly as `TraitRequirements` states it.
 *
 * The game's `HasTraitRequirements` (RunLogic.lua:57) also reads a `TwoOf`
 * form. No trait in build 138174 uses it, and the validator fails the build if
 * one ever does, because a form nobody handles would be read as satisfied.
 */
export type Requirement = { oneOf: TraitId[] } | { oneFromEachSet: TraitId[][] }

export type Trait = {
  id: TraitId
  /** null when the game ships no display name, which is 84 of 651 templates */
  name: string | null
  kind: TraitKind
  /** the slot this trait occupies, null for the many boons that occupy none */
  slot: Slot | null
  /** a second slot it also occupies. HeroSlotFilled counts both */
  altSlot: Slot | null
  /** the loot sets that offer it. A duo is offered by two */
  gods: GodId[]
  requires: Requirement | null
}

/** Traits by id. Built once, read everywhere, never mutated. */
export type TraitIndex = ReadonlyMap<TraitId, Trait>

/** One held trait and the rarity it is held at, which decides swap eligibility. */
export type HeldTrait = { id: TraitId; rarity: Rarity }

export type Held = readonly HeldTrait[]
