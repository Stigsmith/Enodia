/**
 * How reachable a build is, as one word.
 *
 * `engine/repeat.ts` decides the reading. This draws it, in three sizes,
 * because the same claim has to sit on an overview card, beside a play strip
 * and at the head of a shared build without being three different components
 * that drift apart.
 *
 * **It is deliberately quiet.** It is not a score and not a warning: a build
 * reading Needs luck can be the best build in the library, and a build reading
 * Reliably can be dull. The only reading that raises its voice is the hard
 * stop, which is a statement about the game rather than about the build.
 */

import type { Reach, RepeatRead } from '../engine/repeat.ts'
import { REACH } from '../engine/repeat.ts'

const SAY = new Map(REACH.map((one) => [one.id, one]))

export function Stamp({
  read,
  size = 'small',
  showSay = false,
}: {
  read: RepeatRead
  /** `small` on a card, `medium` beside a strip, `large` at the head of a page */
  size?: 'small' | 'medium' | 'large'
  /** add the sentence under the word. Worth it wherever there is room */
  showSay?: boolean
}) {
  const word = SAY.get(read.reach)
  if (!word) return null

  return (
    <span className={`stamp is-${size} is-${read.reach}`}>
      <span className="stamp-word">{word.name}</span>
      {showSay ? <span className="stamp-say">{read.hardStop ?? word.say}</span> : null}
    </span>
  )
}

/** The word alone, for somewhere a whole component would be too much. */
export function stampClass(reach: Reach): string {
  return `is-${reach}`
}
