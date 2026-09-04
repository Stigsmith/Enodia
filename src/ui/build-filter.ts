/**
 * Narrowing a library of builds.
 *
 * Eight builds do not need filtering. **Eighty do**, and the library is going
 * to hold dozens of tested builds and then whatever the community adds, so this
 * is written against that rather than against what is on screen today.
 *
 * ## Seven facets, and the first two are the ones people have
 *
 * **Arm, then aspect.** That is the order a player already thinks in: they pick
 * up the Sister Blades and then choose which Sister Blades. Aspect alone was
 * the wrong first question, because there are 24 of them and no useful grouping
 * without the weapon in front. Gods, what it leans on, keepsake, familiar and
 * Fear are questions people only sometimes have, so they live behind a
 * disclosure.
 *
 * ## More than one value per facet, except Fear
 *
 * A facet holds a set. "Zeus or Poseidon" is the question people actually have,
 * and an earlier version of this could express it with chips, lost it when the
 * chips became dropdowns, and is getting it back without the nine rows of
 * vertical space the chips cost on a phone.
 *
 * **Fear is the exception and holds one value.** It is a threshold rather than a
 * match, so "30 or better" OR "50 or better" is just "30 or better": every
 * build the second admits, the first already did. A control offering a choice
 * that cannot change the answer is worse than one that does not offer it.
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
import { PLAYSTYLES } from '../data/builds.ts'
import { readRepeat } from '../engine/repeat.ts'
import type { ShownBuild } from '../data/builds.ts'

/** The seven things a build can be narrowed by, in the order they are asked. */
export type FacetId =
  | 'weapon'
  | 'aspect'
  | 'god'
  | 'playstyle'
  | 'keepsake'
  | 'familiar'
  | 'fear'

export const FACET_ORDER: FacetId[] = [
  'weapon',
  'aspect',
  'god',
  'playstyle',
  'keepsake',
  'familiar',
  'fear',
]

/**
 * The one facet that holds a single value.
 *
 * See the header: Fear is a threshold, so a set of them collapses to its lowest
 * member and the extra choices are furniture. Stated as data rather than as an
 * `if` in `choose`, because three separate places have to agree about it.
 */
export const SINGLE: ReadonlySet<FacetId> = new Set<FacetId>(['fear'])

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

/** What is picked, per facet. An empty array is "not narrowing by this". */
export type Selection = Record<FacetId, string[]>

export const EMPTY_SELECTION: Selection = {
  weapon: [],
  aspect: [],
  god: [],
  playstyle: [],
  keepsake: [],
  familiar: [],
  fear: [],
}

/**
 * How many facets are narrowing the list.
 *
 * **`?.length ?? 0`, and the optional chain is a bug that shipped.**
 * `facets()` drops a facet with no options, so a caller rebuilding a selection
 * out of what it returned gets an object missing those keys. When this held
 * `string | null` the key was `undefined`, `undefined !== null` was true, and an
 * empty library counted every facet as chosen: the bar offered to "Clear 6" with
 * nothing selected. The shape changed to arrays and the hazard did not, because
 * reading `.length` off a missing key throws rather than counting wrong.
 *
 * The type says every key is present. The type is satisfied by a cast.
 */
export const countSelected = (selection: Partial<Selection>): number =>
  FACET_ORDER.filter((facet) => (selection[facet]?.length ?? 0) > 0).length

export const isEmpty = (selection: Partial<Selection>): boolean => countSelected(selection) === 0

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
    case 'playstyle':
      return build.playstyle ? [build.playstyle] : []
    case 'keepsake':
      return build.keepsake ? [build.keepsake] : []
    case 'familiar':
      return build.familiar ? [build.familiar] : []
    case 'fear':
      return FEAR_BANDS.filter((band) => (build.play?.fear ?? 0) >= band).map(String)
  }
}

/**
 * **OR inside a facet, AND across them.**
 *
 * "Zeus or Poseidon" and "on the Sister Blades" is one question, and it is the
 * one people ask. The other reading, AND inside a facet, would mean "uses Zeus
 * and Poseidon both", which is a different and much rarer question: it is
 * answered today by picking Zeus and reading the list.
 */
export function matches(build: ShownBuild, selection: Selection, ignore?: FacetId): boolean {
  for (const facet of FACET_ORDER) {
    if (facet === ignore) continue
    const picked = selection[facet] ?? []
    if (picked.length === 0) continue
    const has = valuesFor(build, facet)
    if (!picked.some((value) => has.includes(value))) return false
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
  chosen: string[]
  /** false for Fear, which is a threshold. See `SINGLE`. */
  many: boolean
  options: Option[]
}

const NAMES: Record<FacetId, { name: string; all: string }> = {
  weapon: { name: 'Arm', all: 'Any arm' },
  aspect: { name: 'Aspect', all: 'Any aspect' },
  god: { name: 'Gods', all: 'Any god' },
  playstyle: { name: 'Leans on', all: 'Anything' },
  keepsake: { name: 'Keepsake', all: 'Any keepsake' },
  familiar: { name: 'Familiar', all: 'Any familiar' },
  fear: { name: 'Fear cleared', all: 'Any Fear' },
}

/**
 * What a build leans on, which is the one facet a build states in words rather
 * than in ids. `PLAYSTYLES` is already ordered the way the game lists the moves.
 */
const PLAYSTYLE_NAME = new Map(PLAYSTYLES.map((one) => [one.id as string, one.name]))
const PLAYSTYLE_RANK = new Map(PLAYSTYLES.map((one, at) => [one.id as string, at]))

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
  if (facet === 'playstyle') return PLAYSTYLE_NAME.get(value) ?? value
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
  // The game's own move order, so Attack sits above Sprint rather than below it.
  if (facet === 'playstyle') return PLAYSTYLE_RANK.get(value) ?? 99
  if (facet === 'weapon') return weaponRank.get(value) ?? 99
  if (facet !== 'aspect') return 0
  const weapon = traits.get(value)?.requiredWeapon
  return weapon ? (weaponRank.get(weapon) ?? 99) : 99
}

