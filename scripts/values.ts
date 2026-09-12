/**
 * The numbers in a boon's own sentence, and in the stat lines under it.
 *
 * `{$TooltipData.ExtractData.StrikeChance}` in the game's text is a number the
 * game computes at render time, and this project rendered all 384 of them as
 * `#`. "and again #% of the time" is not a description, it is a description
 * with a hole in it.
 *
 * This is `TraitLogic.ExtractValues` and `FormatExtractedValue`, followed to
 * the letter, for the part of it that is static.
 *
 * ## The chain
 *
 * ```
 * {$TooltipData.ExtractData.StrikeChance}
 *   -> ExtractValues entry with ExtractAs "StrikeChance", Key "ReportedStrikeChance"
 *   -> some subtable's ReportValues says ReportedStrikeChance = "ConsecutiveStrikeChance"
 *   -> that subtable's ConsecutiveStrikeChance is 0.5
 *   -> Format "LuckModifiedPercent" -> 50
 * ```
 *
 * **`ReportValues` is hoisted from any depth**, which is the thing that took
 * two attempts. `ExtractValues` walks the entire trait table and copies
 * `topLevel[key] = subtable[value]` wherever it finds one, at any nesting. A
 * first pass looked only at `<name>Function.FunctionArgs.ReportValues` and
 * resolved 34 of 384; walking properly resolves 241.
 *
 * ## Rarity comes first
 *
 * A boon's numbers are not its `BaseValue`s. `ProcessTraitData` multiplies
 * every `BaseValue` in the record by the rarity's multiplier before anything
 * reads it (TraitLogic.lua:152-174, and `GetProcessedValue` below it). Heaven
 * Strike's Common multiplier is 0.8, so its Blitz is 80 at Common and 200 at
 * Heroic. `atRarity` is that step. Reading `BaseValue` straight gives the number
 * at a multiplier of 1, which is right for the 135 boons whose Common
 * multiplier is 1 and wrong for the rest.
 *
 * **Some numbers roll, and they roll twice.** A rarity stating `MinMultiplier`
 * and `MaxMultiplier` rather than one `Multiplier` draws a random multiplier
 * when the boon is made (TraitLogic.lua:158), and a value stating `BaseMin` and
 * `BaseMax` rather than one `BaseValue` draws its own random base (:252). The
 * two draws are independent. 57 of the 203 boons, duos, legendaries and Hexes
 * the app shows roll at one rarity or more, and nearly every Chaos boon rolls
 * its base.
 *
 * So a range has four corners, and the ends of it are not always low with low
 * and high with high: for a `SourceIsMultiplier` value below 1, the low base
 * and the high multiplier make the strongest boon. `Options.base` and
 * `Options.roll` pick a corner, and a caller wanting the range reads all four.
 *
 * ## What it will not answer, and why that matters
 *
 * **These are values for one copy on a fresh hero.** Several formats multiply
 * by something the run carries: `LuckModifiedPercent` by the hero's Luck,
 * `FlatHeal` by the healing multiplier, `SpeedModifiedDuration` by Olympian
 * recharge. With nothing held every one of those multipliers is 1, so the
 * number here is the number on a fresh run and the game will show more once
 * the run has boons in it. That is a real difference and the surface should
 * not pretend otherwise.
 *
 * Anything needing the state of a run in progress returns null and stays a
 * `#`: `SlottedBoon` wants what is in a slot right now, `ResourceAmount` wants
 * a count. Guessing any of them puts a wrong number on a card, which is worse
 * than an admitted gap.
 *
 * ## External values
 *
 * An `External` entry names another table and a property on it. Four are
 * reachable and are read here: `EffectData` and `EffectLuaData` out of
 * `effects.json`, `WeaponData` out of `weapons.json`, `HeroData` out of
 * `hero.json`, and `ProjectileBase` out of `projectiles.json`.
 *
 * **`ProjectileBase` was recorded here as "not, and never will be" answerable,
 * and that was wrong.** It asks for `Damage`, `Fuse` and `TotalFuse`, and
 * `ProjectileData` in Scripts declares none of them. That part was true. The
 * conclusion drawn from it, that the numbers sat in engine data nobody could
 * read, was not: they are in `Game/Projectiles/` as sjson, which is what
 * `GetBaseDataValue({ Type = "Projectile" })` reads, and `scripts/extract.mjs`
 * reads them too now. `CLAUDE.md` keeps it as error 9.
 */

type Raw = Record<string, unknown>

