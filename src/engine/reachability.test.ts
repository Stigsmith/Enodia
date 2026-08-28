import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { bandFor, godPriority, minimumPicks, obtainability, reachable, verdictFor } from './reachability.ts'
import { buildTraitIndex, olympiansFrom } from '../data/load.ts'
import type { Held, RunContext, Trait, TraitId, TraitIndex } from '../data/types.ts'

// ---------------------------------------------------------------------------
// A hand-built world: two Olympians with a Cast boon each, a duo between them,
// and a legendary that needs two sets from one god.
// ---------------------------------------------------------------------------

const trait = (id: string, over: Partial<Trait> = {}): Trait => ({
  id,
  name: id,
  kind: 'boon',
  slot: null,
  altSlot: null,
  gods: [],
  requiredWeapon: null,
  requires: null,
  ...over,
})

const index: TraitIndex = new Map(
  [
    trait('ZeusCast', { name: 'Storm Ring', slot: 'Ranged', gods: ['Zeus'] }),
    trait('ZeusAttack', { name: 'Heaven Strike', slot: 'Melee', gods: ['Zeus'] }),
    trait('PoseidonCast', { name: 'Tidal Ring', slot: 'Ranged', gods: ['Poseidon'] }),
    trait('PoseidonAttack', { name: 'Wave Flourish', slot: 'Melee', gods: ['Poseidon'] }),
    trait('HeraCast', { name: 'Hera Cast', slot: 'Ranged', gods: ['Hera'] }),
    trait('HermesSpeed', { name: 'Nimble Limbs', gods: ['Hermes'] }),
    trait('ZeusDuo', {
      name: 'Killer Current',
      kind: 'duo',
      gods: ['Zeus', 'Poseidon'],
      requires: { oneFromEachSet: [['ZeusCast', 'ZeusAttack'], ['PoseidonCast', 'PoseidonAttack']] },
    }),
    trait('ZeusLegendary', {
      name: 'Shocking Loss',
      kind: 'legendary',
      gods: ['Zeus'],
      requires: { oneFromEachSet: [['ZeusCast'], ['ZeusAttack']] },
    }),
    trait('HermesGated', {
      name: 'Paid Dues',
      kind: 'legendary',
      gods: ['Hermes'],
      requires: { oneOf: ['HermesSpeed'] },
    }),
  ].map((t) => [t.id, t]),
)

const OLYMPIANS = ['Aphrodite', 'Apollo', 'Ares', 'Demeter', 'Hephaestus', 'Hera', 'Hestia', 'Poseidon', 'Zeus']

const context = (over: Partial<RunContext> = {}): RunContext => ({
  weapon: null,
  aspect: null,
  path: null,
  exitsLeft: 8,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians: OLYMPIANS,
  ...over,
})

const holding = (...ids: TraitId[]): Held => ids.map((id) => ({ id, rarity: 'Common' as const }))

// ---------------------------------------------------------------------------

describe('minimumPicks', () => {
  it('counts one when a single trait covers both sets', () => {
    expect(minimumPicks([['a', 'b'], ['b', 'c']])).toBe(1)
  })

  it('counts two when nothing overlaps', () => {
    expect(minimumPicks([['a'], ['b']])).toBe(2)
  })

  it('is zero with nothing left to satisfy', () => {
    expect(minimumPicks([])).toBe(0)
  })
})

describe('the four states', () => {
  it('is ON_TRACK when every set is already held', () => {
    const verdict = verdictFor('ZeusDuo', context({ held: holding('ZeusCast', 'PoseidonAttack') }), index)
    expect(verdict.state).toBe('ON_TRACK')
    expect(verdict.why).toContain('in hand')
  })

  it('is REACHABLE from an empty run, and says how many picks', () => {
    const verdict = verdictFor('ZeusDuo', context(), index)
    expect(verdict.state).toBe('REACHABLE')
    expect(verdict.minPicks).toBe(2)
    expect(verdict.needs).toHaveLength(2)
  })

  it('is AT_RISK when it needs more picks than there are Exits', () => {
    const verdict = verdictFor('ZeusDuo', context({ exitsLeft: 1 }), index)
    expect(verdict.state).toBe('AT_RISK')
    expect(verdict.why).toContain('2 more picks and you have one Exit left')
  })

  it('counts the pick that satisfies two sets once', () => {
    // Holding one Zeus core boon leaves the legendary needing only the other.
    const verdict = verdictFor('ZeusLegendary', context({ held: holding('ZeusCast'), exitsLeft: 1 }), index)
    expect(verdict.minPicks).toBe(1)
    expect(verdict.state).toBe('REACHABLE')
  })
})

