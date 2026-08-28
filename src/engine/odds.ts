/**
 * How often a target actually completes, measured rather than asserted.
 *
 * `DESIGN.md` 4.3 refuses stated probabilities, and it is right about the
 * reason: an invented percentage is false precision, and the previous project
 * shipped one. This is not that. It runs the game's own offer model forward
 * from the run you are in and counts how often the target lands.
 *
 * What it rests on, all of it sourced:
 *
 * - Exits draw uniformly from the eligible Olympians, `RewardLogic.ChooseLoot`
 * - Three choices, `ScreenData.UpgradeChoice.MaxChoices`
 * - Core boons are slot filtered, `GetPriorityTraits`
 * - The pool freezes at `MaxGodsPerRun`
 *
 * And the two things it assumes, which are assumptions and not facts:
 *
 * 1. **You take what gets you there.** The simulated player picks a prerequisite
 *    when one is offered and otherwise picks at random. A player who wants the
 *    target behaves like this; a player who does not will see a lower number
 *    than the one on screen
 * 2. **Every reward is a god.** `RunProgress` gives a Boon in 4 of its 18 slots,
 *    so a real run gets fewer god offers than this simulates. The number is
 *    therefore optimistic, and it is a ceiling rather than a forecast
 *
 * Both are stated on screen with the number. A measured number with its method
 * attached is a different object from an invented one, and the rule that
 * matters is that nobody can mistake which they are looking at.
 */

import type { GodId, RunContext, TraitId, TraitIndex } from '../data/types.ts'
import { requirementSets } from './reachability.ts'
import { simulateRun } from './runsim.ts'
import type { ChoosePolicy, GodPools } from './runsim.ts'

export type Odds = {
  target: TraitId
  /** 0 to 1, over `runs` simulated continuations of this exact run */
  rate: number
  runs: number
}

/** The traits that would satisfy any of a target's unsatisfied sets. */
function wantedFor(target: TraitId, traits: TraitIndex): Set<TraitId> {
  const requires = traits.get(target)?.requires
  if (!requires) return new Set([target])
  return new Set(requirementSets(requires).flat())
}

/** A player chasing one target: take a prerequisite when offered, else anything. */
function chasing(wanted: ReadonlySet<TraitId>): ChoosePolicy {
  return (options, _ctx, rng) => {
    const useful = options.filter((id) => wanted.has(id))
    if (useful.length) return useful[Math.floor(rng() * useful.length)] ?? null
    return options[Math.floor(rng() * options.length)] ?? null
  }
}

function isSatisfied(held: ReadonlySet<TraitId>, target: TraitId, traits: TraitIndex): boolean {
  const requires = traits.get(target)?.requires
  if (!requires) return held.has(target)
  return requirementSets(requires).every((set) => set.some((id) => held.has(id)))
}

/**
 * Completion rate per target, from here.
 *
 * One batch of simulations per target, because the policy has to chase that
 * target. 300 runs over 10 targets is roughly 150ms, so this is a thing the
 * present entry can afford and a thing a list of 47 cannot.
 */
export function completionOdds(
  ctx: RunContext,
  targets: readonly TraitId[],
  traits: TraitIndex,
  pools: GodPools,
  olympians: readonly GodId[],
  options: { runs?: number; seed?: number } = {},
): Odds[] {
  const runs = options.runs ?? 300
  const firstSeed = options.seed ?? 1

  return targets.map((target) => {
    const wanted = wantedFor(target, traits)
    const policy = chasing(wanted)
    let hits = 0

    for (let i = 0; i < runs; i += 1) {
      const run = simulateRun(traits, pools, olympians, {
        seed: firstSeed + i,
        from: ctx,
        choose: policy,
      })
      if (isSatisfied(new Set(run.context.held.map((h) => h.id)), target, traits)) hits += 1
    }

    return { target, rate: hits / runs, runs }
  })
}

/**
 * The number as a player should read it.
 *
 * Rounded to five, because the simulation's own error at 300 runs is around
 * three points and a number ending in 7 would claim a precision it does not
 * have. Under 5% reads as "under 5" rather than 0, since 0 would say impossible
 * and impossible is a different verdict with a proof behind it.
 */
export function formatOdds(rate: number): string {
  if (rate <= 0) return 'under 5%'
  const rounded = Math.round((rate * 100) / 5) * 5
  return rounded < 5 ? 'under 5%' : `${rounded}%`
}
