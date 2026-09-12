/**
 * The Olympian damage table, against the game's own tables.
 *
 * This table decides a warning a player reads, so the failure that matters is
 * claiming a boon's damage counts when its record only says the boon changes
 * somebody else's projectile. Both of those shapes are real, both are in here,
 * and the two traits that sit on the line are pinned by name.
 *
 * The lists themselves are pinned too. They are what "damaging effects from
 * Olympians" means, and a patch that moves a name in or out of them changes
 * what the warning says without touching a line of this project.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { traceOlympian } from './olympian.ts'

const ROOT = resolve(import.meta.dirname, '..')
const generated = (name: string) => {
  const file = JSON.parse(readFileSync(join(ROOT, `data/generated/${name}.json`), 'utf8').replace(/^﻿/, ''))
  return (file.data ?? file) as Record<string, Record<string, unknown>>
}

const traits = generated('traits-resolved')
const trace = traceOlympian(generated('weapon-sets'), traits)

describe('the lists the game states', () => {
  it('is 63 projectiles and 3 effects', () => {
    expect(trace.projectiles).toHaveLength(63)
    expect(trace.effects).toEqual(['DamageShareDeath', 'BurnEffect', 'DamageOverTime'])
  })

  /* The reason this table exists at all. Artemis and Athena have no `LootData`
     entry and never spend an Olympian slot, so the damage sense of the word is
     not the sense the cap uses, and no answer can be read off a build's gods. */
  it('names Artemis and Athena projectiles, who spend no Olympian slot', () => {
    expect(trace.projectiles).toContain('ArtemisCastVolley')
    expect(trace.projectiles).toContain('AthenaRushProjectile')
  })
})

describe('who reads the lists', () => {
  it('finds them by their records holding the list, not by being named here', () => {
    expect(trace.readers).toEqual([
      'DamageShareRetaliateBoon', // Extended Family, +3% per counted god
      'ElementalOlympianDamageBoon', // the Earth infusion, x1.5
      'LobImpulseAspect', // Argent Skull's Persephone aspect, which charges off it
    ])
  })
})

describe('what makes damage on them', () => {
  it('takes a trait whose own stat line is a listed projectile', () => {
    // Heaven Strike's Blitz damage is ZeusEchoStrike's damage.
    expect(trace.makes.get('ZeusWeaponBoon')).toEqual([
      { name: 'ZeusEchoStrike', at: 'ExtractValues.[].BaseName' },
    ])
  })

  it('takes an effect a trait applies', () => {
    expect(trace.makes.get('HestiaWeaponBoon')).toEqual([
      { name: 'BurnEffect', at: 'OnEnemyDamagedAction.Args.EffectName' },
    ])
  })

  it('takes a property change that makes a weapon fire one', () => {
    expect(trace.makes.get('InvulnerabilityDashBoon')).toEqual([
      { name: 'AthenaRushProjectile', at: 'PropertyChanges.[].WeaponProperties.Projectile' },
    ])
  })

  /**
   * The two shapes that name a listed projectile and mean somebody else fires
   * it. Both were in an earlier pass of this table and both are wrong.
   */
  it('leaves out a modifier that only boosts a projectile somebody else fires', () => {
    // Master Conductor adds 0.15 per jump to ProjectileZeusSpark, inside
    // AddOutgoingDamageModifiers. Static Shock is what fires it.
    expect(trace.makes.has('ReboundingSparkBoon')).toBe(false)
    expect(trace.makes.get('FocusLightningBoon')?.map((one) => one.name)).toEqual(['ProjectileZeusSpark'])
  })

  it('leaves out a property change to a projectile somebody else fires', () => {
    // Coffin Nail moves ProjectileAresSwordWake's fuse. Stabbing Rush fires it.
    expect(trace.makes.has('RapidSwordBoon')).toBe(false)
    expect(trace.makes.get('AresSprintBoon')?.map((one) => one.name)).toEqual(['ProjectileAresSwordWake'])
  })

  it('reaches 62 traits and 51 of the 66 names', () => {
    expect(trace.makes.size).toBe(62)
    const covered = new Set([...trace.makes.values()].flat().map((one) => one.name))
    expect(covered.size).toBe(51)
  })

  /**
   * What it cannot see, stated as a test so it stays true or fails loudly.
   *
   * Five of the fifteen are Region traps, under a `-- Traps` comment in
   * `WeaponSets.lua`, and no boon fires those. The rest are weapon variants
   * whose link to a boon lives in the per-weapon data, which is not loaded. So
   * the table undercounts, and the warning it feeds states only the positive.
   */
  it('leaves the traps and the weapon variants unclaimed', () => {
    const covered = new Set([...trace.makes.values()].flat().map((one) => one.name))
    const missing = [...trace.projectiles, ...trace.effects].filter((name) => !covered.has(name))
    expect(missing.filter((name) => name.includes('Statue'))).toHaveLength(5)
    expect(missing).toContain('PoseidonCast')
    expect(missing).toHaveLength(15)
  })

  /* Every row is a thing a player can be shown. A template with no display
     name would be a row the warning could name and the wiki could not open. */
  it('names nothing without a display name', () => {
    const text = generated('text-traits')
    const nameless = [...trace.makes.keys()].filter((id) => !text[id]?.name)
    expect(nameless).toEqual([])
  })
})
