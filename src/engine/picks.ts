/**
 * Where a pick goes, and what kind of thing it is.
 *
 * **This exists so the routing can be tested.** The editor writes to three
 * lists, `boons`, `optional` and `hammers`, and until now it decided between
 * them inside a component. There are no React component tests in this repo:
 * jsdom is a per-file opt-in in `vite.config.ts` and nothing opts in, so
 * anything living in `BuildEditor.tsx` or `BoonSort.tsx` is unprovable. List
 * routing is exactly the kind of thing that fails without an error, and one of
 * its failures corrupts three separate readings at once, so it comes out here.
 *
 * ## What a hammer is, and why it has to be looked up
 *
 * `CLAUDE.md` records that a Daedalus Hammer upgrade belongs to a weapon
 * through `<Weapon>HammerTrait` inheritance. The resolved trait carries neither
 * a weapon nor a distinguishing `kind`: all 92 come out as plain `other`, and
 * their `gods` reads `['Loot']`. So nothing about a hammer trait says it is a
 * hammer, and the association only survives in `sources`, which groups them
 * into one entry per arm.
 *
 * `build-check.ts` had already worked this out and kept its own copy of the
 * map. It imports this one now, so there is one answer.
 */

import { sources, traits } from '../data/app.ts'
import { CORE_SLOTS } from './slots.ts'
import type { ShownBuild } from '../data/builds.ts'
import type { Slot, TraitId } from '../data/types.ts'

/** Where a pick can live. `null` is the picker, which is neither. */
export type Tray = 'build' | 'optional'

const HAMMER_ARM = new Map<string, string>()
for (const source of sources) {
  if (source.kind !== 'hammer' || !source.weapon) continue
  for (const id of source.traits) HAMMER_ARM.set(id, source.weapon)
}

/** Which arm a hammer upgrade belongs to, or undefined for anything else. */
export const hammerArm = (id: TraitId): string | undefined => HAMMER_ARM.get(id)

/**
 * Whether this is a Daedalus Hammer upgrade.
 *
 * Membership of the six hammer sources, not a naming rule. `CLAUDE.md` closes
 * on that lesson twice over: match against the data, never conclude from the
 * shape of a name.
 */
export const isHammer = (id: TraitId): boolean => HAMMER_ARM.has(id)

/** The core slot a trait occupies, or null. Derived, never stored. */
export function coreSlotOf(id: TraitId): Slot | null {
  const slot = traits.get(id)?.slot
  return slot && CORE_SLOTS.includes(slot) ? slot : null
}

/**
 * The hammer upgrades an arm and aspect can actually be offered.
 *
 * Two gates, both lifted here unchanged from the editor.
 *
 * **The arm**, because a hammer for another weapon is a hard blocker rather
 * than a bad idea, and the association is `sources`.
 *
 * **The aspect**, because 20 upgrades are locked to one. That gate was a bug
 * fix: without it the list offered Circe an upgrade only Seth can take.
 */
export function hammerOptions(weapon: string, aspect: string): TraitId[] {
  const entry = sources.find((one) => one.kind === 'hammer' && one.weapon === weapon)
  return (entry?.traits ?? []).filter((id) => {
    const needs = traits.get(id)?.needsAspect
    return !needs || needs.includes(aspect)
  })
}

/** Which list a pick is currently in, or null when the build does not hold it. */
export function trayOf(build: ShownBuild, id: TraitId): Tray | null {
  if (build.boons.includes(id) || build.hammers.includes(id)) return 'build'
  if ((build.optional ?? []).includes(id)) return 'optional'
  return null
}

/**
 * What fills a core slot, and from which list.
 *
 * Reads the build list first, so a slot holding both answers with the required
 * one. `movePick` makes that unreachable, and this does not depend on it: a
 * build can arrive from an import or from a version that allowed it.
 */
export function coreAt(build: ShownBuild, slot: Slot): { id: TraitId; tray: Tray } | null {
  const required = build.boons.find((id) => coreSlotOf(id) === slot)
  if (required) return { id: required, tray: 'build' }
  const spare = (build.optional ?? []).find((id) => coreSlotOf(id) === slot)
  return spare ? { id: spare, tray: 'optional' } : null
}

/**
 * Move a pick to a tray, or out of the build entirely.
 *
 * **It leaves every list before it joins one**, which is what makes "in the
 * build and also worth adding" unrepresentable rather than merely discouraged.
 * The alternative, removing only from the list it was in, needs the caller to
 * know where it was, and a caller that gets that wrong produces a build holding
 * the same id twice with no error anywhere.
 *
 * A hammer goes to `hammers` and everything else to `boons`, which is the whole
 * reason this is one function rather than the two it replaces. Getting that
 * wrong puts a hammer in `boons`, where it corrupts the slot map, the Olympian
 * tally and the exchange's shape hash at once, and nothing complains.
 *
 * **One pick per core slot, across both lists.** A new Attack boon displaces
 * whatever held Attack, wherever it sat. `takeFix` in the editor already works
 * this way and its note says why: doing half of it leaves two boons in one slot,
 * which is a blocker. It also makes the slot tiles a total function of the
 * build, which is the only thing that makes them worth drawing as a readout.
 *
 * `optional` collapses to `undefined` when it empties, because that is what
 * every build written before the field existed looks like and the two must not
 * be distinguishable.
 */
export function movePick(build: ShownBuild, id: TraitId, to: Tray | null): ShownBuild {
  const slot = coreSlotOf(id)
  const displaced = (one: TraitId) => one === id || (slot !== null && coreSlotOf(one) === slot)

  const boons = build.boons.filter((one) => !displaced(one))
  const hammers = build.hammers.filter((one) => one !== id)
  const optional = (build.optional ?? []).filter((one) => !displaced(one))

  if (to === 'build') {
    if (isHammer(id)) hammers.push(id)
    else boons.push(id)
  }
  if (to === 'optional') optional.push(id)

  return {
    ...build,
    boons,
    hammers,
    ...(optional.length ? { optional } : { optional: undefined }),
  }
}