describe('the Cast lockout, end to end', () => {
  // The originating complaint, as a run: Hera has your Cast, so neither Zeus's
  // nor Poseidon's Cast boon can be offered, and the duo has to come through
  // the Attack boons instead.
  it('keeps the duo alive, and keeps the swap route in the options', () => {
    const ctx = context({ held: holding('HeraCast'), godsTaken: ['Hera'] })
    const verdict = verdictFor('ZeusDuo', ctx, index)
    expect(verdict.state).toBe('REACHABLE')
    // Both Cast boons are still listed, because a Common occupant can be
    // swapped. Dropping them would report a build as narrower than it is.
    expect(verdict.needs).toEqual([
      ['ZeusCast', 'ZeusAttack'],
      ['PoseidonCast', 'PoseidonAttack'],
    ])
  })

  it('drops the Cast options once the slot is held at Heroic', () => {
    const ctx = context({ held: [{ id: 'HeraCast', rarity: 'Heroic' }], godsTaken: ['Hera'] })
    const verdict = verdictFor('ZeusDuo', ctx, index)
    expect(verdict.state).toBe('REACHABLE')
    expect(verdict.needs).toEqual([['ZeusAttack'], ['PoseidonAttack']])
  })

  it('kills the legendary that needs the filled slot outright', () => {
    // ZeusLegendary needs ZeusCast specifically, and a Heroic occupant cannot
    // be swapped, so this one really is a proof.
    const ctx = context({ held: [{ id: 'HeraCast', rarity: 'Heroic' }], godsTaken: ['Hera'] })
    const verdict = verdictFor('ZeusLegendary', ctx, index)
    expect(verdict.state).toBe('DEAD')
    expect(verdict.why).toContain('top of the ladder')
    expect(verdict.blockedBy).toContain('HeraCast')
  })

  it('does not call a set a swap while one option can still arrive normally', () => {
    // Hera holds the Cast, so ZeusCast is swap-only, but ZeusAttack is a normal
    // offer in the same set. The duo is an ordinary ask, not a long shot.
    const ctx = context({ held: holding('HeraCast'), godsTaken: ['Hera'], godsSeen: ['Zeus', 'Poseidon'] })
    const verdict = verdictFor('ZeusDuo', ctx, index)
    expect(verdict.band).not.toBe('Long shot')
    expect(verdict.why).not.toContain('swap')
  })

  // The correction. Below Heroic the same slot is a swap away, not dead.
  it('does not call it dead while the occupant can still be swapped', () => {
    const ctx = context({ held: holding('HeraCast'), godsTaken: ['Hera'] })
    const verdict = verdictFor('ZeusLegendary', ctx, index)
    expect(verdict.state).not.toBe('DEAD')
    expect(verdict.band).toBe('Long shot')
    expect(verdict.why).toContain('swap')
  })
})

