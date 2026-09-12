// Enodia data extractor.
//
// Runs the game's own Lua data files in a sandboxed Lua state and serialises the
// resulting tables to JSON. It does NOT parse the Lua as text: those files are
// executable table declarations and regex-parsing them is a trap.
//
// Output lands in data/generated/ and is never hand edited. See DESIGN.md 2.1.

import { LuaFactory } from 'wasmoon'
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

import { parseSjson } from './sjson.ts'

const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Hades II/Content'
const SCRIPTS = join(GAME, 'Scripts')
const OUT = resolve('data/generated')

// ---------------------------------------------------------------------------
// Stubs. The data files call exactly five helpers at load time and read a few
// namespaces. The helper bodies are copied from the game's own UtilityLogic.lua
// and Main.lua so behaviour matches rather than approximates.
// ---------------------------------------------------------------------------

const PRELUDE = `
function OverwriteTableKeys( tableToOverwrite, tableToTake )
  if tableToTake == nil then return end
  for key, value in pairs( tableToTake ) do
    if value == "nil" then tableToOverwrite[key] = nil
    else tableToOverwrite[key] = value end
  end
end

function ConcatTableValues( baseTable, tableToAdd )
  if tableToAdd == nil then return baseTable end
  for key, value in pairs( tableToAdd ) do table.insert( baseTable, value ) end
  return baseTable
end

function ShallowCopyTable( t )
  if t == nil then return end
  local copy = {}
  for k, v in pairs( t ) do copy[k] = v end
  return copy
end

function CombineTables( table1, table2 )
  if table1 == nil or table2 == nil then return end
  local returnTable = ShallowCopyTable( table1 )
  for k, v in pairs( table2 ) do table.insert( returnTable, v ) end
  return returnTable
end

function ToLookup( t )
  if t == nil then return nil end
  local lookup = {}
  for key, value in pairs( t ) do lookup[value] = true end
  return lookup
end

-- Inheritance. Bodies copied from the game: DeepCopyTable and
-- ConcatTableValuesIPairs from UtilityLogic.lua, ProcessDataInheritance and
-- DeepInheritData from RunData.lua around line 1363. Only 49 of 651 traits
-- state a Slot; the rest inherit one, so nothing downstream can ask what slot
-- a boon occupies until this has run.
function DeepCopyTable( orig )
  local orig_type = type(orig)
  local copy
  if orig_type == 'table' then
    copy = {}
    for k,v in next, orig, nil do copy[k] = DeepCopyTable(v) end
  else
    copy = orig
  end
  return copy
end

function ConcatTableValuesIPairs( baseTable, tableToAdd )
  if tableToAdd == nil then return baseTable end
  for key, value in ipairs( tableToAdd ) do table.insert( baseTable, value ) end
  return baseTable
end

-- RunData.lua:1323. One key, and it is why DebugOnly does not spread from a
-- base template to every boon that inherits it.
local inheritanceIgnores = { "DebugOnly" }

function DeepInheritData( data, parentData )
  for parentKey, parentValue in pairs( parentData ) do
    local value = data[parentKey]
    if data.NilValues ~= nil and data.NilValues[parentKey] then
      data[parentKey] = nil
    elseif value == "nil" then
      data[parentKey] = nil
      data.NilValues = data.NilValues or {}
      data.NilValues[parentKey] = true
    elseif value == nil then
      if type(parentValue) == "table" then
        data[parentKey] = DeepCopyTable( parentValue )
      else
        data[parentKey] = parentValue
      end
    elseif type(parentValue) == "table" and parentValue.DeepInheritance then
      DeepInheritData( data[parentKey], parentValue )
    elseif type(value) == "table" and ( value.Append or value.Prepend ) then
      local parentTable = DeepCopyTable( parentValue )
      if value.Append then
        ConcatTableValuesIPairs( parentTable, value )
        data[parentKey] = parentTable
      else
        ConcatTableValuesIPairs( value, parentTable )
      end
    end
  end
end

function ProcessDataInheritance( data, dataStore )
  if data.InheritFrom == nil then return end
  local originalValues = {}
  for k, ignoreKey in pairs( inheritanceIgnores ) do
    originalValues[ignoreKey] = data[ignoreKey]
  end
  for k, inheritFromName in ipairs( data.InheritFrom ) do
    local parentData = dataStore[inheritFromName]
    if parentData ~= nil then
      ProcessDataInheritance( parentData, dataStore )
      DeepInheritData( data, parentData )
    end
  end
  for k, ignoreKey in pairs( inheritanceIgnores ) do
    data[ignoreKey] = originalValues[ignoreKey]
  end
end

-- ProcessDataStore, minus ProcessSimpleExtractValues. That second pass turns
-- ExtractValues into tooltip numbers, which is presentation and needs the live
-- projectile and effect data. Nothing here reads it.
function __resolveStore( store )
  for name, data in pairs( store ) do
    data.Name = name
    ProcessDataInheritance( data, store )
  end
end

-- Namespaces the trait data reads but that live outside these files.
-- Auto-vivifying so a deep read like GameData.Foo.Bar yields a table, not a nil error.
__autoreads = {}
local function autotable( path )
  return setmetatable( {}, {
    __index = function( t, k )
      __autoreads[ path .. "." .. tostring(k) ] = true
      local v = autotable( path .. "." .. tostring(k) )
      rawset( t, k, v )
      return v
    end
  })
end

GameData      = autotable( "GameData" )
ObstacleData  = autotable( "ObstacleData" )
ProjectileData= autotable( "ProjectileData" )
EnemyData     = autotable( "EnemyData" )
EncounterData = autotable( "EncounterData" )
RoomData      = autotable( "RoomData" )
ScreenData    = autotable( "ScreenData" )
UnitSetData   = autotable( "UnitSetData" )
EffectData    = autotable( "EffectData" )
EnemySets     = autotable( "EnemySets" )
Color         = autotable( "Color" )
AudioState    = autotable( "AudioState" )
QuestData     = autotable( "QuestData" )
CosmeticsData = autotable( "CosmeticsData" )
PresetEventArgs = autotable( "PresetEventArgs" )
HeroVoiceLines  = autotable( "HeroVoiceLines" )
GlobalVoiceLines= autotable( "GlobalVoiceLines" )
UIData          = autotable( "UIData" )

-- Screen geometry. UpgradeChoiceData lays its boon cards out with arithmetic on
-- these. The values are irrelevant to anything extracted, only that they are
-- numbers rather than nil.
ScreenWidth = 1920
ScreenHeight = 1080
ScreenCenterX = 960
ScreenCenterY = 540

-- Namespaces the data files populate themselves.
TraitData     = TraitData or {}
TraitSetData  = TraitSetData or {}
LootSetData   = LootSetData or {}

-- TraitData.lua reads LootData.TrialUpgrade.PermanentTraits, which the engine
-- assembles from LootSetData at runtime. buildLootData() below fills it in
-- between the loot files and the trait files.
LootData      = LootData or {}

function __buildLootData()
  for setName, set in pairs( LootSetData ) do
    if type(set) == "table" then
      for key, value in pairs( set ) do
        LootData[key] = value
      end
    end
  end
end
`

