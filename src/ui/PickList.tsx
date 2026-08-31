/**
 * Picking a few things out of a hundred.
 *
 * **The first version was a wall of tags and it was unusable.** Every boon in
 * the game, one chip each, in one scrolling box, and the way to add Killer
 * Current was to scroll until you saw it. That is fine for the twenty-five
 * Arcana and a hard no for the two hundred boons, which is what the owner
 * called it.
 *
 * Three things fix it, and all three are the same idea: **do not make somebody
 * look at what they are not looking for.**
 *
 * - **Search.** Type two letters and the list is five rows.
 * - **Grouped, and one group at a time.** Boons are grouped by the god who
 *   offers them, which is how a player already thinks about them, and only the
 *   open group is drawn. Nine headers beat two hundred chips.
 * - **What is chosen is not in the list.** It sits above, in its own row, and
 *   is removed from there. Hunting through a long list to un-tick something is
 *   the same problem twice.
 *
 * An ungrouped list, which is what the Arcana and the hammers are, skips
 * straight to the rows and keeps the search.
 */

import { useMemo, useState } from 'react'

export type PickOption = {
  value: string
  label: string
  icon?: string | null
  /** the heading this sits under, when the list is grouped */
  group?: string
  /** shown under the label, where there is something worth saying */
  note?: string | null
}

export function PickList({
  options,
  chosen,
  onToggle,
  placeholder = 'Search',
  cards = false,
  emptySays = 'Nothing chosen yet.',
}: {
  options: PickOption[]
  chosen: readonly string[]
  onToggle: (id: string) => void
  placeholder?: string
  /** the options are tall painted cards rather than square icons */
  cards?: boolean
  emptySays?: string
}) {
  const [query, setQuery] = useState('')
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const byValue = useMemo(() => new Map(options.map((one) => [one.value, one])), [options])
  const picked = chosen.flatMap((id) => {
    const found = byValue.get(id)
    return found ? [found] : []
  })

  const term = query.trim().toLowerCase()

  /**
   * Everything not already chosen, narrowed by the search.
   *
   * **Deduplicated by value.** A duo is filed under both of its gods so it can
   * be found under either, which means the same option appears twice in the
   * flat list. Searching "killer" returned Killer Current twice, and the two
   * copies shared a React key.
   *
   * The grouped view keeps both, because there it is one row under Poseidon and
   * one under Zeus and that is the point of it.
   */
  const available = useMemo(() => {
    const list = options.filter(
      (one) => !chosen.includes(one.value) && (!term || one.label.toLowerCase().includes(term)),
    )
    if (!term) return list
    const seen = new Set<string>()
    return list.filter((one) => (seen.has(one.value) ? false : (seen.add(one.value), true)))
  }, [options, chosen, term])

  const grouped = options.some((one) => one.group)

  const groups = useMemo(() => {
    if (!grouped) return []
    const map = new Map<string, PickOption[]>()
    for (const one of available) {
      const key = one.group ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), one])
    }
    return [...map].sort((a, b) => a[0].localeCompare(b[0]))
  }, [available, grouped])

  // Searching opens everything: the point of a search is to stop hunting, and
  // making somebody then open a group to see the hits would put it back.
  const searching = term.length > 0

  return (
    <div className={`picklist${cards ? ' is-cards' : ''}`}>
      <div className="picklist-chosen">
        {picked.length ? (
          picked.map((one) => (
            <button
              key={one.value}
              type="button"
              className="picklist-pick is-on"
              onClick={() => onToggle(one.value)}
              title={`Remove ${one.label}`}
            >
              {one.icon ? <img src={`/${one.icon}`} alt="" loading="lazy" /> : null}
              <span>{one.label}</span>
              <span className="picklist-x" aria-hidden="true">
                &times;
              </span>
            </button>
          ))
        ) : (
          <p className="picklist-empty">{emptySays}</p>
        )}
      </div>

      <input
        type="search"
        className="picklist-search"
        value={query}
        placeholder={placeholder}
        onChange={(event) => setQuery(event.target.value)}
      />

      {grouped && !searching ? (
        <div className="picklist-groups">
          {groups.map(([name, list]) => (
            <div key={name} className="picklist-group">
              <button
                type="button"
                className={`picklist-head${openGroup === name ? ' is-open' : ''}`}
                aria-expanded={openGroup === name}
                onClick={() => setOpenGroup((was) => (was === name ? null : name))}
              >
                <span className="picklist-caret" aria-hidden="true" />
                {name}
                <span className="picklist-count">{list.length}</span>
              </button>
              {openGroup === name ? <Rows list={list} onToggle={onToggle} cards={cards} /> : null}
            </div>
          ))}
        </div>
      ) : available.length ? (
        <Rows list={available} onToggle={onToggle} cards={cards} />
      ) : (
        <p className="picklist-none">{term ? `Nothing matches "${query}".` : 'All of them are chosen.'}</p>
      )}
    </div>
  )
}

function Rows({
  list,
  onToggle,
  cards,
}: {
  list: PickOption[]
  onToggle: (id: string) => void
  cards: boolean
}) {
  return (
    <div className="picklist-rows">
      {list.map((one) => (
        <button
          key={`${one.group ?? ''}:${one.value}`}
          type="button"
          className="picklist-row"
          onClick={() => onToggle(one.value)}
          title={one.note ?? one.label}
        >
          {one.icon ? <img src={`/${one.icon}`} alt="" loading="lazy" /> : null}
          <span className="picklist-row-text">
            <span className="picklist-row-name">{one.label}</span>
            {one.note && !cards ? <span className="picklist-row-note">{one.note}</span> : null}
          </span>
          <span className="picklist-add" aria-hidden="true">
            +
          </span>
        </button>
      ))}
    </div>
  )
}
