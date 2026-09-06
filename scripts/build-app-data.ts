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
import { extractedValues } from './values.ts'
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

/**
 * The tables an `External` value in a description can name.
 *
 * Read once. `effects.json` and `weapons.json` were added to the extractor for
 * this; `hero.json` was already there.
 */
const externalTables = {
  effects: dictOf(read('effects').data),
  weapons: dictOf(read('weapons').data),
  hero: dictOf(read('hero').data),
  traits: dictOf(read('traits-resolved').data),
}
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

/**
 * Which gods offer a trait, including the four that do not offer through Exits.
 *
 * `godsByTrait` walks `LootData`, which is right for the nine Olympians, Hermes
 * and Chaos and blind to everybody else. **Artemis, Athena, Dionysus and Hades
 * have no `LootData` entry at all**: they carry `TreatAsGodLootByShops` in
 * `UnitSetData` and arrive through Encounters, which is exactly why CLAUDE.md
 * records that they never spend an Olympian slot.
 *
 * So all 33 of their traits shipped with no god at all, which meant the builder
 * could not offer them, `repeat.ts` could not charge for them, and nothing
 * anywhere could tell one from an ordinary boon.
 *
 * Read from `unit-sets.json` rather than from the `sources` array further down,
 * which is built from the same table but not until after the trait records are
 * emitted. Same filter, same name: `TreatAsGodLootByShops`, and the set name
 * without its `NPC_`.
 *
 * **It does not make them Olympians.** `olympiansFrom` reads `LootData` and
 * `GodLoot`, so the tally and the four-god cap are untouched. What changes is
 * that a trait can say whose it is.
 */
const ENCOUNTER_GOD = new Map<string, string>()
for (const [setName, members] of Object.entries(read('unit-sets').data)) {
  for (const record of Object.values(dictOf(members))) {
    const entry = dictOf(record)
    if (entry.TreatAsGodLootByShops !== true) continue
    for (const id of strings(entry.Traits)) ENCOUNTER_GOD.set(id, setName.replace(/^NPC_/, ''))
  }
}

const godsFor = (trait: Trait): string[] => {
  if (trait.gods.length) return trait.gods
  const encounter = ENCOUNTER_GOD.get(trait.id)
  return encounter ? [encounter] : []
}

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
/**
 * The six arms, and both of their names.
 *
 * `name` is the game's `DisplayName` out of HelpText, which is what the game
 * itself uses in its UI and in every patch note: "Witch's Staff (Circe)".
 *
 * **`arm` is the weapon's own name**, and the Nocturnal Arms have them because
 * they are characters rather than equipment. Melinoe's Codex says so of each in
 * turn, and the owner calls the staff Descura because that is what the game
 * calls her. Both names are the game's and neither replaces the other, so the
 * surface shows the arm and keeps the type as the qualifier.
 *
 * Transcribed by hand from `Content/Game/Text/en/CodexText.en.sjson`, with the
 * record each came from, because the name sits inside a prose blob rather than
 * in a field of its own and a regex over that prose would be a guess dressed as
 * an extraction. Quoted so the transcription can be audited:
 *
 * | Arm | The line it is taken from |
 * |---|---|
 * | Descura | "Amongst the Nocturnal Arms, Descura was first to wake" |
 * | Lim and Oros | "The sister blades Lim and Oros were created for you" |
 * | Ygnium | "You are ready for the Umbral Flames of Ygnium" |
 * | Zorephet | "do not use Zorephet the Moonstone Axe" |
 * | Revaal | "The Argent Skull once belonged to the Adjudicator Revaal" |
 * | Xinth | "Xinth is simply that idea made manifest" |
 */
const WEAPONS = [
  { id: 'WeaponStaffSwing', slug: 'staff', textId: 'HiddenAspectRevealed_Staff', arm: 'Descura', codex: 'CodexData_WeaponStaff_01' },
  { id: 'WeaponDagger', slug: 'blades', textId: 'HiddenAspectRevealed_Dagger', arm: 'Lim and Oros', codex: 'CodexData_WeaponDagger_01' },
  { id: 'WeaponTorch', slug: 'flames', textId: 'HiddenAspectRevealed_Torch', arm: 'Ygnium', codex: 'CodexData_WeaponTorch_01' },
  { id: 'WeaponAxe', slug: 'axe', textId: 'HiddenAspectRevealed_Axe', arm: 'Zorephet', codex: 'CodexData_WeaponAxe_01' },
  { id: 'WeaponLob', slug: 'skull', textId: 'HiddenAspectRevealed_Lob', arm: 'Revaal', codex: 'CodexData_WeaponLob_01' },
  { id: 'WeaponSuit', slug: 'coat', textId: 'HiddenAspectRevealed_Suit', arm: 'Xinth', codex: 'CodexData_WeaponSuit_01' },
]

