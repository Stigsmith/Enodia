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
import { olympiansOf } from '../engine/build-check.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import { FRAME, PLATE, SLOT_GLYPH } from './build-pieces.ts'
import { ELEMENT_ICON } from './Elements.tsx'
import type { ShownBuild } from '../data/builds.ts'
import type { Rarity, Slot, TraitId } from '../data/types.ts'
import { coreAt, coreSlotOf, isHammer } from '../engine/picks.ts'
import { useTraitPeek } from './BuildMark.tsx'

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

/**
 * The heading the hammer upgrades file under.
 *
 * Set here rather than read off the trait, because all 92 carry
 * `gods: ['Loot']` and a group headed "Loot" would be a Lua identifier on
 * screen. `CLAUDE.md` has a table for exactly this: the player-facing word
 * first, the internal one never.
 */
const HAMMER_GROUP = 'Daedalus Hammer'

/**
 * The gods a run decides about, which are not gods you pick at an Exit.
 *
 * Chaos is behind a gate you have to find and pay for. The four Encounter gods
 * arrive through Encounters, cost no Olympian slot, and turn up on the run's
 * schedule. Grouped away from the Olympians because the difference is the whole
 * point: everything above the divider is something you can ask for.
 *
 * The same set `repeat.ts` calls `UNSUMMONABLE`, minus Hermes, who has a
 * `LootData` entry and does appear behind an Exit.
 */
const WANDERING = new Set(['Chaos', 'Artemis', 'Athena', 'Dionysus', 'Hades'])

/** Where a boon can live. `null` is the picker, which is neither. */
export type Tray = 'build' | 'optional'

