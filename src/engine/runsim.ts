/**
 * Run simulation. Legal runs, generated.
 *
 * Two jobs, both of them measurement rather than product. Reachability's
 * property tests need runs that a real game could produce, and `scripts/health.ts`
 * will need a population to measure rules against. `DESIGN.md` 5.1 is emphatic
 * that the population must **never** be the archetypes that ship with the tool:
 * in the previous project two rules looked healthy against 39 shipped builds and
 * fired on 86% and 45% of 300 random ones, and both were cut.
 *
 * What is modelled, from the source:
 *
 * - The Exit pool is **Olympians only**. `GetEligibleLootNames` keeps loot with
 *   `GodLoot`, so Hermes and Chaos are never drawn here even though they hand
 *   out boons through their own encounters
 * - Uniform draw. `RewardLogic.ChooseLoot` is `GetRandomValue(eligibleLootNames)`
 *   with no history term. A god you hold is exactly as likely as one you do not
 * - At the cap the pool freezes to the Olympians already taken
 * - Three choices, from `ScreenData.UpgradeChoice.MaxChoices`
 * - Priority boons are slot-filtered, and once one of a god's core boons is held
 *   or blocked the priority offer collapses to a single option
 * - Attack and Special are guaranteed a place when the offer would have neither
 *
 * What is deliberately not modelled, and why:
 *
 * - **Rarity.** Everything arrives Common. Rarity decides whether a slot can be
 *   swapped, and rolling it would make runs disagree with each other for a
 *   reason no rule is being measured on. Pass `rollRarity` to switch it on
 * - **Weights.** `Weight` and `PriorityChance` are in the files, unvalidated.
 *   `DESIGN.md` 12 keeps them out until somebody measures them, so selection
 *   inside a pool is uniform
 * - **Swaps.** The 10% replacement offer is not simulated. It removes a held
 *   trait, and a simulator that quietly takes boons away would break the one
 *   property these runs exist to test
 *
 * Pure and seeded. Same seed, same run, on any machine.
 */

import type { GodPool } from '../data/load.ts'
import type { GodId, Held, RunContext, TraitId, TraitIndex, WeaponId } from '../data/types.ts'
import { canBeOffered, CORE_SLOTS, GUARANTEED_SLOTS } from './slots.ts'
import { satisfiesRequirement } from './reachability.ts'

export type Rng = () => number

/** mulberry32. Small, fast, and good enough for choosing between three boons. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  if (!items.length) return undefined
  return items[Math.floor(rng() * items.length)]
}

export type GodPools = ReadonlyMap<GodId, GodPool>

export type SimStep = {
  /** 1-based, counting down exitsLeft */
  exit: number
  god: GodId
  options: TraitId[]
  /** null when the policy declined, which is a real move */
  taken: TraitId | null
}

export type SimRun = {
  steps: SimStep[]
  /** the run as it ended, ready to hand to reachable() */
  context: RunContext
}

export type ChoosePolicy = (options: readonly TraitId[], ctx: RunContext, rng: Rng) => TraitId | null

export type SimOptions = {
  seed?: number
  /** how many Exits the run gets. A full Hades II run is roughly a dozen */
  exits?: number
  maxOlympians?: number
  maxChoices?: number
  weapon?: WeaponId | null
  /** default: take one at random. Declining is legal and costs nothing */
  choose?: ChoosePolicy
  /** roll rarity per offer instead of everything arriving Common */
  rollRarity?: boolean
}

const takeOne: ChoosePolicy = (options, _ctx, rng) => pick(options, rng) ?? null

/**
 * The three boons one god puts in front of you.
 *
 * Follows `GetPriorityTraits` then the fill from `GetEligibleUpgrades`, in that
 * order, because the order is what makes the slot lockout visible: a filled
 * Cast means the Cast boon never appears in the priority half.
 */
