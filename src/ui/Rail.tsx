/**
 * The rail. Five slots, fixed positions, always on screen.
 *
 * `DESIGN.md` 8: an empty slot is the warning. A dark Cast slot states, without
 * saying anything, the thing that keeps half the live targets alive.
 *
 * An empty slot now shows the game's own slot glyph rather than a hole, because
 * the game shows one and a hole reads as a bug. A filled slot wears the game's
 * rarity frame, which is how the game itself says Common from Heroic, and which
 * is the difference between a slot that can still be swapped and one that is
 * shut for good.
 */

import { iconOf, traits } from '../data/app.ts'
import { CORE_SLOTS, slotLabel, slotStates } from '../engine/slots.ts'
import type { Held, Rarity, Slot } from '../data/types.ts'

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
  const states = slotStates(held, traits)

  return (
    <ul className="rail" aria-label="What you hold, by slot">
      {CORE_SLOTS.map((slot) => {
        const state = states.get(slot)
        const occupant = state?.occupant ? traits.get(state.occupant) : null
        const icon = state?.occupant ? iconOf.get(state.occupant) : null
        const glyph = SLOT_GLYPH[slot]
        const label = slotLabel(slot)
        const rarity = state?.rarity ?? 'Common'

        return (
          <li key={slot} className={`rail-slot${occupant ? ' is-filled' : ''}`} title={`${label}: ${occupant?.name ?? 'open'}`}>
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
          </li>
        )
      })}
    </ul>
  )
}
