/**
 * How reachable a build is, as a number and a word.
 *
 * ## The question this answers, and the one it does not
 *
 * `build-check.ts` asks **would the game allow this**. It is a legality check:
 * two boons in one core slot, a hammer for the wrong arm, more Grasp than a
 * save holds. Every Pair passes it, because nothing in Every Pair is illegal.
 *
 * This asks the different question, and it is the one that matters the moment a
 * build is handed to somebody else: **how likely is a person to end a run
 * holding all of it.** A build can be perfectly legal and still be a run nobody
 * is going to have twice.
 *
 * **The two readings are independent and both are worth showing.** A build can
 * be five stars from five thousand people and still read Not in one run. That
 * is not a contradiction, it is a famous build people keep chasing, and the
 * tool should be able to say both things at once rather than letting one
 * number stand in for the other.
 *
 * ## It is not a rating, and it is not a simulation
 *
 * Not a rating. `CLAUDE.md` is clear that evaluations belong to the owner, and
 * "this build is bad" is an evaluation. Nothing here says a build is bad.
 *
 * Not a simulation either, and not because simulating would be slow.
 * `simulateRun` grants at most one boon per Exit and cannot satisfy an aspect
 * or a hammer at all, so a whole-build rate out of it is a floor rather than a
 * measurement, and it would read as a hard zero for exactly the builds this
 * exists to describe.
 *
 * What it is: countable costs, summed, compared against the length of a run.
 *
 * ## The model
 *
 * The shape is the owner's, who plays the game. In a bountiful run you end up
 * holding thirty to forty boons, and maybe five or six of them are load-bearing.
 * So a build listing twenty boons is not a better build than one listing six,
 * it is the same build with filler attached, and every piece of filler is
 * another thing that has to go right.
 *
 * Most of the weights are then read off the data rather than picked, which is
 * the difference between a rule and a guess. Each is documented at the rule
 * that uses it. The through line: **a cost is charged for every way a build
 * narrows what a run is allowed to hand you.**
 */

import { requirementSets } from './reachability.ts'
import { ESTIMATED_EXITS } from '../state/run.ts'
import type { ShownBuild } from '../data/builds.ts'
import type { GodId, Trait, TraitId, TraitIndex } from '../data/types.ts'

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

/**
 * How dependably a build comes together, as the tool reads it.
 *
 * **The first three are `Assembles`, deliberately.** A player already answers
 * this question in the builder, in these words, and `PlayStrip` already shows
 * their answer. Using the same three means the detail view can put the tool's
 * read beside the player's and the two are comparable rather than two scales
 * nobody can line up. The player is right and the reading is context.
 *
 * They were also chosen against the obvious alternative. `easy / medium / hard`
 * reads as how hard the *game* is, which is a claim this makes no attempt to
 * support and which would tell a new player something false.
 */
export type Reach = 'reliably' | 'situational' | 'needs-luck' | 'not-in-one-run'

/** The four, easiest first, with the words a reader sees. */
export const REACH: { id: Reach; name: string; say: string }[] = [
  { id: 'reliably', name: 'Reliably', say: 'Asks for little enough that most runs can get there.' },
  { id: 'situational', name: 'Situational', say: 'Comes together when the offers go your way.' },
  { id: 'needs-luck', name: 'Needs luck', say: 'A lot has to land in one run.' },
  { id: 'not-in-one-run', name: 'Not in one run', say: 'Asks for more than a run is going to give.' },
]

const NAMES = new Map(REACH.map((one) => [one.id, one.name]))

/** The word for a reading, for anything that just wants to print it. */
export function reachName(reach: Reach): string {
  return NAMES.get(reach) ?? 'Unknown'
}

// ---------------------------------------------------------------------------
// What a build demands
// ---------------------------------------------------------------------------

/** One cost that applied, with what it was about and what to do instead. */
export type Charge = {
  id: string
  /** points added */
  cost: number
  /** what is true, stated. Shown wherever the reading is */
  say: string
  /** how to make it cheaper. The builder shows these and nothing else does */
  tip?: string
  /** what the charge was about, when it was about particular traits */
  traits?: TraitId[]
}

