/**
 * The data the app runs on, loaded once at module init.
 *
 * `data/app/app-data.json` is 78 KB, 15 gzipped, so it is imported rather than
 * fetched. Static site, no network call at runtime, exactly as `DESIGN.md` 1
 * says. Rebuild it with `npm run data`, which prebuild also does.
 */

import bundle from '../../data/app/app-data.json'
import type { GodId, Requirement, Slot, Trait, TraitId, TraitIndex, TraitKind, WeaponId } from './types.ts'

type RawTrait = {
  id: string
  name: string
  kind: string
  slot?: string
  altSlot?: string
  gods?: string[]
  weapon?: string
  requires?: Requirement
  icon?: string
  text?: string
  render?: string
}

export type Weapon = {
  id: WeaponId
  /** the library's slug for it, which is also its art */
  slug: string
  name: string
  /** the base aspect's cutout: the weapon itself, transparent */
  icon: string | null
  /** the Codex card, parchment and all, for when a card is what is wanted */
  card: string | null
}

/** Where a trait's art lives, by trait id. Absent when there is none. */
export const iconOf: ReadonlyMap<TraitId, string> = new Map(
  (bundle.traits as RawTrait[]).flatMap((trait) => (trait.icon ? [[trait.id, trait.icon] as const] : [])),
)

/** The large cutout, for the aspects that have one. */
export const renderOf: ReadonlyMap<TraitId, string> = new Map(
  (bundle.traits as RawTrait[]).flatMap((trait) => (trait.render ? [[trait.id, trait.render] as const] : [])),
)

export const traits: TraitIndex = new Map(
  (bundle.traits as RawTrait[]).map((trait) => [
    trait.id,
    {
      id: trait.id,
      name: trait.name,
      kind: trait.kind as TraitKind,
      slot: (trait.slot ?? null) as Slot | null,
      altSlot: (trait.altSlot ?? null) as Slot | null,
      gods: trait.gods ?? [],
      requiredWeapon: trait.weapon ?? null,
      requires: trait.requires ?? null,
      text: trait.text ?? null,
    } satisfies Trait,
  ]),
)

export const olympians: readonly GodId[] = bundle.olympians

export const weapons: readonly Weapon[] = bundle.weapons as Weapon[]

/** `ScreenData.UpgradeChoice.MaxChoices`, `HeroData.MaxGodsPerRun`, and friends. */
export const offerRules = bundle.offerRules as {
  maxChoices: number
  maxGodsPerRun: number
  replaceChance: number
  replaceUnlockedAfterRuns: number
  rarityUpgradeOrder: string[]
}

/**
 * Everything that can hand you a trait, and what it can hand you.
 *
 * Nine Olympians, Hermes and Chaos, Selene's Hexes, a Daedalus Hammer per
 * weapon, and the four Encounter gods who have no LootData entry at all.
 */
export type RewardSource = {
  id: string
  name: string
  kind: 'olympian' | 'other' | 'hammer' | 'hex' | 'encounter'
  icon: string | null
  /** hammers only: which weapon these upgrades belong to */
  weapon?: string
  /** where this one turns up, when the room data says. Athena says nothing */
  path?: 'underworld' | 'surface'
  traits: TraitId[]
}

export const sources: readonly RewardSource[] = bundle.sources as RewardSource[]

/** Each god's offer pools, for the Exit picker and the simulator. */
export const godPools: ReadonlyMap<GodId, { priority: TraitId[]; pool: TraitId[] }> = new Map(
  (bundle.pools as { god: string; priority: string[]; pool: string[] }[]).map((entry) => [
    entry.god,
    { priority: entry.priority, pool: entry.pool },
  ]),
)

/** The aspects of one weapon, in display order with the base one first. */
export function aspectsOf(weapon: WeaponId): Trait[] {
  return [...traits.values()]
    .filter((trait) => trait.kind === 'aspect' && trait.requiredWeapon === weapon)
    .sort((a, b) => {
      const base = (trait: Trait) => (trait.name?.includes('Melino') ? 0 : 1)
      return base(a) - base(b) || (a.name ?? '').localeCompare(b.name ?? '')
    })
}

/** The build stamp the data came from, for the footer and for bug reports. */
export const gameVersion: string = (bundle._provenance as { gameVersion?: string }).gameVersion ?? 'unknown'
