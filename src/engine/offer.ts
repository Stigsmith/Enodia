/**
 * The offer. What is on the table, ranked, and what each one costs.
 *
 * `DESIGN.md` 10 step 11, and `DESIGN.md` 8: three cards and three sentences,
 * never a table, game art on every card.
 *
 * The ranking is `engine/rating.ts`. What this adds is **the reject verdict**,
 * which is the half of the question the rating cannot answer: not "how good is
 * this" but "what does taking it close". A boon can score well and still be
 * the pick that kills four duos, and a player deciding at an Exit has four
 * seconds and needs both halves in front of them.
 *
 * ## Why this is not free
 *
 * Answering it means asking reachability what the run would look like *after*
 * each candidate: 47 targets per candidate, on a list that can be a dozen long.
 * There is no cheaper exact answer, because whether a target dies depends on
 * the whole slot picture rather than on the candidate alone.
 *
 * So it is computed once per offer and memoised by trait and rarity, which is
 * the same key `DESIGN.md` 5 rates on: a Common and a Heroic version of one
 * boon really are different cards, and only the Heroic one shuts its slot.
 *
 * Pure.
 */

import { order, rate } from './rating.ts'
import { ruleContext } from './rules.ts'
import type { Rated } from './rating.ts'
import type { Rule, RuleContext, Subject } from './rules.ts'
import { reachable } from './reachability.ts'
import type { RunContext, TraitId, TraitIndex } from '../data/types.ts'

export type Judged = {
  subject: Subject
  rated: Rated
  /** targets that are live now and would be dead after taking this */
  closes: TraitId[]
  /** targets that would have every prerequisite in hand after taking this */
  completes: TraitId[]
  /** the one line a card shows, or null when nothing had anything to say */
  say: string | null
}

/** The states that count as still on the table. */
const LIVE = new Set(['REACHABLE', 'AT_RISK'])

/**
 * What taking this would do to everything still open.
 *
 * Both halves come out of one pass. A target that moves from live to DEAD is a
 * cost; one that moves from live to ON_TRACK is the whole point.
 */
function consequences(
  subject: Subject,
  ctx: RuleContext,
): { closes: TraitId[]; completes: TraitId[] } {
  const after: RunContext = {
    ...ctx.run,
    held: [...ctx.run.held, { id: subject.id, rarity: subject.rarity }],
    godsTaken:
      subject.god && !ctx.run.godsTaken.includes(subject.god)
        ? [...ctx.run.godsTaken, subject.god]
        : ctx.run.godsTaken,
    // An Exit is spent to take it, and a target that only dies because of the
    // clock would die whatever was picked. Holding the clock still keeps this
    // answering "what does *this boon* close" rather than "what does time".
    exitsLeft: ctx.run.exitsLeft,
  }

  const now = new Map(ctx.verdicts.map((verdict) => [verdict.target, verdict.state]))
  const closes: TraitId[] = []
  const completes: TraitId[] = []

  for (const verdict of reachable(after, ctx.traits)) {
    const before = now.get(verdict.target)
    if (!before || !LIVE.has(before)) continue
    if (verdict.state === 'DEAD') closes.push(verdict.target)
    else if (verdict.state === 'ON_TRACK') completes.push(verdict.target)
  }

  return { closes, completes }
}

/**
 * Judge one offer.
 *
 * Order is the rating's: best first, unrated last and never dropped. What a
 * pick closes deliberately does **not** reorder anything. It is stated on the
 * card and the player decides, because how much a closed duo costs depends on
 * whether they wanted it, and that is not ours to weigh.
 */
export function judgeOffer(
  subjects: readonly Subject[],
  rules: readonly Rule[],
  ctx: RuleContext,
): Judged[] {
  const memo = new Map<string, { closes: TraitId[]; completes: TraitId[] }>()

  const judged = subjects.map((subject) => {
    const key = `${subject.id}|${subject.rarity}`
    let effect = memo.get(key)
    if (!effect) {
      effect = consequences(subject, ctx)
      memo.set(key, effect)
    }
    const rated = rate(subject, rules, ctx)
    return { subject, rated, ...effect, say: sayFor(rated, effect, ctx) }
  })

  // One ordering, in rating.ts, so the offer block and anything else that ever
  // ranks a list cannot disagree about where unrated goes.
  return order(
    judged.map((entry) => ({ ...entry, score: entry.rated.score, unrated: entry.rated.unrated, id: entry.subject.id })),
    ctx,
  )
}

