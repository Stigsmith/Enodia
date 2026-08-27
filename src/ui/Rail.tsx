/**
 * The rail. Five slots, fixed positions, icons only.
 *
 * `DESIGN.md` 8: an empty slot is the warning. A dark Cast slot states, without
 * saying anything, the thing that keeps half the live targets alive. It never
 * reorders, because a fixed position is what makes it readable without being
 * read.
 */

import { iconOf, traits } from '../data/app.ts'
import { CORE_SLOTS, slotLabel, slotStates } from '../engine/slots.ts'
import type { Held } from '../data/types.ts'

export function Rail({ held }: { held: Held }) {
  const states = slotStates(held, traits)

  return (
    <ul className="rail" aria-label="What you hold, by slot">
      {CORE_SLOTS.map((slot) => {
        const state = states.get(slot)
        const occupant = state?.occupant ? traits.get(state.occupant) : null
        const icon = state?.occupant ? iconOf.get(state.occupant) : null
        const label = slotLabel(slot)

        return (
          <li key={slot} className={`rail-slot${occupant ? ' is-filled' : ''}`}>
            <span className="rail-mark" aria-hidden="true">
              {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : null}
            </span>
            <span className="rail-text">
              <span className="rail-slot-name">{label}</span>
              <span className="rail-occupant">{occupant?.name ?? 'open'}</span>
            </span>
            <span className="visually-hidden">
              {occupant ? `${label} holds ${occupant.name} at ${state?.rarity}` : `${label} is open`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