// Load order matters: WeaponSets is read by the trait data, TraitData.lua defines
// the tables the per-god files overwrite into.
function loadOrder() {
  const all = readdirSync(SCRIPTS)
  const pick = (re) => all.filter((f) => re.test(f)).sort()
  // Loot before traits: TraitData.lua reads LootData.TrialUpgrade.
  // ColorData / EffectData / EnemySets are real files, not stubs: the trait data
  // does arithmetic on EffectData values, so a stub would silently produce zeros.
  return [
    'WeaponSets.lua',
    'ColorData.lua',
    'EffectData.lua',
    'EnemySets.lua',
    /**
     * `WeaponData`, because a boon's own description reads numbers out of it.
     *
     * `{$TooltipData.ExtractData.X}` with an `External` entry names a table
     * and a property on it. `EffectData` was already loaded and simply never
     * emitted; this adds the other one that answers.
     *
     * **`ProjectileData` was tried and does not answer.** Its three hero files
     * load cleanly and give 134 entries, and **not one of them declares
     * `Damage` or `Fuse`**, which is what the `ProjectileBase` entries ask
     * for. `ProjectileData_Gods.lua` only carries overrides, mostly colours.
     *
     * That much was right, and the conclusion drawn from it was not. This
     * comment used to end "no amount of loading will find them". The numbers
     * are not in Scripts, and they are in `Game/Projectiles/`, as sjson, which
     * is where `GetBaseDataValue({ Type = "Projectile" })` reads them. See
     * the projectile pass below.
     */
    'WeaponData.lua',
    'LootData.lua',
    ...pick(/^LootData_.*\.lua$/),
    '@buildLootData',
    'HeroData.lua',
    'TraitData.lua',
    ...pick(/^TraitData_.*\.lua$/),
    'MetaUpgradeData.lua',
    // Assigns ScreenData.UpgradeChoice, which is where MaxChoices lives.
    'UpgradeChoiceData.lua',
    // Artemis, Athena, Dionysus and Hades hand out boons but have no LootData
    // entry, because they arrive through Encounters rather than Exits. Their
    // pools live in UnitSetData, carrying TreatAsGodLootByShops.
    ...pick(/^NPCData_(Artemis|Athena|Dionysus|Hades)\.lua$/),
  ]
}

