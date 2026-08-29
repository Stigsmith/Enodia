/**
 * The rule engine, against the real trait data.
 *
 * Two things are worth testing here and neither is "does a predicate work".
 * The first is that a binding means the same thing on both sides of a rule,
 * because the alternative fires on nearly everything. The second is that a
 * rule which cannot explain itself is refused at load rather than shipped.
 */

import { describe, expect, it } from 'vitest'

import { traits } from '../data/app.ts'
import { headline, rate, rateOffer } from './rating.ts'
import { fire, parseRules, prerequisitesOf, ruleContext } from './rules.ts'
import type { Rule } from './rules.ts'
import type { RunContext } from '../data/types.ts'

const olympians = ['Aphrodite', 'Apollo', 'Ares', 'Demeter', 'Hephaestus', 'Hera', 'Hestia', 'Poseidon', 'Zeus']

const run = (over: Partial<RunContext> = {}): RunContext => ({
  weapon: 'WeaponStaffSwing',
  aspect: null,
  path: 'underworld',
  exitsLeft: 8,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
  ...over,
})

/** Killer Current, the Poseidon and Zeus duo. */
const DUO = 'LightningVulnerabilityBoon'

describe('parseRules', () => {
  it('refuses a rule with no say, because the surface renders the sentence', () => {
    const { rules, problems } = parseRules([{ id: 'quiet', delta: 5 }])
    expect(rules).toHaveLength(0)
    expect(problems.join(' ')).toMatch(/say/)
  })

  it('refuses a slot that is not a slot, rather than never firing', () => {
    const { problems } = parseRules([
      { id: 'typo', delta: 5, say: 'x', match: { slot: ['Meelee'] } },
    ])
    expect(problems.join(' ')).toMatch(/Meelee/)
  })

  it('refuses a rule that names a target but binds none', () => {
    const { problems } = parseRules([
      { id: 'unbound', delta: 5, say: 'x', match: { prerequisiteFor: ['$target'] } },
    ])
    expect(problems.join(' ')).toMatch(/binds none/)
  })

  it('catches a duplicate id', () => {
    const rule = { id: 'same', delta: 1, say: 'x' }
    expect(parseRules([rule, rule]).problems.join(' ')).toMatch(/twice/)
  })

  it('accepts the rules the project actually ships', async () => {
    const shipped = (await import('../../data/curated/rules.json', { with: { type: 'json' } })).default
    const { rules, problems } = parseRules(shipped)
    expect(problems).toEqual([])
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) expect(rule.say.trim()).not.toBe('')
  })
})

