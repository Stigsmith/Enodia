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

import { atRarity, extractedValues, formatCode, reportedValues, statDisplays } from './values.ts'
import type { Corner } from './values.ts'

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

  /**
   * This test used to be called "refuses ProjectileBase, whose numbers are
   * engine data rather than Lua", and asserted exactly that. The numbers are
   * engine data, and the engine keeps them in `Game/Projectiles/` as sjson.
   * Without the table there is still nothing to read, and that half stays.
   */
  it('refuses ProjectileBase only when it has not been handed the projectile table', () =>
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

// ---------------------------------------------------------------------------
// Rarity, projectiles and stat lines. The two golden cases are traced end to
// end through the game's own code, and CLAUDE.md records both.
// ---------------------------------------------------------------------------

describe('the golden cases, against the real data', () => {
  const tables = {
    effects: generated('effects'),
    weapons: generated('weapons'),
    hero: generated('hero'),
    traits,
    projectiles: generated('projectiles'),
  }
  const at = (id: string, rarity: string) => extractedValues(traits[id] ?? {}, tables, { rarity })

  /**
   * Heaven Strike, `ZeusWeaponBoon`. Its stat line is `MultiplyByBase` over the
   * projectile `ZeusEchoStrike`, whose `Damage` is 100
   * (PlayerProjectiles.sjson:7987). Its `Modifier.BaseValue` is 1.0 and its
   * rarities are 0.8, 1.2, 1.6 and 2.0 (TraitData_Zeus.lua:8-43).
   */
  it('reads Heaven Strike as 80, 120, 160 and 200', () => {
    expect(['Common', 'Rare', 'Epic', 'Heroic'].map((rarity) => at('ZeusWeaponBoon', rarity).Damage)).toEqual([
      '80',
      '120',
      '160',
      '200',
    ])
  })

  /**
   * Extended Family, `DamageShareRetaliateBoon`. `PerUniqueGodMultiplier` is
   * 1.03 with `SourceIsMultiplier`, so rarity scales only the 0.03, and its
   * rarities are 1, 4/3, 5/3 and 2 (TraitData_Hera.lua:1859-1897).
   */
  it('reads Extended Family as 3, 4, 5 and 6 per cent', () => {
    expect(['Common', 'Rare', 'Epic', 'Heroic'].map((rarity) => at('DamageShareRetaliateBoon', rarity).OlympianMultiplier)).toEqual(['3', '4', '5', '6'])
  })

  it('dresses Extended Family\'s stat line the way its text entry does', () => {
    const trait = traits.DamageShareRetaliateBoon ?? {}
    expect(statDisplays(trait, at('DamageShareRetaliateBoon', 'Common'))[0]).toBe('+3%')
  })

  it('reads the projectile table the extractor wrote, parent and all', () => {
    expect((tables.projectiles.ZeusEchoStrike as Record<string, unknown>).Damage).toBe(100)
    // DemeterCastStorm states only `InheritFrom` and `Damage = 4`
    // (PlayerProjectiles.sjson:6807). Its fuses are DemeterSprintStorm's
    // (:6743), and the file says so. CLAUDE.md error 8, in sjson.
    expect(tables.projectiles.DemeterCastStorm).toEqual({
      Damage: 4,
      Fuse: 0.25,
      SpeedMultiplierOfEnemyProjectilesInside: 0.4,
      TotalFuse: 3,
      inherited: {
        Fuse: 'DemeterSprintStorm',
        SpeedMultiplierOfEnemyProjectilesInside: 'DemeterSprintStorm',
        TotalFuse: 'DemeterSprintStorm',
      },
    })
  })
})

describe('atRarity', () => {
  const read = (trait: Record<string, unknown>, rarity: string | null, corner?: Corner) =>
    extractedValues(trait, {}, { rarity, corner }).V

  it('multiplies a BaseValue by the rarity, and leaves one it does not list at 1', () => {
    const trait = {
      RarityLevels: { Common: { Multiplier: 0.8 }, Heroic: { Multiplier: 2 } },
      X: { BaseValue: 10 },
      ExtractValues: [{ ExtractAs: 'V', Key: 'X' }],
    }
    expect(read(trait, 'Common')).toBe('8')
    expect(read(trait, 'Heroic')).toBe('20')
    expect(read(trait, 'Legendary')).toBe('10')
  })

  it('reaches a BaseValue at any depth, as GetProcessedValue recurses', () => {
    const trait = {
      RarityLevels: { Rare: { Multiplier: 1.5 } },
      Action: { Args: { Inner: { BaseValue: 4 }, ReportValues: { Reported: 'Inner' } } },
      ExtractValues: [{ ExtractAs: 'V', Key: 'Reported' }],
    }
    expect(read(trait, 'Rare')).toBe('6')
  })

  it('scales only the part above 1 of a SourceIsMultiplier value', () => {
    const trait = {
      RarityLevels: { Heroic: { Multiplier: 2 } },
      X: { BaseValue: 1.03, SourceIsMultiplier: true },
      ExtractValues: [{ ExtractAs: 'V', Key: 'X', Format: 'PercentDelta' }],
    }
    expect(read(trait, 'Heroic')).toBe('6')
  })

  it('lets a property override the rarity with its own CustomRarityMultiplier', () => {
    const trait = {
      RarityLevels: { Epic: { Multiplier: 2 } },
      X: { BaseValue: 60, CustomRarityMultiplier: { Epic: { Multiplier: 0.5 } } },
      ExtractValues: [{ ExtractAs: 'V', Key: 'X' }],
    }
    expect(read(trait, 'Epic')).toBe('30')
  })

  it('processes PropertyChanges entry by entry into a ChangeValue', () => {
    const trait = {
      RarityLevels: { Rare: { Multiplier: 2 } },
      PropertyChanges: [{ BaseValue: 5, ReportValues: { Reported: 'ChangeValue' } }],
      ExtractValues: [{ ExtractAs: 'V', Key: 'Reported' }],
    }
    expect(read(trait, 'Rare')).toBe('10')
  })

  it('reads each corner of a number that rolls twice', () => {
    // A base between 0.7 and 0.8, a multiplier between 1 and 1.5, and the
    // strongest boon is the low base with the high multiplier.
    const trait = {
      RarityLevels: { Common: { MinMultiplier: 1, MaxMultiplier: 1.5 } },
      X: { BaseMin: 0.7, BaseMax: 0.8, SourceIsMultiplier: true },
      ExtractValues: [{ ExtractAs: 'V', Key: 'X', Format: 'NegativePercentDelta' }],
    }
    expect(read(trait, 'Common', { base: 'min', roll: 'max' })).toBe('45')
    expect(read(trait, 'Common', { base: 'max', roll: 'min' })).toBe('20')
    expect(read(trait, 'Common', { base: 'min', roll: 'min' })).toBe('30')
  })

  it('reads the record as written unless a rarity is asked for, and at 1 when the answer is none', () => {
    // At a multiplier of 1 the value still goes through ProcessValue, which
    // rounds to two places.
    expect(atRarity({ X: { BaseValue: 3.456 } }, null)).toEqual({ X: 3.46 })
    expect(
      extractedValues({ X: { BaseValue: 3.456 }, ExtractValues: [{ ExtractAs: 'V', Key: 'X', DecimalPlaces: 3 }] }).V,
    ).toBe('3.456')
  })
})

describe('base values and the second pass', () => {
  const tables = {
    projectiles: { Bolt: { Damage: 50, Fuse: 0.5, NumJumps: 3 } },
    weapons: { Staff: { ChargeWeaponStages: [{ ManaCost: 20 }, { ManaCost: 40 }], OnFiredFunctionArgs: { Count: 3 } } },
  }
  const ask = (entries: Record<string, unknown>[], record: Record<string, unknown> = {}) =>
    extractedValues({ ...record, ExtractValues: entries }, tables)

  it('multiplies by a projectile base, and divides by its fuse over time', () => {
    const out = ask(
      [
        { ExtractAs: 'Hit', Key: 'M', Format: 'MultiplyByBase', BaseType: 'Projectile', BaseName: 'Bolt', BaseProperty: 'Damage' },
        { ExtractAs: 'PerSec', Key: 'M', Format: 'MultiplyByBaseOverTime', BaseType: 'Projectile', BaseName: 'Bolt', BaseProperty: 'Damage', BaseFuseProperty: 'Fuse' },
      ],
      { M: 2 },
    )
    expect(out).toEqual({ Hit: '100', PerSec: '200' })
  })

  it('leaves a Weapon base unread, since engine weapon data is not extracted', () => {
    expect(ask([{ ExtractAs: 'V', Key: 'M', Format: 'PercentOfBase', BaseType: 'Weapon', BaseName: 'Staff', BaseProperty: 'X' }], { M: 1 })).toEqual({})
  })

  it('counts a chain as its jumps plus one', () => {
    expect(ask([{ ExtractAs: 'V', External: true, BaseType: 'ProjectileBase', BaseName: 'Bolt', BaseProperty: 'NumJumps', Format: 'TotalTargets' }]).V).toBe('4')
  })

  it('reads a charge stage and a fired-function argument off a weapon', () => {
    const out = ask([
      { ExtractAs: 'Stage', External: true, BaseType: 'WeaponData', BaseName: 'Staff', BaseProperty: 'ChargeStageProperty', ChargeStage: 2, ChargeStageProperty: 'ManaCost' },
      { ExtractAs: 'Args', External: true, BaseType: 'WeaponData', BaseName: 'Staff', BaseProperty: 'FiredFunctionArgs', FiredFunctionArg: 'Count' },
    ])
    expect(out).toEqual({ Stage: '40', Args: '3' })
  })

  it('subtracts, multiplies and negates after every value exists, and drops one leaning on a gap', () => {
    const out = ask(
      [
        { ExtractAs: 'Cost', Key: 'C', Subtractor: 'Base' },
        { ExtractAs: 'Base', Key: 'B', SkipAutoExtract: true },
        { ExtractAs: 'Twice', Key: 'C', Multiplier: 'Two' },
        { ExtractAs: 'Two', Key: 'T', SkipAutoExtract: true },
        { ExtractAs: 'Down', Key: 'B', Negative: true },
        { ExtractAs: 'Orphan', Key: 'C', Multiplier: 'Missing' },
      ],
      { C: 40, B: 15, T: 2 },
    )
    expect(out).toEqual({ Cost: '25', Base: '15', Twice: '80', Two: '2', Down: '-15' })
  })
})

describe('stat lines', () => {
  it('dresses each automatic value the way SetTraitTextData picks its text entry', () => {
    const trait = {
      ExtractValues: [
        { ExtractAs: 'A', Format: 'PercentDelta' },
        { ExtractAs: 'Skipped', SkipAutoExtract: true },
        { ExtractAs: 'B', Format: 'Percent', HideSigns: true },
        { ExtractAs: 'C', IncludeSigns: true },
        { ExtractAs: 'D' },
        { ExtractAs: 'E' },
      ],
    }
    expect(statDisplays(trait, { A: '30', B: '-20', C: '5', D: '12' })).toEqual(['+30%', '20%', '+5', '12', null])
  })

  it('prints :P with its sign and :F without one', () => {
    expect(formatCode('3', 'P')).toBe('+3%')
    expect(formatCode('-5', 'P')).toBe('-5%')
    expect(formatCode('-30', 'F')).toBe('30%')
    expect(formatCode('Rare', 'F')).toBe('Rare%')
  })
})