const weaponName = (textId: string): string => {
  const record = help[textId]
  const name = typeof record === 'object' && record !== null ? (record as Raw).name : null
  return typeof name === 'string' ? name.replace(/^The /, '') : textId
}

/**
 * The game's own description, made readable.
 *
 * `{$Keywords.CastSet}` resolves out of HelpText, which is where the published
 * glossary lives, and the `{#BoldFormatGraft}` style codes are dropped. This is
 * the game's sentence about its own boon, so a player who has never seen
 * Ecstatic Obsession can find out what it does without leaving the tool.
 */
/**
 * What a glyph is, where the glossary would get it wrong.
 *
 * `HelpText` names most icons and naming them from there is right, but its
 * `DisplayName` is a **tooltip title** rather than an inline noun, and for a
 * few that is not the same thing. `Omega` is `"{!Icons.Omega} Moves"`, so
 * reading it off the glossary turns "your {omega}{Cast}" into "your Moves
 * Cast" where the game says **\u03a9 Cast**. `CLAUDE.md`'s vocabulary table has
 * that one by name.
 *
 * So this table wins, and the glossary fills in behind it.
 */
const ICON_WORDS: Record<string, string> = {
  Mana: 'Magick',
  ManaUp: 'Magick',
  Health: 'health',
  HealthUp: 'health',
  HealthRestore: 'health',
  EnemyHealth: 'health',
  Currency: 'gold',
  ArmorTotal: 'armour',
  ArmorTotal_NoTooltip: 'armour',
  // `Total` is not a decoration that can be stripped: ArmorTotal is not
  // Armor. These two are named here rather than guessed at.
  HealthUpTotal: 'health',
  HealthDown: 'health',
  // Marks rather than nouns: an arrow between two numbers, a slash between
  // two costs. There is no word to look up because there is no word.
  RightArrow: 'to',
  Slash: '/',
  // \u03a9 Moves, per CLAUDE.md. The glossary calls this one "Moves", which
  // reads as a different mechanic entirely once it is inline.
  Omega: '\u03a9',
  /**
   * The one the glossary has an entry for and no name in.
   *
   * `HelpText.ManaItem_Hound` ships a `description` and no `name`, so the
   * lookup found the record, took nothing out of it, and rendered an empty
   * string: Hecuba "digs up Snack or in a pinch", with the second half of the
   * pair silently missing. It is the Magick drop, and `Mana` above already
   * says Magick rather than Mana for the same reason CLAUDE.md's table does.
   */
  ManaItem_Hound: 'Magick',
}

/**
 * A name out of the published glossary, following the id's own decorations.
 *
 * `HelpText` keys the real entry on the plain id and the game refers to it
 * with a suffix when it wants the same thing without a tooltip, or an
 * alternate phrasing: `GodBoonPluralNoTooltip` is `GodBoonPlural`, `HoldAlt`
 * is `Hold`. Without following that, eleven descriptions rendered the raw
 * identifier at the reader, which is worse than rendering nothing.
 */
function glossary(key: string): string | null {
  const tried = [key]
  // `WithCount` is the same word with its count in front of it: the game
  // renders "2 {AllElements}" and names the entry AllElementsWithCount.
  for (const suffix of ['NoTooltip', '_NoTooltip', 'Alt', 'EX', 'WithCount']) {
    let candidate = key
    while (candidate.endsWith(suffix) && candidate.length > suffix.length) {
      candidate = candidate.slice(0, -suffix.length)
      tried.push(candidate)
    }
  }
  // A doubly decorated id, GodBoonPluralNoTooltip -> GodBoonPlural -> GodBoon.
  for (const candidate of [...tried]) {
    for (const suffix of ['NoTooltip', 'Alt', 'Plural']) {
      if (candidate.endsWith(suffix) && candidate.length > suffix.length) {
        tried.push(candidate.slice(0, -suffix.length))
      }
    }
  }

  for (const candidate of tried) {
    const name = dictOf(help[candidate]).name
    if (typeof name !== 'string' || !name.trim()) continue
    // Not trimmed. A glossary name is the glyph plus the word, so stripping
    // the glyph leaves a leading space that is the space between them:
    // "{!Icons.PomLevel} Lv." is " Lv." and "+#" + "Lv." reads "+#Lv.".
    // describe() collapses runs of whitespace at the end, so a stray one
    // costs nothing and a missing one is visible.
    const cleaned = name.replace(/\{[^}]*\}/g, '')
    if (cleaned.trim()) return cleaned
  }
  return null
}

