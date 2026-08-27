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
if (!existsSync(join(ROOT, 'assets/manifest.json'))) console.log('  no asset manifest, so no icons')
