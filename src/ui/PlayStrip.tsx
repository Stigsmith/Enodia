/**
 * How a build has played, in one line.
 *
 * Stars, then the runs, then how dependably it comes together. It sits under
 * the name and the one line in the detail view, above everything the build is
 * made of, because "I have played this twelve times and cleared seven" is the
 * thing a returning player wants before they read the pieces again.
 *
 * **It draws nothing when there is nothing to say.** Eight samples and every
 * build written before this work have no record, and an empty strip on each of
 * them would be eight rows of furniture claiming to be information.
 *
 * The record is personal to this install, so nothing here is a recommendation
 * and nothing here travels when a build is shared. `PlayRecord` in
 * `data/builds.ts` says why it is nested.
 */

import { ASSEMBLES, winRate } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'
import { olympians, traits } from '../data/app.ts'
import { ratingCeiling, readRepeat } from '../engine/repeat.ts'

const STARS = [1, 2, 3, 4, 5]

export function PlayStrip({ build }: { build: ShownBuild }) {
  const play = build.play
  const rate = winRate(play)
  const assembles = ASSEMBLES.find((one) => one.id === play?.assembles)
  const runs = play?.runs ?? 0

  /**
   * Stars a build asking the impossible is allowed to wear.
   *
   * **Clamped here rather than trusted from storage**, the same reasoning
   * `winRate` gives for clamping clears against runs: the builder disables the
   * higher stars, and storage is a text file a person can edit and a build can
   * arrive from another install. A five-star build that cannot be assembled
   * must be impossible to draw, so the clamp lives where the stars are drawn.
   */
  const ceiling = ratingCeiling(readRepeat(build, traits, olympians))
  const rating = ceiling === null ? (play?.rating ?? 0) : Math.min(play?.rating ?? 0, ceiling)

  // Nothing rated, nothing played, nothing judged. Draw nothing.
  if (!play?.rating && !runs && !assembles) return null

  return (
    <div className="playstrip">
      {rating ? (
        <span className="playstrip-stars" aria-label={`Rated ${rating} of 5`}>
          {STARS.map((star) => (
            <span key={star} className={star <= rating ? 'is-on' : ''} aria-hidden="true">
              {star <= rating ? '★' : '☆'}
            </span>
          ))}
        </span>
      ) : null}

      {runs ? (
        <span className="playstrip-runs">
          <strong>{runs}</strong> {runs === 1 ? 'run' : 'runs'}
          <span className="playstrip-sep" aria-hidden="true" />
          <strong>{Math.min(play?.clears ?? 0, runs)}</strong> clears
          {rate === null ? null : (
            <>
              <span className="playstrip-sep" aria-hidden="true" />
              <strong className="playstrip-rate">{Math.round(rate * 100)}%</strong>
            </>
          )}
        </span>
      ) : null}

      {assembles ? (
        <span className={`playstrip-assembles is-${assembles.id}`}>{assembles.name}</span>
      ) : null}
    </div>
  )
}