/**
 * The word an icon stands for.
 *
 * `{!Icons.X}` renders as a glyph in game and a glyph is a noun: "you receive
 * [gold], [health], and [bones] now". Dropping it leaves "you receive, health,
 * and now", which is what this app shipped until the sentences were read
 * rather than the code.
 *
 * The table above first, then `HelpText` keyed by the icon's own id, which is
 * the same table `{$Keywords.X}` already reads. `MetaCurrencyIcon` is
 * `"{!Icons.MetaCurrency} Bones"`: the glyph plus the word, so stripping the
 * glyph leaves the word. Nothing here is invented.
 *
 * 38 of the 74 keys used in trait text resolve straight off the glossary.
 * `_NoTooltip` and `Alt` are decorations on an id rather than different
 * things, so those are stripped and tried again. **`Icon` and `Total` are
 * not stripped**: `ArmorTotal` is not `Armor` and the first attempt at this
 * turned "+1 armour" into "+1".
 */
function iconWord(key: string): string {
  const known = ICON_WORDS[key]
  if (known !== undefined) return known

  const candidates = [key]

  /**
   * The five elements are named on the boon, not on the curse.
   *
   * `HelpText` has no `CurseAir`, but `AirBoon` is `"{!Icons.CurseAir} Air"`:
   * the same glyph, and the word. It holds for all five, checked. Without it
   * Air Quality reads "While you have at least 5, you can never deal less
   * damage" and the reader has to guess five of what.
   */
  const element = /^(?:Curse)?(Air|Water|Fire|Earth|Aether)(?:NoTooltip|_NoTooltip|Alt)?$/.exec(key)
  if (element) candidates.push(`${element[1]}Boon`)

  for (const candidate of [key]) {
    for (const suffix of ['_NoTooltip', 'NoTooltip', 'Alt']) {
      if (candidate.endsWith(suffix) && candidate.length > suffix.length) {
        const stripped = candidate.slice(0, -suffix.length)
        candidates.push(stripped)
        if (ICON_WORDS[stripped] !== undefined) return ICON_WORDS[stripped]
      }
    }
  }

  for (const candidate of candidates) {
    const word = glossary(candidate)
    if (word) return word
  }
  return ''
}

/**
 * A value the text reaches for by path, out of the trait tables.
 *
 * `{$TraitData.ElementalDamageFloorBoon.ActivationRequirements.1.Value}` is a
 * literal walk into `traits-resolved.json`, one-based where it indexes a list.
 * **37 of the 38 in the trait text resolve**, and the ones that do not used to
 * be deleted by the catch-all, which is how Air Quality came to read "While
 * you have at least, you can never deal less damage than the limit."
 */
function traitDataAt(path: string): string | null {
  // generated.data, not the `resolved` alias further down: describe() runs
  // while the records are being built, which is before that line executes.
  let node: unknown = generated.data
  // The text writes an index two ways, `.1.` and `.[2].`, and both are
  // one-based. Reckless Abandon uses the bracketed form for the middle of its
  // three damage values, and without it that sentence read "exactly 5,, or 555".
  for (const part of path.split('.').map((piece) => piece.replace(/^\[(\d+)\]$/, '$1'))) {
    if (isDict(node) && part in node) node = node[part]
    else if (Array.isArray(node) && /^\d+$/.test(part)) node = node[Number(part) - 1]
    else return null
  }
  if (typeof node === 'number') return String(Math.round(node * 100) / 100)
  if (typeof node === 'string') return node
  return null
}

/**
 * The last pass over any piece of game text: markup out, spacing tidy.
 *
 * A display name goes through it as well as a description. Thirteen names were
 * shipping raw markup, `{!Icons.CurseAir}` among them, because only
 * descriptions were being cleaned.
 */
function tidy(raw: string): string {
  return raw
    .replace(/\{!Icons\.([A-Za-z0-9_]+)\}/g, (_match, key: string) => {
      const word = iconWord(key)
      return word ? ` ${word}` : ''
    })
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:%])/g, '$1')
    .trim()
}

