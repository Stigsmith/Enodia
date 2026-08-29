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
 * Rate a whole offer and order it.
 *
 * Highest first. **Unrated sorts last but is never dropped**, which
 * `DESIGN.md` 8 requires by name: filtering out the unrated makes every new
 * boon invisible, and a new boon is exactly the thing a player most wants to
 * see. Ties break on the trait's own name so the order is stable between
 * renders rather than depending on the offer's arrival order.
 */
export function rateOffer(
  subjects: readonly Subject[],
  rules: readonly Rule[],
  ctx: RuleContext,
): Rated[] {
  return subjects
    .map((subject) => rate(subject, rules, ctx))
    .sort((a, b) => {
      if (a.unrated !== b.unrated) return a.unrated ? 1 : -1
      if (b.score !== a.score) return b.score - a.score
      const nameA = ctx.traits.get(a.id)?.name ?? a.id
      const nameB = ctx.traits.get(b.id)?.name ?? b.id
      return nameA.localeCompare(nameB)
    })
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
