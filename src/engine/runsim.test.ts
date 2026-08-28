import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildTraitIndex, godPoolsFrom, olympiansFrom } from '../data/load.ts'
import { canBeOffered } from './slots.ts'
import { reachable } from './reachability.ts'
import { eligibleGods, filledCoreSlots, offerFor, seededRng, simulateRun, simulateRuns } from './runsim.ts'
import type { RunContext, TraitId } from '../data/types.ts'

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
  exitsLeft: 12,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
  ...over,
})

describe('the seeded rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('stays inside zero and one', () => {
    const rng = seededRng(7)
    const draws = Array.from({ length: 500 }, rng)
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...draws)).toBeLessThan(1)
  })
})

describe('the Exit pool', () => {
  it('is the nine Olympians, and never Hermes or Chaos', () => {
    const gods = eligibleGods(context(), traits, pools)
    expect(gods).toHaveLength(9)
    expect(gods).not.toContain('Hermes')
    expect(gods).not.toContain('Chaos')
  })

  it('freezes to the gods already taken once the cap is reached', () => {
    const settled = context({ godsTaken: ['Zeus', 'Hera', 'Apollo', 'Hestia'] })
    expect(eligibleGods(settled, traits, pools).sort()).toEqual(['Apollo', 'Hera', 'Hestia', 'Zeus'])
  })

  it('reads the cap from the run', () => {
    const bounty = context({ godsTaken: ['Zeus'], maxOlympians: 1 })
    expect(eligibleGods(bounty, traits, pools)).toEqual(['Zeus'])
  })
})

describe('one god offer', () => {
  const rng = seededRng(3)

  it('offers three and never more', () => {
    for (const god of olympians) {
      expect(offerFor(god, context(), traits, pools, rng).length).toBeLessThanOrEqual(3)
    }
  })

  it('never offers a boon already held', () => {
    const zeusCast = 'ZeusCastBoon'
    const ctx = context({ held: [{ id: zeusCast, rarity: 'Common' }], godsTaken: ['Zeus'] })
    for (let i = 0; i < 40; i += 1) {
      expect(offerFor('Zeus', ctx, traits, pools, seededRng(i))).not.toContain(zeusCast)
    }
  })

  it('never offers a core boon whose slot is filled', () => {
    // Hera holds the Cast. Nobody may offer a Cast boon in the normal path.
    const ctx = context({ held: [{ id: 'HeraCastBoon', rarity: 'Common' }], godsTaken: ['Hera'] })
    for (let seed = 0; seed < 60; seed += 1) {
      for (const god of ['Zeus', 'Poseidon', 'Apollo']) {
        for (const id of offerFor(god, ctx, traits, pools, seededRng(seed))) {
          expect(traits.get(id)?.slot).not.toBe('Ranged')
        }
      }
    }
  })

  it('offers only what the slot rule allows, whatever the seed', () => {
    const ctx = context({
      held: [
        { id: 'ZeusCastBoon', rarity: 'Common' },
        { id: 'HestiaWeaponBoon', rarity: 'Common' },
      ],
      godsTaken: ['Zeus', 'Hestia'],
    })
    for (let seed = 0; seed < 30; seed += 1) {
      for (const god of olympians) {
        for (const id of offerFor(god, ctx, traits, pools, seededRng(seed))) {
          expect(canBeOffered(id, ctx.held, traits).route).toBe('offer')
        }
      }
    }
  })
})

describe('a simulated run', () => {
  it('is reproducible from its seed', () => {
    const a = simulateRun(traits, pools, olympians, { seed: 99 })
    const b = simulateRun(traits, pools, olympians, { seed: 99 })
    expect(a.steps).toEqual(b.steps)
    expect(a.context.held).toEqual(b.context.held)
  })

  it('is not the same run for a different seed', () => {
    const a = simulateRun(traits, pools, olympians, { seed: 1 })
    const b = simulateRun(traits, pools, olympians, { seed: 2 })
    expect(a.steps).not.toEqual(b.steps)
  })

  it('runs one step per Exit and counts down', () => {
    const run = simulateRun(traits, pools, olympians, { seed: 5, exits: 8 })
    expect(run.steps).toHaveLength(8)
    expect(run.context.exitsLeft).toBe(0)
  })

  it('never spends more than the cap, across a population', () => {
    for (const run of simulateRuns(60, traits, pools, olympians, { seed: 100 })) {
      const spent = run.context.godsTaken.filter((god) => olympians.includes(god))
      expect(spent.length).toBeLessThanOrEqual(4)
    }
  })

  it('holds no duplicate boons', () => {
    for (const run of simulateRuns(40, traits, pools, olympians, { seed: 400 })) {
      const ids = run.context.held.map((h) => h.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('respects a policy that declines everything', () => {
    const run = simulateRun(traits, pools, olympians, { seed: 8, choose: () => null })
    expect(run.context.held).toEqual([])
    expect(run.context.godsTaken).toEqual([])
    // Declining is free, so the gods keep coming and the pool never freezes.
    expect(run.steps.every((step) => step.options.length > 0)).toBe(true)
  })

  it('fills core slots as a run goes, which is what makes the lockout bite', () => {
    const runs = simulateRuns(30, traits, pools, olympians, { seed: 700 })
    const filled = runs.map((run) => filledCoreSlots(run, traits))
    expect(Math.max(...filled)).toBeGreaterThan(0)
    expect(Math.max(...filled)).toBeLessThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// The property DESIGN.md 11 asks for
// ---------------------------------------------------------------------------

describe('reachability over simulated runs', () => {
  /**
   * A DEAD verdict must never flip back to alive.
   *
   * The context only ever accumulates inside a run: boons are added, gods are
   * spent, Exits count down. Nothing gives back a slot or a god, so a target
   * proven dead at one Exit is dead at every later one. A swap would break this,
   * which is exactly why runsim does not simulate swaps.
   */
  it('never brings a dead target back to life', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const run = simulateRun(traits, pools, olympians, { seed, exits: 12 })

      let dead = new Set<TraitId>()
      let ctx = context({ exitsLeft: 12 })

      for (const step of run.steps) {
        ctx = {
          ...ctx,
          exitsLeft: 12 - step.exit,
          godsSeen: ctx.godsSeen.includes(step.god) ? ctx.godsSeen : [...ctx.godsSeen, step.god],
          ...(step.taken
            ? {
                held: [...ctx.held, { id: step.taken, rarity: 'Common' as const }],
                godsTaken: ctx.godsTaken.includes(step.god) ? ctx.godsTaken : [...ctx.godsTaken, step.god],
              }
            : {}),
        }

        const now = new Set(
          reachable(ctx, traits)
            .filter((verdict) => verdict.state === 'DEAD')
            .map((verdict) => verdict.target),
        )

        for (const target of dead) {
          expect(`seed ${seed}, exit ${step.exit}: ${target}`).toBe(
            now.has(target) ? `seed ${seed}, exit ${step.exit}: ${target}` : 'came back to life',
          )
        }
        dead = now
      }
    }
  })

  it('kills a serious share of the 47 targets by the end of a run', () => {
    // Not a fixed number, because the point is the shape: settling four
    // Olympians closes most of the board, and a tool that never says so is
    // not worth building.
    const shares = simulateRuns(20, traits, pools, olympians, { seed: 900, exits: 12 }).map((run) => {
      const verdicts = reachable(run.context, traits)
      return verdicts.filter((v) => v.state === 'DEAD').length / verdicts.length
    })
    const average = shares.reduce((a, b) => a + b, 0) / shares.length
    expect(average).toBeGreaterThan(0.4)
    expect(average).toBeLessThan(1)
  })
})
