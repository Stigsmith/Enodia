/**
 * Sorting boons into the build and the things that would only help.
 *
 * ## Why this replaces two pick lists
 *
 * "Beyond the slots" and "Worth adding" were two separate `PickList`s fed the
 * same options, and nothing connected them. So the same boon could sit in both
 * at once, which is not a state a build can be in: a boon is either part of the
 * build or it is upside, and it cannot be both at the same time.
 *
 * The old fix would have been a check that catches it afterwards. **The real
 * fix is one list with a destination**, because then the bad state cannot be
 * described rather than being described and then reported.
 *
 * ## Drag, and click
 *
 * Dragging is the ask and it is the better gesture on a desktop. It is also
 * unusable on a phone, so the row itself is the other way in: clicking a boon
 * sends it into the build, dragging it puts it in whichever tray you drop it on.
 *
 * **Neither adds any furniture to the row.** The first version put a pair of
 * buttons on every row and a swap arrow on every chip, and at two hundred rows
 * that is four hundred controls nobody asked for. The row is the control.
 *
 * ## The picker knows what a run can give you
 *
 * A boon that cannot be had is greyed and says why on the row, rather than
 * being taken and then reported by a checker two panels away. What that means
 * in practice is the Olympian count, which is the one ceiling a slotless boon
 * can push a build past. See `rows` below for why it is the only one, and why
 * it is counted rather than asked of `checkBuild`.
 */

import { useMemo, useState } from 'react'

import { iconOf, olympians, traits } from '../data/app.ts'
import { olympiansOf, slotMap } from '../engine/build-check.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import { FRAME, PLATE } from './build-pieces.ts'
import { ELEMENT_ICON } from './Elements.tsx'
import type { ShownBuild } from '../data/builds.ts'
import type { Rarity, TraitId } from '../data/types.ts'

const OLYMPIAN = new Set<string>(olympians)

/**
 * The most Olympians a build can ask for.
 *
 * Five, which is `engine/repeat.ts`'s line: four is where the random pool
 * freezes and a keepsake buys the fifth. Named here rather than imported
 * because `repeat.ts` states it as a hard stop on a whole build and this needs
 * it as a ceiling on one more pick.
 */
const MAX_GODS = 5

/** Where a boon can live. `null` is the picker, which is neither. */
export type Tray = 'build' | 'optional'

type Row = {
  id: TraitId
  name: string
  icon: string | null
  text: string | null
  rarity: Rarity
  god: string | null
  /** the element it carries, for the 196 that carry one */
  element: string | null
  /** why this cannot be taken, when it cannot */
  blocked: string | null
}

/**
 * What frame and plate a boon wears, which is what tells duos and legendaries
 * apart from everything else at a glance. Same call `build-pieces.ts` makes and
 * for the same reason: a boon's rarity in a run is not knowable in advance, so
 * everything that is not a duo or a legendary wears Common.
 */
const rarityOf = (kind: string): Rarity =>
  kind === 'duo' ? 'Duo' : kind === 'legendary' ? 'Legendary' : 'Common'