function describe(traitId: string): string | null {
  const raw = dictOf(text[traitId]).description
  if (typeof raw !== 'string') return null
  const values = extractedValues(dictOf(dictOf(generated.data)[traitId]), externalTables)
  return (
    raw
      // The published glossary, so the tool says the game's own words.
      .replace(/\{\$Keywords\.([A-Za-z0-9_]+)\}/g, (_match, key: string) => glossary(key) ?? key)
      /**
       * Icon glyphs stand in for nouns. Dropping them leaves sentences like
       * "you lose before you lose", so they become the word they depict.
       *
       * With a leading space, because a glyph sits tight against the number
       * before it and a word cannot: "+{value}{!Icons.Mana}" is "+30 Magick",
       * not "+30Magick". The whitespace collapse at the end tidies up the
       * doubles this creates everywhere else.
       */
      .replace(/\{!Icons\.([A-Za-z0-9_]+)\}/g, (_match, key: string) => {
        const word = iconWord(key)
        return word ? ` ${word}` : ''
      })
      // A value the text names by path into the trait tables. Exact.
      // An unresolved path is a value we could not read. Leaving it to the
      // catch-all deleted it, which is how "Your foes deal +% damage" got out.
      .replace(/\{\$TraitData\.([^}]+)\}/g, (_match, path: string) => traitDataAt(path) ?? '#')
      /**
       * The trait's own numbers. `scripts/values.ts` is `ExtractValues` and
       * `FormatExtractedValue` followed to the letter, for the part of them
       * that is static.
       *
       * **These are base values**, before Luck and the other multipliers a run
       * carries, every one of which is 1 on a fresh hero. Anything needing a
       * table this project does not extract, or the state of a run in
       * progress, stays a `#` rather than becoming a guess.
       */
      .replace(/\{\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)\}/g, (_match, name: string) => values[name] ?? '#')
      .replace(/\{\$TooltipData\.[^}]*\}/g, '#')
      // A value only the run in progress has. There is no static answer, and
      // deleting it left "Your foes deal +% damage".
      .replace(/\{\$CurrentRun\.[^}]*\}/g, '#')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:%])/g, '$1')
      .trim()
  )
}

function iconFor(trait: Trait): string | null {
  const keys = trait.name && trait.requiredWeapon ? aspectIconKeys(trait.name, trait.requiredWeapon) : []
  const found = resolveIcon(trait.id, trait.name, icons, { keys })
  return found.found ? found.file : null
}

/**
 * The large art, for an aspect.
 *
 * `<weapon>-<aspect>-render` is the wiki's transparent cutout of the weapon in
 * that aspect's colours, which is a picture of the thing rather than a 90 pixel
 * icon of it. Only aspects have one.
 */
function renderFor(trait: Trait): string | null {
  if (!trait.name || !trait.requiredWeapon) return null
  const [key] = aspectIconKeys(trait.name, trait.requiredWeapon)
  if (!key) return null
  return icons.get(`${key}-render`)?.file ?? null
}

/**
 * The aspect a trait is locked to, when it is locked to one.
 *
 * **Four of the sixteen staff hammers cannot be offered on most aspects**, and
 * nothing in the resolved trait says so. Pharaoh Etchings and Scarab Etchings
 * want the lone shade; Soulfilled Ankh and Mirrored Ankh want Raise Dead. Every
 * arm has a pair or two like it. The editor was offering all sixteen whatever
 * aspect the build was on, which is a hammer a run can never hand you.
 *
 * The gate is in `GameStateRequirements`, which `traits.json` keeps and the
 * resolved index drops:
 *
 *     { Path: [ "GameState", "LastWeaponUpgradeName", "WeaponStaffSwing" ],
 *       IsAny: [ "StaffRaiseDeadAspect" ] }
 *
 * So it is read off the raw table rather than the resolved one, which is the
 * same split `CLAUDE.md` records for `TraitRequirements`: the resolved file is
 * for what a trait *is*, the raw one for what it *states*.
 */
const rawTraits = dictOf(read('traits').data)

function aspectGate(id: string): string[] | null {
  const rules = (rawTraits[id] as { GameStateRequirements?: unknown[] } | undefined)
    ?.GameStateRequirements
  if (!Array.isArray(rules)) return null

  for (const rule of rules) {
    const one = rule as { Path?: unknown[]; IsAny?: unknown[] }
    if (!Array.isArray(one.Path) || !Array.isArray(one.IsAny)) continue
    if (one.Path[0] === 'GameState' && one.Path[1] === 'LastWeaponUpgradeName') {
      return one.IsAny.map(String)
    }
  }
  return null
}

/**
 * The element a boon carries, and the element counts a boon is gated behind.
 *
 * ## Two different things, from two different places
 *
 * **What a boon *is*.** `AirBoon` in `TraitData.lua` sets `Elements = { "Air" }`
 * and 157 offerable traits inherit from one of the five, so the resolved index
 * carries `Elements` directly and this just reads it.
 *
 * **What a boon *needs*.** Ten traits gate on how many of an element you hold,
 * through a `GameStateRequirements` path of
 * `CurrentRun.Hero.Elements.<Element>`. Those live on the raw table, same as the
 * aspect gate, because the resolved index drops requirement blocks.
 *
 * ## Appear and activate are separate, and the game means it
 *
 * `GameStateRequirements` is what it takes for the boon to be **offered**.
 * `ActivationRequirements` is what it takes for it to **switch on** once held.
 * Frosty Veneer appears at 4 Water and does nothing until 6. A tool that
 * collapsed those into one number would be wrong for every boon that has both,
 * which is half of them.
 */
