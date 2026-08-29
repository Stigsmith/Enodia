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
 * Anything needing a table this project does not extract, or the state of a
 * run in progress, returns null and stays a `#`. `MultiplyByBase` wants a
 * projectile's damage, `Rarity` wants a rarity key, `SlottedBoon` wants what
 * is in a slot right now. Guessing any of them puts a wrong number on a card,
 * which is worse than an admitted gap.
 */

type Raw = Record<string, unknown>

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
 * Every `ExtractData` value a trait can state without a run in progress.
 *
 * Keyed by `ExtractAs`, which is the name the description uses.
 */
export function extractedValues(trait: Raw): Record<string, string> {
  const list = Array.isArray(trait.ExtractValues) ? trait.ExtractValues : []
  if (!list.length) return {}

  const reported = reportedValues(trait)
  const merged: Raw = { ...trait, ...reported }
  const out: Record<string, string> = {}

  for (const entry of list) {
    if (!isDict(entry)) continue
    const name = entry.ExtractAs
    if (typeof name !== 'string') continue

    // External values live in the projectile, weapon and effect tables, which
    // this project does not extract. 21 of the 384.
    if (entry.External) continue
    if (RUN_DEPENDENT.some((field) => field in entry)) continue

    const format = typeof entry.Format === 'string' ? entry.Format : null
    if (format && !(format in STATIC_FORMATS)) continue

    // `FormatExtractedValue` defaults a missing Key to ChangeValue.
    const key = typeof entry.Key === 'string' ? entry.Key : 'ChangeValue'
    const value = numberOf(merged[key])
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
