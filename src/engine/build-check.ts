/**
 * Is this build mechanically coherent?
 *
 * `builds.test.ts` asks exactly these questions of the eight samples and fails
 * the build when one drifts. A player assembling their own deserves the same
 * questions asked out loud, while they are assembling it, rather than a silent
 * pass and a build that cannot happen.
 *
 * **Every check here is mechanical.** Slots, the Olympian cap, prerequisites,
 * which aspect belongs to which arm. `CLAUDE.md` is clear that evaluations come
 * from the owner and are not in any file, so nothing here says a build is weak,
 * slow or badly chosen. It says what the game would not allow.
 *
 * ## Two severities, and the difference matters
 *
 * `blocks` is a thing the game cannot do: a Sister Blades aspect on the axe,
 * two boons in one slot. `notes` is a thing that is legal and probably not what
 * was meant: an empty core slot, a duo whose prerequisites are not held yet.
 *
 * **A note never stops a save.** Somebody sketching a build they are working
 * towards has a legal, incomplete build, and refusing to keep it would be the
 * tool telling a player they are using it wrong.
 */

import { arcanaById, olympians, sources, traits } from '../data/app.ts'
import type { ShownBuild } from '../data/builds.ts'
import { CORE_SLOTS, slotLabel } from './slots.ts'
import { satisfiesRequirement } from './reachability.ts'
import type { Slot, TraitId } from '../data/types.ts'

export type Problem = {
  /** what it is about, so the form can point at the right control */
  field: 'name' | 'aspect' | 'boons' | 'hex' | 'hammers' | 'arcana' | 'centrepiece'
  severity: 'blocks' | 'notes'
  say: string
}

const OLYMPIAN = new Set<string>(olympians)

/**
 * The most Grasp a save can reach.
 *
 * `MetaUpgradeCostData.StartingMetaUpgradeLimit` is 10 and rises in
 * `CostIncrease` steps as MemPoints are spent. The owner reports it stops at
 * 30, which is the same number `ui/Arcana.tsx` counts against.
 */
const MAX_GRASP = 30

/**
 * The most Arcana a build may name, and the most that still reads as advice.
 *
 * Not a rule of the game. A save can hold far more than five cards and usually
 * does. This is about what a build is for: the cards that follow from what it
 * does, so a reader knows which two to bring rather than being handed somebody
 * else's whole loadout.
 */
const MAX_CARDS = 5
const SUGGESTED_CARDS = 3

/** The Olympians a build spends a slot on, which is not every god on it. */
export function olympiansOf(build: ShownBuild): string[] {
  const found = new Set<string>()
  for (const id of build.boons) {
    for (const god of traits.get(id)?.gods ?? []) {
      if (OLYMPIAN.has(god)) found.add(god)
    }
  }
  return [...found].sort()
}

/** Which core slot each boon takes, and what is fighting over one. */
export function slotMap(build: ShownBuild): Map<Slot, TraitId[]> {
  const map = new Map<Slot, TraitId[]>()
  for (const id of build.boons) {
    const slot = traits.get(id)?.slot
    if (!slot || !CORE_SLOTS.includes(slot)) continue
    map.set(slot, [...(map.get(slot) ?? []), id])
  }
  return map
}

const name = (id: string) => traits.get(id)?.name ?? id

/**
 * Which arm a Daedalus Hammer upgrade belongs to.
 *
 * **Not on the trait.** `CLAUDE.md` records that a hammer upgrade belongs to a
 * weapon through `<Weapon>HammerTrait` inheritance, and the resolved trait
 * carries neither a `weapon` nor a distinguishing `kind`: they come out as
 * plain `other`. The association survives in `sources`, which groups them into
 * one hammer entry per arm, so that is what this reads.
 */
const HAMMER_ARM = new Map<string, string>()
for (const source of sources) {
  if (source.kind !== 'hammer' || !source.weapon) continue
  for (const id of source.traits) HAMMER_ARM.set(id, source.weapon)
}

