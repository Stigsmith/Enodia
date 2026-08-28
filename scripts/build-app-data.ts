/**
 * The app's data bundle.
 *
 *   npm run data
 *
 * `data/generated` is 5 MB of the game's own tables and the app needs a
 * fraction of it. This projects that fraction into `data/app/app-data.json`,
 * which is what the UI imports: the traits with the fields the engines read,
 * the roster, the weapons, the offer constants, and the icon for each trait.
 *
 * It runs through `src/data/load.ts`, so the classification the app ships is
 * the same code the tests and the validator use. A second projection written
 * here by hand would be a second definition of what a duo is, and there is
 * already a scar from that one.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { buildTraitIndex, godPoolsFrom, olympiansFrom } from '../src/data/load.ts'
import { aspectIconKeys, buildIconIndex, resolveIcon } from '../src/data/icons.ts'
import type { Manifest } from '../src/data/icons.ts'
import type { Trait } from '../src/data/types.ts'

const ROOT = resolve(import.meta.dirname, '..')

const isDict = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const dictOf = (value: unknown): Record<string, unknown> => (isDict(value) ? value : {})
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
const OUT_DIR = join(ROOT, 'data/app')

type Raw = Record<string, unknown>

const read = (name: string): { _provenance?: Raw; data: Raw } =>
  JSON.parse(readFileSync(join(ROOT, `data/generated/${name}.json`), 'utf8'))

const generated = read('traits-resolved')
const loot = read('loot').data
const text = read('text-traits').data
const help = read('text-help').data
const offerRules = read('offer-rules').data

const traits = buildTraitIndex({
  traits: generated.data,
  requirements: read('requirements').data,
  loot,
  text,
})

const manifest = JSON.parse(
  readFileSync(join(ROOT, 'assets/manifest.json'), 'utf8').replace(/^﻿/, ''),
) as Manifest
const icons = buildIconIndex(manifest)

/**
 * The six Nocturnal Arms.
 *
 * Display names come from `HelpText.HiddenAspectRevealed_<weapon>`, which is
 * the only place the game writes them down in a form we can read. The leading
 * "The" is dropped so they sit in a list.
 */
const WEAPONS = [
  { id: 'WeaponStaffSwing', slug: 'staff', textId: 'HiddenAspectRevealed_Staff' },
  { id: 'WeaponDagger', slug: 'blades', textId: 'HiddenAspectRevealed_Dagger' },
  { id: 'WeaponTorch', slug: 'flames', textId: 'HiddenAspectRevealed_Torch' },
  { id: 'WeaponAxe', slug: 'axe', textId: 'HiddenAspectRevealed_Axe' },
  { id: 'WeaponLob', slug: 'skull', textId: 'HiddenAspectRevealed_Lob' },
  { id: 'WeaponSuit', slug: 'coat', textId: 'HiddenAspectRevealed_Suit' },
]

const weaponName = (textId: string): string => {
  const record = help[textId]
  const name = typeof record === 'object' && record !== null ? (record as Raw).name : null
  return typeof name === 'string' ? name.replace(/^The /, '') : textId
}

function iconFor(trait: Trait): string | null {
  const keys = trait.name && trait.requiredWeapon ? aspectIconKeys(trait.name, trait.requiredWeapon) : []
  const found = resolveIcon(trait.id, trait.name, icons, { keys })
  return found.found ? found.file : null
}

const records = [...traits.values()]
  // Templates with no display name are never rendered, and 84 of them would be
  // a third of the payload.
  .filter((trait) => trait.name !== null)
  .map((trait) => ({
    id: trait.id,
    name: trait.name,
    kind: trait.kind,
    ...(trait.slot ? { slot: trait.slot } : {}),
    ...(trait.altSlot ? { altSlot: trait.altSlot } : {}),
    ...(trait.gods.length ? { gods: trait.gods } : {}),
    ...(trait.requiredWeapon ? { weapon: trait.requiredWeapon } : {}),
    ...(trait.requires ? { requires: trait.requires } : {}),
    ...(iconFor(trait) ? { icon: iconFor(trait) } : {}),
  }))

const pools = [...godPoolsFrom(loot).entries()].map(([god, pool]) => ({ god, ...pool }))

// ---------------------------------------------------------------------------
// What an Exit, or an Encounter, can actually give you.
//
// The default reward store is RunProgress (RewardLogic.lua:516) and it is a bag
// of 18 slots, only 4 of which are a god's Boon. Two are a Daedalus Hammer, one
// is Selene, one Hermes, one a Devotion, and the rest are Poms, health, Magick
// and gold. So "an Exit gives you a god" is the common case and not the rule,
// and a tool that only records gods cannot describe a real run.
//
// Artemis, Athena, Dionysus and Hades have no LootData entry at all. They carry
// TreatAsGodLootByShops in UnitSetData and arrive through Encounters, which is
// why they never count against MaxGodsPerRun and why they belong here anyway.
// ---------------------------------------------------------------------------

