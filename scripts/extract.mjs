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
    'LootData.lua',
    ...pick(/^LootData_.*\.lua$/),
    '@buildLootData',
    'HeroData.lua',
    'TraitData.lua',
    ...pick(/^TraitData_.*\.lua$/),
    'MetaUpgradeData.lua',
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
  'trait-rarity': 'TraitRarityData',
  'trait-elements': 'TraitElementData',
}

mkdirSync(OUT, { recursive: true })

const summary = []
for (const [fileName, luaName] of Object.entries(tables)) {
  const data = grab(luaName)
  const count = data && typeof data === 'object' ? Object.keys(data).length : 0
  writeGenerated(fileName, { luaTable: luaName }, data)
  summary.push([fileName, luaName, count])
}

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

console.log('\ndisplay text (sjson):')
for (const [f, s, n] of textSummary) console.log(`  ${String(n).padStart(5)} entries  ${f}.json  (${s})`)
console.log(`\n  ${namedTraits} of ${Object.keys(allTraits).length} traits resolve to a display name`)

if (autoreads.length) {
  console.log(`\n${autoreads.length} stubbed namespace reads (expected, these live outside Scripts):`)
  for (const a of autoreads.slice(0, 8)) console.log(`  ${a}`)
  if (autoreads.length > 8) console.log(`  ...and ${autoreads.length - 8} more`)
}

lua.global.close()
