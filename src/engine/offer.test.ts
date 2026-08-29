/**
 * The offer, against the real trait data.
 *
 * The reject verdict is the thing worth testing: it has to be true, it has to
 * be about the boon rather than about the clock, and it has to be cheap enough
 * to compute on every render.
 */

import { describe, expect, it } from 'vitest'

import { traits } from '../data/app.ts'
import { commonTo, differentiate, judgeFor, judgeOffer, marginalCost, sharedCost } from './offer.ts'
import { prerequisitesOf, ruleContext } from './rules.ts'
import type { Rule, Subject } from './rules.ts'
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

const RULES: Rule[] = [
  {
    id: 'shuts',
    match: { shutsItsSlot: true },
    delta: -20,
    say: 'Shuts its slot.',
    source: 'source',
  },
]

/** Killer Current, the Poseidon and Zeus duo. */
const DUO = 'LightningVulnerabilityBoon'
const zeusHalf = [...prerequisitesOf(DUO, traits)].find((id) => traits.get(id)?.gods.includes('Zeus')) as string
const poseidonHalf = [...prerequisitesOf(DUO, traits)].find((id) =>
  traits.get(id)?.gods.includes('Poseidon'),
) as string

describe('completes', () => {
  it('names the target a pick would finish', () => {
    expect(zeusHalf, 'the duo should want a Zeus boon').toBeTruthy()
    const ctx = ruleContext(
      run({ held: [{ id: zeusHalf, rarity: 'Common' }], godsTaken: ['Zeus'], godsSeen: ['Zeus'] }),
      traits,
    )
    const [judged] = judgeOffer([{ id: poseidonHalf, rarity: 'Common', god: 'Poseidon' }], RULES, ctx)
    expect(judged?.completes).toContain(DUO)
    expect(judged?.say).toContain('Killer Current')
  })

  it('says nothing about completion when a pick finishes nothing', () => {
    const ctx = ruleContext(run(), traits)
    const [judged] = judgeOffer([{ id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' }], RULES, ctx)
    expect(judged?.completes).toEqual([])
  })
})

describe('closes', () => {
  it('reports what a slot-shutting pick would kill', () => {
    // The fourth Olympian settles the pool, so a Heroic core boon on top of it
    // is the pick with real consequences.
    const ctx = ruleContext(
      run({
        held: [
          { id: 'ZeusCastBoon', rarity: 'Common' },
          { id: 'HestiaSpecialBoon', rarity: 'Common' },
          { id: 'DemeterSprintBoon', rarity: 'Common' },
        ],
        godsTaken: ['Zeus', 'Hestia', 'Demeter'],
        godsSeen: ['Zeus', 'Hestia', 'Demeter'],
      }),
      traits,
    )
    const judged = judgeOffer(
      [
        { id: 'PoseidonWeaponBoon', rarity: 'Heroic', god: 'Poseidon' },
        { id: 'PoseidonWeaponBoon', rarity: 'Common', god: 'Poseidon' },
      ],
      RULES,
      ctx,
    )
    const heroic = judged.find((entry) => entry.subject.rarity === 'Heroic')
    const common = judged.find((entry) => entry.subject.rarity === 'Common')

    // Same boon, two rarities, and only one of them shuts the slot. That is
    // why DESIGN.md 5 keys a rating on trait and rarity rather than on trait.
    expect(heroic?.closes.length).toBeGreaterThanOrEqual(common?.closes.length ?? 0)
  })

  it('is about the boon and not about the clock', () => {
    // Same run twice, one Exit apart. A candidate that closes nothing should
    // still close nothing: `closes` holds the clock still on purpose, or every
    // card in a late run would claim to be killing things time was killing.
    const long = ruleContext(run({ exitsLeft: 9 }), traits)
    const short = ruleContext(run({ exitsLeft: 2 }), traits)
    const subject: Subject = { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' }
    expect(judgeOffer([subject], RULES, long)[0]?.closes).toEqual(
      judgeOffer([subject], RULES, short)[0]?.closes,
    )
  })
})

describe('ordering', () => {
  it('never drops the unrated, which is what DESIGN.md 8 is protecting', () => {
    const offer: Subject[] = [
      { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' },
      { id: 'PoseidonWeaponBoon', rarity: 'Heroic', god: 'Poseidon' },
    ]
    const judged = judgeFor(run(), traits, offer, RULES)
    expect(judged).toHaveLength(2)
    expect(judged.some((entry) => entry.rated.unrated)).toBe(true)
  })

  it('puts unrated below anything at the same score that we did rate', () => {
    // Two boons nothing has an opinion about, and one the rules like. The
    // unrated pair keep their places behind it and neither is hidden.
    const rules: Rule[] = [
      { id: 'likes-melee', match: { slot: ['Melee'] }, delta: 10, say: 'Melee.', source: 'curator' },
    ]
    const judged = judgeFor(
      run(),
      traits,
      [
        { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' },
        { id: 'PoseidonWeaponBoon', rarity: 'Common', god: 'Poseidon' },
      ],
      rules,
    )
    expect(judged[0]?.subject.id).toBe('PoseidonWeaponBoon')
    expect(judged[1]?.rated.unrated).toBe(true)
  })

  it('does not reorder on what a pick closes', () => {
    // A pick that closes a great deal but rates well stays where the rating
    // put it. How much a closed duo costs depends on whether the player wanted
    // it, and that is not the engine's to weigh.
    const ctx = ruleContext(
      run({
        held: [
          { id: 'ZeusCastBoon', rarity: 'Common' },
          { id: 'HestiaSpecialBoon', rarity: 'Common' },
          { id: 'DemeterSprintBoon', rarity: 'Common' },
        ],
        godsTaken: ['Zeus', 'Hestia', 'Demeter'],
      }),
      traits,
    )
    const judged = judgeOffer(
      [
        { id: 'PoseidonWeaponBoon', rarity: 'Common', god: 'Poseidon' },
        { id: 'PoseidonWeaponBoon', rarity: 'Heroic', god: 'Poseidon' },
      ],
      RULES,
      ctx,
    )
    // Heroic scores -20 for shutting its slot. Common is unrated at 0. So the
    // one we know costs something sorts below the one we know nothing about,
    // which is the correction to DESIGN.md 8's literal "unrated sorts last".
    expect(judged[0]?.subject.rarity).toBe('Common')
    expect(judged[0]?.rated.unrated).toBe(true)
    expect(judged[1]?.rated.score).toBe(-20)
  })
})

describe('cost', () => {
  it('answers a dozen candidates in a reasonable time', () => {
    const ctx = ruleContext(run(), traits)
    const pool = [...traits.values()].filter((trait) => trait.kind === 'boon').slice(0, 12)
    const offer: Subject[] = pool.map((trait) => ({
      id: trait.id,
      rarity: 'Common',
      god: trait.gods[0] ?? null,
    }))

    const started = Date.now()
    const judged = judgeOffer(offer, RULES, ctx)
    const elapsed = Date.now() - started

    expect(judged).toHaveLength(12)
    // Reachability over 47 targets, twelve times. If this ever creeps past a
    // second the offer block needs memoising across renders rather than within
    // one call.
    expect(elapsed).toBeLessThan(2000)
  })
})

describe('sharedCost', () => {
  it('separates what the god costs from what the boon costs', () => {
    // Three Olympians held, so any Poseidon boon is the fourth and settles the
    // pool. Every candidate closes the same three dozen targets, and that is
    // a fact about Poseidon rather than about any of them.
    const ctx = ruleContext(
      run({
        held: [
          { id: 'ZeusCastBoon', rarity: 'Common' },
          { id: 'HestiaSpecialBoon', rarity: 'Common' },
          { id: 'DemeterSprintBoon', rarity: 'Common' },
        ],
        godsTaken: ['Zeus', 'Hestia', 'Demeter'],
        godsSeen: ['Zeus', 'Hestia', 'Demeter'],
      }),
      traits,
    )
    const offer: Subject[] = [
      { id: 'PoseidonWeaponBoon', rarity: 'Common', god: 'Poseidon' },
      { id: 'PoseidonSpecialBoon', rarity: 'Common', god: 'Poseidon' },
      { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' },
    ]
    const judged = judgeOffer(offer, RULES, ctx)
    const shared = sharedCost(judged)

    expect(shared.length).toBeGreaterThan(0)
    // Whatever is shared is shared: no card should still be claiming it.
    for (const entry of judged) {
      const marginal = marginalCost(entry, shared)
      for (const id of shared) expect(marginal).not.toContain(id)
      expect(marginal.length).toBeLessThanOrEqual(entry.closes.length)
    }
  })

  it('is empty when there is only one candidate to compare against', () => {
    const ctx = ruleContext(run(), traits)
    const judged = judgeOffer([{ id: 'ZeusWeaponBoon', rarity: 'Common', god: 'Zeus' }], RULES, ctx)
    expect(sharedCost(judged)).toEqual([])
  })

  it('is empty when the candidates close nothing in common', () => {
    const ctx = ruleContext(run(), traits)
    const judged = judgeOffer(
      [
        { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' },
        { id: 'ZeusManaBoon', rarity: 'Common', god: 'Zeus' },
      ],
      RULES,
      ctx,
    )
    expect(sharedCost(judged)).toEqual([])
  })
})

describe('differentiate', () => {
  const ctx = () =>
    ruleContext(
      run({
        held: [
          { id: 'ZeusCastBoon', rarity: 'Common' },
          { id: 'HestiaSpecialBoon', rarity: 'Common' },
          { id: 'DemeterSprintBoon', rarity: 'Common' },
        ],
        godsTaken: ['Zeus', 'Hestia', 'Demeter'],
        godsSeen: ['Zeus', 'Hestia', 'Demeter'],
      }),
      traits,
    )

  const spends: Rule[] = [
    {
      id: 'spends',
      when: { atGodCap: false },
      match: { spendsAGodSlot: true },
      delta: -8,
      say: 'Spends an Olympian slot.',
      source: 'source',
    },
  ]

  const offer: Subject[] = [
    { id: 'PoseidonWeaponBoon', rarity: 'Common', god: 'Poseidon' },
    { id: 'PoseidonSpecialBoon', rarity: 'Common', god: 'Poseidon' },
    { id: 'RoomRewardBonusBoon', rarity: 'Common', god: 'Poseidon' },
  ]

  it('lifts a sentence that fires on every card off all of them', () => {
    const judged = judgeOffer(offer, spends, ctx())
    // Every one of these is a Poseidon boon and Poseidon is the fourth god, so
    // the rule fires on all three and says nothing about which to take.
    expect(judged.every((entry) => entry.rated.says.includes('Spends an Olympian slot.'))).toBe(true)

    const { common, cards } = differentiate(judged)
    expect(common.says).toContain('Spends an Olympian slot.')
    for (const card of cards) expect(card.say).not.toBe('Spends an Olympian slot.')
  })

  it('leaves a card silent rather than repeating what was lifted', () => {
    const { cards } = differentiate(judgeOffer(offer, spends, ctx()))
    // Nothing else had anything to say about these, so silence is the answer.
    expect(cards.some((card) => card.say === null)).toBe(true)
  })

  it('keeps a sentence that only one card carries', () => {
    const rules: Rule[] = [
      ...spends,
      { id: 'melee', match: { slot: ['Melee'] }, delta: 10, say: 'A Melee boon.', source: 'curator' },
    ]
    const { common, cards } = differentiate(judgeOffer(offer, rules, ctx()))
    expect(common.says).not.toContain('A Melee boon.')
    expect(cards.find((card) => card.subject.id === 'PoseidonWeaponBoon')?.say).toBe('A Melee boon.')
  })

  it('does the same for cost, and leaves each card only what it alone closes', () => {
    const { common, cards } = differentiate(judgeOffer(offer, spends, ctx()))
    const floor = new Set(common.closes)
    expect(floor.size).toBeGreaterThan(0)
    for (const card of cards) for (const id of card.closes) expect(floor.has(id)).toBe(false)
  })

  it('lifts nothing when there is one card, because everything is about it', () => {
    const judged = judgeOffer([offer[0] as Subject], spends, ctx())
    const { common, cards } = differentiate(judged)
    expect(commonTo(judged)).toEqual({ closes: [], says: [] })
    expect(common.says).toEqual([])
    expect(cards[0]?.say).toBe('Spends an Olympian slot.')
  })
})