export function facets(builds: readonly ShownBuild[], selection: Selection): Facet[] {
  /* One arm chosen disambiguates the aspect labels. Two do not: with the Blades
   * and the Staff both picked, six aspects are still called Aspect of Melinoe
   * and dropping the arm from the label would make three pairs identical. */
  const armChosen = (selection.weapon ?? []).length === 1

  return FACET_ORDER.map((facet) => {
    const values = new Set<string>()
    for (const build of builds) for (const value of valuesFor(build, facet)) values.add(value)

    // Counted with this facet's own choice lifted, so a count reads as "how
    // many if I pick this instead" rather than "how many are left".
    const others = builds.filter((build) => matches(build, selection, facet))
    const chosen = selection[facet] ?? []

    const options = [...values]
      .map((value) => ({
        value,
        label: labelFor(facet, value, armChosen),
        count: others.filter((build) => valuesFor(build, facet).includes(value)).length,
        icon: iconFor(facet, value),
      }))
      // A dead option is dropped, except the one currently chosen: removing
      // that would silently change what is on screen.
      .filter((option) => option.count > 0 || chosen.includes(option.value))
      .sort(
        (a, b) =>
          rankOf(facet, a.value) - rankOf(facet, b.value) || a.label.localeCompare(b.label),
      )

    return {
      id: facet,
      name: NAMES[facet].name,
      all: NAMES[facet].all,
      chosen,
      many: !SINGLE.has(facet),
      options,
    }
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
 * Turn a value on or off. `null` clears the whole facet.
 *
 * A toggle rather than a set, because that is what a list of checkable options
 * does: the caller says which option was clicked and does not have to work out
 * the resulting set. Fear replaces instead of toggling, per `SINGLE`.
 *
 * **Choosing arms drops aspects that belong to none of them.** An aspect belongs
 * to exactly one arm, so keeping a Descura aspect while switching to the Sister
 * Blades would show an empty list with no visible reason. With one arm this is
 * the old rule; with several it keeps the aspects of every arm still chosen,
 * which is what makes "the Blades or the Staff, these two aspects" expressible.
 * It is still the only dependency between facets and it is still one-way.
 */
export function choose(selection: Selection, facet: FacetId, value: string | null): Selection {
  const held = selection[facet] ?? []
  const picked =
    value === null
      ? []
      : SINGLE.has(facet)
        ? held.includes(value)
          ? []
          : [value]
        : held.includes(value)
          ? held.filter((one) => one !== value)
          : [...held, value]

  const next = { ...selection, [facet]: picked }

  if (facet === 'weapon' && (selection.aspect ?? []).length > 0 && picked.length > 0) {
    next.aspect = (selection.aspect ?? []).filter((aspect) => {
      const belongsTo = traits.get(aspect)?.requiredWeapon ?? null
      return belongsTo !== null && picked.includes(belongsTo)
    })
  }
  return next
}

/** How a library is ordered, when a reader wants it ordered rather than filtered. */
export type SortId = 'name' | 'arm' | 'gods' | 'recent' | 'assemble' | 'fear'

export const SORTS: { id: SortId; name: string }[] = [
  { id: 'name', name: 'Name' },
  { id: 'arm', name: 'Arm' },
  { id: 'gods', name: 'Gods' },
  { id: 'recent', name: 'Recently changed' },
  { id: 'assemble', name: 'Easiest to assemble' },
  { id: 'fear', name: 'Fear cleared' },
]

/**
 * When a build last changed, as a number, or 0.
 *
 * `SavedBuild` requires `modified`; `ShownBuild`, which is what a browsing
 * surface actually holds, does not. A build without one sorts last rather than
 * throwing, which is the right answer for a sample and for anything that
 * arrived from another install.
 */
const changedAt = (build: ShownBuild): number => {
  const at = Date.parse(build.modified ?? build.created ?? '')
  return Number.isFinite(at) ? at : 0
}

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
    case 'recent':
      return copy.sort((a, b) => changedAt(b) - changedAt(a) || a.name.localeCompare(b.name))
    /**
     * **Easiest first, and it is not a ranking of worth.**
     *
     * `readRepeat` already computes what a build costs to assemble and nothing
     * has ever ordered by it. Cost is picks needed, so ascending is easiest
     * first. `repeat.ts` is explicit that this is not a rating: a build that is
     * hard to put together is not a bad build, it is a hard one, and somebody
     * sorting this way is asking a question about their evening rather than
     * about quality.
     */
    case 'assemble':
      return copy.sort(
        (a, b) => readRepeat(a, traits, olympians).cost - readRepeat(b, traits, olympians).cost ||
          a.name.localeCompare(b.name),
      )
    // Descending: the interesting end of "how far has this got" is the top.
    case 'fear':
      return copy.sort(
        (a, b) => (b.play?.fear ?? 0) - (a.play?.fear ?? 0) || a.name.localeCompare(b.name),
      )
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name))
  }
}
