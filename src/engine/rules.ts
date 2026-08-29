/**
 * Rules, as data.
 *
 * `DESIGN.md` 5: rules are JSON, not code. This file is the vocabulary they
 * are written in and the machine that evaluates them, and it contains no rule.
 * The rules live in `data/curated/rules.json` and every one carries a `say`,
 * which the validator enforces, because the Exit surface renders the sentence
 * and never the number.
 *
 * ## Why a rule quantifies
 *
 * The rule the whole design turns on is:
 *
 * ```json
 * { "when": { "reachable": ["$target"] },
 *   "match": { "prerequisiteFor": ["$target"] },
 *   "delta": 25,
 *   "say": "This is the last piece of a duo still on the table." }
 * ```
 *
 * `$target` appears in both halves and has to mean the same thing in each, or
 * the rule says something much weaker: that *some* duo is live and this boon
 * feeds *some* duo, which on 47 live targets is nearly everything. So a rule
 * declares what it binds, the evaluator tries each candidate in turn, and the
 * first binding that satisfies both halves is the one that fires and the one
 * the sentence is about.
 *
 * That is the difference between a rule that earns its space and a rule that
 * fires on 86 percent of runs. `scripts/health.ts` exists to catch the second
 * kind before it ships, measured against random legal runs rather than against
 * the builds we chose.
 *
 * Pure. No react, no storage, no fetch.
 */

import { reachable, verdictFor } from './reachability.ts'
import { CORE_SLOTS, canBeOffered, slotStates } from './slots.ts'
import type { ReachState, Verdict } from './reachability.ts'
import type { GodId, Rarity, RunContext, Slot, TraitId, TraitIndex } from '../data/types.ts'

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

/** A trait id, or `$target` meaning "whatever this rule is bound to". */
export type TraitRef = string

/**
 * What a rule asks about the run.
 *
 * Every field is optional and every field present must hold. There is no `or`,
 * on purpose: a rule that needs one is two rules, and two rules can be
 * measured separately.
 */
export type ContextPredicate = {
  /** the bound target is still live, in one of these states */
  reachable?: ReachState[]
  /** the bound target needs at most this many more picks */
  minPicksAtMost?: number
  /** these core slots are empty */
  slotOpen?: Slot[]
  /** these core slots are filled */
  slotFilled?: Slot[]
  /** at most this many Exits remain */
  exitsLeftAtMost?: number
  /** at least this many Exits remain */
  exitsLeftAtLeast?: number
  /** the Olympian cap is reached, so the Exit pool is frozen */
  atGodCap?: boolean
  /** the run holds all of these */
  holds?: TraitId[]
  /** the run holds none of these */
  lacks?: TraitId[]
}

/** What a rule asks about the boon being judged. */
export type SubjectPredicate = {
  /** it is named in one of the bound target's prerequisite sets */
  prerequisiteFor?: TraitRef[]
  /** it occupies one of these core slots */
  slot?: Slot[]
  /** it occupies no core slot at all */
  slotless?: boolean
  /** it is offered by one of these gods */
  god?: GodId[]
  /** it is one of these kinds */
  kind?: string[]
  /** it is being offered at one of these rarities */
  rarity?: Rarity[]
  /**
   * Taking it would spend an Olympian slot the run has not spent yet.
   *
   * `ReachedMaxGods` counts pickups carrying `GodLoot`, so this is only true
   * of an Olympian the run has not taken from before.
   */
  spendsAGodSlot?: boolean
  /** it would shut its slot outright: nothing above Heroic to upgrade into */
  shutsItsSlot?: boolean
}

export type Rule = {
  id: string
  /** what this rule binds `$target` over. Absent means it binds nothing */
  each?: 'liveTarget'
  when?: ContextPredicate
  /** absent means the rule is about the run rather than about any boon */
  match?: SubjectPredicate
  /** points. No floors, no ceilings: DESIGN.md 5 */
  delta: number
  /** mandatory, and the only thing a player is ever shown */
  say: string
  /**
   * How to say it when it is true of every card in an offer.
   *
   * `say` is written for one card and reads "taking this". Lifted above nine
   * cards by `offer.ts differentiate`, "this" no longer refers to anything.
   * A rule that expects to be hoisted supplies the other phrasing rather than
   * having its sentence rewritten by string surgery, which would break the
   * first time somebody wrote one that did not fit the pattern.
   */
  sayAll?: string
  source: 'curator' | 'wiki' | 'source'
}

