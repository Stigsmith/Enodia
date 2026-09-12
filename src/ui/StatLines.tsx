/**
 * The lines the game draws under a boon's sentence.
 *
 * `Peek` and `PieceCard` both draw them, and draw them the same way, because
 * they are the same fact: a label on the left and a number on the right, which
 * is how the game's own Codex lays out `StatLineLeft` and `StatLineRight`
 * (BoonInfoLogic.lua:181-195). Until this existed the tool drew none of them,
 * so Heaven Strike read "Your Attacks inflict Blitz." and never said how much.
 *
 * ## The ladder
 *
 * A build stores no rarity, so a boon in a build has four numbers rather than
 * one, and this says all four. Each rung carries the game's own colour for its
 * rarity, `BoonPatch*` in ColorData.lua, as a bar under the number rather than
 * as the number's colour: Epic's violet on this ground measures about 3.3 to 1,
 * enough for a bar and not for small text. The rung names travel with it for a
 * screen reader, and the dialog, which has the room, prints them.
 */

import { offerRules } from '../data/app.ts'
import type { StatLine } from '../data/types.ts'

/** The rung names, from the same `RarityUpgradeOrder` the data was built with. */
const RUNGS = offerRules.rarityUpgradeOrder

function Ladder({ line, spelled }: { line: StatLine; spelled: boolean }) {
  const rungs = line.ladder ?? []
  const tail = line.tail ?? ''
  const said = rungs.map((rung, index) => `${RUNGS[index] ?? ''} ${rung}${tail}`).join(', ')

  return (
    <>
      <span className="visually-hidden">{said}</span>
      <span className="ladder" aria-hidden="true">
        {rungs.map((rung, index) => {
          const name = RUNGS[index] ?? ''
          return (
            <span key={name || index} className={`ladder-rung is-${name.toLowerCase()}`}>
              <span className="ladder-value">{rung}</span>
              {spelled ? <span className="ladder-name">{name}</span> : null}
            </span>
          )
        })}
        {tail ? <span className="ladder-tail">{tail.trim()}</span> : null}
      </span>
    </>
  )
}

export function StatLines({
  lines,
  spelled = false,
}: {
  lines: StatLine[] | null | undefined
  /** print the rarity under each rung, for the dialog */
  spelled?: boolean
}) {
  if (!lines?.length) return null
  return (
    <dl className={`stats${spelled ? ' is-spelled' : ''}`}>
      {lines.map((line, index) => (
        <div key={`${line.label}:${index}`} className="stats-line">
          <dt>{line.label}</dt>
          <dd>{line.ladder?.length ? <Ladder line={line} spelled={spelled} /> : line.value}</dd>
        </div>
      ))}
    </dl>
  )
}
