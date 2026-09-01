/**
 * Narrowing a library of builds.
 *
 * Eight builds do not need filtering. **Eighty do**, and the library is going
 * to hold dozens of tested builds and then whatever the community adds, so this
 * is written against that rather than against what is on screen today.
 *
 * ## Five facets, and the first two are the ones people have
 *
 * **Arm, then aspect.** That is the order a player already thinks in: they pick
 * up the Sister Blades and then choose which Sister Blades. Aspect alone was
 * the wrong first question, because there are 24 of them and no useful grouping
 * without the weapon in front. Gods, keepsake and familiar are questions people
 * only sometimes have, so they live behind a disclosure.
 *
 * ## One value per facet
 *
 * These are dropdowns, so a facet holds one value or none. That is a real
 * constraint against the chips this replaced, which could express "Zeus or
 * Poseidon", and it buys back the vertical space chips were eating on a phone:
 * five dropdowns are five rows, twenty-eight chips were about nine.
 *
 * ## Every facet is derived
 *
 * A build states a weapon, an aspect, a keepsake and a familiar, and its gods
 * come from its boons. So the options are computed from the builds themselves:
 * add a build using an aspect nothing else uses and that aspect appears, with
 * no list anywhere to keep in step.
 *
 * ## Counts are computed against the other facets, not against everything
 *
 * A count beside an option answers "how many would I get if I picked this
 * **instead**". So each facet's counts are taken with that facet's own
 * selection lifted and every other facet still applied. Counting against the
 * unfiltered library is the common version of this and it lies: it offers a god
 * with 6 beside it that yields nothing, because the arm already picked excludes
 * all six.
 *
 * A zero-count option is **dropped** here, where the chip version kept and
 * dimmed it. The reasoning inverts with the control: a chip that disappears
 * makes the row reflow under the cursor, and a closed dropdown was not showing
 * the option anyway.
 */

import {
  familiarById,
  iconOf,
  olympians,
  sources,
  traits,
  weaponById,
  weapons,
} from '../data/app.ts'
import type { ShownBuild } from '../data/builds.ts'

/** The five things a build can be narrowed by, in the order they are asked. */
export type FacetId = 'weapon' | 'aspect' | 'god' | 'keepsake' | 'familiar' | 'fear'

export const FACET_ORDER: FacetId[] = ['weapon', 'aspect', 'god', 'keepsake', 'familiar', 'fear']

/**
 * The Fear bands a build can be filtered by.
 *
 * **A threshold wearing an exact match's clothes.** Every other facet asks
 * "does this build have exactly this", which for Fear would be useless: nobody
 * wants the builds cleared at exactly 34. So a build reports every band it
 * reaches, and a build at 34 answers 10, 20 and 30. Picking 30 then means
 * "cleared 30 or better" without `matches` needing to know anything new.
 *
 * Tens, and stopping at 50 because `MAX_FEAR` is 57 and a band nothing can
 * reach would be a row that never matches.
 */
const FEAR_BANDS = [10, 20, 30, 40, 50] as const

/** Weapon and aspect are on the surface. The rest unfold. */
export const SURFACE_FACETS: FacetId[] = ['weapon', 'aspect']

export type Selection = Record<FacetId, string | null>

export const EMPTY_SELECTION: Selection = {
  weapon: null,
  aspect: null,
  god: null,
  keepsake: null,
  familiar: null,
  fear: null,
}

export const countSelected = (selection: Selection): number =>
  FACET_ORDER.filter((facet) => selection[facet] !== null).length

export const isEmpty = (selection: Selection): boolean => countSelected(selection) === 0

/**
 * The gods a build takes, derived from its boons.
 *
 * **Kept to the roster rather than excluding a list.** This named Hermes,
 * Selene and Chaos to drop them, which is three god names written as string
 * literals in source, and `validate.ts` refused it by name. `olympians` is the
 * nine that carry `GodLoot` and spend one of the four slots, read out of the
 * generated bundle, so intersecting with it says the same thing from the data.
 *
 * The distinction matters to a filter: an entry for Selene beside one for Zeus
 * would imply they cost the same thing, and they do not.
 */
const OLYMPIAN = new Set<string>(olympians)