/** A rule that fired, with the binding that made it fire. */
export type Firing = {
  rule: Rule
  delta: number
  say: string
  /** the target `$target` was bound to, when the rule binds one */
  target: TraitId | null
}

/** The boon being judged. `DESIGN.md` 5: ratings are keyed by trait and rarity. */
export type Subject = { id: TraitId; rarity: Rarity; god: GodId | null }

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Everything the predicates read, computed once per Exit rather than per rule.
 *
 * Reachability over 47 targets is the expensive thing this app does, and a
 * dozen rules against a dozen offers would otherwise run it 144 times.
 */
export type RuleContext = {
  run: RunContext
  traits: TraitIndex
  verdicts: Verdict[]
  byTarget: Map<TraitId, Verdict>
  openSlots: Set<Slot>
  filledSlots: Set<Slot>
  held: Set<TraitId>
  atGodCap: boolean
}

export function ruleContext(run: RunContext, traits: TraitIndex): RuleContext {
  const verdicts = reachable(run, traits)
  const states = slotStates(run.held, traits)
  const openSlots = new Set<Slot>()
  const filledSlots = new Set<Slot>()
  for (const slot of CORE_SLOTS) {
    if (states.get(slot)?.occupant) filledSlots.add(slot)
    else openSlots.add(slot)
  }

  const olympiansHeld = new Set(
    run.held.flatMap((entry) => traits.get(entry.id)?.gods ?? []).filter((god) => run.olympians.includes(god)),
  )

  return {
    run,
    traits,
    verdicts,
    byTarget: new Map(verdicts.map((verdict) => [verdict.target, verdict])),
    openSlots,
    filledSlots,
    held: new Set(run.held.map((entry) => entry.id)),
    atGodCap: olympiansHeld.size >= run.maxOlympians,
  }
}

/** Every prerequisite named anywhere in a target's requirement. */
export function prerequisitesOf(target: TraitId, traits: TraitIndex): Set<TraitId> {
  const requires = traits.get(target)?.requires
  if (!requires) return new Set()
  if ('oneOf' in requires) return new Set(requires.oneOf)
  return new Set(requires.oneFromEachSet.flat())
}

function contextHolds(when: ContextPredicate | undefined, ctx: RuleContext, target: TraitId | null): boolean {
  if (!when) return true

  if (when.reachable) {
    if (!target) return false
    const verdict = ctx.byTarget.get(target)
    if (!verdict || !when.reachable.includes(verdict.state)) return false
  }
  if (when.minPicksAtMost !== undefined) {
    if (!target) return false
    const verdict = ctx.byTarget.get(target)
    if (!verdict || verdict.minPicks > when.minPicksAtMost) return false
  }
  if (when.slotOpen && !when.slotOpen.every((slot) => ctx.openSlots.has(slot))) return false
  if (when.slotFilled && !when.slotFilled.every((slot) => ctx.filledSlots.has(slot))) return false
  if (when.exitsLeftAtMost !== undefined && ctx.run.exitsLeft > when.exitsLeftAtMost) return false
  if (when.exitsLeftAtLeast !== undefined && ctx.run.exitsLeft < when.exitsLeftAtLeast) return false
  if (when.atGodCap !== undefined && ctx.atGodCap !== when.atGodCap) return false
  if (when.holds && !when.holds.every((id) => ctx.held.has(id))) return false
  if (when.lacks && when.lacks.some((id) => ctx.held.has(id))) return false
  return true
}

/**
 * Whether taking this would spend an Olympian slot that is not already spent.
 *
 * Free if the god is not an Olympian at all, and free if the run already holds
 * something of theirs: the cap counts gods, not pickups.
 */
function spendsAGodSlot(subject: Subject, ctx: RuleContext): boolean {
  const gods = subject.god ? [subject.god] : (ctx.traits.get(subject.id)?.gods ?? [])
  const olympians = gods.filter((god) => ctx.run.olympians.includes(god))
  if (!olympians.length) return false
  const alreadyHeld = new Set(
    ctx.run.held.flatMap((entry) => ctx.traits.get(entry.id)?.gods ?? []),
  )
  return olympians.every((god) => !alreadyHeld.has(god))
}