const resolved = generated.data

function ancestorsOf(id: string, seen = new Set<string>()): Set<string> {
  const record = resolved[id]
  const parents = Array.isArray((record as Raw)?.InheritFrom) ? ((record as Raw).InheritFrom as string[]) : []
  for (const parent of parents) {
    if (seen.has(parent)) continue
    seen.add(parent)
    ancestorsOf(parent, seen)
  }
  return seen
}

/** Hammer upgrades belong to a weapon through <Weapon>HammerTrait. 92 of them,
 *  which is exactly the length of Loot.WeaponUpgrade.Traits. */
const HAMMER_MARKERS: Record<string, string> = {
  WeaponStaffSwing: 'StaffHammerTrait',
  WeaponDagger: 'DaggerHammerTrait',
  WeaponTorch: 'TorchHammerTrait',
  WeaponAxe: 'AxeHammerTrait',
  WeaponLob: 'LobHammerTrait',
  WeaponSuit: 'SuitHammerTrait',
}

const named = (ids: string[]) => ids.filter((id) => traits.get(id)?.name)

type Source = {
  id: string
  name: string
  kind: 'olympian' | 'other' | 'hammer' | 'hex' | 'encounter'
  icon: string | null
  weapon?: string
  traits: string[]
}

const olympianList = olympiansFrom(loot)
const sources: Source[] = []

for (const [god, pool] of godPoolsFrom(loot)) {
  sources.push({
    id: god,
    name: god,
    kind: olympianList.includes(god) ? 'olympian' : 'other',
    icon: icons.get(god.toLowerCase())?.file ?? null,
    traits: named([...new Set([...pool.priority, ...pool.pool])]),
  })
}

// Chaos states its pool in fields nobody else uses.
const chaos = Object.values(dictOf(loot.Chaos)).find((record) => Array.isArray(dictOf(record).PermanentTraits))
if (chaos) {
  sources.push({
    id: 'Chaos',
    name: 'Chaos',
    kind: 'other',
    icon: icons.get('chaos')?.file ?? null,
    traits: named([
      ...strings(dictOf(chaos).PermanentTraits),
      ...strings(dictOf(chaos).TemporaryTraits),
    ]),
  })
}

// Selene's Hexes are the traits that occupy the Spell slot.
sources.push({
  id: 'Selene',
  name: 'Selene',
  kind: 'hex',
  icon: icons.get('selene')?.file ?? null,
  traits: named([...traits.values()].filter((trait) => trait.slot === 'Spell').map((trait) => trait.id)),
})

for (const [weapon, marker] of Object.entries(HAMMER_MARKERS)) {
  sources.push({
    id: `Hammer_${weapon}`,
    name: 'Daedalus Hammer',
    kind: 'hammer',
    icon: icons.get('daedalus-hammer')?.file ?? null,
    weapon,
    traits: named(Object.keys(resolved).filter((id) => ancestorsOf(id).has(marker))),
  })
}

const unitSets = read('unit-sets').data
for (const [setName, members] of Object.entries(unitSets)) {
  for (const record of Object.values(dictOf(members))) {
    const entry = dictOf(record)
    if (entry.TreatAsGodLootByShops !== true) continue
    const pool = named(strings(entry.Traits))
    if (!pool.length) continue
    const who = setName.replace(/^NPC_/, '')
    sources.push({
      id: setName,
      name: who,
      kind: 'encounter',
      icon: icons.get(who.toLowerCase())?.file ?? null,
      traits: pool,
    })
  }
}

const bundle = {
  _provenance: {
    ...generated._provenance,
    generatedBy: 'scripts/build-app-data.ts',
    note: 'The app bundle. A projection of data/generated, built through src/data/load.ts.',
  },
  olympians: olympiansFrom(loot),
  offerRules,
  weapons: WEAPONS.map((weapon) => ({
    id: weapon.id,
    slug: weapon.slug,
    name: weaponName(weapon.textId),
    icon: icons.get(weapon.slug)?.file ?? null,
  })),
  pools,
  sources,
  traits: records,
}

mkdirSync(OUT_DIR, { recursive: true })
const path = join(OUT_DIR, 'app-data.json')
writeFileSync(path, `${JSON.stringify(bundle)}\n`)

const bytes = readFileSync(path).length
const withArt = records.filter((record) => 'icon' in record).length
console.log(`data/app/app-data.json  ${(bytes / 1024).toFixed(0)} KB`)
console.log(`  ${records.length} named traits of ${traits.size}, ${withArt} with art`)
console.log(`  ${bundle.olympians.length} Olympians, ${bundle.weapons.length} weapons, ${pools.length} god pools`)
const byKind = sources.reduce<Record<string, number>>((tally, source) => {
  tally[source.kind] = (tally[source.kind] ?? 0) + 1
  return tally
}, {})
console.log(`  ${sources.length} reward sources: ${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ')}`)
if (!existsSync(join(ROOT, 'assets/manifest.json'))) console.log('  no asset manifest, so no icons')