export function BoonSort({
  build,
  options,
  onMove,
}: {
  build: ShownBuild
  /** every boon that can be sorted, which is everything occupying no core slot */
  options: readonly TraitId[]
  /** move a boon to a tray, or out of both when `to` is null */
  onMove: (id: TraitId, to: Tray | null) => void
}) {
  const [query, setQuery] = useState('')
  const [openGod, setOpenGod] = useState<string | null>(null)
  const [dragging, setDragging] = useState<TraitId | null>(null)
  const [over, setOver] = useState<Tray | null>(null)

  const inBuild = useMemo(
    () =>
      build.boons.filter((id) => {
        const slot = traits.get(id)?.slot
        return !slot || !CORE_SLOTS.includes(slot)
      }),
    [build.boons],
  )
  const optional = build.optional ?? []
  const held = useMemo(() => new Set([...inBuild, ...optional]), [inBuild, optional])

  /**
   * What each unheld boon would cost the build, and when it cannot be had.
   *
   * **The check that matters here is the Olympian one.** A boon occupying no
   * core slot cannot trip any of `checkBuild`'s blockers: those are about slots,
   * arms, the centrepiece and Grasp, and a slotless boon touches none of them.
   * What it can do is bring a god, and a build past five Olympians is one
   * `engine/repeat.ts` already calls Not in one run: the random pool freezes at
   * four and a run gives four keepsakes, so a sixth god is not arriving.
   *
   * Counted rather than re-checked. Calling `checkBuild` once per option is a
   * few hundred full passes on every keystroke; a set union per option is not.
   */
  const rows = useMemo((): Row[] => {
    const slots = slotMap(build)
    const already = new Set(olympiansOf(build))

    return options.flatMap((id) => {
      const trait = traits.get(id)
      if (!trait || held.has(id)) return []

      let blocked: string | null = null

      // A core-slot clash, for the few sortable traits that declare one.
      if (trait.slot && CORE_SLOTS.includes(trait.slot)) {
        const sitting = slots.get(trait.slot)?.[0]
        if (sitting && sitting !== id) {
          blocked = `${traits.get(sitting)?.name ?? sitting} already holds your ${slotLabel(trait.slot)}.`
        }
      }

      // The god cost. A duo names two and needs both, so both count.
      if (!blocked) {
        const adds = trait.gods.filter((god) => OLYMPIAN.has(god) && !already.has(god))
        if (adds.length && already.size + adds.length > MAX_GODS) {
          blocked = `That would be ${already.size + adds.length} Olympians. The pool freezes at four and a run gives four keepsakes.`
        }
      }

      return [
        {
          id,
          name: trait.name ?? id,
          icon: iconOf.get(id) ?? null,
          text: trait.text ?? null,
          rarity: rarityOf(trait.kind),
          god: trait.gods[0] ?? null,
          element: trait.elements?.[0] ?? null,
          blocked,
        },
      ]
    })
  }, [options, held, build])

  const term = query.trim().toLowerCase()
  const found = useMemo(
    () => (term ? rows.filter((one) => one.name.toLowerCase().includes(term)) : rows),
    [rows, term],
  )

  /**
   * Grouped by god, one open at a time, which is what made the old list usable
   * at two hundred boons and is kept for the same reason. Searching opens
   * everything, because the point of a search is to stop hunting.
   */
  const gods = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of found) {
      const key = row.god ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), row])
    }
    for (const list of map.values()) {
      list.sort((a, b) => rank(a.rarity) - rank(b.rarity) || a.name.localeCompare(b.name))
    }
    return [...map].sort((a, b) => a[0].localeCompare(b[0]))
  }, [found])

  const drop = (to: Tray) => (event: React.DragEvent) => {
    event.preventDefault()
    setOver(null)
    const id = event.dataTransfer.getData('text/plain') || dragging
    if (id) onMove(id as TraitId, to)
    setDragging(null)
  }

  return (
    <div className="bsort">
      <div className="bsort-picker">
        <input
          type="search"
          className="picklist-search"
          value={query}
          placeholder="Search boons"
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="bsort-scroll">
          {term ? (
            <Rows list={found} onMove={onMove} onDrag={setDragging} />
          ) : (
            gods.map(([god, list]) => (
              <div key={god} className="picklist-group">
                <button
                  type="button"
                  className={`picklist-head${openGod === god ? ' is-open' : ''}`}
                  aria-expanded={openGod === god}
                  onClick={() => setOpenGod((was) => (was === god ? null : god))}
                >
                  <span className="picklist-caret" aria-hidden="true" />
                  {god}
                  <span className="picklist-count">{list.length}</span>
                </button>
                {openGod === god ? <Rows list={list} onMove={onMove} onDrag={setDragging} /> : null}
              </div>
            ))
          )}
          {found.length === 0 ? (
            <p className="picklist-none">
              {term ? `Nothing matches "${query}".` : 'Every boon is already sorted.'}
            </p>
          ) : null}
        </div>
      </div>

      <div className="bsort-trays">
        <TrayBox
          tray="build"
          label="The build"
          hint="What it is not a build without."
          ids={inBuild}
          over={over === 'build'}
          onMove={onMove}
          onDrag={setDragging}
          onOver={setOver}
          onDrop={drop('build')}
        />
        <TrayBox
          tray="optional"
          label="Worth adding"
          hint="Raises the ceiling without being the build. One boon from a god you take for nothing else still spends an Olympian slot."
          ids={optional}
          over={over === 'optional'}
          onMove={onMove}
          onDrag={setDragging}
          onOver={setOver}
          onDrop={drop('optional')}
        />
      </div>
    </div>
  )
}