export function checkBuild(build: ShownBuild): Problem[] {
  const out: Problem[] = []
  const held = new Set(build.boons)

  if (!build.name.trim()) {
    out.push({ field: 'name', severity: 'blocks', say: 'It needs a name.' })
  }

  // An aspect belongs to exactly one arm.
  const aspect = traits.get(build.aspect)
  if (aspect && aspect.requiredWeapon && aspect.requiredWeapon !== build.weapon) {
    out.push({
      field: 'aspect',
      severity: 'blocks',
      say: `${aspect.name} is not an aspect of this arm.`,
    })
  }

  // One boon per core slot. This is the lockout the whole project is about.
  for (const [slot, ids] of slotMap(build)) {
    if (ids.length > 1) {
      out.push({
        field: 'boons',
        severity: 'blocks',
        say: `${ids.map(name).join(' and ')} both want your ${slotLabel(slot)}. Only one can hold it.`,
      })
    }
  }

  /**
   * The Olympian cap, which is a cap on the random pool and not on the run.
   *
   * This used to block above four, citing `HeroData.MaxGodsPerRun`. That was
   * the same shape of mistake as reading `MaxGodsPerRun` without following
   * `GodLoot`: the constant is real and the conclusion drawn from it was not.
   *
   * `RewardLogic.lua:238` calls `ChooseLoot`, which goes through
   * `GetEligibleLootNames` and freezes the pool to gods already held once
   * `ReachedMaxGods` is true. Then line 242, unconditionally, and without ever
   * consulting the cap again:
   *
   *     if trait.ForceBoonName ~= nil and trait.Uses > 0 ... then
   *       lootData = { Name = trait.ForceBoonName }
   *
   * A keepsake overwrites the capped choice. All nine Olympians have one, so a
   * fifth god is a keepsake away and the cap never sees it.
   *
   * So five is legal and defensible: bring a keepsake for the one boon you want
   * from a fifth god. Past that you are spending keepsakes fighting the pool for
   * gods you were not offered, and `engine/repeat.ts` says so in the reading.
   * Neither is blocked, because neither is illegal.
   */
  const gods = olympiansOf(build)
  if (gods.length > 4) {
    out.push({
      field: 'boons',
      severity: 'notes',
      say: `${gods.length} Olympians: ${gods.join(', ')}. Past four the pool is frozen to gods you hold, so the rest have to arrive on a keepsake.`,
    })
  }

  // A hammer belongs to its weapon through <Weapon>HammerTrait inheritance.
  for (const id of build.hammers) {
    const weapon = HAMMER_ARM.get(id)
    if (weapon && weapon !== build.weapon) {
      out.push({ field: 'hammers', severity: 'blocks', say: `${name(id)} is not an upgrade for this arm.` })
    }
  }

  // The centrepiece has to be something the build actually holds.
  if (build.centrepiece) {
    const inBuild = held.has(build.centrepiece) || build.hex === build.centrepiece
    if (!inBuild) {
      out.push({
        field: 'centrepiece',
        severity: 'blocks',
        say: `${name(build.centrepiece)} is what this build is for, but the build does not take it.`,
      })
    }
    const requires = traits.get(build.centrepiece)?.requires
    if (requires && !satisfiesRequirement(requires, held)) {
      out.push({
        field: 'centrepiece',
        severity: 'notes',
        say: `${name(build.centrepiece)} needs prerequisites this build does not hold yet.`,
      })
    }
  }

  // Every duo and legendary in the build, not only the centrepiece.
  for (const id of build.boons) {
    const trait = traits.get(id)
    if (!trait?.requires || id === build.centrepiece) continue
    if (!satisfiesRequirement(trait.requires, held)) {
      out.push({
        field: 'boons',
        severity: 'notes',
        say: `${trait.name} needs prerequisites this build does not hold yet.`,
      })
    }
  }

  /**
   * The Arcana on a build are a couple of suggestions, not a board.
   *
   * **This has been wrong twice, in opposite directions.** First it blocked
   * above five cards, on the assumption the Grasp holds five. It does not: the
   * board has eighteen paid cards costing between 1 and 5, `MetaUpgradeCostData`
   * starts a save at 10 and rises to 30, and six cheap cards fit inside the same
   * Grasp as two expensive ones. So the rule became a Grasp sum.
   *
   * That was right about the game and wrong about the build. A build is not a
   * save file. What belongs on one is the one or two cards that follow from what
   * the build does: The Huntress on an Attack or Special build, The Furies on a
   * Cast build, the Ω crit card on a Morrigan build. Everything else on a real
   * board is the player's own loadout and says nothing about this build.
   *
   * So the limit is the count again, and it is about usefulness rather than
   * legality: five is the most that can still read as advice, and past three it
   * has stopped being advice. The Grasp sum stays underneath as a backstop,
   * though at five cards it cannot be reached: five of the most expensive card
   * is 25 against a ceiling of 30.
   */
  const grasp = build.arcana.reduce((total, id) => total + (arcanaById.get(id)?.cost ?? 0), 0)
  if (build.arcana.length > MAX_CARDS) {
    out.push({
      field: 'arcana',
      severity: 'blocks',
      say: `${build.arcana.length} Arcana. Name the ${MAX_CARDS} that follow from the build and leave the rest of the board to whoever is playing it.`,
    })
  } else if (grasp > MAX_GRASP) {
    out.push({
      field: 'arcana',
      severity: 'blocks',
      say: `That is ${grasp} Grasp, and a save tops out at ${MAX_GRASP}.`,
    })
  } else if (build.arcana.length > SUGGESTED_CARDS) {
    out.push({
      field: 'arcana',
      severity: 'notes',
      say: `${build.arcana.length} Arcana. Two or three that follow from the build are worth more to a reader than a whole board.`,
    })
  }

  const empty = CORE_SLOTS.filter((slot) => !slotMap(build).has(slot))
  if (empty.length && empty.length < CORE_SLOTS.length) {
    out.push({
      field: 'boons',
      severity: 'notes',
      say: `Nothing in your ${empty.map(slotLabel).join(', ')} yet.`,
    })
  }

  return out
}

/** Only the ones that make the build impossible rather than unfinished. */
export const blockers = (problems: Problem[]): Problem[] =>
  problems.filter((problem) => problem.severity === 'blocks')