const ELEMENT_PATH = ['CurrentRun', 'Hero', 'Elements']

function elementGate(rules: unknown): Record<string, number> | null {
  if (!Array.isArray(rules)) return null
  const out: Record<string, number> = {}
  for (const rule of rules) {
    const one = rule as { Path?: unknown[]; Value?: unknown }
    const path = one.Path
    if (!Array.isArray(path) || path.length < 4) continue
    if (ELEMENT_PATH.some((part, index) => path[index] !== part)) continue
    if (typeof one.Value === 'number') out[String(path[3])] = one.Value
  }
  return Object.keys(out).length ? out : null
}

function elementsOf(id: string): string[] | null {
  const held = (externalTables.traits[id] as { Elements?: unknown } | undefined)?.Elements
  return Array.isArray(held) && held.length ? held.map(String) : null
}

function needsElements(id: string): { appear?: Record<string, number>; activate?: Record<string, number> } | null {
  const raw = rawTraits[id] as
    | { GameStateRequirements?: unknown; ActivationRequirements?: unknown }
    | undefined
  const appear = elementGate(raw?.GameStateRequirements)
  const activate = elementGate(raw?.ActivationRequirements)
  if (!appear && !activate) return null
  return { ...(appear ? { appear } : {}), ...(activate ? { activate } : {}) }
}

const records = [...traits.values()]
  // Templates with no display name are never rendered, and 84 of them would be
  // a third of the payload.
  .filter((trait) => trait.name !== null)
  .map((trait) => ({
    id: trait.id,
    name: trait.name ? tidy(trait.name) || trait.name : trait.name,
    kind: trait.kind,
    ...(trait.slot ? { slot: trait.slot } : {}),
    ...(trait.altSlot ? { altSlot: trait.altSlot } : {}),
    ...(godsFor(trait).length ? { gods: godsFor(trait) } : {}),
    ...(trait.requiredWeapon ? { weapon: trait.requiredWeapon } : {}),
    ...(trait.requires ? { requires: trait.requires } : {}),
    ...(aspectGate(trait.id) ? { needsAspect: aspectGate(trait.id) } : {}),
    ...(elementsOf(trait.id) ? { elements: elementsOf(trait.id) } : {}),
    ...(needsElements(trait.id) ? { needsElements: needsElements(trait.id) } : {}),
    ...(iconFor(trait) ? { icon: iconFor(trait) } : {}),
    ...(describe(trait.id) ? { text: describe(trait.id) } : {}),
    ...(renderFor(trait) ? { render: renderFor(trait) } : {}),
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
  /** which way this one turns up, when the room data says */
  path?: 'underworld' | 'surface'
  traits: string[]
}

const olympianList = olympiansFrom(loot)
const sources: Source[] = []

/**
 * A god's portrait: the max-affection gift art, falling back to the headshot.
 *
 * Three sets were tried for this and the order they were rejected in matters.
 *
 * The game's own `BoonSelectSymbols` glyphs went first: small glowing marks
 * meant to sit on an Exit at a distance, and at list size they are coloured
 * dots. `assets/symbols/` keeps them for wherever a small mark is right.
 *
 * The `gods/` headshots replaced them, and they are faces, which is what a
 * player recognises. But they are **cropped portraits**, so at 22 pixels in a
 * dropdown they reduce to a smear of skin and hair.
 *
 * **The gift portraits win.** `assets/gifts/` is the max-affection art, one per
 * character, and they are drawn small and whole: a full figure, a strong
 * silhouette and one dominant colour each. `assets/README.md` shelved them as
 * "a possible alternate to gods/, unused so far". This is that alternate.
 *
 * `hades` has no gift art of its own, only the Hades and Persephone pair, so
 * the fallback is not decoration: it is the one case that needs it.
 */
const portrait = (name: string): string | null => {
  const slug = name.toLowerCase()
  return icons.get(`${slug}-gift`)?.file ?? icons.get(slug)?.file ?? null
}

for (const [god, pool] of godPoolsFrom(loot)) {
  sources.push({
    id: god,
    name: god,
    kind: olympianList.includes(god) ? 'olympian' : 'other',
    icon: portrait(god),
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
    icon: portrait('chaos'),
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
  // Through the same resolver as every other character, or Selene is the one
  // face in the app still wearing the old headshot.
  icon: portrait('selene'),
  traits: named([...traits.values()].filter((trait) => trait.slot === 'Spell').map((trait) => trait.id)),
})

for (const [weapon, marker] of Object.entries(HAMMER_MARKERS)) {
  sources.push({
    id: `Hammer_${weapon}`,
    name: 'Daedalus Hammer',
    kind: 'hammer',
    icon: portrait('daedalus-hammer'),
    weapon,
    traits: named(Object.keys(resolved).filter((id) => ancestorsOf(id).has(marker))),
  })
}

/**
 * Where each Encounter god turns up, from the room data.
 *
 * `NPC_Artemis` appears only in `RoomDataF`, which is Erebus by its own
 * `ErebusExitDoor`. `NPC_Dionysus` only in `RoomDataP`, which is Ephyra.
 * `NPC_Hades` only in `RoomDataI`, which is Tartarus. Athena appears in no room
 * data at all, which matches her arriving through her keepsake rather than
 * through a Location, so she is left unfiltered.
 */
const ENCOUNTER_PATHS: Record<string, 'underworld' | 'surface'> = {
  NPC_Artemis: 'underworld',
  NPC_Hades: 'underworld',
  NPC_Dionysus: 'surface',
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
      icon: portrait(who),
      ...(ENCOUNTER_PATHS[setName] ? { path: ENCOUNTER_PATHS[setName] } : {}),
      traits: pool,
    })
  }
}

