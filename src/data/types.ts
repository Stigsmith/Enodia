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
  /**
   * The weapon this trait belongs to, which only the 24 aspects carry. No boon
   * is weapon-gated at the eligibility level: the ValidWeapons lists inside the
   * damage modifiers say where a bonus applies, not whether it can be offered.
   */
  requiredWeapon: WeaponId | null
  requires: Requirement | null
  /**
   * The game's own sentence about what this does, with the Keywords resolved
   * and the formatting codes stripped. A player who has never seen a boon can
   * find out what it is without leaving the tool.
   */
  text: string | null
}

/** The game's internal weapon name, for example `WeaponStaffSwing`. */
export type WeaponId = string

/**
 * The run, as the engines read it. DESIGN.md 3.3, with two changes the source
 * forced.
 *
 * `held` carries a rarity per trait, because a slot held at Heroic can never be
 * swapped and one held at Common can. `godsTaken` is separate from `godsSeen`
 * because the cap counts pickups: `InteractLogic.HandleLootPickup` writes
 * `LootTypeHistory` when the loot is taken, so seeing a god costs nothing.
 */
export type RunPath = 'underworld' | 'surface'

export type RunContext = {
  weapon: WeaponId | null
  aspect: TraitId | null
  /**
   * Which way the run went. Recorded, and not yet used to filter anything: the
   * region each Encounter god appears in is only half traceable in the room
   * data, and a guess about who can still turn up would be exactly the kind of
   * invented fact this project keeps out.
   */
  path: RunPath | null
  /**
   * The build this run is going for, when the player named one at setup.
   *
   * An id from `data/builds.ts` rather than the build itself, so a run stored
   * yesterday reads against today's definition of it. Null is the ordinary
   * case and means the run is not chasing anything in particular, which is a
   * real way to play and not a missing answer.
   */
  build?: string | null
  /** Exits remaining in the run. The engine's only clock. */
  exitsLeft: number
  held: Held
  /** Olympians whose boon has been picked up. This is what the cap counts. */
  godsTaken: GodId[]
  /** Gods offered at an Exit, taken or not. Free, and useful for AT_RISK. */
  godsSeen: GodId[]
  /**
   * `CurrentRun.MaxGodsPerRun or HeroData.MaxGodsPerRun`. Read from the run and
   * never hardcoded: bounties override it to 1 or 2.
   */
  maxOlympians: number
  /** The roster that counts toward the cap, derived from the loot data. */
  olympians: readonly GodId[]
}

/**
 * A build: a combination, which is what a player is actually chasing.
 *
 * "A single duo or legendary is not a build", and the owner is right. Builds
 * are centred on a combination of an aspect, a hammer upgrade, a duo and a
 * legendary, and tracking one duo gives no more edge than the codex does.
 *
 * The engine needs no new machinery for this: a build is the same set-cover
 * problem with more sets in it. What it needs is definitions, and those are
 * judgement, so they live in `data/curated/builds.json` and they are the
 * owner's to write. `CLAUDE.md`: evaluations come from the owner.
 */
export type Build = {
  id: string
  name: string
  /** what it does and how it plays, in the owner's words */
  say: string
  /** every set must be satisfied, exactly like a duo's prerequisites */
  requires: TraitId[][]
  /** the aspect it is built on, when it needs one */
  aspect?: TraitId
  /** hammer upgrades it wants, each treated as its own set */
  hammers?: TraitId[]
  gods?: {
    /** the build does not exist without these */
    core?: GodId[]
    /** fine, sometimes good, worth a spare slot */
    compatible?: GodId[]
    /** taking one costs a slot the build needs */
    avoid?: GodId[]
  }
}

/** Traits by id. Built once, read everywhere, never mutated. */
export type TraitIndex = ReadonlyMap<TraitId, Trait>

/** One held trait and the rarity it is held at, which decides swap eligibility. */
export type HeldTrait = { id: TraitId; rarity: Rarity }

export type Held = readonly HeldTrait[]
