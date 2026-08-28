/**
 * Reachability. The engine no other Hades II tool has.
 *
 * One question: given what you hold and how many Exits are left, which builds
 * are still live, and which died without the game telling you. `DESIGN.md` 4 is
 * the specification and every mechanic below traces to a named symbol in the
 * game's Lua.
 *
 * The order matters. DEAD is computed first, because it is the state players
 * most need and least expect, and it is the only one that is a proof rather
 * than a judgement. It renders even if every other engine is switched off.
 *
 * Pure. No react, no storage, no fetch.
 */

import type { Build, GodId, RunContext, Trait, TraitId, TraitIndex } from '../data/types.ts'
import { canBeOffered } from './slots.ts'

export type ReachState = 'ON_TRACK' | 'REACHABLE' | 'AT_RISK' | 'DEAD'

/**
 * No percentages. The game data carries `Weight` and `PriorityChance`, so a
 * real offer model may be recoverable later, and until it is measured a band is
 * honest where an invented number is not.
 */
export type Band = 'Likely' | 'Possible' | 'Long shot'

export type Verdict = {
  target: TraitId
  state: ReachState
  /** null when the target is already satisfied or already dead */
  band: Band | null
  /** one array of still-live options per unsatisfied set */
  needs: TraitId[][]
  /** exact set-cover lower bound on new traits required */
  minPicks: number
  /** what is standing in the way, when something is */
  blockedBy: TraitId[]
  /** mandatory. never render a state without it */
  why: string
}

// ---------------------------------------------------------------------------
// Obtainability, which is where every mechanic lands
// ---------------------------------------------------------------------------

export type Route =
  /** already in hand */
  | 'held'
  /** can appear in a normal offer */
  | 'offer'
  /**
   * Only through a replacement offer, because its slot is occupied.
   * `GetReplacementTraits` at `BoonData.ReplaceChance` 0.1, after two completed
   * runs. Live, and long odds. Never call this dead.
   */
  | 'swap'
  /** provably not obtainable in this run */
  | 'dead'

export type Obtainability = { route: Route; why: string }

const OBTAINABLE: readonly Route[] = ['held', 'offer', 'swap']

/**
 * Whether the Olympian pool can still produce this trait.
 *
 * `ReachedMaxGods` counts `LootTypeHistory` entries whose loot carries
 * `GodLoot`, against `CurrentRun.MaxGodsPerRun or HeroData.MaxGodsPerRun`. At
 * the cap the Exit pool freezes to the Olympians already taken. Hermes, Chaos,
 * Selene and the Encounter gods never counted, so their traits are never gated
 * by this.
 */
function godPoolAllows(trait: Trait, ctx: RunContext, traits: TraitIndex): boolean {
  const olympians = trait.gods.filter((god) => ctx.olympians.includes(god))
  if (!olympians.length) return true

  const taken = olympiansTaken(ctx, traits)
  if (taken.length < ctx.maxOlympians) return true
  return olympians.some((god) => taken.includes(god))
}

/**
 * The Olympians this run has spent, read from the boons in hand as well as from
 * `godsTaken`.
 *
 * Holding a god's boon means that god was picked up, so deriving it removes a
 * whole class of wrong answer from a context that forgot to record one. The
 * field stays because a god can be taken without a boon in hand.
 */
export function olympiansTaken(ctx: RunContext, traits: TraitIndex): GodId[] {
  const taken = new Set<GodId>(ctx.godsTaken.filter((god) => ctx.olympians.includes(god)))
  for (const held of ctx.held) {
    for (const god of traits.get(held.id)?.gods ?? []) {
      if (ctx.olympians.includes(god)) taken.add(god)
    }
  }
  return [...taken]
}

/** Every god this run has met: offered, taken, or already feeding a held boon. */
export function godsMet(ctx: RunContext, traits: TraitIndex): Set<GodId> {
  const met = new Set<GodId>([...ctx.godsSeen, ...ctx.godsTaken])
  for (const held of ctx.held) {
    for (const god of traits.get(held.id)?.gods ?? []) met.add(god)
  }
  return met
}