/**
 * What is true of every card in an offer, and therefore of none of them.
 *
 * **An offer block exists to differentiate.** Anything that holds for every
 * candidate cannot help a player choose between them, and printed nine times
 * it drowns the one card that really is different.
 *
 * Two things turned out to do this, and they had the same shape:
 *
 * - **Cost.** Taking a fourth Olympian settles the pool and kills three dozen
 *   duos, whichever of their boons you take.
 * - **Sentences.** "Taking this spends one of your four Olympian slots" fires
 *   on every boon that god has, for the same reason.
 *
 * So both are lifted out together. `DESIGN.md` 8: every warning is
 * conditioned, and the condition here is the god rather than the boon.
 */
export type Common = {
  /** targets every candidate would close */
  closes: TraitId[]
  /** sentences every candidate carries */
  says: string[]
}

/**
 * What every list has in common.
 *
 * **Empty below two lists**, and that is not a detail. With one list there is
 * nothing to have anything in common *with*, and returning that list instead
 * meant a single-card offer had its only sentence lifted off it as "shared" and
 * rendered as silence. `commonTo` guarded for it; `differentiate` recomputed
 * and did not.
 */
function intersect<T>(lists: readonly (readonly T[])[]): T[] {
  if (lists.length < 2) return []
  const [first, ...rest] = lists
  if (!first) return []
  let shared = new Set(first)
  for (const list of rest) {
    const here = new Set(list)
    shared = new Set([...shared].filter((item) => here.has(item)))
    if (!shared.size) break
  }
  return [...shared]
}

export function commonTo(judged: readonly Judged[]): Common {
  // Two cards is the fewest that can share anything, which `intersect` now
  // enforces for every caller rather than only this one.
  const shared = intersect(judged.map((entry) => entry.rated.says))

  // A rule lifted above the cards says it in the plural if it knows how.
  const plural = new Map<string, string>()
  for (const entry of judged) {
    for (const firing of entry.rated.firings) {
      if (firing.rule.sayAll) plural.set(firing.say, firing.rule.sayAll)
    }
  }

  return {
    closes: intersect(judged.map((entry) => entry.closes)),
    says: shared.map((say) => plural.get(say) ?? say),
  }
}

/** Kept for the cost alone, which is what the surface asks for separately. */
export const sharedCost = (judged: readonly Judged[]): TraitId[] => commonTo(judged).closes

/** What this one closes that its neighbours would not. */
export const marginalCost = (entry: Judged, shared: readonly TraitId[]): TraitId[] => {
  const floor = new Set(shared)
  return entry.closes.filter((id) => !floor.has(id))
}

/**
 * The offer with everything shared lifted off the cards.
 *
 * Each card's sentence is recomputed from what is left, so a card whose only
 * sentence was the shared one falls back to silence rather than to a repeat.
 * Silence is the normal state and an honest one.
 */
export function differentiate(judged: readonly Judged[]): { common: Common; cards: Judged[] } {
  const common = commonTo(judged)
  // Matched on what the cards actually say, since `common.says` may already
  // have been swapped for the plural phrasing.
  const shared = new Set(intersect(judged.map((entry) => entry.rated.says)))
  const floor = new Set(common.closes)

  const cards = judged.map((entry) => {
    const kept = entry.rated.firings.filter((firing) => !shared.has(firing.say))
    if (kept.length === entry.rated.firings.length && !floor.size) return entry

    const completes = entry.completes
    let say: string | null = null
    if (completes.length === 1) say = entry.say
    else if (completes.length > 1) say = entry.say
    else if (kept.length) {
      let best = kept[0]
      for (const firing of kept) if (Math.abs(firing.delta) > Math.abs(best!.delta)) best = firing
      say = best?.say ?? null
    }

    return { ...entry, say, closes: entry.closes.filter((id) => !floor.has(id)) }
  })

  return { common, cards }
}

/**
 * The one line a card shows.
 *
 * A completion outranks everything: finishing a duo is the strongest thing that
 * can be said about a pick and it is a fact rather than a score. After that the
 * strongest firing, and after that nothing, because "this is a boon" is not a
 * sentence worth the space.
 */
function sayFor(
  rated: Rated,
  effect: { closes: TraitId[]; completes: TraitId[] },
  ctx: RuleContext,
): string | null {
  const name = (id: TraitId) => ctx.traits.get(id)?.name ?? id

  if (effect.completes.length === 1) return `Completes ${name(effect.completes[0] as TraitId)}.`
  if (effect.completes.length > 1) {
    return `Completes ${effect.completes.length} at once: ${effect.completes.map(name).join(', ')}.`
  }

  if (!rated.firings.length) return null
  let best = rated.firings[0]
  if (!best) return null
  for (const firing of rated.firings) {
    if (Math.abs(firing.delta) > Math.abs(best.delta)) best = firing
  }
  return best.say
}

/** The whole job for a caller with only a run. */
export function judgeFor(
  run: RunContext,
  traits: TraitIndex,
  subjects: readonly Subject[],
  rules: readonly Rule[],
): Judged[] {
  return judgeOffer(subjects, rules, ruleContext(run, traits))
}