export type RepeatRead = {
  reach: Reach
  /** weighted picks the build demands */
  cost: number
  /** what it is measured against: the Exits in a run */
  ceiling: number
  charges: Charge[]
  /**
   * Boons in the build that nothing else in it depends on.
   *
   * The cheapest thing to remove, and the tip worth reading first.
   */
  filler: TraitId[]
  /** how many boons the build needs from each Olympian, most first */
  perGod: { god: GodId; count: number }[]
  /**
   * A reading forced to the bottom regardless of what it costs.
   *
   * Set when a build asks for something no amount of good play gets you, which
   * today means six or more Olympians. Named so a screen can say why rather
   * than showing a number that does not add up to the word beside it.
   */
  hardStop: string | null
}

// ---------------------------------------------------------------------------

const nameOf = (id: TraitId, traits: TraitIndex) => traits.get(id)?.name ?? id
const list = (ids: TraitId[], traits: TraitIndex) => ids.map((id) => nameOf(id, traits)).join(', ')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Gods a build can take a boon from that a run will not offer on request.
 *
 * Hermes turns up on his own schedule and cannot be forced. Chaos is behind a
 * gate you have to find and pay for. Neither spends an Olympian slot, which is
 * why `olympiansOf` does not see them and why they need naming here: a build
 * resting on one of them is resting on a god the run decides about, not you.
 *
 * **Artemis, Athena, Dionysus and Medea belong in this list and are not in it,**
 * because they are not in the trait data at all. `CLAUDE.md` records why: they
 * have no `LootData` entry, carry `TreatAsGodLootByShops` in `UnitSetData`, and
 * the extractor does not reach their pools. Nothing can put one in a build
 * today, so nothing needs to charge for one. When the extractor learns them,
 * they go here, and Athena goes here with an asterisk: she is the one encounter
 * god you can force, through `AthenaEncounterKeepsake`, whose
 * `UniqueEncounterArgs` requires `#CurrentRun.Hero.LastStands <= 0`. Zero Death
 * Defiance. A real route, and a narrow one.
 */
const UNSUMMONABLE = new Set<GodId>(['Hermes', 'Chaos'])

/** The Olympian a boon is offered by, when exactly one is. */
function godOf(trait: Trait | undefined, olympians: ReadonlySet<GodId>): GodId | null {
  const gods = (trait?.gods ?? []).filter((god) => olympians.has(god))
  return gods.length === 1 ? (gods[0] ?? null) : null
}

/**
 * Everything the build depends on, which is what makes a boon load-bearing.
 *
 * A boon earns its place if it is the centrepiece, if it occupies a core slot,
 * or if some other entry in the build names it as a prerequisite. Anything left
 * over is in the build without holding anything up.
 *
 * `optional` is not in this at all. It is already declared as upside rather
 * than as the build, so calling it filler would be telling somebody off for
 * labelling their build correctly.
 */
function loadBearing(build: ShownBuild, traits: TraitIndex): Set<TraitId> {
  const held = new Set(build.boons)
  const bearing = new Set<TraitId>()

  if (build.centrepiece) bearing.add(build.centrepiece)

  for (const id of build.boons) {
    const trait = traits.get(id)
    if (!trait) continue
    if (trait.slot) bearing.add(id)
    // A duo or a legendary is a target, and a target is the point of the build
    // rather than padding in it. Without this the rule called every duo in Every
    // Pair filler, which is the opposite of true: they are the whole build.
    if (trait.kind === 'duo' || trait.kind === 'legendary') bearing.add(id)
    if (!trait.requires) continue
    // Only the prerequisites the build actually holds. A set lists every way to
    // satisfy it and the build took one of them; the others are not in it.
    for (const set of requirementSets(trait.requires)) {
      for (const option of set) if (held.has(option)) bearing.add(option)
    }
  }

  return bearing
}