/**
 * The Arcana, for the build manager.
 *
 * `MetaUpgradeCardData` is 27 records and two of them are `DebugOnly`
 * scaffolding, so 25 real cards. `CLAUDE.md` records that the art maps by
 * `Image = "CardArt_NN"` with a source comment naming each card; the library
 * is filed under the card's display name instead, which joins for 23 of 25
 * directly. `The Enchantress` and `The Fates` kept their article in the
 * filename, so both shapes are tried.
 */
/** An Arcana's own art, and never another category's. */
const arcanaIcon = (key: string): string | null => {
  const found = icons.get(key)?.file
  return found && found.startsWith('arcana/') ? found : null
}

const arcanaCards = Object.entries(dictOf(read('arcana-cards').data))
  .filter(([, record]) => {
    const card = dictOf(record)
    return !card.DebugOnly && typeof card.Image === 'string'
  })
  .map(([id, record]) => {
    const card = dictOf(record)
    const raw = dictOf(text[id]).name
    const name = typeof raw === 'string' ? raw : ''
    const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''
    const bare = slug.replace(/^the-/, '')
    return {
      id,
      name,
      text: describe(id),
      cost: typeof card.Cost === 'number' ? card.Cost : null,
      /**
       * **The lite copy first, the original as the fallback.**
       *
       * `scripts/lite.ts` writes a 420px webp beside each card because the
       * board was serving 689px art into a 94px slot: 39.2 MB for one screen,
       * which was 61 percent of the whole site. The full-size art stays on
       * disk for the quality setting that is coming, and `prune.ts` leaves it
       * out of `dist/` meanwhile because nothing names it.
       *
       * Falling back rather than requiring it means a card whose lite copy has
       * not been generated still renders, just heavily.
       *
       * Kept inside `arcana/`, and the full slug tried before the bare one.
       *
       * Most cards are filed without their article, so "The Boatman" needs the
       * bare `boatman`. **Two are not**, and one of those collided: "The Fates"
       * is `arcana/the-fates.png`, and the bare `fates` matched
       * `characters/fates.webp` instead, so the card rendered as the
       * characters' portrait. Full slug first fixes the order, and restricting
       * the search to this category removes the whole class of collision:
       * `assets/README.md` already warns that a slug can be claimed twice and
       * that directory order silently decides which wins.
       */
      icon: arcanaIcon(`${slug}-lite`) ?? arcanaIcon(`${bare}-lite`) ?? arcanaIcon(slug) ?? arcanaIcon(bare) ?? null,
      /**
       * The game's own dimmed twin, for a card that is not equipped.
       *
       * `cardNN_inactive.png` beside `cardNN.png`. Better than desaturating the
       * lit one in CSS, because the game did not desaturate: the inactive art
       * is redrawn, and a filter approximating it looks like a filter.
       */
      iconOff:
        arcanaIcon(`${slug}-inactive-lite`) ??
        arcanaIcon(`${bare}-inactive-lite`) ??
        arcanaIcon(`${slug}-inactive`) ??
        arcanaIcon(`${bare}-inactive`) ??
        null,
      /**
       * What has to be true for a conditional card to switch itself on.
       *
       * Six of the twenty-five cost nothing and carry an `AutoEquipRequirements`
       * block instead. It is passed through whole rather than interpreted here:
       * `engine/arcana.ts` evaluates it, and putting the rules in two places is
       * how they drift apart.
       */
      requires: dictOf(card.AutoEquipRequirements ?? {}),
    }
  })
  .filter((card) => card.name)
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

/**
 * The five familiars.
 *
 * `FamiliarOrderData` in `FamiliarData.lua` lists them and `HelpText` names
 * them, so nothing new needed extracting. The art is one image each in
 * `assets/familiars/`, beside their skins and their stat icons.
 */