/**
 * The other tables an `External` value can name.
 *
 * Passed in rather than imported, so this stays a pure function of its inputs
 * and a test can hand it whatever it likes.
 */
export type Tables = {
  effects?: Raw
  weapons?: Raw
  hero?: Raw
  traits?: Raw
  /** What `GetBaseDataValue({ Type = "Projectile" })` reads, by projectile name. */
  projectiles?: Raw
}

/** Which end of a rolled range to read. */
export type Bound = 'min' | 'max'

/**
 * One corner of a rolled number: which end of `BaseMin` to `BaseMax`, and
 * which end of `MinMultiplier` to `MaxMultiplier`. The game's Codex reads the
 * low base (`ForceMin`, BoonInfoLogic.lua:121) and rolls the multiplier.
 */
export type Corner = { base: Bound; roll: Bound }

const LOW: Corner = { base: 'min', roll: 'min' }

const isDict = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every value a trait reports about itself, hoisted to the top.
 *
 * `TraitLogic.ExtractValues`: walk the whole table, and wherever a subtable
 * below the top carries `ReportValues`, copy `topLevel[key] = subtable[value]`.
 * `ReportValues` itself is never descended into.
 */
export function reportedValues(trait: Raw): Raw {
  const out: Raw = {}

  const walk = (node: unknown, depth: number): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (!isDict(node)) return

    for (const [key, value] of Object.entries(node)) {
      if (key !== 'ReportValues' && (isDict(value) || Array.isArray(value))) walk(value, depth + 1)
    }

    if (depth >= 1 && isDict(node.ReportValues)) {
      for (const [key, source] of Object.entries(node.ReportValues)) {
        if (typeof source === 'string' && source in node) out[key] = node[source]
      }
    }
  }

  walk(trait, 0)
  return out
}

/**
 * A number out of whatever shape the data stores it in.
 *
 * A trait value is often `{ BaseValue }` with the stacking fields beside it.
 * At one copy the base is the value. After `atRarity` it is a plain number.
 */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (isDict(value) && typeof value.BaseValue === 'number') return value.BaseValue
  return null
}

/**
 * `round( num, idp )`, UtilityLogic.lua:732: `math.floor(num * mult + 0.5) / mult`.
 *
 * `Math.round` agrees almost everywhere and disagrees on a value a hair under
 * a half, so this is the game's own line rather than a near miss.
 */
const round = (value: number, precision = 0): number => {
  const factor = 10 ** precision
  return Math.floor(value * factor + 0.5) / factor
}

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

/**
 * `ProcessTraitDataBlacklist`, TraitData.lua:52. Keys that `ProcessTraitData`
 * and `GetProcessedValue` never descend into, so a `BaseValue` below one of
 * them is left as written.
 */
const NOT_PROCESSED = new Set([
  'InheritFrom',
  'ExtractValues',
  'ReportValues',
  'WeaponDataOverride',
  'ConsumedVoiceLines',
  'OnSpawnVoiceLines',
  'GiftTextLineSets',
  'InteractTextLineSets',
  'UpgradeMenuOpenVoiceLines',
  'UseFunctionNames',
  'UseFunctionArgs',
  'PurchaseRequirements',
  'GameStateRequirements',
  'ValidWeapons',
])

/** Done separately, one entry at a time, into a `ChangeValue` (TraitLogic.lua:188-209). */
const CHANGE_KEYS = ['PropertyChanges', 'ActivatedPropertyChanges']

/** A rarity's multiplier, out of `RarityLevels.X` or `CustomRarityMultiplier.X`. */
function multiplierOf(level: unknown, bound: Bound): number | null {
  if (!isDict(level)) return null
  if (typeof level.Multiplier === 'number') return level.Multiplier
  const edge = bound === 'max' ? level.MaxMultiplier : level.MinMultiplier
  return typeof edge === 'number' ? edge : null
}

/**
 * `ProcessValue`, TraitLogic.lua:349: the rounding every processed value goes
 * through. Two decimal places unless the value asks for something else.
 */
function processValue(value: number, data: Raw): number {
  let out = value
  if (data.AsInt) out = round(out)
  else if (typeof data.ToNearest === 'number') out = Math.floor(out / data.ToNearest) * data.ToNearest
  out = round(out, typeof data.DecimalPlaces === 'number' ? data.DecimalPlaces : 2)
  if (typeof data.MaximumValue === 'number') out = Math.min(out, data.MaximumValue)
  if (typeof data.MinimumSourceValue === 'number') out = Math.max(out, data.MinimumSourceValue)
  return out
}