/**
 * Whether taking this at this rarity shuts its slot for the rest of the run.
 *
 * `TraitRarityData.RarityUpgradeOrder` ends at Heroic, and `GetReplacementTraits`
 * only offers a swap while the held boon can still be upgraded. So a Heroic
 * boon in a core slot is the one pick in this game that is genuinely final.
 */
function shutsItsSlot(subject: Subject, ctx: RuleContext): boolean {
  if (subject.rarity !== 'Heroic') return false
  const slot = ctx.traits.get(subject.id)?.slot
  return !!slot && CORE_SLOTS.includes(slot)
}

function subjectMatches(
  match: SubjectPredicate | undefined,
  subject: Subject,
  ctx: RuleContext,
  target: TraitId | null,
): boolean {
  if (!match) return true
  const trait = ctx.traits.get(subject.id)

  if (match.prerequisiteFor) {
    const targets = match.prerequisiteFor.map((ref) => (ref === '$target' ? target : ref))
    if (targets.some((id) => !id)) return false
    if (!targets.every((id) => prerequisitesOf(id as TraitId, ctx.traits).has(subject.id))) return false
  }
  if (match.slot) {
    if (!trait?.slot || !match.slot.includes(trait.slot)) return false
  }
  if (match.slotless !== undefined) {
    const inCore = !!trait?.slot && CORE_SLOTS.includes(trait.slot)
    if (match.slotless === inCore) return false
  }
  if (match.god) {
    const gods = subject.god ? [subject.god] : (trait?.gods ?? [])
    if (!gods.some((god) => match.god?.includes(god))) return false
  }
  if (match.kind && (!trait || !match.kind.includes(trait.kind))) return false
  if (match.rarity && !match.rarity.includes(subject.rarity)) return false
  if (match.spendsAGodSlot !== undefined && spendsAGodSlot(subject, ctx) !== match.spendsAGodSlot) return false
  if (match.shutsItsSlot !== undefined && shutsItsSlot(subject, ctx) !== match.shutsItsSlot) return false
  return true
}

/** The targets a rule may bind, best first, so the sentence names the closest. */
function candidates(rule: Rule, ctx: RuleContext): (TraitId | null)[] {
  if (rule.each !== 'liveTarget') return [null]
  return ctx.verdicts
    .filter((verdict) => verdict.state !== 'DEAD' && verdict.state !== 'ON_TRACK')
    .map((verdict) => verdict.target)
}

/**
 * Every rule that fires on this boon, with the binding that made it.
 *
 * A rule fires at most once. It quantifies over targets to find a binding, not
 * to accumulate one delta per target: a boon that feeds four live duos is a
 * better pick than one that feeds one, but saying so four times over is a
 * score that runs away from the sentence explaining it.
 */
export function fire(rules: readonly Rule[], subject: Subject, ctx: RuleContext): Firing[] {
  const out: Firing[] = []
  for (const rule of rules) {
    for (const target of candidates(rule, ctx)) {
      if (!contextHolds(rule.when, ctx, target)) continue
      if (!subjectMatches(rule.match, subject, ctx, target)) continue
      out.push({
        rule,
        delta: rule.delta,
        say: sayFor(rule, target, ctx),
        target,
      })
      break
    }
  }
  return out
}

/** `{target}` in a `say` becomes the bound target's display name. */
export function sayFor(rule: Rule, target: TraitId | null, ctx: RuleContext): string {
  if (!target) return rule.say
  const name = ctx.traits.get(target)?.name ?? target
  return rule.say.replace(/\{target\}/g, name)
}

/**
 * Rules with no `match` are about the run rather than about any boon.
 *
 * `DESIGN.md` 8: every warning is conditioned. These are the conditions, and a
 * warning that cannot state one does not get to exist.
 */
export function runLevel(rules: readonly Rule[], ctx: RuleContext): Firing[] {
  return fire(
    rules.filter((rule) => !rule.match),
    { id: '', rarity: 'Common', god: null },
    ctx,
  )
}

/** Rules that judge a boon, which is the rest of them. */
export const subjectRules = (rules: readonly Rule[]): Rule[] => rules.filter((rule) => !!rule.match)

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const SLOTS = new Set<string>(CORE_SLOTS)
const STATES = new Set<string>(['ON_TRACK', 'REACHABLE', 'AT_RISK', 'DEAD'])