/**
 * The Arcana board, five by five.
 *
 * `MetaUpgradeDefaultCardLayout`. The same twenty-five cards in the same
 * positions for every player: the layout is copied into game state at the
 * start of a save and the code path that would let a player rearrange it is
 * gated behind `LockedRequirement`.
 *
 * **Position is load-bearing.** Three of the six conditional cards read it:
 * The Fates needs every neighbour equipped, The Moon needs one, and Divinity
 * needs a complete row or column other than its own.
 */
const arcanaBoard = (read('arcana-layout').data as unknown as string[][]).map((row) => [...row])

/**
 * The five familiars, and the third column is not guessable.
 *
 * **What each one does is filed under its ability, not under its id.**
 * `HelpText[CatFamiliar]` is `{ name: 'Toula' }` and nothing else, which made
 * this look like data the game does not ship. It does: `TraitText` holds the
 * descriptions under `LastStandFamiliar`, `HealthFamiliar`, `CritFamiliar`,
 * `DigFamiliar` and `DodgeFamiliar`, and the join is by the name they resolve
 * to rather than by anything about the id.
 *
 * Same shape as the vow names, which are also in `TraitText` rather than
 * `HelpText`. Reading the obvious table twice now and finding nothing twice is
 * enough to make the rule: when a name is missing, look for it under what the
 * thing does before concluding it is not written down.
 *
 * `says` goes through `describe`, so `{$Keywords.Sprint}` and
 * `{$TooltipData.ExtractData.FamiliarDamage}` resolve exactly as they do for a
 * boon rather than reaching a reader as markup.
 */
const FAMILIARS = [
  { id: 'CatFamiliar', slug: 'cat', says: 'LastStandFamiliar' },
  { id: 'FrogFamiliar', slug: 'frog', says: 'HealthFamiliar' },
  { id: 'RavenFamiliar', slug: 'raven', says: 'CritFamiliar' },
  { id: 'HoundFamiliar', slug: 'hound', says: 'DigFamiliar' },
  { id: 'PolecatFamiliar', slug: 'polecat', says: 'DodgeFamiliar' },
]

const familiars = FAMILIARS.map((familiar) => ({
  id: familiar.id,
  name: (() => { const n = dictOf(help[familiar.id]).name; return typeof n === 'string' && n ? n : familiar.id })(),
  icon: icons.get(`familiars-${familiar.slug}-01`)?.file ?? null,
  text: describe(familiar.says),
}))

/**
 * The Oath of the Unseen: the 17 vows, in the order the shrine draws them.
 *
 * **The order comes from `ShrineUpgradeOrder` in `ShrineData.lua`**, not from
 * whatever order `MetaUpgradeData` happens to iterate in, because that list is
 * also what `GetMaxShrinePoints` walks. Anything in `MetaUpgradeData` and not
 * in the order list is not a vow: `BaseMetaUpgrade` is the template, and it is
 * the one record of the eighteen with no `Ranks`.
 *
 * `Points` is **incremental, not cumulative**, and that is the thing to get
 * right. `ShrineLogic.GetTotalSpentShrinePoints` sums `Ranks[1..activeRank]`,
 * so a vow at rank 3 costs the sum of its first three ranks rather than the
 * third one's number. Reading the last rank as the vow's Fear would have been
 * the same error as reading `GodLoot` without following `InheritFrom`.
 */
const SHRINE_ORDER = [
  'EnemyDamageShrineUpgrade',
  'EnemyHealthShrineUpgrade',
  'EnemyShieldShrineUpgrade',
  'EnemySpeedShrineUpgrade',
  'EnemyCountShrineUpgrade',
  'NextBiomeEnemyShrineUpgrade',
  'EnemyRespawnShrineUpgrade',
  'EnemyEliteShrineUpgrade',
  'HealingReductionShrineUpgrade',
  'ShopPricesShrineUpgrade',
  'MinibossCountShrineUpgrade',
  'BoonSkipShrineUpgrade',
  'BiomeSpeedShrineUpgrade',
  'LimitGraspShrineUpgrade',
  'BoonManaReserveShrineUpgrade',
  'BanUnpickedBoonsShrineUpgrade',
  'BossDifficultyShrineUpgrade',
] as const

const metaUpgrades = dictOf(read('meta-upgrades').data)