describe('the Olympian cap', () => {
  const atCap = { godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'], godsSeen: [] }

  it('kills a target needing a god outside the settled pool', () => {
    const verdict = verdictFor('ZeusDuo', context(atCap), index)
    expect(verdict.state).toBe('DEAD')
    expect(verdict.why).toContain('4 Olympians are settled')
  })

  it('leaves it alive one slot below the cap', () => {
    const verdict = verdictFor('ZeusDuo', context({ godsTaken: ['Aphrodite', 'Apollo', 'Ares'] }), index)
    expect(verdict.state).not.toBe('DEAD')
  })

  it('reads the cap from the run, since bounties change it', () => {
    const verdict = verdictFor('ZeusDuo', context({ godsTaken: ['Aphrodite'], maxOlympians: 1 }), index)
    expect(verdict.state).toBe('DEAD')
  })

  it('never counts Hermes against the cap', () => {
    // Hermes is not an Olympian, so his legendary survives a settled pool.
    const verdict = verdictFor('HermesGated', context(atCap), index)
    expect(verdict.state).toBe('REACHABLE')
  })
})

describe('obtainability', () => {
  it('reports a held trait as held', () => {
    expect(obtainability('ZeusCast', context({ held: holding('ZeusCast') }), index).route).toBe('held')
  })

  it('reports an unknown id as dead rather than throwing', () => {
    expect(obtainability('NotATrait', context(), index).route).toBe('dead')
  })

  it('survives a prerequisite cycle', () => {
    const cyclic: TraitIndex = new Map([
      ['A', trait('A', { requires: { oneOf: ['B'] } })],
      ['B', trait('B', { requires: { oneOf: ['A'] } })],
    ])
    expect(obtainability('A', context(), cyclic).route).toBe('dead')
  })

  it('rules out an aspect belonging to another weapon', () => {
    const weapons: TraitIndex = new Map([
      ['CoatAspect', trait('CoatAspect', { kind: 'aspect', requiredWeapon: 'WeaponSuit' })],
    ])
    expect(obtainability('CoatAspect', context({ weapon: 'WeaponAxe' }), weapons).route).toBe('dead')
    expect(obtainability('CoatAspect', context({ weapon: 'WeaponSuit' }), weapons).route).toBe('offer')
  })
})

describe('bands', () => {
  it('never renders the god cap as a likelihood', () => {
    // A capped-out god is DEAD, which carries no band at all.
    expect(verdictFor('ZeusDuo', context({ godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'] }), index).band).toBeNull()
  })

  it('reads Likely only with room to spare and every god met', () => {
    expect(bandFor({ minPicks: 1, exitsLeft: 6, needsASwap: false, unseenGods: 0 })).toBe('Likely')
    expect(bandFor({ minPicks: 1, exitsLeft: 6, needsASwap: false, unseenGods: 1 })).toBe('Possible')
    expect(bandFor({ minPicks: 4, exitsLeft: 3, needsASwap: false, unseenGods: 0 })).toBe('Long shot')
    expect(bandFor({ minPicks: 1, exitsLeft: 9, needsASwap: true, unseenGods: 0 })).toBe('Long shot')
  })
})

describe('reachable', () => {
  it('puts the dead first, because that is the news', () => {
    const ctx = context({ godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'] })
    const states = reachable(ctx, index).map((v) => v.state)
    expect(states[0]).toBe('DEAD')
    expect(states).toEqual([...states].sort())
  })

  it('judges every duo and legendary when given no targets', () => {
    expect(reachable(context(), index).map((v) => v.target).sort()).toEqual([
      'HermesGated',
      'ZeusDuo',
      'ZeusLegendary',
    ])
  })
})

describe('god priority', () => {
  it('ranks the god that feeds the most live targets first', () => {
    const ranked = godPriority(context(), index)
    expect(ranked[0]?.god).toBe('Zeus')
    expect(ranked[0]?.keeps).toContain('ZeusDuo')
  })

  it('names what a god kills when it would take the last slot', () => {
    // Three Olympians taken, so the fourth settles the pool. Hera feeds
    // nothing here and closes Zeus and Poseidon out.
    const ctx = context({ godsTaken: ['Aphrodite', 'Apollo', 'Ares'] })
    const hera = godPriority(ctx, index).find((g) => g.god === 'Hera')
    expect(hera?.kills).toContain('ZeusDuo')
    expect(hera?.why).toContain('last Olympian slot')
  })

  it('says the pool is settled once the cap is reached', () => {
    const ctx = context({ godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'] })
    expect(godPriority(ctx, index)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Against the real extraction
// ---------------------------------------------------------------------------

describe('against data/generated', () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(join(import.meta.dirname, `../../data/generated/${name}.json`), 'utf8'))
      .data as Record<string, unknown>

  const traits = buildTraitIndex({
    traits: read('traits-resolved'),
    requirements: read('requirements'),
    loot: read('loot'),
    text: read('text-traits'),
  })
  const olympians = olympiansFrom(read('loot'))
  const real = (over: Partial<RunContext> = {}): RunContext => ({
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

  it('finds the nine Olympians and the 37 duos', () => {
    expect(olympians).toHaveLength(9)
    expect([...traits.values()].filter((t) => t.kind === 'duo')).toHaveLength(37)
    expect([...traits.values()].filter((t) => t.kind === 'legendary')).toHaveLength(10)
  })

  it('starts a run with every duo and legendary alive', () => {
    const verdicts = reachable(real(), traits)
    expect(verdicts).toHaveLength(47)
    expect(verdicts.filter((v) => v.state === 'DEAD')).toHaveLength(0)
  })

  it('kills the duos that need a god outside a settled pool', () => {
    // Four Olympians taken. Killer Current is Poseidon and Zeus, so it dies.
    const ctx = real({ godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'] })
    const verdict = reachable(ctx, traits).find((v) => v.target === 'LightningVulnerabilityBoon')
    expect(verdict?.state).toBe('DEAD')
    expect(verdict?.why).toContain('Olympians are settled')
  })

  it('keeps a duo between two held gods alive at the cap', () => {
    const ctx = real({ godsTaken: ['Aphrodite', 'Apollo', 'Ares', 'Demeter'] })
    // Hostile Environment is Ares and Demeter, both held.
    const verdict = reachable(ctx, traits).find((v) => v.target === 'SelfCastBoon')
    expect(verdict?.state).not.toBe('DEAD')
  })

  it('ranks gods without inventing one', () => {
    const ranked = godPriority(real(), traits)
    expect(ranked.map((g) => g.god).sort()).toEqual([...olympians].sort())
    expect(ranked.every((g) => g.why.length > 0)).toBe(true)
  })
})