export function godsOf(build: ShownBuild): string[] {
  const found = new Set<string>()
  for (const id of build.boons) {
    for (const god of traits.get(id)?.gods ?? []) {
      if (OLYMPIAN.has(god)) found.add(god)
    }
  }
  return [...found].sort()
}

/** What a build offers a facet. It matches if the picked value is among them. */
function valuesFor(build: ShownBuild, facet: FacetId): string[] {
  switch (facet) {
    case 'weapon':
      return [build.weapon]
    case 'aspect':
      return [build.aspect]
    case 'god':
      return godsOf(build)
    case 'keepsake':
      return build.keepsake ? [build.keepsake] : []
    case 'familiar':
      return build.familiar ? [build.familiar] : []
    case 'fear':
      return FEAR_BANDS.filter((band) => (build.play?.fear ?? 0) >= band).map(String)
  }
}

export function matches(build: ShownBuild, selection: Selection, ignore?: FacetId): boolean {
  for (const facet of FACET_ORDER) {
    if (facet === ignore) continue
    const picked = selection[facet]
    if (picked === null) continue
    if (!valuesFor(build, facet).includes(picked)) return false
  }
  return true
}

export function apply(builds: readonly ShownBuild[], selection: Selection): ShownBuild[] {
  return builds.filter((build) => matches(build, selection))
}

export type Option = { value: string; label: string; count: number; icon: string | null }

export type Facet = {
  id: FacetId
  name: string
  /** what the empty choice reads as */
  all: string
  chosen: string | null
  options: Option[]
}

const NAMES: Record<FacetId, { name: string; all: string }> = {
  weapon: { name: 'Arm', all: 'Any arm' },
  aspect: { name: 'Aspect', all: 'Any aspect' },
  god: { name: 'Gods', all: 'Any god' },
  keepsake: { name: 'Keepsake', all: 'Any keepsake' },
  familiar: { name: 'Familiar', all: 'Any familiar' },
  fear: { name: 'Fear cleared', all: 'Any Fear' },
}

/**
 * A display name for a facet value.
 *
 * **Six aspects are called "Aspect of Melinoe"**, which `CLAUDE.md` records as
 * a join hazard and which is a labelling hazard too. The arm disambiguates, so
 * it leads unless an arm is already chosen, in which case repeating it in every
 * option is noise.
 */
function labelFor(facet: FacetId, value: string, armChosen: boolean): string {
  if (facet === 'god') return value
  if (facet === 'fear') return `Fear ${value} or better`
  if (facet === 'familiar') return familiarById.get(value)?.name ?? value
  if (facet === 'weapon') {
    const weapon = weaponById.get(value)
    return weapon ? `${weapon.arm}, ${weapon.name}` : value
  }
  const trait = traits.get(value)
  if (!trait) return value
  const bare = (trait.name ?? value).replace(/^Aspect of /, '')
  if (facet !== 'aspect' || armChosen) return facet === 'aspect' ? bare : (trait.name ?? value)
  const arm = trait.requiredWeapon ? weaponById.get(trait.requiredWeapon)?.arm : null
  return arm ? `${arm}, ${bare}` : bare
}

/**
 * A god's own mark, from the reward sources rather than from a path.
 *
 * `sources` already carries an icon for each of the nine, so this reads it
 * rather than building `gods/${name}.webp`. That is not fussiness: `prune.ts`
 * fails the build on any asset path assembled from a template literal it has
 * not been told about, because a scanner cannot see those and would delete the
 * files they resolve to. Reading the resolved path avoids the whole question.
 */
const GOD_ICON = new Map(
  sources.filter((source) => source.kind === 'olympian').map((source) => [source.id, source.icon]),
)

/**
 * An arm's mark: its base aspect's square icon, not the weapon's cutout.
 *
 * `Weapon.icon` is the large transparent render, which is right on a poster and
 * useless at 22 pixels: the Witch's Staff reduces to a thin diagonal line with
 * nothing readable in it. Every arm's Aspect of Melinoe has a 90 square framed
 * icon, which is drawn to be legible small, so that is what the list shows.
 */
const ARM_ICON = new Map(
  [...traits.values()]
    .filter((trait) => trait.kind === 'aspect' && trait.requiredWeapon && /Melino/.test(trait.name ?? ''))
    .map((trait) => [trait.requiredWeapon as string, iconOf.get(trait.id) ?? null]),
)