// ---------------------------------------------------------------------------
// Lua table -> plain JS. Guards against the shared-reference cycles that appear
// when TraitRequirements points at LinkedTraitData sets.
// ---------------------------------------------------------------------------

function toPlain(value, seen = new Set(), depth = 0) {
  if (depth > 40) return null
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return null
  seen.add(value)

  const entries = Object.entries(value)
  // A Lua array arrives as { '1': x, '2': y }. Detect and flatten.
  const isArray = entries.length > 0 && entries.every(([k]) => /^\d+$/.test(k))
  let out
  if (isArray) {
    out = entries
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, v]) => toPlain(v, seen, depth + 1))
  } else {
    // Sort keys. Lua's pairs() is unordered, so without this every run
    // reshuffles the output and produces a six-figure diff that buries any
    // real change a game patch made. Arrays keep their index order above.
    out = {}
    for (const [k, v] of entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
      const p = toPlain(v, seen, depth + 1)
      if (p !== undefined) out[k] = p
    }
  }
  seen.delete(value)
  return out
}

// ---------------------------------------------------------------------------

const lua = await new LuaFactory().createEngine()

await lua.doString(PRELUDE)

const loaded = []
const failed = []
for (const file of loadOrder()) {
  if (file === '@buildLootData') {
    await lua.doString('__buildLootData()')
    loaded.push('(built LootData from LootSetData)')
    continue
  }
  const path = join(SCRIPTS, file)
  let src
  try {
    src = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  } catch {
    failed.push([file, 'not found'])
    continue
  }
  try {
    await lua.doString(src)
    loaded.push(file)
  } catch (err) {
    failed.push([file, String(err.message ?? err).split('\n')[0]])
  }
}

const grab = (name) => toPlain(lua.global.get(name))

// Raw first, then resolved. traits.json stays the game's declaration, which is
// what TraitRequirements and LinkedTraitData are written against, and
// traits-resolved.json is what the game actually runs on once every InheritFrom
// has been followed.
const rawTraits = grab('TraitData')
await lua.doString('__resolveStore(TraitData)')
const resolvedTraits = grab('TraitData')

const gameVersion = (() => {
  try {
    return readFileSync(join(GAME, 'packagever'), 'utf8').trim().slice(0, 60)
  } catch {
    return 'unknown'
  }
})()

const provenance = {
  extractedOn: new Date().toISOString().slice(0, 10),
  gameVersion,
  source: 'Content/Scripts/*.lua',
  generatedBy: 'scripts/extract.mjs',
  warning: 'Generated. Never hand edit. Re-run npm run extract after a game patch.',
}

// Every generated file carries a sha256 of its own data payload. The validator
// recomputes it and rejects a file whose payload was hand edited, which is the
// one thing DESIGN.md 2.1 says must never happen to this directory. The hash
// covers `data` only, since it cannot cover the block it sits in.
function writeGenerated(fileName, extraProvenance, data) {
  const payload = JSON.stringify(data)
  const sha256 = createHash('sha256').update(payload).digest('hex')
  writeFileSync(
    join(OUT, `${fileName}.json`),
    JSON.stringify({ _provenance: { ...provenance, ...extraProvenance, sha256 }, data }, null, 1)
  )
}