/**
 * Can this trait still arrive, and by what route.
 *
 * Memoised on trait id with a visited set, because prerequisite chains share
 * nodes and a cycle in the data must not become a stack overflow.
 */
export function obtainability(
  traitId: TraitId,
  ctx: RunContext,
  traits: TraitIndex,
  memo: Map<TraitId, Obtainability> = new Map(),
  visiting: Set<TraitId> = new Set(),
): Obtainability {
  const cached = memo.get(traitId)
  if (cached) return cached

  const record = (result: Obtainability): Obtainability => {
    memo.set(traitId, result)
    return result
  }

  if (ctx.held.some((h) => h.id === traitId)) return record({ route: 'held', why: 'Already held.' })

  const trait = traits.get(traitId)
  if (!trait) {
    return record({ route: 'dead', why: `${traitId} is not in the trait data.` })
  }
  const label = trait.name ?? trait.id

  // A cycle. Treat it as unobtainable rather than recursing, and say so, since
  // a real cycle in the prerequisite data is a bug worth seeing.
  if (visiting.has(traitId)) {
    return { route: 'dead', why: `${label} depends on itself.` }
  }

  if (trait.requiredWeapon && ctx.weapon && trait.requiredWeapon !== ctx.weapon) {
    return record({ route: 'dead', why: `${label} belongs to another weapon.` })
  }

  if (!godPoolAllows(trait, ctx, traits)) {
    const gods = trait.gods.join(' or ')
    return record({
      route: 'dead',
      why: `Your ${ctx.maxOlympians} Olympians are settled and ${gods} is not among them.`,
    })
  }

  // Its own prerequisites, if it has any. A trait whose requirement is dead
  // cannot arrive however open its slot is.
  if (trait.requires) {
    visiting.add(traitId)
    const sets = requirementSets(trait.requires)
    const deadSet = sets.find((set) =>
      set.every((member) => !OBTAINABLE.includes(obtainability(member, ctx, traits, memo, visiting).route)),
    )
    visiting.delete(traitId)
    if (deadSet) {
      return record({ route: 'dead', why: `${label} needs a set that has nothing live left in it.` })
    }
  }

  // The slot. This is the lockout, and it is the one clause that returns swap.
  const offer = canBeOffered(traitId, ctx.held, traits)
  if (offer.route === 'locked') return record({ route: 'dead', why: offer.why })
  if (offer.route === 'swap') return record({ route: 'swap', why: offer.why })

  return record({ route: 'offer', why: offer.why })
}

/**
 * `HasTraitRequirements`, as a pure function.
 *
 * OneOf wants one member held. OneFromEachSet wants one from every set. A trait
 * with no requirement is always satisfied.
 */
export function satisfiesRequirement(requires: Trait['requires'], held: ReadonlySet<TraitId>): boolean {
  if (!requires) return true
  return requirementSets(requires).every((set) => set.some((id) => held.has(id)))
}

/** Both requirement forms as a list of sets. OneOf is one set of options. */
export function requirementSets(requires: NonNullable<Trait['requires']>): TraitId[][] {
  return 'oneOf' in requires ? [requires.oneOf] : requires.oneFromEachSet
}

// ---------------------------------------------------------------------------
// minPicks, exactly rather than greedily
// ---------------------------------------------------------------------------

/**
 * The fewest new traits that would satisfy every unsatisfied set.
 *
 * Solved exactly. One trait can sit in two sets at once, and a greedy count
 * overstates the cost, which would report AT_RISK on builds that are
 * comfortably reachable. With at most three sets the search is trivial.
 */