/**
 * Read rules off disk, refusing anything that cannot be trusted.
 *
 * A rule with no `say` is refused because the surface renders the sentence and
 * a score that cannot explain itself is a score nobody should trust. A rule
 * naming a slot or a state that does not exist is refused because it would
 * silently never fire, which looks exactly like a rule that is merely quiet.
 */
export function parseRules(raw: unknown): { rules: Rule[]; problems: string[] } {
  const problems: string[] = []
  // `records` is what data/curated/ calls its array, and every curated file
  // has to answer to the same validator. A bare array and a `rules` key are
  // taken too, because a test fixture should not need the ceremony.
  const doc = raw as { records?: unknown; rules?: unknown }
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(doc?.records)
      ? doc.records
      : Array.isArray(doc?.rules)
        ? doc.rules
        : []

  const rules: Rule[] = []
  const seen = new Set<string>()

  for (const [index, entry] of list.entries()) {
    const where = `rule ${index}`
    if (typeof entry !== 'object' || entry === null) {
      problems.push(`${where} is not an object`)
      continue
    }
    const rule = entry as Partial<Rule>
    if (typeof rule.id !== 'string' || !rule.id) {
      problems.push(`${where} has no id`)
      continue
    }
    if (seen.has(rule.id)) problems.push(`${rule.id} is declared twice`)
    seen.add(rule.id)
    if (typeof rule.say !== 'string' || !rule.say.trim()) {
      problems.push(`${rule.id} has no say, and DESIGN.md 5 makes it mandatory`)
      continue
    }
    if (typeof rule.delta !== 'number' || !Number.isFinite(rule.delta)) {
      problems.push(`${rule.id} has no numeric delta`)
      continue
    }

    for (const slot of [...(rule.when?.slotOpen ?? []), ...(rule.when?.slotFilled ?? []), ...(rule.match?.slot ?? [])]) {
      if (!SLOTS.has(slot)) problems.push(`${rule.id} names slot "${slot}", which is not a core slot`)
    }
    for (const state of rule.when?.reachable ?? []) {
      if (!STATES.has(state)) problems.push(`${rule.id} names state "${state}", which does not exist`)
    }
    if (rule.each && rule.each !== 'liveTarget') {
      problems.push(`${rule.id} binds "${rule.each}", and the only binding is liveTarget`)
    }
    const usesTarget =
      JSON.stringify(rule.when ?? {}).includes('$target') ||
      JSON.stringify(rule.match ?? {}).includes('$target') ||
      rule.say.includes('{target}')
    if (usesTarget && rule.each !== 'liveTarget') {
      problems.push(`${rule.id} refers to a target but binds none`)
    }

    rules.push(rule as Rule)
  }

  return { rules, problems }
}

/** What a slot being shut actually costs, named. Used by the run-level rules. */
export function slotShutBy(subject: Subject, ctx: RuleContext): TraitId[] {
  if (!shutsItsSlot(subject, ctx)) return []
  const slot = ctx.traits.get(subject.id)?.slot
  if (!slot) return []

  // Every live target that still needs somebody else's boon in this slot.
  const dying: TraitId[] = []
  for (const verdict of ctx.verdicts) {
    if (verdict.state === 'DEAD' || verdict.state === 'ON_TRACK') continue
    const needed = prerequisitesOf(verdict.target, ctx.traits)
    for (const id of needed) {
      if (id === subject.id || ctx.held.has(id)) continue
      if (ctx.traits.get(id)?.slot !== slot) continue
      // slots.ts calls a shut slot 'locked'. reachability.ts calls its own
      // route 'dead'. Two vocabularies, and this is the one that owns slots.
      if (canBeOffered(id, [...ctx.run.held, { id: subject.id, rarity: subject.rarity }], ctx.traits).route === 'locked') {
        dying.push(verdict.target)
        break
      }
    }
  }
  return dying
}

/** Judge one target as it stands, for a rule that wants a verdict directly. */
export const verdictOf = (target: TraitId, ctx: RuleContext): Verdict =>
  ctx.byTarget.get(target) ?? verdictFor(target, ctx.run, ctx.traits)
