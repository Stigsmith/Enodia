/**
 * The filter bar. Dropdowns, arm first.
 *
 * **This was a wall of chips and the chips lost on space.** Five facets across
 * eight builds is 28 chips, about nine rows on a phone, and the library is
 * meant to grow: at eighty builds it would have been the whole screen before a
 * single build appeared. Five dropdowns are five rows at any size.
 *
 * The cost is real and worth naming: a dropdown holds one value, so "Zeus or
 * Poseidon" is no longer expressible. `build-filter.ts` says the same thing
 * from the model's side.
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

import type { BuildDetail } from '../state/prefs.ts'
import { useId, useState } from 'react'

import { Dropdown } from './Dropdown.tsx'
import { SORTS, SURFACE_FACETS, countSelected } from './build-filter.ts'
import type { Facet, FacetId, SortId } from './build-filter.ts'

/** The two layouts a single build can open in. */
const DETAILS: { id: BuildDetail; name: string; note: string }[] = [
  { id: 'poster', name: 'Poster', note: 'The art large, everything else demoted. One build as a page' },
  {
    id: 'constellation',
    name: 'Constellation',
    note: 'Five fixed positions round the arm. A dark spoke is a gap you see at once',
  },
]

export function BuildFilters({
  facets,
  onChoose,
  onClear,
  sort,
  onSort,
  detail,
  onDetail,
  showing,
  total,
}: {
  facets: Facet[]
  onChoose: (facet: FacetId, value: string | null) => void
  onClear: () => void
  sort: SortId
  onSort: (sort: SortId) => void
  /** how a build opens, set here rather than in the menu */
  detail: BuildDetail
  onDetail: (detail: BuildDetail) => void
  showing: number
  total: number
}) {
  const [open, setOpen] = useState(false)
  const paneId = useId()

  const surface = facets.filter((facet) => SURFACE_FACETS.includes(facet.id))
  const rest = facets.filter((facet) => !SURFACE_FACETS.includes(facet.id))
  const hiddenPicks = rest.filter((facet) => facet.chosen !== null).length
  const picked = countSelected(
    Object.fromEntries(facets.map((facet) => [facet.id, facet.chosen])) as never,
  )

  return (
    <div className="bfilter">
      <div className="bfilter-surface">
        {surface.map((facet) => (
          <Drop key={facet.id} facet={facet} onChoose={onChoose} />
        ))}
      </div>

      <div className="bfilter-bar">
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

        {/* How a build opens. Two layouts, so a switch rather than a list:
            the Poster is "what shall I try", the Constellation is "where are
            the gaps". It sits with Sort because both are about how the library
            is presented rather than about which builds are in it. */}
        <div className="bfilter-layout" role="radiogroup" aria-label="How a build opens">
          {DETAILS.map((one) => (
            <button
              key={one.id}
              type="button"
              role="radio"
              aria-checked={detail === one.id}
              className={detail === one.id ? 'is-on' : ''}
              title={one.note}
              onClick={() => onDetail(one.id)}
            >
              {one.name}
            </button>
          ))}
        </div>

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

        {picked ? (
          <button type="button" className="bfilter-clear" onClick={onClear}>
            Clear {picked}
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
      chosen={facet.chosen}
      onChoose={(value) => onChoose(facet.id, value)}
    />
  )
}
