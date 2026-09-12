/**
 * What elements a build holds, and what that is or is not enough for.
 *
 * ## Why this is in the editor and nowhere else
 *
 * The owner's own account of when they look at elements: almost never in play,
 * and then only to work out how much of one they would need for a particular
 * gated boon to appear or activate. That happens while inspecting a build,
 * which is this screen. So it is here, and not on the overview card, not in the
 * detail views, not in the run.
 *
 * ## Appear and activate are two numbers, not one
 *
 * The game states them separately and means it. `GameStateRequirements` is what
 * it takes to be offered the boon; `ActivationRequirements` is what it takes for
 * it to do anything once held. Frosty Veneer appears at 4 Water and sits inert
 * until 6. Five of the ten gated boons have both, so a single number would be
 * wrong for half of them.
 *
 * ## It counts what the build declares, not what a run would have
 *
 * A build is a list of boons, and each one carries at most one element. That is
 * the count. A real run also picks up elements from Chaos, from tools and from
 * the Wells, and none of that is in a build definition, so the tally here is a
 * floor rather than a prediction. Said on the panel rather than left to be
 * discovered.
 */

import { traits } from '../data/app.ts'
import type { ShownBuild } from '../data/builds.ts'
import type { TraitId } from '../data/types.ts'

/**
 * The five, in the order the game lists them, with their art.
 *
 * **The paths are literals on purpose.** `scripts/prune.ts` ships only what the
 * bundle names, and it reads literal strings: a path built as
 * `` `/elements/${name}.webp` `` is invisible to it, so it would drop all five
 * files and the deploy would 404. It caught exactly that here and refused the
 * build, which is what it is for. Everything that needs an element's art reads
 * this map.
 */
export const ELEMENTS = [
  { id: 'Air', icon: 'elements/air.webp' },
  { id: 'Earth', icon: 'elements/earth.webp' },
  { id: 'Fire', icon: 'elements/fire.webp' },
  { id: 'Water', icon: 'elements/water.webp' },
  { id: 'Aether', icon: 'elements/aether.webp' },
] as const

/** An element's art by name, so nothing has to build the path itself. */
export const ELEMENT_ICON: Record<string, string> = Object.fromEntries(
  ELEMENTS.map((one) => [one.id, one.icon]),
)

/**
 * An element as a boon's kind line says it: the game's glyph, then the word.
 *
 * The hover and the dialog both put it on the line with the slot and the gods,
 * and both use this, so pointing at a boon and opening it name its element the
 * same way. The data has carried `Elements` since the extractor learned it; no
 * description of a boon ever said it.
 */
export function ElementWord({ element }: { element: string }) {
  const icon = ELEMENT_ICON[element]
  return (
    <span className="element-word">
      {icon ? <img src={`/${icon}`} alt="" aria-hidden="true" /> : null}
      {element}
    </span>
  )
}

/** How many of each element a build's boons carry. */
export function elementTally(build: ShownBuild): Record<string, number> {
  const out: Record<string, number> = {}
  // `optional` counts too: a boon you would take if offered still brings its
  // element, and the question this answers is what a build could reach.
  for (const id of [...build.boons, ...(build.optional ?? [])]) {
    for (const element of traits.get(id)?.elements ?? []) {
      out[element] = (out[element] ?? 0) + 1
    }
  }
  return out
}

/** A gate, measured against what the build holds. */
type Standing = {
  id: TraitId
  name: string
  /** every element it wants, with what is held and what is needed */
  appear: { element: string; held: number; need: number }[]
  activate: { element: string; held: number; need: number }[]
  appears: boolean
  activates: boolean
}

/**
 * The gated boons that are in this build, and where they stand.
 *
 * Only the ones the build actually names. Listing all ten would be a reference
 * table, and the tool has a Codex-shaped hole elsewhere for that; this is about
 * the build in front of you.
 */
export function gateStanding(build: ShownBuild, tally: Record<string, number>): Standing[] {
  const held = [...build.boons, ...(build.optional ?? [])]

  return held.flatMap((id) => {
    const trait = traits.get(id)
    const needs = trait?.needsElements
    if (!trait || !needs) return []

    const rows = (want: Record<string, number> | undefined) =>
      Object.entries(want ?? {}).map(([element, need]) => ({
        element,
        need,
        held: tally[element] ?? 0,
      }))

    const appear = rows(needs.appear)
    const activate = rows(needs.activate)

    return [
      {
        id,
        name: trait.name ?? id,
        appear,
        activate,
        appears: appear.every((one) => one.held >= one.need),
        activates: activate.every((one) => one.held >= one.need),
      },
    ]
  })
}

/** The tally, and anything in the build that is waiting on it. */
export function ElementPanel({ build }: { build: ShownBuild }) {
  const tally = elementTally(build)
  const gates = gateStanding(build, tally)
  const any = ELEMENTS.some((one) => tally[one.id])

  if (!any && gates.length === 0) return null

  return (
    <section className="elements">
      <h3 className="editor-rule">Elements</h3>

      <div className="elements-tally">
        {ELEMENTS.map((one) => {
          const held = tally[one.id] ?? 0
          return (
            <span key={one.id} className={`element-count${held ? '' : ' is-none'}`} title={one.id}>
              <img src={`/${one.icon}`} alt="" aria-hidden="true" />
              <strong>{held}</strong>
              <span className="visually-hidden">{one.id}</span>
            </span>
          )
        })}
      </div>

      <p className="editor-hint">
        Counted from the boons this build names. A run also picks elements up
        elsewhere, so this is the floor rather than what you would end with.
      </p>

      {gates.length ? (
        <ul className="elements-gates">
          {gates.map((gate) => (
            <li key={gate.id}>
              <span className="elements-gate-name">{gate.name}</span>
              <span className="elements-gate-rows">
                <Row label="Appears at" rows={gate.appear} met={gate.appears} />
                <Row label="Works at" rows={gate.activate} met={gate.activates} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** One threshold line. Draws nothing where the game states no threshold. */
function Row({
  label,
  rows,
  met,
}: {
  label: string
  rows: { element: string; held: number; need: number }[]
  met: boolean
}) {
  if (!rows.length) return null
  return (
    <span className={`elements-gate-row${met ? ' is-met' : ''}`}>
      <span className="elements-gate-label">{label}</span>
      {rows.map((one) => (
        <span key={one.element} className={one.held >= one.need ? 'is-met' : undefined}>
          {one.held} of {one.need} {one.element}
        </span>
      ))}
    </span>
  )
}