const tables = {
  traits: 'TraitData',
  requirements: 'TraitRequirements',
  'linked-trait-sets': 'LinkedTraitData',
  'trait-sets': 'TraitSetData',
  loot: 'LootSetData',
  'weapon-sets': 'WeaponSets',
  hero: 'HeroData',
  'arcana-cards': 'MetaUpgradeCardData',
  'arcana-layout': 'MetaUpgradeDefaultCardLayout',
  /**
   * The Oath of the Unseen: every vow, and the ranks each one sells.
   *
   * `MetaUpgradeData.lua` was already loaded for the Arcana and this table sat
   * in the same file unwritten, which is why `MAX_FEAR = 57` was a constant
   * with a comment instead of a number with a source. Every rank states its own
   * `Points`, so the total is a sum rather than a claim.
   *
   * It holds more than the vows: the Arcana cards' own MetaUpgrade records are
   * in here too. `scripts/build-app-data.ts` is where they are told apart, on
   * `Ranks`, because a vow is the thing you can buy ranks of.
   */
  'meta-upgrades': 'MetaUpgradeData',
  'trait-rarity': 'TraitRarityData',
  'trait-elements': 'TraitElementData',
  'unit-sets': 'UnitSetData',
  // What can sit behind an Exit, per region. Not just gods: hammers, Selene,
  // Hermes, health and Magick drops, and the Encounter gods all live here.
  'reward-stores': 'RewardStoreData',
  // Already loaded for real rather than stubbed, because the trait data does
  // arithmetic on it. It was never emitted, and a trait's own description asks
  // it for numbers: `{$TooltipData.ExtractData.X}` with an `External` entry of
  // BaseType EffectData or EffectLuaData reads a duration or a stack count out
  // of here. See scripts/values.ts.
  effects: 'EffectData',
  weapons: 'WeaponData',
}

mkdirSync(OUT, { recursive: true })

const summary = []
for (const [fileName, luaName] of Object.entries(tables)) {
  const data = fileName === 'traits' ? rawTraits : grab(luaName)
  const count = data && typeof data === 'object' ? Object.keys(data).length : 0
  writeGenerated(fileName, { luaTable: luaName }, data)
  summary.push([fileName, luaName, count])
}

writeGenerated(
  'traits-resolved',
  {
    luaTable: 'TraitData',
    luaSource: 'ProcessDataInheritance and DeepInheritData, RunData.lua',
    note:
      'Every InheritFrom followed, the way the game does it at load. Use this to ask what a trait is. Use traits.json to see what the file actually declares.',
  },
  resolvedTraits
)

// ---------------------------------------------------------------------------
// The constants the engines run on, pulled out so they are sourced rather than
// typed into a TypeScript file from memory. Small, and worth watching: a patch
// that moves ReplaceChance or MaxChoices changes what the tool tells a player.
// ---------------------------------------------------------------------------

await lua.doString(`
__offerRules = {
  maxChoices = ScreenData.UpgradeChoice.MaxChoices,
  maxGodsPerRun = HeroData.MaxGodsPerRun,
  replaceChance = HeroData.BoonData.ReplaceChance,
  replaceUnlockedAfterRuns = HeroData.BoonData.GameStateRequirements[1].Value,
  rarityUpgradeOrder = TraitRarityData.RarityUpgradeOrder,
  rarityValues = TraitRarityData.RarityValues,
  boonRarityRollOrder = TraitRarityData.BoonRarityRollOrder,
  rarityChances = HeroData.BoonData.RarityChances,
}
`)

writeGenerated(
  'offer-rules',
  {
    luaSource:
      'ScreenData.UpgradeChoice.MaxChoices, HeroData.MaxGodsPerRun, HeroData.BoonData, TraitRarityData',
    note:
      'The numbers the offer and the slot lockout turn on. GetPriorityTraits blocks a core boon whose slot is filled, GetReplacementTraits can still swap into it at replaceChance, and rarityUpgradeOrder ends at Heroic, which is where a slot locks for good.',
  },
  grab('__offerRules')
)

