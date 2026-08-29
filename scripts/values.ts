/**
 * The numbers in a boon's own sentence.
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
 * ## What it will not answer, and why that matters
 *
 * **These are base values.** Several formats multiply by something the run
 * carries: `LuckModifiedPercent` by the hero's Luck, `FlatHeal` by the healing
 * multiplier, `SpeedModifiedDuration` by Olympian recharge. With nothing held
 * every one of those multipliers is 1, so the number here is the number on a
 * fresh run and the game will show more once the run has boons in it. That is
 * a real difference and the surface should not pretend otherwise.
 *
 * Anything needing the state of a run in progress returns null and stays a
 * `#`: `SlottedBoon` wants what is in a slot right now, `ResourceAmount` wants
 * a count. Guessing any of them puts a wrong number on a card, which is worse
 * than an admitted gap.
 *
 * ## External values, and the one that is not there
 *
 * An `External` entry names another table and a property on it. Three of them
 * are reachable and are read here: `EffectData` and `EffectLuaData` out of
 * `effects.json`, `WeaponData` out of `weapons.json`, `HeroData` out of
 * `hero.json`.
 *
 * **`ProjectileBase` is not, and never will be from this source.** It accounts
 * for 50 of the 236 External entries and asks for `Damage`, `Fuse` and
 * `TotalFuse`. `ProjectileData` and its hero files were loaded to find them:
 * 134 entries, and **not one declares any of the three**.
 * `ProjectileData_Gods.lua` carries overrides, mostly colours, and
 * `GetBaseDataValue({ Type = "Projectile" })` is an engine call reading the
 * binary data beside the Lua. The files were dropped again rather than left
 * loading for nothing.
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
}

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
 * At one copy the base is the value, which is what a description describes.
 */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (isDict(value) && typeof value.BaseValue === 'number') return value.BaseValue
  return null
}

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
      return numberOf(record[prop])
    }

    case 'HeroData':
      return numberOf(at(tables.hero, name))

    case 'TraitData':
      return numberOf(at(tables.traits, name))

    /**
     * ProjectileBase, and everything else, is not answerable here. See the
     * docblock: the projectile numbers are engine data rather than Lua.
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

/** `round(value, precision)`, which is what the game finishes with. */
const round = (value: number, precision: number): number => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

/**
 * `TraitRarityData.RarityUpgradeOrder`, one-based, which is what
 * `GetRarityKey(index)` indexes. The game returns `"{$Keywords." .. key .. "}"`
 * and the glossary turns that back into the same word, so the key is the
 * answer.
 */
const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Heroic']

/**
 * Every `ExtractData` value a trait can state without a run in progress.
 *
 * Keyed by `ExtractAs`, which is the name the description uses.
 */
export function extractedValues(trait: Raw, tables: Tables = {}): Record<string, string> {
  const list = Array.isArray(trait.ExtractValues) ? trait.ExtractValues : []
  if (!list.length) return {}

  const reported = reportedValues(trait)
  const merged: Raw = { ...trait, ...reported }
  const out: Record<string, string> = {}

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
      const index = numberOf({ ...trait, ...reported }[key])
      const rarity = index === null ? null : RARITY_ORDER[index - 1]
      if (rarity && typeof name === 'string') out[name] = rarity
      continue
    }

    if (format && !(format in STATIC_FORMATS)) continue

    // An External value comes from another table; everything else comes from
    // the trait, with a missing Key defaulting to ChangeValue as the game does.
    const key = typeof entry.Key === 'string' ? entry.Key : 'ChangeValue'
    const value = entry.External ? externalValue(entry, tables) : numberOf(merged[key])
    if (value === null) continue

    let result = format ? (STATIC_FORMATS[format] as (v: number) => number)(value) : value
    if (!Number.isFinite(result)) continue

    if (entry.AbsoluteValue !== undefined) result = Math.abs(result)
    if (typeof entry.MaximumValue === 'number') result = Math.min(entry.MaximumValue, result)

    const precision = typeof entry.DecimalPlaces === 'number' ? entry.DecimalPlaces : 0
    out[name] = String(round(result, precision))
  }

  return out
}