describe('a binding means the same thing on both sides', () => {
  const bound: Rule = {
    id: 'last-piece',
    each: 'liveTarget',
    when: { reachable: ['REACHABLE', 'AT_RISK'], minPicksAtMost: 1 },
    match: { prerequisiteFor: ['$target'] },
    delta: 25,
    say: 'This is the last piece of {target}.',
    source: 'source',
  }

  it('fires on a boon that is the last piece, and names which', () => {
    // Killer Current wants a Zeus boon and a Poseidon one. Hold the Zeus half
    // and a Poseidon prerequisite becomes the last piece.
    const needed = [...prerequisitesOf(DUO, traits)]
    const zeus = needed.find((id) => traits.get(id)?.gods.includes('Zeus'))
    const poseidon = needed.find((id) => traits.get(id)?.gods.includes('Poseidon'))
    expect(zeus, 'the duo should want a Zeus boon').toBeTruthy()
    expect(poseidon, 'the duo should want a Poseidon boon').toBeTruthy()

    const ctx = ruleContext(
      run({ held: [{ id: zeus as string, rarity: 'Common' }], godsTaken: ['Zeus'], godsSeen: ['Zeus'] }),
      traits,
    )
    const firings = fire([bound], { id: poseidon as string, rarity: 'Common', god: 'Poseidon' }, ctx)
    expect(firings).toHaveLength(1)
    expect(firings[0]?.say).toContain('Killer Current')
  })

  it('does not fire on a boon that feeds nothing, in the same run', () => {
    const needed = [...prerequisitesOf(DUO, traits)]
    const zeus = needed.find((id) => traits.get(id)?.gods.includes('Zeus'))
    const ctx = ruleContext(
      run({ held: [{ id: zeus as string, rarity: 'Common' }], godsTaken: ['Zeus'], godsSeen: ['Zeus'] }),
      traits,
    )
    // Buried Treasure occupies no slot and is nobody's prerequisite.
    expect(fire([bound], { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' }, ctx)).toEqual([])
  })

  it('fires at most once however many targets a boon feeds', () => {
    const ctx = ruleContext(run(), traits)
    const zeus = [...prerequisitesOf(DUO, traits)].find((id) => traits.get(id)?.gods.includes('Zeus'))
    const firings = fire([bound], { id: zeus as string, rarity: 'Common', god: 'Zeus' }, ctx)
    expect(firings.length).toBeLessThanOrEqual(1)
  })
})

describe('shutsItsSlot', () => {
  const rule: Rule = {
    id: 'shuts',
    match: { shutsItsSlot: true },
    delta: -20,
    say: 'This shuts its slot.',
    source: 'source',
  }

  it('fires on a Heroic core boon, because RarityUpgradeOrder ends at Heroic', () => {
    const ctx = ruleContext(run(), traits)
    expect(fire([rule], { id: 'ZeusWeaponBoon', rarity: 'Heroic', god: 'Zeus' }, ctx)).toHaveLength(1)
  })

  it('does not fire below Heroic, because the slot can still be upgraded into', () => {
    const ctx = ruleContext(run(), traits)
    for (const rarity of ['Common', 'Rare', 'Epic'] as const) {
      expect(fire([rule], { id: 'ZeusWeaponBoon', rarity, god: 'Zeus' }, ctx)).toEqual([])
    }
  })

  it('does not fire on a Heroic boon that occupies no slot', () => {
    const ctx = ruleContext(run(), traits)
    expect(fire([rule], { id: 'RoomRewardBonusBoon', rarity: 'Heroic', god: 'Poseidon' }, ctx)).toEqual([])
  })
})

describe('spendsAGodSlot', () => {
  const rule: Rule = {
    id: 'spends',
    match: { spendsAGodSlot: true },
    delta: -8,
    say: 'This spends a slot.',
    source: 'source',
  }

  it('fires on a god the run has not taken from', () => {
    const ctx = ruleContext(run(), traits)
    expect(fire([rule], { id: 'ZeusWeaponBoon', rarity: 'Common', god: 'Zeus' }, ctx)).toHaveLength(1)
  })

  it('does not fire on a god already held, because the cap counts gods', () => {
    const ctx = ruleContext(
      run({ held: [{ id: 'ZeusCastBoon', rarity: 'Common' }], godsTaken: ['Zeus'] }),
      traits,
    )
    expect(fire([rule], { id: 'ZeusWeaponBoon', rarity: 'Common', god: 'Zeus' }, ctx)).toEqual([])
  })
})

describe('rating', () => {
  const rules: Rule[] = [
    { id: 'good', match: { slot: ['Melee'] }, delta: 10, say: 'Melee.', source: 'curator' },
    { id: 'bad', match: { shutsItsSlot: true }, delta: -20, say: 'Shuts.', source: 'source' },
  ]

  it('sums every firing, and carries every sentence', () => {
    const ctx = ruleContext(run(), traits)
    const rated = rate({ id: 'ZeusWeaponBoon', rarity: 'Heroic', god: 'Zeus' }, rules, ctx)
    expect(rated.score).toBe(-10)
    expect(rated.says).toEqual(['Melee.', 'Shuts.'])
    expect(rated.unrated).toBe(false)
  })

  it('calls a boon nothing fired on unrated, which is the normal case', () => {
    const ctx = ruleContext(run(), traits)
    const rated = rate({ id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' }, rules, ctx)
    expect(rated.unrated).toBe(true)
    expect(rated.score).toBe(0)
    expect(headline(rated)).toBeNull()
  })

  it('sorts unrated last but never drops it', () => {
    const ctx = ruleContext(run(), traits)
    const offer = [
      { id: 'RoomRewardBonusBoon', rarity: 'Common' as const, god: 'Poseidon' },
      { id: 'ZeusWeaponBoon', rarity: 'Common' as const, god: 'Zeus' },
    ]
    const rated = rateOffer(offer, rules, ctx)
    expect(rated).toHaveLength(2)
    expect(rated[0]?.id).toBe('ZeusWeaponBoon')
    expect(rated[1]?.unrated).toBe(true)
  })

  it('leads with the firing that moved the score most, not the first', () => {
    const ctx = ruleContext(run(), traits)
    const rated = rate({ id: 'ZeusWeaponBoon', rarity: 'Heroic', god: 'Zeus' }, rules, ctx)
    expect(headline(rated)).toBe('Shuts.')
  })
})
