/**
 * The re-entry header. What was I doing.
 *
 * `DESIGN.md` 8: **the briefing is not a surface.** It is a header above the
 * timeline, the timeline still opens at the present, and scrolling back is the
 * rest of the briefing. A separate screen would put the answer somewhere the
 * player has to navigate to, which is the thing this whole product is against.
 *
 * Three registers, kept visibly apart because `DESIGN.md` 8 requires a
 * judgement and a sourced fact never look equally weighed:
 *
 * - **fact**, what is held and where the run is
 * - **derivation**, what moved while you were away and where the pin stands
 * - **advice**, which is absent rather than filled with something weaker
 *
 * It dismisses to nothing and can be reopened from the menu. Dismissing marks
 * the trail read, so the next card diffs from here rather than from the top of
 * the run.
 */

import { iconOf, traits } from '../data/app.ts'
import { slotLabel } from '../engine/slots.ts'
import type { Briefing as Card, Change } from '../engine/briefing.ts'
import type { Verdict } from '../engine/reachability.ts'

/**
 * The four states, twice, because a state and a move are not the same sentence.
 *
 * "open again" is right at the end of an arrow and wrong as a label: a target
 * that has been REACHABLE all run has not come back from anywhere.
 */
const STATE_WORD: Record<Change['to'], string> = {
  DEAD: 'closed',
  AT_RISK: 'at risk',
  REACHABLE: 'open',
  ON_TRACK: 'yours',
}

const MOVED_TO: Record<Change['to'], string> = {
  ...STATE_WORD,
  REACHABLE: 'open again',
}

/** How long ago, in the coarsest unit that is still true. */
function since(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return null
  const hours = ms / 3600_000
  if (hours < 1) return 'less than an hour ago'
  if (hours < 24) return `${Math.round(hours)} ${Math.round(hours) === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function Briefing({ card, onDismiss }: { card: Card; onDismiss: () => void }) {
  const ago = since(card.away.since)
  // The pin is already the headline, with its own sentence and its own weight.
  // Repeating it as the first line of the list reads as two different findings.
  const moved = card.changedWhileAway.filter((change) => change.target !== card.pinned?.target)
  const deaths = moved.filter((change) => change.to === 'DEAD')
  const rest = moved.filter((change) => change.to !== 'DEAD')

  return (
    <section className="briefing" aria-label="Where you left off">
      <header className="briefing-head">
        <h2>Where you left off</h2>
        <p className="briefing-when">
          {card.away.exits > 0
            ? `${card.away.exits} ${card.away.exits === 1 ? 'Exit' : 'Exits'} since you last looked`
            : 'Nothing logged since you last looked'}
          {ago ? <span className="briefing-ago">{ago}</span> : null}
        </p>
        <button type="button" className="quiet briefing-close" onClick={onDismiss}>
          Got it
        </button>
      </header>

      {/* Derivation, and the headline. A pinned target that died three Exits
          ago is the single most important line on the card. */}
      {card.pinned ? <Pinned verdict={card.pinned} /> : null}

      {moved.length ? (
        <div className="briefing-changed">
          <h3>What moved</h3>
          <ul>
            {[...deaths, ...rest].slice(0, 8).map((change) => (
              <li key={change.target} className={`briefing-change is-${change.to.toLowerCase()}`}>
                <span className="briefing-change-name">
                  {traits.get(change.target)?.name ?? change.target}
                </span>
                <span className="briefing-change-move">
                  {STATE_WORD[change.from]} to {MOVED_TO[change.to]}
                </span>
              </li>
            ))}
          </ul>
          {moved.length > 8 ? (
            <p className="briefing-more">and {moved.length - 8} more, all of it in the timeline below</p>
          ) : null}
        </div>
      ) : null}

      {/* Fact. */}
      <div className="briefing-held">
        <h3>What you hold</h3>
        <ul>
          {card.held
            .filter((row) => row.slot !== null)
            .map((row) => (
              <li key={row.slot} className={row.traits.length ? '' : 'is-open'}>
                <span className="briefing-slot">{slotLabel(row.slot!)}</span>
                <span className="briefing-slot-holds">
                  {row.traits.length ? (
                    row.traits.map((id) => {
                      const icon = iconOf.get(id)
                      return (
                        <span key={id} className="briefing-holds">
                          {icon ? <img src={`/${icon}`} alt="" /> : null}
                          {traits.get(id)?.name ?? id}
                        </span>
                      )
                    })
                  ) : (
                    <span className="briefing-empty">Open</span>
                  )}
                </span>
              </li>
            ))}
        </ul>
        <Slotless count={card.held.find((row) => row.slot === null)?.traits.length ?? 0} />
      </div>

      <p className="briefing-position">
        {card.position.exitsLeft} {card.position.exitsLeft === 1 ? 'Exit' : 'Exits'} left
        {card.position.path ? `, ${card.position.path === 'surface' ? 'Surface' : 'Underworld'}` : ''}
        {/* region and nextBoss are null and stay unsaid. The run records which
            way it went and nothing finer, and a guess here would be invented. */}
      </p>
    </section>
  )
}

/**
 * Everything held that takes no core slot, which is most of a run: only 45
 * boons occupy one at all. A count, because naming them here would bury the
 * five slots that carry the lockout.
 */
function Slotless({ count }: { count: number }) {
  if (!count) return null
  return (
    <p className="briefing-slotless">
      {count === 1 ? '1 more that occupies no slot' : `${count} more that occupy no slot`}
    </p>
  )
}

function Pinned({ verdict }: { verdict: Verdict }) {
  const trait = traits.get(verdict.target)
  const icon = iconOf.get(verdict.target)

  return (
    <div className={`briefing-pinned is-${verdict.state.toLowerCase()}`}>
      <h3>You were chasing</h3>
      <div className="briefing-pinned-body">
        {icon ? <img src={`/${icon}`} alt="" /> : null}
        <div>
          <p className="briefing-pinned-name">
            {trait?.name ?? verdict.target}
            <span className="briefing-pinned-state">{STATE_WORD[verdict.state]}</span>
          </p>
          <p className="briefing-pinned-why">{verdict.why}</p>
        </div>
      </div>
    </div>
  )
}
