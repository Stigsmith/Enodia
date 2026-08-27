/**
 * Generated data in, domain types out.
 *
 * Pure mapping. It takes the parsed JSON as arguments rather than importing or
 * fetching it, so the same function serves the tests reading from disk and the
 * app importing at build time, and nothing here has to decide yet how the app
 * gets its bytes. That decision belongs to step 7, when there is a screen to
 * feed.
 *
 * Reads `traits-resolved.json`, never `traits.json`: only 49 of 651 traits
 * state a Slot and the rest inherit one, so the raw declaration cannot answer
 * the question the engines ask.
 */

import type { GodId, Requirement, Slot, Trait, TraitId, TraitIndex, TraitKind } from './types.ts'

type Raw = Record<string, unknown>

const isDict = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const dict = (value: unknown): Raw => (isDict(value) ? value : {})

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

const SLOTS = new Set<string>(['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell', 'Keepsake', 'Aspect'])

const asSlot = (value: unknown): Slot | null =>
  typeof value === 'string' && SLOTS.has(value) ? (value as Slot) : null

/** The transitive InheritFrom closure, for the markers that decide kind. */
function ancestors(traits: Raw, id: string, seen = new Set<string>()): Set<string> {
  for (const parent of strings(dict(traits[id]).InheritFrom)) {
    if (seen.has(parent)) continue
    seen.add(parent)
    ancestors(traits, parent, seen)
  }
  return seen
}

/**
 * What kind of thing a trait is, by the marker the game uses.
 *
 * A duo inherits `SynergyTrait`, which carries `IsDuoBoon` and `Frame = "Duo"`.
 * A legendary inherits `LegendaryTrait`. Selene's Hex duos carry `IsDuoBoon`
 * themselves. Counting prerequisite sets instead reads 33 duos where the game
 * marks 37, which is the mistake this classification exists to prevent.
 */
export function kindOf(traits: Raw, id: string): TraitKind {
  const record = dict(traits[id])
  const family = ancestors(traits, id)

  if (family.has('SynergyTrait')) return 'duo'
  if (family.has('LegendaryTrait')) return 'legendary'
  if (record.IsDuoBoon === true) return 'hex'
  if (str(record.RequiredWeapon)) return 'aspect'
  if (family.has('GiftTrait')) return 'keepsake'
  if (family.has('BaseTrait') || asSlot(record.Slot)) return 'boon'
  return 'other'
}

function requirementOf(entry: unknown): Requirement | null {
  const record = dict(entry)
  if (Array.isArray(record.OneFromEachSet)) {
    return { oneFromEachSet: record.OneFromEachSet.map((set) => strings(set)) }
  }
  if (Array.isArray(record.OneOf)) return { oneOf: strings(record.OneOf) }
  return null
}

/** Which loot sets offer each trait. A duo comes back with its two gods. */
export function godsByTrait(loot: Raw): Map<TraitId, GodId[]> {
  const POOLS = ['Traits', 'PriorityUpgrades', 'WeaponUpgrades', 'PermanentTraits', 'TemporaryTraits']
  const out = new Map<TraitId, GodId[]>()
  for (const [setName, set] of Object.entries(loot)) {
    for (const record of Object.values(dict(set))) {
      for (const field of POOLS) {
        for (const traitId of strings(dict(record)[field])) {
          const gods = out.get(traitId) ?? []
          if (!gods.includes(setName)) gods.push(setName)
          out.set(traitId, gods)
        }
      }
    }
  }
  return out
}

/**
 * The Olympians, meaning the gods that count toward `MaxGodsPerRun`.
 *
 * `GodLoot` is inherited: Poseidon and Zeus never state it and take true from
 * `BaseLoot`, while Hermes and Chaos state false and Selene's `SpellDrop`
 * inherits from nothing. Reading the flag without following `InheritFrom`
 * drops two Olympians, so this follows it.
 */
export function olympiansFrom(loot: Raw): GodId[] {
  const records = new Map<string, Raw>()
  const owner = new Map<string, string>()
  for (const [setName, set] of Object.entries(loot)) {
    for (const [recordName, record] of Object.entries(dict(set))) {
      if (!isDict(record)) continue
      records.set(recordName, record)
      owner.set(recordName, setName)
    }
  }

  const godLoot = (name: string, seen = new Set<string>()): boolean => {
    if (seen.has(name)) return false
    seen.add(name)
    const record = records.get(name)
    if (!record) return false
    if (typeof record.GodLoot === 'boolean') return record.GodLoot
    return strings(record.InheritFrom).some((parent) => records.has(parent) && godLoot(parent, seen))
  }

  const out: GodId[] = []
  for (const [recordName, record] of records) {
    if (typeof record.Speaker !== 'string') continue
    if (!godLoot(recordName)) continue
    const setName = owner.get(recordName) ?? recordName
    if (!out.includes(setName)) out.push(setName)
  }
  return out.sort()
}

export type Sources = {
  /** data/generated/traits-resolved.json, the `data` payload */
  traits: Raw
  /** data/generated/requirements.json */
  requirements: Raw
  /** data/generated/loot.json */
  loot: Raw
  /** data/generated/text-traits.json */
  text: Raw
}

export function buildTraitIndex(sources: Sources): TraitIndex {
  const gods = godsByTrait(sources.loot)
  const index = new Map<TraitId, Trait>()

  for (const [id, record] of Object.entries(sources.traits)) {
    const trait = dict(record)
    index.set(id, {
      id,
      name: str(dict(sources.text[id]).name),
      kind: kindOf(sources.traits, id),
      slot: asSlot(trait.Slot),
      altSlot: asSlot(trait.AltSlot),
      gods: gods.get(id) ?? [],
      requiredWeapon: str(trait.RequiredWeapon),
      requires: requirementOf(sources.requirements[id]),
    })
  }
  return index
}
