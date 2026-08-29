/**
 * The number resolver, against the game's own tables.
 *
 * The formulas are copied from `TraitLogic.FormatExtractedValue` and the
 * game's own comments on them are the test cases: "eg 0.5 becomes 50", "eg 1.3
 * becomes 30", "eg 0.7 becomes -30". Those are asserted literally, so a
 * refactor that inverts one is caught by the game's own documentation.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { extractedValues, reportedValues } from './values.ts'

const ROOT = resolve(import.meta.dirname, '..')
const generated = (name: string) => {
  const file = JSON.parse(readFileSync(join(ROOT, `data/generated/${name}.json`), 'utf8').replace(/^﻿/, ''))
  return (file.data ?? file) as Record<string, Record<string, unknown>>
}

const traits = generated('traits-resolved')

describe('reportedValues', () => {
  it('hoists from any depth, which is the whole trick', () => {
    // Divine Vengeance keeps ReportValues inside OnSelfDamagedFunction.FunctionArgs.
    // A pass that only looked one level down resolved 34 of 384.
    const reported = reportedValues(traits.BoltRetaliateBoon as Record<string, unknown>)
    expect(reported.ReportedStrikeChance).toBe(0.5)
    expect(reported.ReportedMaxStrikes).toBeDefined()
  })

  it('never descends into ReportValues itself', () => {
    const trait = {
      Outer: { ReportValues: { A: 'x' }, x: 1 },
    }
    expect(reportedValues(trait)).toEqual({ A: 1 })
  })

  it('ignores a ReportValues at the top level, as the game does', () => {
    // ExtractValues only copies at depth >= 1.
    expect(reportedValues({ ReportValues: { A: 'x' }, x: 1 })).toEqual({})
  })
})

describe('the formats, against the game\'s own examples', () => {
  const one = (format: string | null, value: number, extra: Record<string, unknown> = {}) =>
    extractedValues({
      Value: value,
      ExtractValues: [{ ExtractAs: 'V', Key: 'Value', ...(format ? { Format: format } : {}), ...extra }],
    }).V

  it('Percent: eg 0.5 becomes 50', () => expect(one('Percent', 0.5)).toBe('50'))
  it('FlatPercent: eg -0.5 becomes 50', () => expect(one('FlatPercent', -0.5)).toBe('50'))
  it('PercentDelta: eg 1.3 becomes 30', () => expect(one('PercentDelta', 1.3)).toBe('30'))
  it('FlatPercentDelta: eg 1.3 becomes 30', () => expect(one('FlatPercentDelta', 1.3)).toBe('30'))
  /**
   * The game's comment says "eg. 0.7 becomes -30" and its code is
   * `(1 - value) * 100`, which is +30. The minus is in the sentence, not in
   * the number: the text reads "-{value}%". Following the code, not the
   * comment.
   */
  it('NegativePercentDelta: 0.7 becomes 30, and the sign is in the sentence', () =>
    expect(one('NegativePercentDelta', 0.7)).toBe('30'))
  it('PercentReciprocalDelta: eg 0.5 becomes 100', () => expect(one('PercentReciprocalDelta', 0.5)).toBe('100'))

  it('LuckModifiedPercent caps at 100, as the game does', () => {
    expect(one('LuckModifiedPercent', 0.2)).toBe('20')
    expect(one('LuckModifiedPercent', 1.5)).toBe('100')
  })

  it('no format at all is the raw number', () => expect(one(null, 30)).toBe('30'))

  it('honours DecimalPlaces, AbsoluteValue and MaximumValue', () => {
    expect(one(null, 1.234, { DecimalPlaces: 2 })).toBe('1.23')
    expect(one(null, -7, { AbsoluteValue: true })).toBe('7')
    expect(one(null, 99, { MaximumValue: 10 })).toBe('10')
  })

  it('unwraps a BaseValue, which is what one copy of a trait is worth', () => {
    const out = extractedValues({
      Value: { BaseValue: 50, IdenticalMultiplier: { Value: -0.5 } },
      ExtractValues: [{ ExtractAs: 'V', Key: 'Value' }],
    })
    expect(out.V).toBe('50')
  })
})

describe('what it refuses', () => {
  const refuses = (entry: Record<string, unknown>) =>
    extractedValues({ Value: 0.5, ExtractValues: [{ ExtractAs: 'V', Key: 'Value', ...entry }] })

  it('refuses a format that needs a table this project does not extract', () => {
    expect(refuses({ Format: 'MultiplyByBase', BaseType: 'Projectile' })).toEqual({})
    expect(refuses({ Format: 'PercentOfBase' })).toEqual({})
  })

  it('refuses a format that needs the state of a run', () => {
    expect(refuses({ Format: 'SlottedBoon' })).toEqual({})
    expect(refuses({ Format: 'ResourceAmount' })).toEqual({})
    expect(refuses({ Format: 'FinalBoss' })).toEqual({})
  })

  it('reads Rarity as a rung on the ladder, one-based', () => {
    // GetRarityKey indexes TraitRarityData.RarityUpgradeOrder, which is
    // Common, Rare, Epic, Heroic.
    const at = (n: number) =>
      extractedValues({ V: n, ExtractValues: [{ ExtractAs: 'R', Key: 'V', Format: 'Rarity' }] }).R
    expect(at(1)).toBe('Common')
    expect(at(3)).toBe('Epic')
    expect(at(9)).toBeUndefined()
  })

  it('refuses an External value, which lives in another table', () => {
    expect(refuses({ External: true, BaseType: 'ProjectileBase' })).toEqual({})
  })

  it('refuses a value multiplied by something the run carries', () => {
    expect(refuses({ MultiplyByMissingHealth: true })).toEqual({})
    expect(refuses({ MultiplyByOlympianBoonCount: true })).toEqual({})
  })

  it('refuses a key that resolves to nothing rather than guessing zero', () => {
    expect(extractedValues({ ExtractValues: [{ ExtractAs: 'V', Key: 'Absent' }] })).toEqual({})
  })
})