// ---------------------------------------------------------------------------
// Display text. Lives in sjson, not Lua, so it gets its own pass.
// The format is regular: flat { Id = "..." DisplayName = "..." Description = "..." }
// blocks inside a Texts array. Parsed by walking Id to Id rather than by trying
// to be a general sjson parser.
// ---------------------------------------------------------------------------

function readText(file) {
  let src
  try {
    src = readFileSync(join(GAME, 'Game/Text/en', file), 'utf8').replace(/^﻿/, '')
  } catch {
    return null
  }
  const out = {}
  const ids = [...src.matchAll(/\bId\s*=\s*"([^"]+)"/g)]
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i][1]
    const block = src.slice(ids[i].index, ids[i + 1]?.index ?? src.length)
    const name = block.match(/\bDisplayName\s*=\s*"((?:[^"\\]|\\.)*)"/)
    const desc = block.match(/\bDescription\s*=\s*"((?:[^"\\]|\\.)*)"/)
    if (!name && !desc) continue
    const rec = {}
    if (name) rec.name = name[1].replace(/\\"/g, '"')
    if (desc) rec.description = desc[1].replace(/\\"/g, '"')
    out[id] = rec
  }
  return out
}

const textFiles = {
  'text-traits': 'TraitText.en.sjson',
  'text-help': 'HelpText.en.sjson',
  'text-screens': 'ScreenText.en.sjson',
}

const textSummary = []
for (const [fileName, sjson] of Object.entries(textFiles)) {
  const data = readText(sjson)
  if (!data) {
    textSummary.push([fileName, sjson, 0])
    continue
  }
  writeGenerated(fileName, { source: `Game/Text/en/${sjson}` }, data)
  textSummary.push([fileName, sjson, Object.keys(data).length])
}

// ---------------------------------------------------------------------------
// GUI animations, for the one join that cannot be made without them.
//
// A vow's record says `Icon = "ShrineIcon_EnemyDamage"`. That is an animation
// name, not a file, and nothing in Scripts defines it: the animations live in
// `Game/Animations/*.sjson`, where the entry names the sprite it draws.
//
//     Name = "ShrineIcon_EnemyDamage" //Blood
//     InheritFrom = "BaseShrineIcon"
//     FilePath = "GUI\Screens\ShrineIcons\VowBlood"
//
// **This is why sixteen of the seventeen vows looked like they had no art.**
// `assets/vows/` holds nineteen files under names like blood, dominance and
// aegis, and the join was being tried on the vow's display name, so Vow of Pain
// went looking for `pain.png` and found nothing. The files were right all along
// and the key was wrong: they are named after the sprite, and the sprite name is
// one indirection away in a file nothing here had read.
//
// Only the ShrineIcon entries are written. The file holds every GUI screen
// animation and none of the rest is joined to anything.
// ---------------------------------------------------------------------------

function readShrineIcons() {
  let src
  try {
    src = readFileSync(join(GAME, 'Game/Animations/GUI_Screens_VFX.sjson'), 'utf8').replace(/^\ufeff/, '')
  } catch {
    return null
  }
  const out = {}
  // Name to the next Name, the same walk `readText` does for Id blocks, so a
  // FilePath is always read out of the entry that declared it.
  const names = [...src.matchAll(/\bName\s*=\s*"(ShrineIcon_[A-Za-z]+)"/g)]
  for (let i = 0; i < names.length; i++) {
    const block = src.slice(names[i].index, names[i + 1]?.index ?? src.length)
    const path = block.match(/\bFilePath\s*=\s*"([^"]+)"/)
    if (path) out[names[i][1]] = path[1].split('\\').pop()
  }
  return out
}

const shrineIcons = readShrineIcons()
if (shrineIcons) {
  writeGenerated('shrine-icons', { source: 'Game/Animations/GUI_Screens_VFX.sjson' }, shrineIcons)
}
console.log(`  shrine icons: ${shrineIcons ? Object.keys(shrineIcons).length : 0} animations resolve to a sprite`)