/**
 * What a target costs above an ordinary pick, from the two fields that say how
 * few ways it can arrive.
 *
 * **Sides**, which is `Trait.gods.length`, is the duo and legendary asymmetry
 * exactly as the owner describes it, and it is a field rather than a heuristic:
 *
 * | | Offered by one god | Offered by two |
 * |---|---|---|
 * | Duos, 37 | 2 | 35 |
 * | Legendaries, 10 | **10** | 0 |
 *
 * Every legendary comes from its own god and nowhere else. Almost every duo can
 * be picked up from either half. Two sides is the ordinary case and charges
 * nothing; one side charges one.
 *
 * **Depth** is how many sets the target's own `requires` states:
 *
 * | | 1 set | 2 sets | 3 sets |
 * |---|---|---|---|
 * | Duos | 0 | 33 | 4 |
 * | Legendaries | 1 | 0 | **9** |
 *
 * Nine of the ten legendaries want three separate boons out of one god's pool,
 * and that pool holds the core boons every other target is contending for. Two
 * sets is ordinary, a third charges one, and a single set charges nothing.
 *
 * The escape hatch stays thin, which is why a narrow route is a real cost: a
 * swap arrives at `ReplaceChance` 0.1, only after two completed runs, only
 * while the held boon can still be upgraded, and `RarityUpgradeOrder` ends at
 * Heroic, so a Heroic boon shuts its slot outright.
 */
function narrowness(trait: Trait, olympians: ReadonlySet<GodId>): number {
  const sides = trait.gods.filter((god) => olympians.has(god)).length
  const sets = trait.requires ? requirementSets(trait.requires).length : 0
  return (sides <= 1 ? 1 : 0) + (sets >= 3 ? 1 : 0)
}

/**
 * Read a build.
 *
 * Pure, and deliberately so: no run, no `RunContext`, no play record. The same
 * build reads the same in the builder, on a card, and on a link somebody opened
 * on their phone. `rules.ts` cannot be reused for this precisely because it
 * needs a live run to evaluate anything.
 */
