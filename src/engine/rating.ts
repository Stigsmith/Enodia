/**
 * Rating. What to take, and why.
 *
 * `DESIGN.md` 5. `engine/rules.ts` holds the vocabulary and the machine,
 * `data/curated/rules.json` holds the rules, and this turns a set of firings
 * into something a surface can render.
 *
 * **The number is not the product.** A rating carries its sentences and the
 * Exit block renders those; the score exists to order three cards and for
 * `scripts/health.ts` to measure. `DESIGN.md` 8 is explicit that a judgement
 * and a sourced fact must never look equally weighed, and a bare number reads
 * as neither.
 *
 * **Unrated is a first-class state**, not missing data. Most boons in this game
 * are damage boons and no rule here has anything to say about them, which is
 * correct: silence is the normal state. An offer with no firings scores zero,
 * sorts by the tiebreak, and says so.
 *
 * Pure.
 */

import { fire, ruleContext, subjectRules } from './rules.ts'
import type { Firing, Rule, RuleContext, Subject } from './rules.ts'
import type { Rarity, RunContext, TraitId, TraitIndex } from '../data/types.ts'

export type Rated = {
  id: TraitId
  rarity: Rarity
  /** the sum of every firing's delta. Zero means nothing had anything to say */
  score: number
  /** what fired, in the order the rules are declared */
  firings: Firing[]
  /** every sentence, which is what the surface renders */
  says: string[]
  /** true when no rule fired at all, which is the normal case */
  unrated: boolean
}

/** Rate one candidate against the run. */
export function rate(subject: Subject, rules: readonly Rule[], ctx: RuleContext): Rated {
  const firings = fire(subjectRules(rules), subject, ctx)
  return {
    id: subject.id,
    rarity: subject.rarity,
    score: firings.reduce((sum, firing) => sum + firing.delta, 0),
    firings,
    says: firings.map((firing) => firing.say),
    unrated: firings.length === 0,
  }
}

/**
 * The order an offer is shown in.
 *
 * Score first, then unrated after rated at the same score, then name.
 *
 * **`DESIGN.md` 8 says unrated "sorts last", and taken literally that is
 * wrong.** It was written when every delta was a bonus, and it holds
 * perfectly there. With a penalty in the pack it puts a boon we know shuts a
 * slot *above* one we know nothing about, which tells a player the opposite of
 * what we mean.
 *
 * What the rule is actually protecting is in the same sentence: unrated
 * "survives every filter floor, because filtering out the unrated makes every
 * new boon invisible". Nothing is dropped here and nothing is hidden. Unrated
 * scores zero, sits among the other zeroes, and loses the tie to anything we
 * had something to say about.
 *
 * Name breaks the last tie so the order is stable between renders rather than
 * depending on the offer's arrival order.
 */
export function order<T extends { score: number; unrated: boolean; id: TraitId }>(
  rated: readonly T[],
  ctx: RuleContext,
): T[] {
  return [...rated].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.unrated !== b.unrated) return a.unrated ? 1 : -1
    const nameA = ctx.traits.get(a.id)?.name ?? a.id
    const nameB = ctx.traits.get(b.id)?.name ?? b.id
    return nameA.localeCompare(nameB)
  })
}

export function rateOffer(
  subjects: readonly Subject[],
  rules: readonly Rule[],
  ctx: RuleContext,
): Rated[] {
  return order(
    subjects.map((subject) => rate(subject, rules, ctx)),
    ctx,
  )
}

/** The whole job in one call, for a caller that has no context yet. */
export function rateFor(
  run: RunContext,
  traits: TraitIndex,
  subjects: readonly Subject[],
  rules: readonly Rule[],
): Rated[] {
  return rateOffer(subjects, rules, ruleContext(run, traits))
}

/**
 * What a rating is worth saying out loud, in one line.
 *
 * The strongest firing, not a summary of all of them: a card has room for one
 * sentence and the one that moved the score most is the one that earned it.
 * Ties go to the rule declared first, which is the order a curator put them in.
 */
export function headline(rated: Rated): string | null {
  if (!rated.firings.length) return null
  let best = rated.firings[0]
  if (!best) return null
  for (const firing of rated.firings) {
    if (Math.abs(firing.delta) > Math.abs(best.delta)) best = firing
  }
  return best.say
}