/**
 * One value at one rarity: the single-copy half of `GetProcessedValue`,
 * TraitLogic.lua:213-268.
 *
 * `MultipliedByElement` is left out. It multiplies by how many of an element
 * the hero holds (:233), which only a run knows, so the value stays at one
 * element's worth, as it always has here.
 */
function rampValue(node: Raw, multiplier: number, rarity: string | null, corner: Corner): number | null {
  const custom =
    rarity && isDict(node.CustomRarityMultiplier)
      ? multiplierOf(node.CustomRarityMultiplier[rarity], corner.roll)
      : null
  const m = custom ?? multiplier
  const base =
    typeof node.BaseValue === 'number'
      ? node.BaseValue
      : corner.base === 'max' && typeof node.BaseMax === 'number'
        ? node.BaseMax
        : node.BaseMin
  if (typeof base !== 'number') return null

  let value: number
  if (node.SourceIsMultiplier) value = 1 + (base - 1) * m
  else if (node.SourceIsNegativeMultiplier) value = 1 + (1 - base * m)
  else if (node.SourceIsDivisor) value = 1 - (1 - base) / m
  else value = base * m
  return processValue(value, node)
}

/**
 * A trait as the game holds it at one rarity, for one copy.
 *
 * `ProcessTraitData` (TraitLogic.lua:152-174) takes the rarity's multiplier and
 * runs every table in the record through `GetProcessedValue`, which recurses
 * until it meets a `BaseValue` or a `BaseMin` and turns that table into a
 * number (:336-345). `PropertyChanges` are done entry by entry into a
 * `ChangeValue` (:188-209). A rarity the trait does not list, or no rarity at
 * all, is a multiplier of 1, which is where the game's own `or 1` lands.
 *
 * The result holds plain numbers where the record had `{ BaseValue }` tables,
 * so everything after this reads it exactly as it read the raw record.
 */