/** What to draw beside an option. Absent where the library has nothing. */
function iconFor(facet: FacetId, value: string): string | null {
  switch (facet) {
    case 'weapon':
      return ARM_ICON.get(value) ?? weaponById.get(value)?.icon ?? null
    case 'god':
      return GOD_ICON.get(value) ?? null
    case 'familiar':
      return familiarById.get(value)?.icon ?? null
    case 'fear':
      return 'icons/fear.png'
    // An aspect and a keepsake are both traits, so both are in the same index.
    default:
      return iconOf.get(value) ?? null
  }
}

/**
 * Aspects sort by their weapon's own order, not alphabetically.
 *
 * `weapons` is in the order the game lists the arms, and grouping a dropdown of
 * 24 aspects by arm is the only thing that makes it readable when no arm is
 * chosen.
 */
const weaponRank = new Map(weapons.map((weapon, index) => [weapon.id, index]))

function rankOf(facet: FacetId, value: string): number {
  if (facet === 'weapon') return weaponRank.get(value) ?? 99
  if (facet !== 'aspect') return 0
  const weapon = traits.get(value)?.requiredWeapon
  return weapon ? (weaponRank.get(weapon) ?? 99) : 99
}

export function facets(builds: readonly ShownBuild[], selection: Selection): Facet[] {
  const armChosen = selection.weapon !== null

  return FACET_ORDER.map((facet) => {
    const values = new Set<string>()
    for (const build of builds) for (const value of valuesFor(build, facet)) values.add(value)

    // Counted with this facet's own choice lifted, so a count reads as "how
    // many if I pick this instead" rather than "how many are left".
    const others = builds.filter((build) => matches(build, selection, facet))
    const chosen = selection[facet]

    const options = [...values]
      .map((value) => ({
        value,
        label: labelFor(facet, value, armChosen),
        count: others.filter((build) => valuesFor(build, facet).includes(value)).length,
        icon: iconFor(facet, value),
      }))
      // A dead option is dropped, except the one currently chosen: removing
      // that would silently change what is on screen.
      .filter((option) => option.count > 0 || option.value === chosen)
      .sort(
        (a, b) =>
          rankOf(facet, a.value) - rankOf(facet, b.value) || a.label.localeCompare(b.label),
      )

    return { id: facet, name: NAMES[facet].name, all: NAMES[facet].all, chosen, options }
  })
    /**
     * A facet with nothing in it is not drawn.
     *
     * This never came up while every facet was something every build has: a
     * build always carries a weapon, an aspect and at least one god, so the
     * list was never empty. Fear is the first facet a whole library can be
     * silent about, and a "Fear cleared" control offering no Fear to filter by
     * is a row of furniture claiming to be a choice.
     */
    .filter((facet) => facet.options.length > 0)
}

/**
 * Choose a value, or clear one by passing null.
 *
 * **Choosing an arm clears the aspect**, because an aspect belongs to exactly
 * one arm and keeping a Descura aspect while switching to the Sister Blades
 * would show an empty list with no visible reason. It is the only dependency
 * between facets, and it is one-way.
 */
export function choose(selection: Selection, facet: FacetId, value: string | null): Selection {
  const next = { ...selection, [facet]: value }
  if (facet === 'weapon' && selection.aspect !== null) {
    const belongsTo = traits.get(selection.aspect)?.requiredWeapon ?? null
    if (value !== null && belongsTo !== value) next.aspect = null
    if (value === null) next.aspect = selection.aspect
  }
  return next
}

/** How a library is ordered, when a reader wants it ordered rather than filtered. */
export type SortId = 'name' | 'arm' | 'gods'

export const SORTS: { id: SortId; name: string }[] = [
  { id: 'name', name: 'Name' },
  { id: 'arm', name: 'Arm' },
  { id: 'gods', name: 'Gods' },
]

export function sortBuilds(builds: readonly ShownBuild[], by: SortId): ShownBuild[] {
  const copy = [...builds]
  switch (by) {
    case 'arm':
      return copy.sort(
        (a, b) =>
          (weaponRank.get(a.weapon) ?? 99) - (weaponRank.get(b.weapon) ?? 99) ||
          a.name.localeCompare(b.name),
      )
    case 'gods':
      return copy.sort(
        (a, b) => godsOf(a).join().localeCompare(godsOf(b).join()) || a.name.localeCompare(b.name),
      )
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name))
  }
}
