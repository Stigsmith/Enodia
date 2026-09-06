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

import { FRAME, PLATE } from './build-pieces.ts'
import type { Rarity } from '../data/types.ts'

export type PickOption = {
  value: string
  label: string
  icon?: string | null
  /** the heading this sits under, when the list is grouped */
  group?: string
  /** shown under the label, where there is something worth saying */
  note?: string | null
  /**
   * What the game would frame this as.
   *
   * The picker used to draw a bare icon, so Killer Current and Heart Breaker
   * looked identical in the list you pick them from, while every other screen
   * in the tool had been drawing duos and legendaries in their own frames since
   * the beginning. The information was there and the one screen that most
   * needed it was the one not using it.
   *
   * Absent means no frame at all, which is right for an Arcana card and a
   * familiar: they are not boons and framing them as Common would be a claim
   * about rarity where rarity does not apply.
   *
   * There is no slot glyph here, and that is deliberate rather than an
   * oversight. Both boon pickers are filtered to slotless boons, and the one
   * control that does offer core boons is the slot bar's own dropdown, where
   * which slot you are filling is the thing you clicked to get there. A glyph
   * would be unreachable in one place and redundant in the other.
   */
  rarity?: Rarity
  /**
   * Why this cannot be picked, when it cannot.
   *
   * The Arcana tab let you keep adding past the Grasp a save holds, and this
   * said the Arcana screen three clicks away enforced it exactly. It did not.
   * It warned and allowed. Both refuse now, against one `MAX_GRASP`.
   */
  blocked?: string | null
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
              <Face option={one} />
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

/**
 * One option's art, framed the way the game frames it.
 *
 * Deliberately not `Mark`. That takes a `Piece`, which is a whole assembled
 * build's worth of shape, and building one per row for two hundred rows to get
 * at two image tags would be the tail wagging the dog. It reads the same `FRAME`
 * map, so a duo here and a duo on the card wear the same art.
 */
function Face({ option }: { option: PickOption }) {
  if (!option.icon) return null
  const frame = option.rarity ? FRAME[option.rarity] : null

  return (
    <span className={`picklist-face${frame ? ' is-framed' : ''}`}>
      <img className="picklist-art" src={`/${option.icon}`} alt="" loading="lazy" />
      {frame ? <img className="picklist-frame" src={`/${frame}`} alt="" aria-hidden="true" /> : null}
    </span>
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
          disabled={!!one.blocked}
          className={`picklist-row${one.blocked ? ' is-blocked' : ''}`}
          onClick={() => onToggle(one.value)}
          title={one.blocked ?? one.note ?? one.label}
          /* The game's own backing plate, which is the thing that makes a list
           * of boons read as boons. It is a 4:1 bar with the colour on the left
           * where the icon sits, so a legendary row is gold under its icon and
           * a duo row is green, which is a second reading of the same fact the
           * frame gives. */
          style={one.rarity ? ({ '--plate': `url(/${PLATE[one.rarity]})` } as React.CSSProperties) : undefined}
        >
          <Face option={one} />
          <span className="picklist-row-text">
            <span className="picklist-row-name">{one.label}</span>
            {one.blocked ? (
              <span className="picklist-row-blocked">{one.blocked}</span>
            ) : one.note && !cards ? (
              <span className="picklist-row-note">{one.note}</span>
            ) : null}
          </span>
          <span className="picklist-add" aria-hidden="true">
            +
          </span>
        </button>
      ))}
    </div>
  )
}