export function minimumPicks(sets: TraitId[][]): number {
  if (!sets.length) return 0
  const candidates = [...new Set(sets.flat())]
  const covers = (chosen: TraitId[]) => sets.every((set) => set.some((id) => chosen.includes(id)))

  for (let size = 1; size <= sets.length; size += 1) {
    const found = combinations(candidates, size).some(covers)
    if (found) return size
  }
  return sets.length
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  const out: T[][] = []
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([item, ...rest])
  })
  return out
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export function verdictFor(
  target: TraitId,
  ctx: RunContext,
  traits: TraitIndex,
  memo: Map<TraitId, Obtainability> = new Map(),
): Verdict {
  const trait = traits.get(target)
  const label = trait?.name ?? target
  const empty = { target, needs: [], minPicks: 0, blockedBy: [] }

  if (!trait) {
    return { ...empty, state: 'DEAD', band: null, why: `${target} is not in the trait data.` }
  }
  if (ctx.held.some((h) => h.id === target)) {
    return { ...empty, state: 'ON_TRACK', band: null, why: `${label} is yours.` }
  }
  if (!trait.requires) {
    const route = obtainability(target, ctx, traits, memo)
    const live = OBTAINABLE.includes(route.route)
    return {
      ...empty,
      state: live ? 'REACHABLE' : 'DEAD',
      band: live ? (route.route === 'swap' ? 'Long shot' : 'Likely') : null,
      minPicks: live ? 1 : 0,
      why: route.why,
    }
  }

  const sets = requirementSets(trait.requires)
  const held = new Set(ctx.held.map((h) => h.id))

  const unsatisfied: TraitId[][] = []
  const blockedBy: TraitId[] = []
  let needsASwap = false

  for (const set of sets) {
    if (set.some((id) => held.has(id))) continue

    const live: TraitId[] = []
    let normalRoute = false
    for (const id of set) {
      const route = obtainability(id, ctx, traits, memo)
      if (route.route === 'offer' || route.route === 'held') normalRoute = true
      if (OBTAINABLE.includes(route.route)) live.push(id)
    }
    // Only a set with nothing but swaps left in it forces a swap. One option
    // that can still arrive normally makes the whole set an ordinary ask, and
    // saying otherwise would call a routine build a long shot.
    if (live.length && !normalRoute) needsASwap = true

    // DEAD first, and it is a proof: this set has nothing left that can arrive.
    if (!live.length) {
      for (const id of set) {
        const blocker = canBeOffered(id, ctx.held, traits).blockedBy
        if (blocker && !blockedBy.includes(blocker)) blockedBy.push(blocker)
      }
      return {
        target,
        state: 'DEAD',
        band: null,
        needs: [],
        minPicks: 0,
        blockedBy,
        why: deadReason(label, set, ctx, traits, memo),
      }
    }
    unsatisfied.push(live)
  }

  if (!unsatisfied.length) {
    return { ...empty, state: 'ON_TRACK', band: null, why: `Every prerequisite for ${label} is in hand.` }
  }

  const minPicks = minimumPicks(unsatisfied)
  const unseenGods = requiredUnseenGods(unsatisfied, ctx, traits)

  const tooFewExits = minPicks > ctx.exitsLeft
  const noSlack = unseenGods.length > 0 && ctx.exitsLeft <= minPicks
  const state: ReachState = tooFewExits || noSlack ? 'AT_RISK' : 'REACHABLE'

  return {
    target,
    state,
    band: bandFor({ minPicks, exitsLeft: ctx.exitsLeft, needsASwap, unseenGods: unseenGods.length }),
    needs: unsatisfied,
    minPicks,
    blockedBy,
    why: reason({ label, state, minPicks, ctx, needsASwap, unseenGods }),
  }
}

/** Which gods an unsatisfied set still depends on that have not been seen. */
function requiredUnseenGods(sets: TraitId[][], ctx: RunContext, traits: TraitIndex): GodId[] {
  const met = godsMet(ctx, traits)
  const unseen = new Set<GodId>()
  for (const set of sets) {
    const gods = new Set(set.flatMap((id) => traits.get(id)?.gods ?? []))
    // Only a set that depends entirely on gods you have not met is at risk.
    // One live option from a god already met is enough to make the set safe.
    if (![...gods].some((god) => met.has(god))) {
      for (const god of gods) unseen.add(god)
    }
  }
  return [...unseen]
}