type Row = {
  id: TraitId
  name: string
  icon: string | null
  text: string | null
  rarity: Rarity
  god: string | null
  /**
   * The heading this row files under, which is not always its god.
   *
   * **All 92 hammer traits carry `gods: ['Loot']`**, so grouping by `gods[0]`
   * the way the god rows do would head a group "Loot": a Lua identifier on
   * screen, which is exactly what `CLAUDE.md`'s vocabulary rule exists to stop.
   */
  group: string
  /** what this would push out of its core slot, when it would push something */
  replaces: string | null
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
  slotFilter,
  onSlotFilter,
  onReorder,
}: {
  build: ShownBuild
  /** everything that can be sorted: every boon a god offers, and this arm's hammers */
  options: readonly TraitId[]
  /** move a pick to a tray, or out of the build when `to` is null */
  onMove: (id: TraitId, to: Tray | null) => void
  /** narrow the list to one core slot, set by pressing a tile */
  slotFilter?: Slot | null
  onSlotFilter?: (slot: Slot | null) => void
  /** put one Worth adding pick before another. See `reorderOptional` */
  onReorder?: (id: TraitId, before: TraitId | null) => void
}) {
  const [query, setQuery] = useState('')
  const [openGod, setOpenGod] = useState<string | null>(null)
  const [dragging, setDragging] = useState<TraitId | null>(null)
  /** A tray, or a slot tile: seven drop targets, one piece of state. */
  const [over, setOver] = useState<Tray | Slot | null>(null)
  /**
   * Where a click sends a row.
   *
   * **Clicking always meant "the build", and that was survivable until now.**
   * Drag was the only route to Worth adding, so on a touch screen there was no
   * route at all. That mattered less when optional held spare boons; it matters
   * now that it holds core slots and hammers, which is most of what somebody
   * would want to put there.
   *
   * One control for the whole list rather than a second button on every row.
   * The docblock at the top of this file records that per-row buttons were
   * tried and removed at two hundred rows, and there are more rows now.
   */
  const [aim, setAim] = useState<Tray>('build')

  /** The slate a slot tile shows on hover. See `useTraitPeek`. */
  const slotPeek = useTraitPeek()

  /**
   * The trays list everything except the five core slots, which the tiles above
   * are the readout for. Drawing them in both places would make the tiles look
   * decorative.
   */
  const notCore = (id: TraitId) => !coreSlotOf(id)
  const inBuild = useMemo(
    () => [...build.boons, ...build.hammers].filter(notCore),
    [build.boons, build.hammers],
  )
  const optional = useMemo(() => (build.optional ?? []).filter(notCore), [build.optional])
  const held = useMemo(
    () => new Set([...build.boons, ...build.hammers, ...(build.optional ?? [])]),
    [build.boons, build.hammers, build.optional],
  )

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
    const already = new Set(olympiansOf(build))

    return options.flatMap((id) => {
      const trait = traits.get(id)
      if (!trait || held.has(id)) return []

      let blocked: string | null = null

      /**
       * A core-slot clash is a replacement, not a refusal.
       *
       * This used to set `blocked`, and it was unreachable because core-slot
       * traits were filtered out of the list entirely. Now they are the list,
       * and blocking would leave grey rows whose only remedy is to go and empty
       * a tile first. `movePick` displaces instead, so the row says what it
       * will replace before it is pressed, which is what `takeFix` already does
       * for the same reason.
       */
      let replaces: string | null = null
      const slot = coreSlotOf(id)
      if (slot) {
        const sitting = coreAt(build, slot)
        if (sitting && sitting.id !== id) {
          replaces = `Replaces ${traits.get(sitting.id)?.name ?? sitting.id} in your ${slotLabel(slot)}.`
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
          group: isHammer(id) ? HAMMER_GROUP : (trait.gods[0] ?? 'Other'),
          replaces,
          element: trait.elements?.[0] ?? null,
          blocked,
        },
      ]
    })
  }, [options, held, build])

  const term = query.trim().toLowerCase()
  const found = useMemo(() => {
    const narrowed = term ? rows.filter((one) => one.name.toLowerCase().includes(term)) : rows
    return slotFilter ? narrowed.filter((one) => coreSlotOf(one.id) === slotFilter) : narrowed
  }, [rows, term, slotFilter])
  /* A filter collapses the groups the same way a search does, because the point
   * of narrowing to one slot is to stop opening things. */
  const flat = Boolean(term) || Boolean(slotFilter)

  /**
   * Grouped by god, one open at a time, which is what made the old list usable
   * at two hundred boons and is kept for the same reason. Searching opens
   * everything, because the point of a search is to stop hunting.
   */
  const gods = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of found) {
      map.set(row.group, [...(map.get(row.group) ?? []), row])
    }
    for (const list of map.values()) {
      list.sort((a, b) => rank(a.rarity) - rank(b.rarity) || a.name.localeCompare(b.name))
    }
    /**
     * Three bands, each alphabetical inside itself.
     *
     * The Olympians, then the gods the run decides about, then the hammers.
     * Without an explicit rank `localeCompare` files "Daedalus Hammer" between
     * Ares and Demeter and Chaos between Ares and Demeter's other side, which
     * reads as two gods nobody has heard of.
     */
    const order = (key: string) =>
      key === HAMMER_GROUP ? 3 : key === 'Other' ? 2 : WANDERING.has(key) ? 1 : 0
    return [...map].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
  }, [found])

  const drop = (to: Tray) => (event: React.DragEvent) => {
    event.preventDefault()
    setOver(null)
    const id = event.dataTransfer.getData('text/plain') || dragging
    if (id) onMove(id as TraitId, to)
    setDragging(null)
  }

  /**
   * A tile takes a drop only from a pick that belongs in it.
   *
   * Read off `dragging` rather than off the drop, so the tile can refuse to
   * light up while the pointer is still moving. Dropping a Cast boon on the
   * Attack tile does nothing, which is better than silently putting it
   * somewhere else.
   */
  const wants = (slot: Slot) => Boolean(dragging && coreSlotOf(dragging) === slot)
  const dropOnSlot = (slot: Slot) => (event: React.DragEvent) => {
    event.preventDefault()
    setOver(null)
    const id = (event.dataTransfer.getData('text/plain') || dragging) as TraitId | null
    if (id && coreSlotOf(id) === slot) onMove(id, 'build')
    setDragging(null)
  }

  return (
    <div className="bsort">
      {/**
       * The five core slots, as a readout and as five more drop targets.
       *
       * They were on another tab, above a dropdown that showed a name and an
       * icon and no description, so the 45 boons that matter most were the only
       * ones you could not read while choosing. The tiles stayed because they
       * say the one thing a list cannot: how much of the build is still open.
       *
       * A tile filled from Worth adding is drawn differently from one filled
       * from the build, because those are different claims and the whole reason
       * for this change is being able to make the weaker one.
       */}
      <div className="slotbar" role="group" aria-label="The five core slots">
        {CORE_SLOTS.map((slot) => {
          const at = coreAt(build, slot)
          const trait = at ? traits.get(at.id) : null
          const icon = at ? iconOf.get(at.id) : null
          const glyph = SLOT_GLYPH[slot]
          const spare = at?.tray === 'optional'
          return (
            <button
              key={slot}
              type="button"
              className={`slotbar-tile${at ? ' is-held' : ''}${spare ? ' is-optional' : ''}${
                slotFilter === slot ? ' is-open' : ''
              }${over === slot ? ' is-over' : ''}${wants(slot) ? ' is-wanted' : ''}`}
              aria-pressed={slotFilter === slot}
              aria-label={
                trait?.name
                  ? `${trait.name}, ${slotLabel(slot)}${spare ? ', worth adding' : ''}`
                  : `${slotLabel(slot)}, empty`
              }
              {...slotPeek(trait ?? null, slotLabel(slot), icon ?? null)}
              /* Draggable when filled, which is how a required core boon is
               * demoted: drag it off the tile onto Worth adding. Without it the
               * only way down is to take it out and put it back. */
              draggable={Boolean(at)}
              onDragStart={(event) => {
                if (!at) return
                event.dataTransfer.setData('text/plain', at.id)
                setDragging(at.id)
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => {
                if (!wants(slot)) return
                event.preventDefault()
                setOver(slot)
              }}
              onDragLeave={() => setOver((was) => (was === slot ? null : was))}
              onDrop={dropOnSlot(slot)}
              onClick={() => onSlotFilter?.(slotFilter === slot ? null : slot)}
            >
              <span className="slotbar-art">
                {icon ? (
                  <img src={`/${icon}`} alt="" loading="lazy" />
                ) : glyph ? (
                  <img className="slotbar-glyph" src={`/${glyph}`} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className="slotbar-slot">{spare ? 'Worth adding' : slotLabel(slot)}</span>
              <span className="slotbar-name">{trait?.name ?? 'Open'}</span>
              {/* The only way to empty a slot. The trays do not list core picks,
                * because the tiles are their readout, so without this a filled
                * slot could be replaced and never cleared. Five at most, so it
                * does not run into the rule against a control on every row. */}
              {at ? (
                <span
                  className="slotbar-clear"
                  role="button"
                  tabIndex={0}
                  aria-label={`Clear your ${slotLabel(slot)}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onMove(at.id, null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    onMove(at.id, null)
                  }}
                >
                  &times;
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="bsort-picker">
        <input
          type="search"
          className="picklist-search"
          value={query}
          placeholder="Search boons, hammers"
          onChange={(event) => setQuery(event.target.value)}
        />

        {/* Where a click sends a row. One control for the whole list, and the
          * only route to Worth adding that does not need a mouse. */}
        <div className="bsort-aim" role="group" aria-label="Where a pick goes">
          {(['build', 'optional'] as const).map((one) => (
            <button
              key={one}
              type="button"
              className={aim === one ? 'is-on' : ''}
              aria-pressed={aim === one}
              onClick={() => setAim(one)}
            >
              {one === 'build' ? 'The build' : 'Worth adding'}
            </button>
          ))}
        </div>

        {slotFilter ? (
          <button
            type="button"
            className="bsort-filter"
            onClick={() => onSlotFilter?.(null)}
          >
            {slotLabel(slotFilter)} boons only
            <span aria-hidden="true"> ×</span>
          </button>
        ) : null}

        <div className="bsort-scroll">
          {flat ? (
            <Rows list={found} aim={aim} onMove={onMove} onDrag={setDragging} />
          ) : (
            gods.map(([god, list], at) => (
              <div key={god} className="picklist-group">
                {/* Said once, above the first of them. They cost no Olympian
                  * slot and you cannot go and get one, and a reader who does
                  * not know that would read these as five more gods. */}
                {WANDERING.has(god) && !WANDERING.has(gods[at - 1]?.[0] ?? '') ? (
                  <p className="bsort-band">
                    These turn up when the run decides. No Olympian slot, and no
                    way to ask.
                  </p>
                ) : null}
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
                {openGod === god ? (
                  <Rows list={list} aim={aim} onMove={onMove} onDrag={setDragging} />
                ) : null}
              </div>
            ))
          )}
          {found.length === 0 ? (
            <p className="picklist-none">
              {term
                ? `Nothing matches "${query}".`
                : slotFilter
                  ? `Nothing left for your ${slotLabel(slotFilter)}.`
                  : 'Everything is already sorted.'}
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
          ranked
          onReorder={onReorder}
          hint="In the order you want them. Raises the ceiling without being the build, and none of it is counted against the reading. One boon from a god you take for nothing else still spends an Olympian slot."
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
  aim,
  onMove,
  onDrag,
}: {
  list: Row[]
  /** where a click sends this row, set once for the whole list */
  aim: Tray
  onMove: (id: TraitId, to: Tray | null) => void
  onDrag: (id: TraitId | null) => void
}) {
  const where = aim === 'build' ? 'the build' : 'Worth adding'
  return (
    <div className="bsort-rows">
      {list.map((row) => (
        <button
          key={row.id}
          type="button"
          disabled={!!row.blocked}
          className={`bsort-row${row.blocked ? ' is-blocked' : ''}`}
          style={{ '--plate': `url(/${PLATE[row.rarity]})` } as React.CSSProperties}
          data-rarity={row.rarity.toLowerCase()}
          title={row.blocked ?? `Add ${row.name} to ${where}, or drag it to either tray`}
          onClick={() => onMove(row.id, aim)}
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
            {/* Said before it is pressed, not reported afterwards. A core slot
              * holds one pick, so taking this one ejects whatever is in there,
              * and a click that silently removes something you chose is the
              * thing this line exists to prevent. */}
            {!row.blocked && row.replaces ? (
              <span className="bsort-row-replaces">{row.replaces}</span>
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
  ranked,
  onMove,
  onDrag,
  onOver,
  onDrop,
  onReorder,
}: {
  tray: Tray
  label: string
  hint: string
  ids: readonly TraitId[]
  over: boolean
  /**
   * Whether this list's order means something.
   *
   * Only Worth adding is ranked. The owner's account of what it is for: three
   * or four hammers really improve a build, some are better than others, one is
   * much better than none, and none of them is the worst version of the build.
   * That is a preference list, and a preference list nobody can put in order is
   * a list that says nothing.
   */
  ranked?: boolean
  onMove: (id: TraitId, to: Tray | null) => void
  onDrag: (id: TraitId | null) => void
  onOver: (tray: Tray | null) => void
  onDrop: (event: React.DragEvent) => void
  onReorder?: (id: TraitId, before: TraitId | null) => void
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
          ids.map((id, at) => {
            const trait = traits.get(id)
            const rarity = rarityOf(trait?.kind ?? 'boon')
            return (
              <div
                key={id}
                className="bsort-chip"
                style={{ '--plate': `url(/${PLATE[rarity]})` } as React.CSSProperties}
                data-rarity={rarity.toLowerCase()}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', id)
                  onDrag(id)
                }}
                onDragEnd={() => onDrag(null)}
                /* In a ranked list a chip is a drop target too: dropping one on
                 * another puts it in that place. The tray behind it still takes
                 * a drop, which is what sends a pick to the end. */
                {...(ranked && onReorder
                  ? {
                      onDragOver: (event: React.DragEvent) => {
                        event.preventDefault()
                        event.stopPropagation()
                      },
                      onDrop: (event: React.DragEvent) => {
                        event.preventDefault()
                        event.stopPropagation()
                        const moving = event.dataTransfer.getData('text/plain')
                        onOver(null)
                        onDrag(null)
                        if (!moving) return
                        // Dragged in from the picker or the other tray: it has
                        // to join the list before it can be placed in it.
                        if (!ids.includes(moving as TraitId)) onMove(moving as TraitId, tray)
                        onReorder(moving as TraitId, id)
                      },
                    }
                  : {})}
              >
                {ranked ? <span className="bsort-rank">{at + 1}</span> : null}
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