export function offerFor(
  god: GodId,
  ctx: RunContext,
  traits: TraitIndex,
  pools: GodPools,
  rng: Rng,
  maxChoices = 3,
): TraitId[] {
  const pool = pools.get(god)
  if (!pool) return []

  const held = new Set(ctx.held.map((h) => h.id))

  // GetPriorityTraits. A core boon is offered only when its slot is open.
  let priority: TraitId[] = []
  let anyPriorityBlocked = false
  for (const id of pool.priority) {
    if (canBeOffered(id, ctx.held, traits).route === 'offer') priority.push(id)
    else anyPriorityBlocked = true
  }

  // "if heroHasPriorityTrait then return { GetRandomValue(priorityOptions) }".
  // Once one of this god's core boons is held or its slot is taken, the
  // priority half of the offer collapses to a single option.
  if (anyPriorityBlocked && priority.length) {
    const one = pick(priority, rng)
    priority = one ? [one] : []
  }

  while (priority.length > maxChoices) {
    const drop = Math.floor(rng() * priority.length)
    priority.splice(drop, 1)
  }

  // The Attack and Special guarantee, which is why they feel commoner than the
  // pool suggests.
  const guaranteed = pool.priority.filter((id) => {
    const slot = traits.get(id)?.slot
    return slot && GUARANTEED_SLOTS.includes(slot) && canBeOffered(id, ctx.held, traits).route === 'offer'
  })
  const hasGuaranteed = priority.some((id) => {
    const slot = traits.get(id)?.slot
    return slot ? GUARANTEED_SLOTS.includes(slot) : false
  })
  if (!hasGuaranteed && guaranteed.length && priority.length) {
    const forced = pick(guaranteed, rng)
    if (forced) priority[0] = forced
  }

  const options = [...new Set(priority)]

  // Fill the rest from the god's own pool: not held, requirements met, and not
  // blocked by a slot it cannot have.
  if (options.length < maxChoices) {
    const rest = pool.pool.filter((id) => {
      if (held.has(id) || options.includes(id)) return false
      const trait = traits.get(id)
      if (!trait) return false
      if (!satisfiesRequirement(trait.requires, held)) return false
      return canBeOffered(id, ctx.held, traits).route === 'offer'
    })
    while (options.length < maxChoices && rest.length) {
      const index = Math.floor(rng() * rest.length)
      const [chosen] = rest.splice(index, 1)
      if (chosen) options.push(chosen)
    }
  }

  return options
}

/** The Exit pool: Olympians, frozen to those held once the cap is reached. */
export function eligibleGods(ctx: RunContext, traits: TraitIndex, pools: GodPools): GodId[] {
  const taken = new Set(
    ctx.godsTaken.filter((god) => ctx.olympians.includes(god)).concat(
      ctx.held.flatMap((h) => (traits.get(h.id)?.gods ?? []).filter((g) => ctx.olympians.includes(g))),
    ),
  )
  const pool = ctx.olympians.filter((god) => pools.has(god))
  return taken.size >= ctx.maxOlympians ? pool.filter((god) => taken.has(god)) : pool
}

const RARITY_ROLL: readonly { rarity: Held[number]['rarity']; chance: number }[] = [
  // HeroData.BoonData.RarityChances, rolled in BoonRarityRollOrder so the
  // rarest result that hits wins, which is how SetTraitsOnLoot does it.
  { rarity: 'Rare', chance: 0.1 },
  { rarity: 'Epic', chance: 0.05 },
]

function rollRarity(rng: Rng): Held[number]['rarity'] {
  let rarity: Held[number]['rarity'] = 'Common'
  for (const step of RARITY_ROLL) {
    if (rng() < step.chance) rarity = step.rarity
  }
  return rarity
}

export function simulateRun(
  traits: TraitIndex,
  pools: GodPools,
  olympians: readonly GodId[],
  options: SimOptions = {},
): SimRun {
  const rng = seededRng(options.seed ?? 1)
  const exits = options.exits ?? 12
  const maxChoices = options.maxChoices ?? 3
  const choose = options.choose ?? takeOne

  let ctx: RunContext = {
    weapon: options.weapon ?? null,
    aspect: null,
    exitsLeft: exits,
    held: [],
    godsTaken: [],
    godsSeen: [],
    maxOlympians: options.maxOlympians ?? 4,
    olympians,
  }

  const steps: SimStep[] = []

  for (let exit = 1; exit <= exits; exit += 1) {
    const gods = eligibleGods(ctx, traits, pools)
    const god = pick(gods, rng)
    if (!god) break

    const offer = offerFor(god, ctx, traits, pools, rng, maxChoices)
    const taken = offer.length ? choose(offer, ctx, rng) : null

    steps.push({ exit, god, options: offer, taken })

    ctx = {
      ...ctx,
      exitsLeft: exits - exit,
      godsSeen: ctx.godsSeen.includes(god) ? ctx.godsSeen : [...ctx.godsSeen, god],
      ...(taken
        ? {
            held: [...ctx.held, { id: taken, rarity: options.rollRarity ? rollRarity(rng) : 'Common' }],
            godsTaken: ctx.godsTaken.includes(god) ? ctx.godsTaken : [...ctx.godsTaken, god],
          }
        : {}),
    }
  }

  return { steps, context: ctx }
}

/** A population. Seeds are consecutive so a failing run can be reproduced. */
export function simulateRuns(
  count: number,
  traits: TraitIndex,
  pools: GodPools,
  olympians: readonly GodId[],
  options: SimOptions = {},
): SimRun[] {
  const first = options.seed ?? 1
  return Array.from({ length: count }, (_, i) => simulateRun(traits, pools, olympians, { ...options, seed: first + i }))
}

/** Which core slots a finished run filled. Handy for describing a population. */
export function filledCoreSlots(run: SimRun, traits: TraitIndex): number {
  const slots = new Set(
    run.context.held.map((h) => traits.get(h.id)?.slot).filter((slot) => slot && CORE_SLOTS.includes(slot)),
  )
  return slots.size
}