/**
 * Bands come from countable facts and nothing else: picks needed against Exits
 * left, whether a swap is involved, and whether a god is still unmet.
 *
 * The cap is never a band. Whether a god can appear at all is a fact, decided
 * in obtainability, and rendering it as "unlikely" would be a lie.
 */
export function bandFor(facts: {
  minPicks: number
  exitsLeft: number
  needsASwap: boolean
  unseenGods: number
}): Band {
  if (facts.needsASwap) return 'Long shot'
  if (facts.minPicks > facts.exitsLeft) return 'Long shot'
  if (facts.minPicks * 2 <= facts.exitsLeft && facts.unseenGods === 0) return 'Likely'
  return 'Possible'
}

function deadReason(
  label: string,
  set: TraitId[],
  ctx: RunContext,
  traits: TraitIndex,
  memo: Map<TraitId, Obtainability>,
): string {
  // Name the first cause rather than listing all of them. The player needs to
  // know what killed it, not an inventory.
  const first = set[0]
  const cause = first ? obtainability(first, ctx, traits, memo).why : ''
  const slotBlocked = set
    .map((id) => canBeOffered(id, ctx.held, traits))
    .find((offer) => offer.route === 'locked')
  if (slotBlocked) {
    return `${label} is dead. ${slotBlocked.why}`
  }
  return `${label} is dead. ${cause}`
}

function reason(args: {
  label: string
  state: ReachState
  minPicks: number
  ctx: RunContext
  needsASwap: boolean
  unseenGods: GodId[]
}): string {
  const { label, state, minPicks, ctx, needsASwap, unseenGods } = args
  const picks = minPicks === 1 ? 'one more pick' : `${minPicks} more picks`
  const exits = ctx.exitsLeft === 1 ? 'one Exit' : `${ctx.exitsLeft} Exits`

  if (state === 'AT_RISK' && minPicks > ctx.exitsLeft) {
    return `${label} needs ${picks} and you have ${exits} left.`
  }
  if (state === 'AT_RISK') {
    return `${label} needs ${picks}, and ${unseenGods.join(' or ')} has not turned up yet.`
  }
  if (needsASwap) {
    return `${label} needs ${picks}, and one of them has to come as a swap into a slot you have filled.`
  }
  return `${label} needs ${picks}, with ${exits} left.`
}

/**
 * Every target, most urgent first: DEAD, then AT_RISK, then the rest.
 *
 * The memo is shared across targets on purpose. Duos and legendaries lean on
 * the same core boons, so the second target is nearly free.
 */
export function reachable(ctx: RunContext, traits: TraitIndex, targets?: readonly TraitId[]): Verdict[] {
  const memo = new Map<TraitId, Obtainability>()
  const list =
    targets ??
    [...traits.values()].filter((trait) => trait.kind === 'duo' || trait.kind === 'legendary').map((t) => t.id)

  const order: Record<ReachState, number> = { DEAD: 0, AT_RISK: 1, REACHABLE: 2, ON_TRACK: 3 }
  return list
    .map((target) => verdictFor(target, ctx, traits, memo))
    .sort((a, b) => order[a.state] - order[b.state] || a.minPicks - b.minPicks || a.target.localeCompare(b.target))
}

// ---------------------------------------------------------------------------
// Builds. A combination rather than one boon.
// ---------------------------------------------------------------------------

/**
 * Is this build still live, and what does it still need.
 *
 * Exactly the same question as for a duo, with more sets: the aspect it is
 * built on, every hammer upgrade it wants, and the boons. A build is dead the
 * moment any one of those sets has nothing live in it, which is why an aspect
 * chosen at setup can settle a build's fate before the first Exit.
 */
