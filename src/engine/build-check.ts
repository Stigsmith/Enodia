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

import { arcanaById, olympianList, olympians, traits } from '../data/app.ts'
import type { ShownBuild } from '../data/builds.ts'
import { CORE_SLOTS, slotLabel } from './slots.ts'
import { requirementSets, satisfiesRequirement } from './reachability.ts'
import { coreSlotOf, hammerArm, isHammer } from './picks.ts'
import { MAX_GRASP } from './arcana.ts'
import type { Slot, TraitId } from '../data/types.ts'

export type Problem = {
  /** what it is about, so the form can point at the right control */
  field: 'name' | 'aspect' | 'boons' | 'hex' | 'hammers' | 'arcana' | 'centrepiece'
  severity: 'blocks' | 'notes'
  say: string
  /**
   * What would fix it, when the fix is picking one of a known set.
   *
   * **"Needs prerequisites this build does not hold yet" was a dead end.** It
   * named the problem and gave a player no way at all to find out what was
   * missing, which the owner hit in playtesting: the boons are somewhere in a
   * list of two hundred and nothing says which.
   *
   * The data was always there. `requirementSets` returns the sets and
   * `satisfiesRequirement` says which are unmet, so the unmet options can be
   * listed and each one can say what taking it would displace. The UI turns
   * these into buttons; the engine only has to know what they are.
   */
  fix?: Fix
}

/** One unmet requirement, and the ways to meet it. */
export type Fix = {
  /** the trait that is missing something */
  target: TraitId
  /** one entry per unmet set: satisfy each of them */
  sets: FixSet[]
}

export type FixSet = {
  options: FixOption[]
}

export type FixOption = {
  id: TraitId
  name: string
  /**
   * What taking this would push out, or null when it costs nothing.
   *
   * A core boon displaces whatever holds that slot, and a player choosing
   * between three options deserves to know which of the three is free before
   * they pick, not after.
   */
  displaces: { id: TraitId; name: string; slot: Slot } | null
}

const OLYMPIAN = new Set<string>(olympians)

/**
 * The most Grasp a save can reach, re-exported from the engine that owns it.
 *
 * It was written out here and again in `ui/Arcana.tsx`, both from the owner's
 * report rather than from the file. `engine/arcana.ts` sums it out of
 * `MetaUpgradeCostData` and says how.
 *
 * Imported as well as re-exported: a bare `export ... from` does not put the
 * name in this module's own scope, and two rules below count against it.
 */
export { MAX_GRASP }

/**
 * The most Arcana a build may name, and the most that still reads as advice.
 *
 * Not a rule of the game. A save can hold far more than five cards and usually
 * does. This is about what a build is for: the cards that follow from what it
 * does, so a reader knows which two to bring rather than being handed somebody
 * else's whole loadout.
 */
export const MAX_CARDS = 5
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
 * The ways to satisfy what a trait is missing.
 *
 * One entry per unmet set, because `oneFromEachSet` means every set has to be
 * satisfied and a player needs to see all of them, not the first. Within a set
 * the options are alternatives: any one will do.
 *
 * **A set already satisfied is left out.** A legendary needing three sets with
 * two of them held should say what is missing, not restate the whole
 * requirement, which is the difference between a list and an answer.
 */