/** Duos and legendaries first: they are what somebody is scrolling to find. */
const rank = (rarity: Rarity) => (rarity === 'Legendary' ? 0 : rarity === 'Duo' ? 1 : 2)

function Rows({
  list,
  onMove,
  onDrag,
}: {
  list: Row[]
  onMove: (id: TraitId, to: Tray | null) => void
  onDrag: (id: TraitId | null) => void
}) {
  return (
    <div className="bsort-rows">
      {list.map((row) => (
        <button
          key={row.id}
          type="button"
          disabled={!!row.blocked}
          className={`bsort-row${row.blocked ? ' is-blocked' : ''}`}
          style={{ '--plate': `url(/${PLATE[row.rarity]})` } as React.CSSProperties}
          title={row.blocked ?? `Add ${row.name} to the build, or drag it to either tray`}
          onClick={() => onMove(row.id, 'build')}
          draggable={!row.blocked}
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', row.id)
            onDrag(row.id)
          }}
          onDragEnd={() => onDrag(null)}
        >
          <Face row={row} />
          {/* The element it brings, which is what the tally at the foot of the
            * tab is counting. Small: it is a fact about the boon, not the
            * reason to take one. */}
          {row.element ? (
            <img
              className="bsort-element"
              src={`/${ELEMENT_ICON[row.element]}`}
              alt=""
              title={row.element}
            />
          ) : null}
          <span className="bsort-row-text">
            <span className="bsort-row-name">{row.name}</span>
            {row.blocked ? (
              <span className="bsort-row-blocked">{row.blocked}</span>
            ) : row.text ? (
              <span className="bsort-row-note">{row.text}</span>
            ) : null}
          </span>

        </button>
      ))}
    </div>
  )
}

function TrayBox({
  tray,
  label,
  hint,
  ids,
  over,
  onMove,
  onDrag,
  onOver,
  onDrop,
}: {
  tray: Tray
  label: string
  hint: string
  ids: readonly TraitId[]
  over: boolean
  onMove: (id: TraitId, to: Tray | null) => void
  onDrag: (id: TraitId | null) => void
  onOver: (tray: Tray | null) => void
  onDrop: (event: React.DragEvent) => void
}) {
  return (
    <section
      className={`bsort-tray${over ? ' is-over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        onOver(tray)
      }}
      onDragLeave={() => onOver(null)}
      onDrop={onDrop}
    >
      <h4 className="editor-rule">{label}</h4>
      <p className="editor-hint">{hint}</p>

      <div className="bsort-held">
        {ids.length === 0 ? (
          <p className="bsort-empty">Drag a boon here, or click one in the list.</p>
        ) : (
          ids.map((id) => {
            const trait = traits.get(id)
            const rarity = rarityOf(trait?.kind ?? 'boon')
            return (
              <div
                key={id}
                className="bsort-chip"
                style={{ '--plate': `url(/${PLATE[rarity]})` } as React.CSSProperties}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', id)
                  onDrag(id)
                }}
                onDragEnd={() => onDrag(null)}
              >
                <Face row={{ icon: iconOf.get(id) ?? null, rarity, name: trait?.name ?? id }} />
                <span className="bsort-chip-name">{trait?.name ?? id}</span>
                <button
                  type="button"
                  className="bsort-drop"
                  title={`Remove ${trait?.name ?? id}`}
                  onClick={() => onMove(id, null)}
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

/** The art, framed the way the game frames it. Same maps the card and tray use. */
function Face({ row }: { row: { icon: string | null; rarity: Rarity; name: string } }) {
  if (!row.icon) return null
  return (
    <span className="bsort-face">
      <img className="bsort-art" src={`/${row.icon}`} alt="" loading="lazy" />
      <img className="bsort-frame" src={`/${FRAME[row.rarity]}`} alt="" aria-hidden="true" />
    </span>
  )
}
