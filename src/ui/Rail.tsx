/**
 * The rail. Five slots, fixed positions, always on screen, and it unfolds.
 *
 * `DESIGN.md` 8: an empty slot is the warning. A dark Cast slot states, without
 * saying anything, the thing that keeps half the live targets alive. Empty
 * slots show the game's own slot glyph rather than a hole, and a filled one
 * wears the game's rarity frame, which is how the game itself says Common from
 * Heroic and therefore says swappable from shut.
 *
 * Unfolded it is the "Held, expanded" overlay from the same section: everything
 * held, grouped by slot, each with the game's own sentence about what it does.
 * The slots keep their order and their places, because a fixed position is what
 * makes the folded rail readable without being read.
 */

import { useState } from 'react'

import { iconOf, traits } from '../data/app.ts'
import { CORE_SLOTS, slotLabel, slotStates } from '../engine/slots.ts'
import type { Held, HeldTrait, Rarity, Slot } from '../data/types.ts'

/** The library's names for the game's slot glyphs. */
const SLOT_GLYPH: Record<Slot, string | null> = {
  Melee: 'slots/attack.webp',
  Secondary: 'slots/special.webp',
  Ranged: 'slots/cast.webp',
  Rush: 'slots/dash.webp',
  Mana: 'slots/magick.webp',
  Spell: null,
  Keepsake: null,
  Aspect: null,
}

const FRAME: Record<Rarity, string> = {
  Common: 'frames/frame-common.png',
  Rare: 'frames/frame-rare.png',
  Epic: 'frames/frame-epic.png',
  Heroic: 'frames/frame-heroic.png',
  Duo: 'frames/frame-duo.png',
  Legendary: 'frames/frame-legendary.png',
  Perfect: 'frames/frame-legendary.png',
}

export function Rail({ held }: { held: Held }) {
  const [open, setOpen] = useState(false)
  const states = slotStates(held, traits)

  // Everything held that occupies no core slot, which is most of a run.
  const slotless = held.filter((entry) => {
    const slot = traits.get(entry.id)?.slot
    return !slot || !CORE_SLOTS.includes(slot)
  })

  return (
    <div className={`rail-wrap${open ? ' is-open' : ''}`}>
      <ul className="rail" aria-label="What you hold, by slot">
        {CORE_SLOTS.map((slot) => {
          const state = states.get(slot)
          const occupant = state?.occupant ? traits.get(state.occupant) : null
          const icon = state?.occupant ? iconOf.get(state.occupant) : null
          const glyph = SLOT_GLYPH[slot]
          const label = slotLabel(slot)
          const rarity = state?.rarity ?? 'Common'

          return (
            <li key={slot} className={`rail-slot${occupant ? ' is-filled' : ''}`}>
              <span className="rail-mark">
                {occupant && icon ? (
                  <>
                    <img className="rail-art" src={`/${icon}`} alt="" loading="lazy" />
                    <img className="rail-frame" src={`/${FRAME[rarity]}`} alt="" aria-hidden="true" />
                  </>
                ) : glyph ? (
                  <img className="rail-glyph" src={`/${glyph}`} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className="rail-slot-name">{label}</span>
              <span className="visually-hidden">
                {occupant ? `${label} holds ${occupant.name} at ${rarity}` : `${label} is open`}
              </span>

              {/* The tooltip. Hover or focus, and it says what the thing does. */}
              {/* aria-hidden, not role="tooltip".
                *
                * A tooltip role is only meaningful when something points at it
                * with aria-describedby, and nothing here does. What it says is
                * already in the visually-hidden line above, so announcing it
                * twice is the only thing the role was achieving. */}
              {occupant ? (
                <span className="rail-tip" aria-hidden="true">
                  <span className="rail-tip-name">{occupant.name}</span>
                  <span className="rail-tip-meta">
                    {label} · {rarity}
                  </span>
                  {occupant.text ? <span className="rail-tip-text">{occupant.text}</span> : null}
                </span>
              ) : (
                <span className="rail-tip" aria-hidden="true">
                  <span className="rail-tip-name">{label} is open</span>
                  <span className="rail-tip-text">
                    Every god's {label} boon is still on the table while this stays dark.
                  </span>
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="rail-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        {open ? 'Close' : `All ${held.length}`}
      </button>

      {open ? (
        <div className="rail-sheet">
          <h2>Everything you hold</h2>

          {CORE_SLOTS.map((slot) => {
            const state = states.get(slot)
            const occupant = state?.occupant ? traits.get(state.occupant) : null
            return (
              <section key={slot}>
                <h3>{slotLabel(slot)}</h3>
                {occupant ? (
                  <HeldLine entry={{ id: occupant.id, rarity: state?.rarity ?? 'Common' }} />
                ) : (
                  <p className="rail-sheet-empty">Open</p>
                )}
              </section>
            )
          })}

          {slotless.length ? (
            <section>
              <h3>No slot</h3>
              <ul>
                {slotless.map((entry) => (
                  <li key={entry.id}>
                    <HeldLine entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function HeldLine({ entry }: { entry: HeldTrait }) {
  const trait = traits.get(entry.id)
  const icon = iconOf.get(entry.id)
  const slot = trait?.slot
  const isCore = slot && CORE_SLOTS.includes(slot)

  return (
    <div className="held-line">
      <span className="held-mark">
        {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : null}
        {isCore ? <img className="rail-frame" src={`/${FRAME[entry.rarity]}`} alt="" aria-hidden="true" /> : null}
      </span>
      <span className="held-body">
        <span className="held-name">
          {trait?.name ?? entry.id}
          <span className="held-rarity">{entry.rarity}</span>
        </span>
        {trait?.text ? <span className="held-text">{trait.text}</span> : null}
      </span>
    </div>
  )
}