export function fixFor(target: TraitId, held: ReadonlySet<TraitId>, build: ShownBuild): Fix | undefined {
  const requires = traits.get(target)?.requires
  if (!requires) return undefined

  const slots = slotMap(build)
  const sets = requirementSets(requires)
    .filter((set) => !set.some((id) => held.has(id)))
    .map((set) => ({
      options: set.map((id) => {
        const slot = traits.get(id)?.slot
        const sitting = slot && CORE_SLOTS.includes(slot) ? slots.get(slot)?.[0] : undefined
        return {
          id,
          name: name(id),
          displaces:
            sitting && sitting !== id && slot
              ? { id: sitting, name: name(sitting), slot }
              : null,
        }
      }),
    }))

  return sets.length ? { target, sets } : undefined
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
   * A run has four keepsakes: one equipped at the start and a swap at the rack
   * after each of the first three bosses. The racks are in the files, one
   * `Template = "GiftRack"` gated on `WorldUpgradePostBossGiftRack` per Region
   * in `RoomDataN/O/P` and `RoomDataF/G/H`.
   *
   * So five is legal and defensible: spend one of the four to force the one boon
   * you want from a fifth god. Past that you are spending keepsakes you wanted
   * for other things on gods the pool is refusing to offer, and
   * `engine/repeat.ts` says so in the reading. Neither is blocked, because
   * neither is illegal.
   */
  const gods = olympiansOf(build)
  if (gods.length > 4) {
    out.push({
      field: 'boons',
      severity: 'notes',
      say: `${gods.length} Olympians: ${gods.join(', ')}. Past four the pool is frozen to gods you hold, so ${gods.length - 4} of them have to be forced with keepsakes, out of the four a run gives you.`,
    })
  }

  /**
   * A hammer belongs to its weapon through `<Weapon>HammerTrait` inheritance.
   * `picks.ts` holds the lookup, because the trait itself says nothing.
   *
   * **Both lists, not just `build.hammers`.** A hammer can sit in `optional`
   * now, and a hammer for another arm is impossible whether or not the build
   * requires it. Reading one list would have let a wrong-arm optional hammer
   * save silently, which is the one way this change could make an impossible
   * build shippable.
   */
  for (const id of [...build.hammers, ...(build.optional ?? []).filter(isHammer)]) {
    const weapon = hammerArm(id)
    if (weapon && weapon !== build.weapon) {
      out.push({ field: 'hammers', severity: 'blocks', say: `${name(id)} is not an upgrade for this arm.` })
    }
  }

  /**
   * The same core slot held twice, once required and once as upside.
   *
   * `movePick` cannot produce this: a new pick displaces whatever held the
   * slot, in either list. A build arriving from an import or from a version
   * that allowed it can. `notes` rather than `blocks`, because it is legal and
   * merely probably not meant, which is the line this file draws everywhere.
   */
  for (const id of build.optional ?? []) {
    const slot = coreSlotOf(id)
    if (!slot) continue
    const required = build.boons.find((one) => coreSlotOf(one) === slot)
    if (required) {
      out.push({
        field: 'boons',
        severity: 'notes',
        say: `${name(id)} and ${name(required)} both take ${slotLabel(slot)}, one as the build and one as upside. Only one of them can be held.`,
      })
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
        say: `${name(build.centrepiece)} needs boons this build does not hold yet.`,
        fix: fixFor(build.centrepiece, held, build),
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
        say: `${trait.name} needs boons this build does not hold yet.`,
        fix: fixFor(id, held, build),
      })
    }
  }

  /**
   * The Arcana on a build are a couple of suggestions, not a board.
   *
   * **This has been wrong twice, in opposite directions.** First it blocked
   * above five cards, on the assumption the Grasp holds five. It does not: the
   * board has nineteen paid cards costing between 1 and 5, `MetaUpgradeCostData`
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

  /**
   * Holding something that reads the game's Olympian damage list, and what in
   * the build is on that list.
   *
   * Three traits read it: Extended Family and the Earth infusion multiply it,
   * and Argent Skull's Persephone aspect charges off it. **The list is names,
   * not gods**: 63 projectiles and 3 effects, including Artemis and Athena
   * projectiles, and Artemis and Athena have no `LootData` entry and never
   * spend an Olympian slot. So which gods a build holds does not answer it,
   * which is the whole reason this is worth saying out loud.
   *
   * **It only ever states the positive.** `scripts/olympian.ts` traces what
   * makes listed damage out of each trait's own record, and it cannot see a
   * projectile whose link to a boon lives in the per-weapon data, so a pick it
   * does not name may still count. The empty case says that rather than
   * claiming the build gets nothing.
   */
  const picks = [
    build.aspect,
    ...build.boons,
    ...(build.optional ?? []),
    ...(build.hex ? [build.hex] : []),
    ...build.hammers,
  ]
  const readers = picks.filter((id) => traits.get(id)?.readsOlympian)
  if (readers.length) {
    const makers = picks.filter((id) => (traits.get(id)?.olympian ?? []).length)
    const shown = makers.slice(0, 3).map(name)
    const rest = makers.length - shown.length
    if (rest) shown.push(rest === 1 ? 'one more' : `${rest} more`)
    const named = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0]
    const list = `the game's Olympian list, ${olympianList.projectiles} projectiles and ${olympianList.effects} effects`
    for (const reader of readers) {
      out.push({
        field: 'boons',
        severity: 'notes',
        say: makers.length
          ? `${name(reader)} only counts damage on ${list}. Among this build's picks: ${named}.`
          : `${name(reader)} only counts damage on ${list}. No pick here is on it, as far as each pick's own record says.`,
      })
    }
  }

  return out
}

/** Only the ones that make the build impossible rather than unfinished. */
export const blockers = (problems: Problem[]): Problem[] =>
  problems.filter((problem) => problem.severity === 'blocks')
