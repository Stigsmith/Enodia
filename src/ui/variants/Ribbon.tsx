/**
 * Variant 4: the Ribbon. A plan, not an inventory.
 *
 * **The design approach is to refuse the premise.** The other four answer "what
 * is in this build". A player standing at an Exit does not have that question.
 * They have "what do I take now, and what can wait", and a grid of eighteen
 * equal items answers it badly: everything looks equally urgent because
 * everything is the same size.
 *
 * So this one is ordered and only ordered. It reads as a sequence with a
 * destination: what is locked in before the run, then what to take first, then
 * what to take when it turns up, ending on the piece the whole thing is for.
 * Each step carries the one thing worth knowing at that step.
 *
 * The order is **derived, not judged**. Prerequisites come before the thing
 * that needs them, because that is what `requires` says. Core slots come before
 * slotless boons, because a filled slot blocks the other gods' boon for that
 * slot and a slotless one blocks nothing, which `CLAUDE.md` records as the
 * lockout this project exists for. No claim about what is strong is made
 * anywhere, because none is available.
 *
 * **What it is good at**: being used, mid run, at an Exit. It is the only one
 * of the five that tells you what to do rather than what exists.
 *
 * **What it gives up**: the whole. You cannot see a build's shape in it, and it
 * is long: on a phone it is a real scroll, and on a wide screen it wastes the
 * width unless it turns.
 */

import { traits } from '../../data/app.ts'
import { requirementSets } from '../../engine/reachability.ts'
import { Mark } from '../BuildMark.tsx'
import type { Assembled, Piece } from '../build-pieces.ts'

type Step = {
  key: string
  /** what to call this stage of the run */
  when: string
  say: string
  pieces: Piece[]
  /** the destination, drawn differently */
  destination?: boolean
}

/**
 * The build as a sequence.
 *
 * Four stages, and the split between them is mechanical: fixed before the run,
 * the contested slots, the uncontested extras, and the thing they were all for.
 */
function steps(built: Assembled): Step[] {
  const slotted = built.slots.flatMap((entry) => (entry.piece ? [entry.piece] : []))
  const rest = built.run.pieces.filter((piece) => !piece.slot && !piece.centrepiece)
  const centre = built.centrepiece

  // A prerequisite of the centrepiece is not optional, so it is named as such
  // rather than left in the pile with everything else.
  const needed = new Set(requirementIds(centre))

  return [
    {
      key: 'crossroads',
      when: 'At the Crossroads',
      say: built.crossroads.say,
      pieces: built.crossroads.pieces,
    },
    {
      key: 'slots',
      when: 'Fill these first',
      say: 'A filled slot shuts the other gods out of it, so these are the picks that cost something.',
      pieces: slotted.map((piece) => ({ ...piece, centrepiece: needed.has(piece.id) })),
    },
    {
      key: 'rest',
      when: 'Take when offered',
      say: 'These occupy no slot, so nothing is lost by holding them.',
      pieces: rest.map((piece) => ({ ...piece, centrepiece: needed.has(piece.id) })),
    },
    ...(centre
      ? [
          {
            key: 'centre',
            when: 'What it is all for',
            say: centre.text ?? '',
            pieces: [centre],
            destination: true,
          },
        ]
      : []),
  ].filter((step) => step.pieces.length)
}

/**
 * Every trait named anywhere in a piece's prerequisites.
 *
 * `requirementSets` flattens `oneOf` and `oneFromEachSet` into lists of
 * alternatives, and every id in any of them is a thing that would satisfy part
 * of the gate. A build lists exactly one alternative per set, so intersecting
 * this with what the build holds is what marks the picks that are not optional.
 */
function requirementIds(piece: Piece | null): string[] {
  const requires = piece ? traits.get(piece.id)?.requires : null
  return requires ? requirementSets(requires).flat() : []
}

export function Ribbon({ built, onOpen }: { built: Assembled; onOpen?: (piece: Piece) => void }) {
  return (
    <ol className="ribbon">
      {steps(built).map((step, index) => (
        <li key={step.key} className={`ribbon-step${step.destination ? ' is-end' : ''}`}>
          <span className="ribbon-num" aria-hidden="true">
            {index + 1}
          </span>
          <div className="ribbon-body">
            <h4>{step.when}</h4>
            <p className="ribbon-say">{step.say}</p>
            <div className="ribbon-pieces">
              {step.pieces.map((piece) => (
                <span key={piece.key} className="ribbon-piece">
                  <Mark piece={piece} size={step.destination ? 'var(--mark-xl)' : 'var(--mark-m)'} onOpen={onOpen} />
                  <span className="ribbon-piece-name">{piece.name}</span>
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