// ---------------------------------------------------------------------------
// Which keepsake comes from which god.
//
// Nine of them guarantee the next boon is from one god, and a build that needs
// Zeus can therefore be told which keepsake makes Zeus likely. Nothing in the
// trait record says so: `ForceZeusBoonKeepsake` carries no god field, and its
// `gods` array is empty.
//
// **The link is in `GiftData`, not in the name.** Each god has a `<God>Upgrade`
// block holding what they give you as their relationship deepens, and the first
// gift is the keepsake:
//
//     ZeusUpgrade =
//     {
//       [1] = { GameStateRequirements = { ... }, Gift = "ForceZeusBoonKeepsake" }
//     }
//
// Reading the id and stripping `Force` and `BoonKeepsake` would produce the same
// nine pairs today and would be a naming assumption, which is the mistake this
// project has made three times in three file formats. `ItemOrder` further down
// the same file agrees, in a source comment naming the giver of every keepsake.
// ---------------------------------------------------------------------------

function readKeepsakeGods() {
  let src
  try {
    src = readFileSync(join(GAME, 'Scripts/KeepsakeData.lua'), 'utf8').replace(/^﻿/, '')
  } catch {
    return null
  }
  const out = {}
  // One block to the next, the same walk the shrine icons use, so a Gift is
  // always read out of the block that declared it.
  const blocks = [...src.matchAll(/^	(\w+)Upgrade\s*=/gm)]

  for (let i = 0; i < blocks.length; i++) {
    const body = src.slice(blocks[i].index, blocks[i + 1]?.index ?? src.length)
    const gifts = [...body.matchAll(/\bGift\s*=\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1])
    // Exactly one, or the block is not the simple "their keepsake" shape this
    // join assumes and is left out rather than guessed at.
    if (gifts.length === 1) out[blocks[i][1]] = gifts[0]
  }
  return out
}

const keepsakeGods = readKeepsakeGods()
if (keepsakeGods) {
  writeGenerated('keepsake-gods', { source: 'Scripts/KeepsakeData.lua' }, keepsakeGods)
}
console.log(`  keepsake gods: ${keepsakeGods ? Object.keys(keepsakeGods).length : 0} gods give a keepsake`)

// ---------------------------------------------------------------------------
// Projectile base values, for the numbers a boon's stat line multiplies.
//
// Heaven Strike's stat line is `MultiplyByBase` over the projectile
// `ZeusEchoStrike`. `FormatExtractedValue` multiplies the trait's own number by
// `GetBaseDataValue({ Type = "Projectile" ... })` (TraitLogic.lua:2200), and an
// `External` entry with `BaseType = "ProjectileBase"` makes the same engine call
// directly (TraitLogic.lua:2063).
//
// This project concluded for weeks that the engine call was out of reach,
// because `ProjectileData` in Scripts declares no `Damage` anywhere. That is
// true. **The engine's projectile data is in `Game/Projectiles/`, as text:**
//
//     Name = "ZeusEchoStrike"
//     InheritFrom = "ZeusLightningStrikeBase"
//     Damage = 100
//
// It is the vow icons again: a negative result from a search proves something
// about the search.
//
// A record nests `Effects` and `Thing` tables whose entries carry a `Name` of
// their own, so this is parsed (`scripts/sjson.ts`) rather than walked from one
// `Name` to the next. And `InheritFrom` is followed to the base, which is
// CLAUDE.md error 8 in a third format: a record that does not state a property
// takes it from its parent. A value that came from a parent says which one, so
// the file can be checked against the game's.
//
// Only what some trait asks for is written: the projectiles named by a
// `ProjectileBase` or `Projectile` extract entry, and the properties those
// entries read. The full set would be most of a megabyte of committed file for
// numbers nothing reads.
// ---------------------------------------------------------------------------

function projectileQuestions(traits) {
  const names = new Set()
  const props = new Set()
  for (const trait of Object.values(traits ?? {})) {
    const list = Array.isArray(trait?.ExtractValues) ? trait.ExtractValues : []
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue
      if (entry.BaseType !== 'ProjectileBase' && entry.BaseType !== 'Projectile') continue
      if (typeof entry.BaseName === 'string') names.add(entry.BaseName)
      if (typeof entry.BaseProperty === 'string') props.add(entry.BaseProperty)
      if (typeof entry.BaseFuseProperty === 'string') props.add(entry.BaseFuseProperty)
    }
  }
  return { names, props }
}

