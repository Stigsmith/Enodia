/**
 * A listing's counts, wherever a card of it is drawn.
 *
 * They were the exchange's alone. Your own published builds and the ones you
 * follow now sit on your side of Builds and nowhere else, so their counts came
 * with them onto the library's cards.
 */

import type { Before, Stats } from '../state/exchange.ts'

/**
 * What happened when people played this, as counts.
 *
 * **Every number here is a tally and none of them is combined.** Runs beside
 * clears rather than a percentage on its own, because "38 of 61" carries how
 * much evidence there is and "62%" does not. The rating carries its own count
 * for the same reason: an average of two is a different thing from an average of
 * two hundred and a reader has to be able to tell them apart.
 *
 * Draws nothing at all for a build nobody has touched, which on a new shelf is
 * every build. A row of zeroes reads as a verdict.
 */
export function Counted({ stats, before }: { stats: Stats; before?: Before }) {
  const anything =
    stats.takes > 0 || stats.runs > 0 || stats.raters > 0 || stats.bestFear !== null
  if (!anything && !before) return null

  return (
    <>
      {anything ? (
        <Tally stats={stats} />
      ) : (
        /**
         * **A build whose counts reset must not read as one nobody has touched.**
         *
         * With no current counts `Tally` draws nothing, which is right for a
         * build nobody has played and wrong for one whose author replaced the
         * picks: those look identical, and on the shelf in list view, where the
         * old counts are not drawn at all, that was the only thing on screen.
         * One line, on the row rather than under it, so it costs no height.
         */
        <p className="xchange-counts xchange-fresh">
          Nothing logged since the author changed this build
        </p>
      )}
      {/**
        * What the build earned before its author changed it.
        *
        * Kept rather than thrown away, and kept apart rather than added in. Four
        * stars from forty people is a claim about the picks those forty played,
        * and once the author replaces the picks it stops being a claim about
        * this build. Deleting it would lose real evidence; folding it in would
        * quietly transfer it. So it is shown, quieter, and said to be old.
        *
        * No player count and no follows in here: see `Before`. Players folded
        * across versions would count somebody who played both of them twice,
        * and a follow is about the listing rather than a version, so it stays
        * on the current line and is never repeated down here.
        */}
      {before ? (
        <p className="xchange-was">
          Before the author changed this build:{' '}
          <Tally stats={{ ...before, players: 0, takes: 0 }} bare />
        </p>
      ) : null}
    </>
  )
}

/** One set of counts, current or old. */
function Tally({ stats, bare }: { stats: Stats; bare?: boolean }) {
  return (
    <p className="xchange-counts">
      {/* One coin, and none on the quieter line for the old counts. `bare` was
          added around the existing image rather than replacing it, so it drew
          two here and one there: the inverse of what the flag means. */}
      {bare ? null : (
        <img className="xchange-coin" src="/shell/coins.png" alt="" aria-hidden="true" />
      )}
      {/* "Taken" was the copy era's word for it. The row records somebody
        * adding this build to their library from this listing, which is what
        * following is; the rows written before following existed are the same
        * act under the older name. */}
      {stats.takes ? <span>Followed by {stats.takes}</span> : null}
      {stats.runs ? (
        <span>
          {stats.clears} of {stats.runs} cleared
          {stats.players > 1 ? `, ${stats.players} people` : null}
        </span>
      ) : null}
      {stats.bestFear ? <span>Best Fear {stats.bestFear}</span> : null}
      {/* Never the average on its own. `raters` is not a footnote to it: two
        * people saying four is a different claim from two hundred saying four,
        * and a bare 4.0 hides which one you are reading. */}
      {stats.rating !== null ? (
        <span>
          ★ {stats.rating.toFixed(1)} from {stats.raters}{' '}
          {stats.raters === 1 ? 'player' : 'players'}
        </span>
      ) : null}
    </p>
  )
}