export function atRarity(trait: Raw, rarity: string | null, corner: Corner = LOW): Raw {
  const levels = rarity && isDict(trait.RarityLevels) ? trait.RarityLevels[rarity] : undefined
  const multiplier = multiplierOf(levels, corner.roll) ?? 1

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!isDict(node)) return node
    if ('BaseValue' in node || 'BaseMin' in node) return rampValue(node, multiplier, rarity, corner) ?? node
    const out: Raw = {}
    for (const [key, value] of Object.entries(node)) out[key] = NOT_PROCESSED.has(key) ? value : walk(value)
    return out
  }

  const out: Raw = {}
  for (const [key, value] of Object.entries(trait)) {
    if (CHANGE_KEYS.includes(key) && Array.isArray(value)) {
      out[key] = value.map((change) => {
        if (!isDict(change) || !('BaseValue' in change || 'BaseMin' in change)) return change
        const ramped = rampValue(change, multiplier, rarity, corner)
        return ramped === null ? change : { ...change, ChangeValue: ramped }
      })
    } else {
      out[key] = NOT_PROCESSED.has(key) || CHANGE_KEYS.includes(key) ? value : walk(value)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/**
 * The formats that are exact without a run, and how `FormatExtractedValue`
 * computes each. The comments are the game's own, kept verbatim where it had
 * one, because they are the test cases.
 */
const STATIC_FORMATS: Record<string, (value: number) => number> = {
  // eg 0.5 becomes "50"
  Percent: (v) => v * 100,
  // eg 0.5 becomes "50", eg -0.5 becomes "50"
  FlatPercent: (v) => Math.abs(v * 100),
  // eg 1.3 becomes "30"
  PercentDelta: (v) => (v - 1) * 100,
  // eg 1.3 becomes "30"
  FlatPercentDelta: (v) => Math.abs((v - 1) * 100),
  // eg 0.7 becomes "-30"
  NegativePercentDelta: (v) => (1 - v) * 100,
  // eg 0.5 becomes "+100"
  PercentReciprocalDelta: (v) => (1 / v) * 100 - 100,
  TimesOneHundred: (v) => v * 100,
  TimesOneHundredPercent: (v) => v * 100 * 100,
  /**
   * The number of targets a chain hits, which is its `NumJumps` plus one.
   * `ExtractValue` adds the one as it reads the projectile (TraitLogic.lua:2066)
   * and `FormatExtractedValue` has no branch for the format, so it passes through.
   */
  TotalTargets: (v) => v,

  /**
   * These four multiply by something the run carries, and every one of those
   * multipliers is 1 on a fresh hero: CalculateHealingMultiplier,
   * OlympianRechargeMultiplier, LuckMultiplier. So the base is exact and the
   * game shows more once the run has boons in it.
   */
  FlatHeal: (v) => v,
  FlatHealBonusOnly: (v) => v,
  PercentHeal: (v) => v * 100,
  SpeedModifiedDuration: (v) => v,
  LuckModifiedPercent: (v) => Math.min(v * 100, 100),
}

/**
 * The formats that combine a trait's own number with an engine base value, as
 * `FormatExtractedValue` does (TraitLogic.lua:2200-2225).
 *
 * Only a projectile base is readable. A `Weapon` base names engine data this
 * project does not extract, and stays a gap.
 */
const BASE_FORMATS: Record<string, (value: number, base: number, fuse: number | null) => number | null> = {
  MultiplyByBase: (value, base) => value * base,
  MultiplyByBaseOverTime: (value, base, fuse) => (fuse ? (value * base) / fuse : null),
  AddToBase: (value, base) => value + base,
  PercentOfBase: (value, base) => (base ? (value / base) * 100 : null),
}

/** One property of a projectile, as the engine holds it. */
function projectileBase(tables: Tables, name: unknown, prop: unknown): number | null {
  if (typeof name !== 'string' || typeof prop !== 'string') return null
  const record = tables.projectiles?.[name]
  return isDict(record) ? numberOf(record[prop]) : null
}

/**
 * An `External` value, out of whichever table it names.
 *
 * `TraitLogic.ExtractValue` branches on `BaseType`, and these are the branches
 * whose table is in `data/generated`. The special cases are the game's own:
 * `ActiveDuration` is a duration minus its expiry threshold, `ManaPerSecond`
 * comes off the weapon's drain effect, and an `EffectData` property is looked
 * for in the nested `EffectData` first and in `DataProperties` after.
 */
function externalValue(entry: Raw, tables: Tables): number | null {
  const name = typeof entry.BaseName === 'string' ? entry.BaseName : null
  const prop = typeof entry.BaseProperty === 'string' ? entry.BaseProperty : null
  if (!name || !prop) return null

  const at = (table: Raw | undefined, key: string): unknown =>
    table && isDict(table[key]) ? (table[key] as Raw)[prop] : undefined

  switch (entry.BaseType) {
    case 'EffectLuaData':
      return numberOf(at(tables.effects, name))

    case 'EffectData': {
      const record = tables.effects?.[name]
      if (!isDict(record)) return null
      const inner = isDict(record.EffectData) ? record.EffectData : null
      if (prop === 'ActiveDuration' && inner) {
        const duration = numberOf(inner.Duration)
        const expiring = numberOf(inner.ExpiringTimeThreshold)
        return duration === null || expiring === null ? null : duration - expiring
      }
      if (inner && prop in inner) return numberOf(inner[prop])
      const props = isDict(record.DataProperties) ? record.DataProperties : null
      return props ? numberOf(props[prop]) : null
    }

    case 'Weapon':
    case 'WeaponData': {
      const record = tables.weapons?.[name]
      if (!isDict(record)) return null
      if (prop === 'ManaPerSecond' && isDict(record.DrainManaEffect)) {
        return numberOf((record.DrainManaEffect as Raw).CostPerSecond)
      }
      /**
       * The two indirections `ExtractValue` makes on `WeaponData`
       * (TraitLogic.lua:2074-2077): one charge stage's property, and one of the
       * weapon's fired-function arguments. Without them Giga Moonburst read
       * "+40 Magick", the stage's whole cost, where the game prints 40 minus
       * the first stage's cost.
       */
      if (prop === 'ChargeStageProperty') {
        const stages = record.ChargeWeaponStages
        const stage = Array.isArray(stages) && typeof entry.ChargeStage === 'number' ? stages[entry.ChargeStage - 1] : null
        return isDict(stage) && typeof entry.ChargeStageProperty === 'string'
          ? numberOf(stage[entry.ChargeStageProperty])
          : null
      }
      if (prop === 'FiredFunctionArgs') {
        const args = record.OnFiredFunctionArgs
        return isDict(args) && typeof entry.FiredFunctionArg === 'string' ? numberOf(args[entry.FiredFunctionArg]) : null
      }
      return numberOf(record[prop])
    }

    /**
     * `GetBaseDataValue({ Type = "Projectile" })`, TraitLogic.lua:2063, and the
     * one place the game adds to what it read: a chain's targets are its jumps
     * plus one.
     */
    case 'ProjectileBase': {
      const value = projectileBase(tables, name, prop)
      if (value === null) return null
      return prop === 'NumJumps' && entry.Format === 'TotalTargets' ? value + 1 : value
    }

    case 'HeroData':
      return numberOf(at(tables.hero, name))

    case 'TraitData':
      return numberOf(at(tables.traits, name))

    /**
     * `Projectile` without `Base` reads a weapon's live projectile on the hero
     * (`GetProjectileDataValue`), which only a run has. Everything else is a
     * table this project does not extract.
     */
    default:
      return null
  }
}

/**
 * Fields that make a value depend on the run rather than on the trait.
 *
 * `FormatExtractedValue` applies these after the format, and every one of them
 * reads `CurrentRun.Hero`. A trait carrying one has no static answer.
 */
const RUN_DEPENDENT = [
  'MultiplyByMissingHealth',
  'MultiplyByOlympianBoonCount',
  'MultiplyByMissingLastStands',
  'MultiplyBySpentLastStands',
]

/**
 * `TraitRarityData.RarityUpgradeOrder`, one-based, which is what
 * `GetRarityKey(index)` indexes. The game returns `"{$Keywords." .. key .. "}"`
 * and the glossary turns that back into the same word, so the key is the
 * answer.
 */
const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Heroic']

export type Options = {
  /**
   * The rarity to read the trait at, through `atRarity`. Left out, the record
   * is read as written, which is a multiplier of 1 with no rounding.
   */
  rarity?: string | null
  /** Which corner of a rolled number to read. The low one if left out. */
  corner?: Corner
}

/**
 * Every `ExtractData` value a trait can state without a run in progress.
 *
 * Keyed by `ExtractAs`, which is the name the description uses.
 */
export function extractedValues(trait: Raw, tables: Tables = {}, options: Options = {}): Record<string, string> {
  const source = 'rarity' in options ? atRarity(trait, options.rarity ?? null, options.corner) : trait
  const list = Array.isArray(source.ExtractValues) ? source.ExtractValues : []
  if (!list.length) return {}

  const reported = reportedValues(source)
  const merged: Raw = { ...source, ...reported }
  const numbers: Record<string, number> = {}
  const words: Record<string, string> = {}

  for (const entry of list) {
    if (!isDict(entry)) continue
    const name = entry.ExtractAs
    if (typeof name !== 'string') continue

    if (RUN_DEPENDENT.some((field) => field in entry)) continue

    const format = typeof entry.Format === 'string' ? entry.Format : null

    // `Rarity` names a rung on the ladder rather than a number, and the ladder
    // is a constant. `FormatExtractedValue` returns a Keywords placeholder
    // that resolves to the same word, so the word is the answer.
    if (format === 'Rarity') {
      const key = typeof entry.Key === 'string' ? entry.Key : 'ChangeValue'
      const index = numberOf(merged[key])
      const rarity = index === null ? null : RARITY_ORDER[index - 1]
      if (rarity) words[name] = rarity
      continue
    }

    // An External value comes from another table; everything else comes from
    // the trait, with a missing Key defaulting to ChangeValue as the game does.
    const key = typeof entry.Key === 'string' ? entry.Key : 'ChangeValue'
    const own = entry.External ? externalValue(entry, tables) : numberOf(merged[key])
    if (own === null) continue

    let result: number | null
    if (format && format in BASE_FORMATS) {
      // `GetBaseDataValue` with the entry's own `BaseType`. Only a projectile
      // answers here.
      if (entry.BaseType !== 'Projectile') continue
      const base = projectileBase(tables, entry.BaseName, entry.BaseProperty)
      const fuse =
        entry.BaseFuseProperty === undefined ? null : projectileBase(tables, entry.BaseName, entry.BaseFuseProperty)
      result = base === null ? null : (BASE_FORMATS[format] as (typeof BASE_FORMATS)[string])(own, base, fuse)
    } else if (format && !(format in STATIC_FORMATS)) {
      continue
    } else {
      result = format ? (STATIC_FORMATS[format] as (v: number) => number)(own) : own
    }
    if (result === null || !Number.isFinite(result)) continue

    if (entry.AbsoluteValue !== undefined) result = Math.abs(result)
    if (typeof entry.MaximumValue === 'number') result = Math.min(entry.MaximumValue, result)

    const precision = typeof entry.DecimalPlaces === 'number' ? entry.DecimalPlaces : 0
    numbers[name] = round(result, precision)
  }

  /**
   * `SetTraitTextData`'s second pass, TraitLogic.lua:2409-2419, in the same
   * order: once every value exists, one can be reduced by another, scaled by
   * another, or turned negative. A value leaning on one this could not answer
   * has no answer either.
   */
  for (const entry of list) {
    if (!isDict(entry) || typeof entry.ExtractAs !== 'string') continue
    const name = entry.ExtractAs
    const value = numbers[name]
    if (value === undefined) continue
    let next: number | undefined = value
    if (typeof entry.Subtractor === 'string') {
      const other = numbers[entry.Subtractor]
      next = other === undefined ? undefined : next - other
    }
    if (next !== undefined && typeof entry.Multiplier === 'string') {
      const other = numbers[entry.Multiplier]
      next = other === undefined ? undefined : next * other
    }
    if (next !== undefined && entry.Negative) next = -next
    if (next === undefined) delete numbers[name]
    else numbers[name] = next
  }

  const out: Record<string, string> = { ...words }
  for (const [name, value] of Object.entries(numbers)) out[name] = String(value)
  return out
}

// ---------------------------------------------------------------------------
// Stat lines
// ---------------------------------------------------------------------------

/**
 * `PercentFormatNamesLookup`, UIData.lua:3. A stat value in one of these
 * formats prints as a percentage.
 */
const PERCENT_FORMATS = new Set([
  'LuckModifiedPercent',
  'Percent',
  'PercentHeal',
  'PercentDelta',
  'NegativePercentDelta',
  'PercentOfBase',
  'TimesOneHundredPercent',
  'Divisor',
  'PercentReciprocalDelta',
])

/**
 * The two format codes the game's text puts after a value, `:P` and `:F`.
 *
 * **These belong to the engine, and the engine is not Lua**, so what they do is
 * read off the game's own usage rather than out of a function.
 * `PercentNewTotal` prints its value with `:P` and nothing else, while
 * `DeltaNewTotal`, its twin for plain numbers, writes its own `+` by hand
 * (TraitText.en.sjson:163-184). `HideSigns` chooses `FlatPercentNewTotal`,
 * which is `:F`, and the text writes a `+` in front of `:F` itself when it
 * wants one: "this rises by +{...:F}". So `:P` is a signed percentage.
 *
 * **`:F` drops the sign either way**, the way the `FlatPercent` format does
 * with `math.abs`. Moonlight Dress settles it: its text says you "use
 * {...:F} Magick less than before", over a `PercentDelta` of 0.7, which is
 * -30. The sentence already says less, so the number it prints is 30. Both
 * are still worth confirming against one boon in game.
 */
export function formatCode(value: string, code: string): string {
  const number = Number(value)
  const known = Number.isFinite(number)
  if (code === 'P') return `${known && number >= 0 ? '+' : ''}${value}%`
  if (code === 'F') return `${known ? String(Math.abs(number)) : value}%`
  return value
}

/**
 * What `{$TooltipData.StatDisplay1}` and its siblings print: the number on a
 * stat line.
 *
 * `SetTraitTextData` (TraitLogic.lua:2426-2468) counts every `ExtractValues`
 * entry that is not `SkipAutoExtract`, in order, and points `StatDisplayN` at
 * a text entry that dresses the Nth value: `PercentNewTotalN` (`:P`) for a
 * format in `PercentFormatNamesLookup`, `FlatPercentNewTotalN` (`:F`) when the
 * entry says `HideSigns`, `DeltaNewTotalN` (a written `+`) for `IncludeSigns`,
 * and `NewTotalN`, the bare number, otherwise.
 *
 * A value the extraction could not answer is null here and a `#` on screen.
 */
export function statDisplays(trait: Raw, values: Record<string, string>): (string | null)[] {
  const list = Array.isArray(trait.ExtractValues) ? trait.ExtractValues : []
  const out: (string | null)[] = []
  for (const entry of list) {
    if (!isDict(entry) || entry.SkipAutoExtract) continue
    const value = typeof entry.ExtractAs === 'string' ? values[entry.ExtractAs] : undefined
    if (value === undefined) {
      out.push(null)
      continue
    }
    const format = typeof entry.Format === 'string' ? entry.Format : null
    if (format && PERCENT_FORMATS.has(format)) out.push(formatCode(value, entry.HideSigns ? 'F' : 'P'))
    else out.push(entry.IncludeSigns ? `+${value}` : value)
  }
  return out
}