const vows = SHRINE_ORDER.map((id) => {
  const record = dictOf(metaUpgrades[id])
  const ranks = Array.isArray(record.Ranks) ? record.Ranks.map((r) => dictOf(r)) : []
  /**
   * The name is in `TraitText`, not `HelpText`, which is where every other
   * screen name here comes from. Worth stating: reading the wrong table gave
   * seventeen vows called `EnemyDamageShrineUpgrade` and it looked like the
   * name was simply missing rather than somewhere else.
   */
  const name = (() => {
    const found = dictOf(text[id]).name
    return typeof found === 'string' && found ? found : id
  })()

  /**
   * The art is filed under the vow's *name*, not its id.
   *
   * `assets/vows/` holds `pain.png`, `rivals.png` and so on, which is the last
   * word of "Vow of Pain". Nothing about `EnemyDamageShrineUpgrade` would ever
   * have found it, and an id-shaped slug quietly resolved to null for all
   * seventeen.
   */
  const slug = name.replace(/^Vow of /, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  /**
   * Scoped to `vows/`, the way `arcanaIcon` is scoped to `arcana/`.
   *
   * **Unscoped, Vow of Fangs resolved to `hammers/fangs.webp`**, a Daedalus
   * Hammer icon, because the bare slug is claimed by two categories and the
   * first by path wins. The validator has warned about 21 such collisions for a
   * while; this is the first time one of them silently produced a wrong picture
   * rather than an ambiguous one.
   *
   * It resolves 5 of 17 and that is the honest number. `assets/vows/` holds 19
   * files under names like blood, forsaking and haunting, and the game's vows
   * are Pain, Grit, Wards and so on: the two sets overlap on five. Whatever
   * those nineteen are, most of them are not these. Forcing a join would have
   * put confident wrong art on sixteen rows.
   *
   * **It resolved four, not five, and Vow of Fangs was the one it lost.**
   * `buildIconIndex` keys by slug and the first entry wins, so `icons.get`
   * hands back `hammers/fangs.webp` and the guard above correctly refuses it.
   * The right file, `assets/vows/fangs.png`, is in the manifest right behind it
   * and the index has no way to ask for it. So this reads the manifest rather
   * than the index: same slug, but the entry filed under `vows/`.
   *
   * The same shape as everything else in `CLAUDE.md`'s list. A guard against
   * confidently wrong art is not a guard that finds the right art, and the
   * comment claiming five was written from the overlap rather than from a run.
   */
  const vowIcon = (key: string): string | null => {
    const found = (manifest.assets ?? []).find(
      (entry: { id?: string; file?: string }) =>
        entry?.id === key && typeof entry.file === 'string' && entry.file.startsWith('vows/'),
    )
    return found?.file ?? null
  }
  return {
    id,
    name,
    icon: vowIcon(`vows-${slug}`) ?? vowIcon(slug),
    /**
     * What each rank costs, in order. The vow's own maximum is the sum.
     *
     * `locked` marks a rank `GetMaxShrinePoints` will not count until the save
     * has earned it. All four of them are Boss Difficulty, and they are the
     * whole difference between a new save's ceiling and a finished one's.
     */
    ranks: ranks.map((rank) => ({
      points: typeof rank.Points === 'number' ? rank.Points : 0,
      ...(rank.GameStateRequirements ? { locked: true } : {}),
    })),
  }
})

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
    arm: weapon.arm,
    // The base aspect's cutout: the weapon itself, transparent, in Melinoe's
    // own colours. The Codex card is the same weapon on parchment, which is a
    // picture of a card rather than a picture of a weapon.
    icon: icons.get(`${weapon.slug}-melinoe-render`)?.file ?? icons.get(weapon.slug)?.file ?? null,
    card: icons.get(weapon.slug)?.file ?? null,
  })),
  pools,
  sources,
  arcana: arcanaCards,
  arcanaBoard,
  familiars,
  vows,
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
console.log(
  `  ${arcanaBoard.length}x${arcanaBoard[0]?.length ?? 0} Arcana board, ` +
    `${arcanaCards.filter((c) => Object.keys(c.requires).length).length} cards switch themselves on`,
)
{
  const ranks = vows.reduce((n, vow) => n + vow.ranks.length, 0)
  const all = vows.reduce((n, vow) => n + vow.ranks.reduce((m, r) => m + r.points, 0), 0)
  const open = vows.reduce(
    (n, vow) => n + vow.ranks.filter((r) => !r.locked).reduce((m, r) => m + r.points, 0),
    0,
  )
  console.log(
    `  ${vows.length} vows over ${ranks} ranks, Fear ${open} on a new save and ${all} once every rank is unlocked`,
  )
}
console.log(
  `  ${arcanaCards.length} Arcana (${arcanaCards.filter((c) => c.icon).length} with art), ` +
    `${familiars.length} familiars (${familiars.filter((f) => f.icon).length} with art)`,
)
const byKind = sources.reduce<Record<string, number>>((tally, source) => {
  tally[source.kind] = (tally[source.kind] ?? 0) + 1
  return tally
}, {})
console.log(`  ${sources.length} reward sources: ${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ')}`)
if (!existsSync(join(ROOT, 'assets/manifest.json'))) console.log('  no asset manifest, so no icons')