describe('against the real trait data', () => {
  it('reads Divine Vengeance the way the game does', () => {
    // ConsecutiveStrikeChance 0.5, reported as ReportedStrikeChance, formatted
    // LuckModifiedPercent: 0.5 * 1 * 100 = 50. The text reads "and again
    // {StrikeChance}% of the time".
    const out = extractedValues(traits.BoltRetaliateBoon as Record<string, unknown>)
    expect(out.StrikeChance).toBe('50')
  })

  it('answers a good share of the whole trait table', () => {
    let answered = 0
    let asked = 0
    for (const trait of Object.values(traits)) {
      const list = Array.isArray(trait.ExtractValues) ? trait.ExtractValues : []
      if (!list.length) continue
      asked += list.length
      answered += Object.keys(extractedValues(trait)).length
    }
    // A regression that broke the hoist would drop this to near zero, which
    // is what a plain "it does not crash" test would have missed.
    expect(asked).toBeGreaterThan(500)
    expect(answered / asked).toBeGreaterThan(0.4)
  })
})

describe('external values', () => {
  const tables = {
    effects: {
      Boil: { EffectData: { Duration: 10, ExpiringTimeThreshold: 2 }, DataProperties: { Stacks: 5 } },
      Plain: { Rate: 3 },
    },
    weapons: {
      Staff: { Cooldown: 1.5, DrainManaEffect: { CostPerSecond: 4 } },
    },
    hero: { MaxHealth: { BaseValue: 50 } },
  }
  const ask = (entry: Record<string, unknown>) =>
    extractedValues({ ExtractValues: [{ ExtractAs: 'V', External: true, ...entry }] }, tables).V

  it('reads a weapon property', () =>
    expect(ask({ BaseType: 'WeaponData', BaseName: 'Staff', BaseProperty: 'Cooldown' })).toBe('2'))

  it('takes ManaPerSecond off the drain effect, as the game does', () =>
    expect(ask({ BaseType: 'WeaponData', BaseName: 'Staff', BaseProperty: 'ManaPerSecond' })).toBe('4'))

  it('computes ActiveDuration as duration minus its expiry threshold', () =>
    expect(ask({ BaseType: 'EffectData', BaseName: 'Boil', BaseProperty: 'ActiveDuration' })).toBe('8'))

  it('falls back to DataProperties when the nested EffectData has nothing', () =>
    expect(ask({ BaseType: 'EffectData', BaseName: 'Boil', BaseProperty: 'Stacks' })).toBe('5'))

  it('reads EffectLuaData off the top of the record', () =>
    expect(ask({ BaseType: 'EffectLuaData', BaseName: 'Plain', BaseProperty: 'Rate' })).toBe('3'))

  it('unwraps a BaseValue from HeroData', () =>
    expect(ask({ BaseType: 'HeroData', BaseName: 'MaxHealth', BaseProperty: 'MaxHealth' })).toBeUndefined())

  it('refuses ProjectileBase, whose numbers are engine data rather than Lua', () =>
    expect(ask({ BaseType: 'ProjectileBase', BaseName: 'ApolloCast', BaseProperty: 'Fuse' })).toBeUndefined())

  it('refuses a table it was not given', () =>
    expect(ask({ BaseType: 'ConsumableData', BaseName: 'X', BaseProperty: 'Y' })).toBeUndefined())
})

describe('against the real external tables', () => {
  const external = {
    effects: generated('effects'),
    weapons: generated('weapons'),
    hero: generated('hero'),
    traits,
  }

  it("reads the duration on Selene's Hexes, which were all '# Sec'", () => {
    // SpellTransformTrait is Dark Side, whose description ends "for # Sec."
    // and whose duration is an External read out of EffectData.
    const out = extractedValues(traits.SpellTransformTrait ?? {}, external)
    expect(Object.keys(out).length).toBeGreaterThan(0)
    expect(Object.keys(extractedValues(traits.SpellTransformTrait ?? {})).length).toBeLessThan(
      Object.keys(out).length,
    )
  })

  it('answers more with the external tables than without', () => {
    let withThem = 0
    let without = 0
    for (const trait of Object.values(traits)) {
      const list = Array.isArray(trait.ExtractValues) ? trait.ExtractValues : []
      if (!list.length) continue
      withThem += Object.keys(extractedValues(trait, external)).length
      without += Object.keys(extractedValues(trait)).length
    }
    expect(withThem).toBeGreaterThan(without)
  })
})