function readProjectiles({ names, props }) {
  const dir = join(GAME, 'Game/Projectiles')
  let files
  try {
    files = readdirSync(dir).filter((file) => file.endsWith('.sjson')).sort()
  } catch {
    return null
  }

  const records = new Map()
  const repeated = []
  for (const file of files) {
    const root = parseSjson(readFileSync(join(dir, file), 'utf8'))
    const list = root && typeof root === 'object' && !Array.isArray(root) ? root.Projectiles : null
    if (!Array.isArray(list)) continue
    for (const record of list) {
      if (!record || typeof record !== 'object' || typeof record.Name !== 'string') continue
      if (records.has(record.Name)) repeated.push(record.Name)
      records.set(record.Name, record)
    }
  }

  // A property, and the record that states it. A record that states the
  // property as anything but a number has overridden its parent with nothing
  // readable, so the walk stops there rather than reaching past it.
  const lookup = (name, prop, seen = new Set()) => {
    if (seen.has(name)) return null
    seen.add(name)
    const record = records.get(name)
    if (!record) return null
    if (prop in record) return typeof record[prop] === 'number' ? { value: record[prop], from: name } : null
    const parents = Array.isArray(record.InheritFrom) ? record.InheritFrom : [record.InheritFrom]
    for (const parent of parents) {
      if (typeof parent !== 'string') continue
      const found = lookup(parent, prop, seen)
      if (found) return found
    }
    return null
  }

  const out = {}
  const missing = []
  for (const name of [...names].sort()) {
    if (!records.has(name)) {
      missing.push(name)
      continue
    }
    const entry = {}
    const inherited = {}
    for (const prop of [...props].sort()) {
      const found = lookup(name, prop)
      if (!found) continue
      entry[prop] = found.value
      if (found.from !== name) inherited[prop] = found.from
    }
    if (Object.keys(inherited).length) entry.inherited = inherited
    out[name] = entry
  }
  return { out, files: files.length, records: records.size, repeated, missing }
}

const projectiles = readProjectiles(projectileQuestions(resolvedTraits))
if (projectiles) {
  writeGenerated(
    'projectiles',
    {
      source: 'Game/Projectiles/*.sjson',
      note:
        'What GetBaseDataValue({ Type = "Projectile" }) reads, for the projectiles and properties a trait extract entry names. InheritFrom is followed; inherited says which record a value came from.',
    },
    projectiles.out,
  )
  console.log(
    `  projectiles: ${Object.keys(projectiles.out).length} asked for, read from ${projectiles.records} records in ${projectiles.files} files` +
      (projectiles.missing.length ? `, ${projectiles.missing.length} not found: ${projectiles.missing.join(', ')}` : '') +
      (projectiles.repeated.length ? `, ${projectiles.repeated.length} names defined twice` : ''),
  )
}

// ---------------------------------------------------------------------------
// Stacking curves. Poms raise a trait's StackNum, and TraitLogic.GetProcessedValue
// applies, per extra stack i:
//
//     multiplier = (1 + IdenticalMultiplier.Value) * decay^(i-1)   clamped to floor
//
// where decay defaults to TraitMultiplierData.DefaultDiminishingReturnsMultiplier
// and floor to DefaultMinMultiplier. Traits without an IdenticalMultiplier stack
// linearly and are deliberately absent from this file: they have no falloff.
// ---------------------------------------------------------------------------

const traitNames = readText('TraitText.en.sjson') ?? {}
const allTraits = grab('TraitData') ?? {}

const multiplierDefaults = grab('TraitMultiplierData') ?? {}
const DECAY = multiplierDefaults.DefaultDiminishingReturnsMultiplier ?? 0.5
const FLOOR = multiplierDefaults.DefaultMinMultiplier ?? 0.1

function findCurves(node, out = [], path = []) {
  if (!node || typeof node !== 'object') return out
  for (const [k, v] of Object.entries(node)) {
    if (k === 'IdenticalMultiplier' && v && typeof v.Value === 'number') {
      out.push({ property: path.join('.') || '(root)', value: v.Value, node })
    } else if (v && typeof v === 'object') {
      findCurves(v, out, [...path, k])
    }
  }
  return out
}