export function verdictForBuild(build: Build, ctx: RunContext, traits: TraitIndex): Verdict {
  const sets = [...build.requires]
  if (build.aspect) sets.push([build.aspect])
  for (const hammer of build.hammers ?? []) sets.push([hammer])

  // A build is judged through the same code as everything else, by handing the
  // engine a trait shaped like one. No second implementation of set cover.
  const asTrait: Trait = {
    id: build.id,
    name: build.name,
    kind: 'other',
    slot: null,
    altSlot: null,
    gods: build.gods?.core ?? [],
    requiredWeapon: null,
    requires: { oneFromEachSet: sets },
    text: build.say,
  }

  const index = new Map(traits)
  index.set(build.id, asTrait)
  return verdictFor(build.id, ctx, index)
}

// ---------------------------------------------------------------------------
// God priority, rolled up from the verdicts. DESIGN.md 4.4.
// ---------------------------------------------------------------------------

export type GodVerdict = {
  god: GodId
  score: number
  /** live targets this god still feeds */
  keeps: TraitId[]
  /** targets that die if this god takes the last Olympian slot */
  kills: TraitId[]
  why: string
}

/**
 * Rank the gods by what they keep alive, derived entirely from `reachable`.
 *
 * No new data and no new judgement. A god scores for every live target whose
 * unsatisfied sets it can still feed, weighted by proximity so a target one
 * pick away counts for more than one three picks away.
 *
 * `kills` is the half that matters at the last Olympian slot: taking this god
 * settles the pool, and every target needing a god outside it dies on the spot.
 */
export function godPriority(ctx: RunContext, traits: TraitIndex, targets?: readonly TraitId[]): GodVerdict[] {
  const taken = olympiansTaken(ctx, traits)
  // At the cap the Exit pool is frozen to the Olympians already held, so there
  // is nothing to rank. That is a fact, not a low score.
  if (taken.length >= ctx.maxOlympians) return []

  const verdicts = reachable(ctx, traits, targets).filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK')
  const candidates = ctx.olympians.filter((god) => !taken.includes(god))
  const lastSlot = taken.length === ctx.maxOlympians - 1

  return candidates
    .map((god) => {
      const keeps: TraitId[] = []
      const kills: TraitId[] = []
      let score = 0

      for (const verdict of verdicts) {
        const feeds = verdict.needs.some((set) =>
          set.some((id) => traits.get(id)?.gods.includes(god) ?? false),
        )
        if (feeds) {
          keeps.push(verdict.target)
          score += 1 / Math.max(1, verdict.minPicks)
          continue
        }
        // Taking this god as the last Olympian settles the pool. Anything that
        // still needs a god outside it dies at that moment.
        if (lastSlot) {
          const needsOutside = verdict.needs.some((set) =>
            set.every((id) => {
              const gods = traits.get(id)?.gods.filter((g) => ctx.olympians.includes(g)) ?? []
              return gods.length > 0 && !gods.some((g) => taken.includes(g) || g === god)
            }),
          )
          if (needsOutside) kills.push(verdict.target)
        }
      }

      return {
        god,
        score: +score.toFixed(3),
        keeps,
        kills,
        why: godReason(god, keeps, kills, lastSlot),
      }
    })
    .sort((a, b) => b.score - a.score || a.kills.length - b.kills.length || a.god.localeCompare(b.god))
}

function godReason(god: GodId, keeps: TraitId[], kills: TraitId[], lastSlot: boolean): string {
  // "targets" was jargon and "builds" was worse: a duo is one boon with
  // prerequisites, not a build. Say what they are.
  const kept = keeps.length === 1 ? '1 duo or legendary still open' : `${keeps.length} duos and legendaries`
  if (lastSlot && kills.length) {
    const killed = kills.length === 1 ? '1 of them' : `${kills.length} others`
    return `${god} feeds ${kept}, and spends your last Olympian slot, which closes ${killed}.`
  }
  if (!keeps.length) return `${god} feeds nothing that is still open.`
  return `${god} feeds ${kept}.`
}
