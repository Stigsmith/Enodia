/**
 * The filter bar. Dropdowns, arm first.
 *
 * **This was a wall of chips and the chips lost on space.** Five facets across
 * eight builds is 28 chips, about nine rows on a phone, and the library is
 * meant to grow: at eighty builds it would have been the whole screen before a
 * single build appeared. Five dropdowns are five rows at any size.
 *
 * That cost chips their one advantage, holding several values, and it has since
 * been paid back: `Dropdown` takes a `many` mode, so "Zeus or Poseidon" is
 * expressible again in one row instead of nine. Fear is the exception, and
 * `build-filter.ts` says why from the model's side.
 *
 * **Search is not a facet.** It narrows by text the reader typed rather than by
 * a value the library offers, so it has no options to count and nothing to put
 * in a dropdown. Putting it through the facet machinery would mean every option
 * count silently answering "how many, of the ones matching your text", which is
 * a different question from the one the counts promise.
 *
 * **The facet dropdowns are not native selects.** They show the game's own art
 * beside each option, and `<option>` cannot hold an image in any engine, so
 * `Dropdown.tsx` rebuilds the control and everything the native one gave away
 * for free. Sort stays a real `<select>`: it is three words with no art, and
 * there is nothing to gain by reimplementing it.
 *
 * **Arm, then aspect, on the surface.** That is the order a player thinks in.
 * Gods, keepsake and familiar unfold, and the shut disclosure keeps a count so
 * a filter left on out of sight cannot narrow the list with nothing on screen
 * saying why. That is the failure mode of every collapsed filter pane.
 */

import { useId, useState } from 'react'

import { Dropdown } from './Dropdown.tsx'
import { SORTS, SURFACE_FACETS, countSelected } from './build-filter.ts'
import type { Facet, FacetId, SortId } from './build-filter.ts'
import type { BuildDensity } from '../state/prefs.ts'

export function BuildFilters({
  facets,
  onChoose,
  onClear,
  sort,
  onSort,
  density,
  onDensity,
  query,
  onQuery,
  showing,
  total,
}: {
  facets: Facet[]
  onChoose: (facet: FacetId, value: string | null) => void
  onClear: () => void
  sort: SortId
  onSort: (sort: SortId) => void
  /** How closely builds are packed, and how to change it. */
  density: BuildDensity
  onDensity: (density: BuildDensity) => void
  query: string
  onQuery: (query: string) => void
  showing: number
  total: number
}) {
  const [open, setOpen] = useState(false)
  const paneId = useId()

  const surface = facets.filter((facet) => SURFACE_FACETS.includes(facet.id))
  const rest = facets.filter((facet) => !SURFACE_FACETS.includes(facet.id))
  /* `.length > 0`, not a truthiness check. `chosen` is an array now and an empty
   * array is truthy, so the old `!== null` would have counted every facet as
   * picked and put a badge on the disclosure permanently. */
  const hiddenPicks = rest.filter((facet) => facet.chosen.length > 0).length
  // Partial on purpose: `facets()` drops a facet with no options, so this object
  // is missing those keys and `countSelected` is written to expect that. The
  // cast that used to be here is what let the gap through.
  const picked = countSelected(Object.fromEntries(facets.map((facet) => [facet.id, facet.chosen])))

  return (
    <div className="bfilter">
      <div className="bfilter-surface">
        {surface.map((facet) => (
          <Drop key={facet.id} facet={facet} onChoose={onChoose} />
        ))}
      </div>

      <div className="bfilter-bar">
        {/* Type rather than pick. `search` so a phone offers the right keyboard
          * and the browser draws its own clear affordance. */}
        <label className="bfilter-find">
          <span className="visually-hidden">Search builds</span>
          <input
            type="search"
            value={query}
            placeholder="Search"
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>

        <button
          type="button"
          className={`bfilter-more${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-controls={paneId}
          onClick={() => setOpen((was) => !was)}
        >
          <span className="bfilter-caret" aria-hidden="true" />
          More filters
          {!open && hiddenPicks ? <span className="bfilter-badge">{hiddenPicks}</span> : null}
        </button>

        <label className="bfilter-sort">
          <span>Sort</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as SortId)}>
            {SORTS.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
          </select>
        </label>

        {/**
          * Cards or a list, on the same row as Sort because it is the same kind
          * of question: not what is on the shelf, but how to look at it.
          *
          * Two states, so a switch rather than a menu, and it says which one it
          * is rather than which one it would become. Measured at 1600x950 with
          * eighteen builds: five fully on screen as cards, and the owner asked
          * for at least twelve.
          */}
        <div className="bfilter-density" role="radiogroup" aria-label="How closely builds are packed">
          {(['cards', 'list'] as const).map((one) => (
            <button
              key={one}
              type="button"
              role="radio"
              aria-checked={density === one}
              className={density === one ? 'is-on' : ''}
              onClick={() => onDensity(one)}
            >
              {one === 'cards' ? 'Cards' : 'List'}
            </button>
          ))}
        </div>

        <p className="bfilter-count" aria-live="polite">
          {showing === total ? (
            <>
              <strong>{total}</strong> builds
            </>
          ) : (
            <>
              <strong>{showing}</strong> of {total}
            </>
          )}
        </p>

        {picked || query ? (
          <button type="button" className="bfilter-clear" onClick={onClear}>
            {picked ? `Clear ${picked}` : 'Clear'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="bfilter-pane" id={paneId}>
          {rest.map((facet) => (
            <Drop key={facet.id} facet={facet} onChoose={onChoose} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** One facet, as a listbox that can show the art. */
function Drop({
  facet,
  onChoose,
}: {
  facet: Facet
  onChoose: (facet: FacetId, value: string | null) => void
}) {
  return (
    <Dropdown
      label={facet.name}
      all={facet.all}
      options={facet.options}
      many={facet.many}
      held={facet.chosen}
      /* The single-value path still reads `chosen`, and Fear is the one facet
       * that takes it. `build-filter.ts` explains why Fear is a threshold and
       * therefore cannot usefully hold a set. */
      chosen={facet.chosen[0] ?? null}
      onChoose={(value) => onChoose(facet.id, value)}
    />
  )
}