export function readRepeat(
  build: ShownBuild,
  traits: TraitIndex,
  olympianList: readonly GodId[],
  ceiling: number = ESTIMATED_EXITS,
): RepeatRead {
  const olympians = new Set(olympianList)
  const charges: Charge[] = []

  // --- Picks --------------------------------------------------------------
  // The headline, and the owner's: more boons is harder, full stop.
  const picks = build.boons.length
  if (picks > 0) {
    charges.push({ id: 'picks', cost: picks, say: `${plural(picks, 'boon', 'boons')} to pick up.` })
  }

  // --- Narrow routes ------------------------------------------------------
  const targets = build.boons
    .map((id) => traits.get(id))
    .filter((trait): trait is Trait => !!trait && (trait.kind === 'duo' || trait.kind === 'legendary'))

  const narrow = targets.filter((trait) => narrowness(trait, olympians) > 0)
  const narrowCost = targets.reduce((total, trait) => total + narrowness(trait, olympians), 0)

  if (narrowCost > 0) {
    const legendaries = narrow.filter((trait) => trait.kind === 'legendary')
    charges.push({
      id: 'narrow',
      cost: narrowCost,
      say: legendaries.length
        ? `${plural(legendaries.length, 'legendary', 'legendaries')}, and a legendary comes from its own god only.`
        : `${narrow.length} of the targets can only arrive one way.`,
      tip: legendaries.length
        ? 'A duo asks for less than a legendary. It can be picked up from either of its two gods, and it wants two prerequisites rather than three out of one pool. Even a build people chase for fun rarely wants more than three duos and a legendary.'
        : undefined,
      traits: narrow.map((trait) => trait.id),
    })
  }

  // --- How many duos, on its own ------------------------------------------
  // Separate from narrowness because it is about the pile rather than any one
  // of them. Three is the owner's line for a build worth sharing.
  const duos = targets.filter((trait) => trait.kind === 'duo')
  if (duos.length > 3) {
    charges.push({
      id: 'duo-pile',
      cost: duos.length - 3,
      say: `${duos.length} duos in one run.`,
      tip: 'Each duo wants two gods in particular slots, and they contend with each other for the same five slots. Three is about where a build stops being a plan and starts being a run you had once.',
      traits: duos.map((trait) => trait.id),
    })
  }

  // --- Concentration ------------------------------------------------------
  // Four gods is not four times the trouble. A god you need one boon from is
  // nearly free: you meet them once and take the thing. A god you need four
  // specific boons from is most of your run, because that god has to be offered
  // four times with the right boon inside each offer. So it starts above two.
  const counts = new Map<GodId, number>()
  for (const id of build.boons) {
    const god = godOf(traits.get(id), olympians)
    if (god) counts.set(god, (counts.get(god) ?? 0) + 1)
  }
  const perGod = [...counts]
    .map(([god, count]) => ({ god, count }))
    .sort((a, b) => b.count - a.count || a.god.localeCompare(b.god))

  const deep = perGod.filter((one) => one.count > 2)
  const concentration = deep.reduce((total, one) => total + (one.count - 2), 0)
  if (concentration > 0) {
    charges.push({
      id: 'concentration',
      cost: concentration,
      say: `${deep.map((one) => `${one.count} boons from ${one.god}`).join(', ')}.`,
      tip: 'Needing one boon from a god is nearly free. Needing four means that god has to be offered four times, with the right boon inside each offer.',
    })
  }

  // --- Olympians past the pool --------------------------------------------
  //
  // Four is where the random pool freezes: `ReachedMaxGods` in `RunLogic.lua`
  // makes `GetEligibleLootNames` return only gods already held. A fifth is still
  // reachable, because `RewardLogic.lua:242` lets a keepsake overwrite the
  // capped choice without consulting the cap, and every Olympian has one.
  //
  // So a fifth god is a keepsake you spent on one boon, and it is defensible:
  // bring Hestia for the one Attack boon you want and nothing else. A sixth is
  // spending keepsakes to fight a pool that is actively not offering them.
  const gods = perGod.length
  //
  // Costed at six, which is enough that a build wanting a fifth god cannot read
  // Reliably however small it is otherwise. "Most runs can get there" is the
  // one thing a keepsake god is not.
  if (gods === 5) {
    charges.push({
      id: 'fifth-god',
      cost: 6,
      say: 'Five Olympians, so the fifth has to arrive on a keepsake.',
      tip: 'Worth it for one boon you really want. The keepsake is spent either way, and it does not always land: you can carry it and still not be offered that god, or be offered them against a hammer you would rather have.',
    })
  }

  const hardStop =
    gods > 5
      ? `${gods} Olympians. The pool freezes at four and a keepsake buys one more, so the rest are not arriving.`
      : null

  // --- Hexes --------------------------------------------------------------
  //
  // Nine Hexes, one per Olympian, and you take one. Which of Selene's blessings
  // you are then offered inside that Hex's tree is its own draw, so a build that
  // rests on a specific Hex has staked itself on two rolls it does not control
  // and cannot change once it has committed.
  //
  // Charged, never blocked. A Hex belongs in a build the way a familiar does:
  // if you meet Selene and you are taking one, take this one.
  if (build.hex) {
    charges.push({
      id: 'hex',
      cost: 2,
      say: `${nameOf(build.hex, traits)} is one Hex out of nine, and its tree is drawn separately.`,
      tip: 'Better read as "if you meet Selene, take this one" than as a foundation. Once a Hex is chosen you are locked into it, so a build that cannot work without a particular one is a build that fails on the draw.',
      traits: [build.hex],
    })
  }

  // --- Gods you cannot ask for --------------------------------------------
  const wandering = [
    ...new Set(
      build.boons.flatMap((id) => (traits.get(id)?.gods ?? []).filter((god) => UNSUMMONABLE.has(god))),
    ),
  ].sort()
  if (wandering.length > 0) {
    const from = build.boons.filter((id) =>
      (traits.get(id)?.gods ?? []).some((god) => UNSUMMONABLE.has(god)),
    )
    const legendary = from.filter((id) => traits.get(id)?.kind === 'legendary')
    charges.push({
      id: 'unsummonable',
      cost: from.length + legendary.length * 2,
      say: `${wandering.join(' and ')} turn${wandering.length === 1 ? 's' : ''} up when the run decides, not when you do.`,
      tip: legendary.length
        ? 'A legendary from a god you cannot summon is two draws deep: the god has to appear enough times, and the right boons have to be in those offers. Good as upside, hard as a foundation.'
        : 'Fine to hold, hard to plan around. Worth writing under the run of good luck rather than into the build.',
      traits: from,
    })
  }

  // --- Hammers ------------------------------------------------------------
  // One is a coin flip you can plan for. Two named upgrades means two specific
  // draws out of the sixteen-odd an arm has, and `RewardStoreData.RunProgress`
  // holds two Daedalus Hammer slots against eighteen.
  if (build.hammers.length > 1) {
    charges.push({
      id: 'hammers',
      cost: (build.hammers.length - 1) * 3,
      say: `${build.hammers.length} named hammer upgrades.`,
      tip: 'A run offers two hammers at most, out of everything the arm has. Naming one is a plan. Naming two is asking for both of the run’s hammers to come up the way you wrote them.',
      traits: build.hammers,
    })
  }

  // --- The tip that is not a cost -----------------------------------------
  const bearing = loadBearing(build, traits)
  const filler = build.boons.filter((id) => !bearing.has(id))
  if (filler.length > 0) {
    charges.push({
      id: 'filler',
      cost: 0,
      say: `${plural(filler.length, 'boon holds', 'boons hold')} nothing else up: ${list(filler, traits)}.`,
      tip: 'The cheapest thing to drop. Nothing in the build depends on them, so taking them out lowers what it asks for without changing what it does. Move them to Beyond the build if they are upside rather than the build.',
      traits: filler,
    })
  }

  const cost = charges.reduce((total, charge) => total + charge.cost, 0)
  return {
    reach: hardStop ? 'not-in-one-run' : bandFor(cost, ceiling),
    cost,
    ceiling,
    charges,
    filler,
    perGod,
    hardStop,
  }
}