function describeCurve(value, decay, floor) {
  const first = 1 + value // multiplier applied to the first EXTRA copy

  const out = { firstExtraMultiplier: +first.toFixed(4) }

  if (first === 0) {
    // extra copies contribute exactly nothing
    return { ...out, shape: 'none', worthTaking: 1 }
  }
  if (first < 0) {
    // negative: each stack subtracts a shrinking amount, converging on zero.
    // never reaches the floor, so there is no hard stop.
    return { ...out, shape: 'converges', worthTaking: null }
  }
  if (first <= floor) {
    // already at the floor on the very first extra copy
    return { ...out, shape: 'immediate', worthTaking: 1 }
  }
  if (!(decay > 0 && decay < 1)) {
    // no decay: every extra copy is worth the same as the first
    return { ...out, shape: 'linear', worthTaking: null }
  }
  const flooredAt = Math.ceil(1 + Math.log(floor / first) / Math.log(decay))
  if (!Number.isFinite(flooredAt)) {
    return { ...out, shape: 'unknown', worthTaking: null }
  }
  // copies worth taking = the base copy plus every extra still above the floor
  return { ...out, shape: 'floors', worthTaking: flooredAt }
}

const stacking = {}
for (const [id, trait] of Object.entries(allTraits)) {
  const curves = findCurves(trait)
  if (!curves.length) continue
  // one trait can carry the same curve on several properties. group them.
  const grouped = new Map()
  for (const c of curves) {
    const decay = c.node.IdenticalMultiplier.DiminishingReturnsMultiplier ?? DECAY
    const floor = c.node.MinMultiplier ?? FLOOR
    const key = `${c.value}|${decay}|${floor}`
    if (!grouped.has(key)) {
      grouped.set(key, { properties: [], value: c.value, decay, floor, ...describeCurve(c.value, decay, floor) })
    }
    grouped.get(key).properties.push(c.property)
  }
  stacking[id] = {
    name: traitNames[id]?.name ?? null,
    curves: [...grouped.values()],
  }
}

writeGenerated(
  'stacking',
  {
    luaSource: 'TraitLogic.GetProcessedValue + TraitMultiplierData',
    note:
      'Only traits with an explicit IdenticalMultiplier appear here. Everything else stacks linearly and has no diminishing point.',
    defaults: { decay: DECAY, floor: FLOOR },
  },
  stacking
)

// how much of the trait data can actually be named
const namedTraits = Object.keys(allTraits).filter((k) => traitNames[k]?.name).length

const autoreads = Object.keys(grab('__autoreads') ?? {}).sort()

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`game version: ${gameVersion}`)
console.log(`loaded ${loaded.length} lua files, ${failed.length} failed\n`)
if (failed.length) {
  console.log('FAILED:')
  for (const [f, why] of failed) console.log(`  ${f}: ${why}`)
  console.log('')
}
console.log('written to data/generated:')
for (const [f, t, n] of summary) console.log(`  ${String(n).padStart(5)} keys  ${f}.json  (${t})`)

{
  const withSlot = (t) => Object.values(t).filter((v) => typeof v?.Slot === 'string').length
  console.log(
    `
inheritance: ${withSlot(rawTraits)} of ${Object.keys(rawTraits).length} traits state a Slot, ` +
      `${withSlot(resolvedTraits)} carry one once InheritFrom is followed`
  )
}

console.log('\ndisplay text (sjson):')
for (const [f, s, n] of textSummary) console.log(`  ${String(n).padStart(5)} entries  ${f}.json  (${s})`)
console.log(`\n  ${namedTraits} of ${Object.keys(allTraits).length} traits resolve to a display name`)

if (autoreads.length) {
  console.log(`\n${autoreads.length} stubbed namespace reads (expected, these live outside Scripts):`)
  for (const a of autoreads.slice(0, 8)) console.log(`  ${a}`)
  if (autoreads.length > 8) console.log(`  ...and ${autoreads.length - 8} more`)
}

lua.global.close()
