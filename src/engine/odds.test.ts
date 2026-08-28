import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildTraitIndex, godPoolsFrom, olympiansFrom } from '../data/load.ts'
import { completionOdds, formatOdds } from './odds.ts'
import type { RunContext } from '../data/types.ts'

const read = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../data/generated/${name}.json`), 'utf8')).data as Record<
    string,
    unknown
  >

const loot = read('loot')
const traits = buildTraitIndex({
  traits: read('traits-resolved'),
  requirements: read('requirements'),
  loot,
  text: read('text-traits'),
})
const pools = godPoolsFrom(loot)
const olympians = olympiansFrom(loot)

const context = (over: Partial<RunContext> = {}): RunContext => ({
  weapon: null,
  aspect: null,
  path: null,
  exitsLeft: 10,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
  ...over,
})

describe('formatOdds', () => {
  it('rounds to five, because the simulation is not more precise than that', () => {
    expect(formatOdds(0.62)).toBe('60%')
    expect(formatOdds(0.63)).toBe('65%')
  })

  it('never says zero, because zero is a proof and this is not one', () => {
    expect(formatOdds(0)).toBe('under 5%')
    expect(formatOdds(0.01)).toBe('under 5%')
  })
})

describe('completionOdds', () => {
  it('is deterministic for a seed', () => {
    const args = [context(), ['LightningVulnerabilityBoon'], traits, pools, olympians, { runs: 50, seed: 7 }] as const
    expect(completionOdds(...args)).toEqual(completionOdds(...args))
  })

  it('rates a duo higher with more Exits left than with fewer', () => {
    const target = ['LightningVulnerabilityBoon']
    const early = completionOdds(context({ exitsLeft: 12 }), target, traits, pools, olympians, { runs: 120 })
    const late = completionOdds(context({ exitsLeft: 2 }), target, traits, pools, olympians, { runs: 120 })
    expect(early[0]!.rate).toBeGreaterThan(late[0]!.rate)
  })

  it('rates a duo higher when one half is already held', () => {
    // Killer Current wants one of two Poseidon boons and one of six Zeus boons.
    // Divine Vengeance is one of the six and occupies no slot.
    const cold = completionOdds(context(), ['LightningVulnerabilityBoon'], traits, pools, olympians, { runs: 300 })
    const warm = completionOdds(
      context({ held: [{ id: 'BoltRetaliateBoon', rarity: 'Common' }], godsTaken: ['Zeus'] }),
      ['LightningVulnerabilityBoon'],
      traits,
      pools,
      olympians,
      { runs: 300 },
    )
    expect(warm[0]!.rate).toBeGreaterThan(cold[0]!.rate)
  })

  /**
   * The finding this whole engine exists to produce.
   *
   * Storm Ring and Divine Vengeance both satisfy Killer Current's Zeus set. But
   * Storm Ring takes the Cast slot, and one of the two ways into the Poseidon
   * set is Tidal Ring, which is a Cast boon. Taking Storm Ring therefore
   * satisfies half the duo and closes half the other half at the same time.
   *
   * Measured at 400 runs: nothing held 7%, Storm Ring 8%, Divine Vengeance 19%.
   * Two prerequisites for the same duo, and one is worth more than twice the
   * other. Nothing in the game says this and no other tool does either.
   */
  it('sees a prerequisite that blocks its own duo', () => {
    const target = ['LightningVulnerabilityBoon']
    const blocking = completionOdds(
      context({ held: [{ id: 'ZeusCastBoon', rarity: 'Common' }], godsTaken: ['Zeus'] }),
      target,
      traits,
      pools,
      olympians,
      { runs: 400 },
    )
    const clean = completionOdds(
      context({ held: [{ id: 'BoltRetaliateBoon', rarity: 'Common' }], godsTaken: ['Zeus'] }),
      target,
      traits,
      pools,
      olympians,
      { runs: 400 },
    )
    expect(clean[0]!.rate).toBeGreaterThan(blocking[0]!.rate * 1.5)
  })

  it('rates a settled-out target at zero, which reachability already proved', () => {
    const settled = context({ godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'] })
    const odds = completionOdds(settled, ['LightningVulnerabilityBoon'], traits, pools, olympians, { runs: 60 })
    expect(odds[0]!.rate).toBe(0)
  })

  it('stays inside a budget the present entry can afford', () => {
    const targets = ['LightningVulnerabilityBoon', 'AllCloseBoon', 'EchoBurnBoon', 'BurnConsumeBoon']
    const started = performance.now()
    completionOdds(context(), targets, traits, pools, olympians, { runs: 200 })
    expect(performance.now() - started).toBeLessThan(2000)
  })
})