/**
 * Where the thresholds are, and why they are fractions rather than numbers.
 *
 * The cost is in weighted picks and the ceiling is the Exits in a run, so a
 * band is the share of a run a build spends on itself. Written as fractions,
 * they survive `ESTIMATED_EXITS` being measured better later, which it will be.
 *
 * A quarter of a run is a build most runs can get to. Half is a build that
 * wants the offers to cooperate. Past that, everything has to land.
 *
 * **It stops at Needs luck, and never returns Not in one run.** Cost measures
 * how unlikely a build is, and unlikely is not impossible. Every Pair costs
 * more than a run is long and is still assemblable: nine of its ten targets fit
 * the slot rules, which was checked over all 1024 ways five core slots can be
 * handed to four gods. Calling it impossible would be the same error as the old
 * four-gods claim, a proxy standing in for the property it is not.
 *
 * Not in one run means proven unreachable, and only `hardStop` says that.
 */
export function bandFor(cost: number, ceiling: number = ESTIMATED_EXITS): Reach {
  if (cost > ceiling / 2) return 'needs-luck'
  if (cost > ceiling / 4) return 'situational'
  return 'reliably'
}

/**
 * The star rating a build is allowed to show.
 *
 * The owner's rule, and it is about honesty rather than taste: a build asking
 * for something a run cannot hand over does not get to look like a
 * recommendation, however much somebody enjoyed the one time it happened. The
 * rating itself is untouched in storage; this is the ceiling on displaying it.
 *
 * Everything short of a hard stop keeps its stars. A five-star Needs luck build
 * is a real thing and a good one: hard to assemble, worth chasing.
 */
export function ratingCeiling(read: RepeatRead): number | null {
  return read.hardStop ? 1 : null
}
