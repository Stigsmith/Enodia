/**
 * Where the run stands. A drawer off the side, not a screen and not a tray.
 *
 * The picker lives on the path now, so this holds only the part that answers
 * "what am I still chasing": the ranked gods, and what is closest with its
 * measured odds. Closed by default, because silence is the normal state and a
 * player who is mid pick does not need a list.
 *
 * It is also where a target gets pinned. The pin is what the briefing leads
 * with when the player comes back, and this is the only place in the product
 * where every live target is already listed, so asking them to say which one
 * they are chasing costs one tap in a list they are already reading.
 */

import { useMemo, useState } from 'react'

import { godPools, olympians, traits } from '../data/app.ts'
import { completionOdds, formatOdds } from '../engine/odds.ts'
import { godPriority, reachable } from '../engine/reachability.ts'
import { buildStanding, buildTally, sayOf } from '../engine/build-run.ts'
import type { Verdict } from '../engine/reachability.ts'
import type { RunContext, TraitId } from '../data/types.ts'

/** How many get a simulated percentage. The rest get their sentence only. */
const RATED = 6

export function Standing({
  run,
  pinned,
  onPin,
}: {
  run: RunContext
  pinned: TraitId | null
  onPin: (target: TraitId | null) => void
}) {
  const [open, setOpen] = useState(false)

  /**
   * Builds first, and the handle counts them.
   *
   * The drawer used to open on a list of duos and legendaries, which is what
   * the engine has and not what anyone is chasing. Those are still here, below,
   * because "you are two picks off Killer Current" is worth knowing. They are
   * the detail under the answer rather than the answer.
   */
  const builds = buildStanding(run, traits)
  const buildsOpen = builds.filter((one) => one.verdict.state !== 'DEAD')
  const counted = buildTally(builds)

  const verdicts = reachable(run, traits)
  const live = verdicts.filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK')
  const shortlist = live.slice(0, RATED).map((verdict) => verdict.target)
  const shortlistKey = shortlist.join(',')

  // Simulating costs real milliseconds, and none of them are worth spending
  // while the drawer is shut.
  const odds = useMemo(
    () =>
      open
        ? new Map(
            completionOdds(run, shortlist, traits, godPools, olympians, { runs: 300 }).map((entry) => [
              entry.target,
              entry.rate,
            ]),
          )
        : new Map<string, number>(),
    [run, shortlistKey, open],
  )

  const gods = godPriority(run, traits).filter((god) => god.keeps.length || god.kills.length)

  return (
    <aside className={`standing${open ? ' is-open' : ''}`} aria-label="What is still open">
      <button
        type="button"
        className="standing-handle"
        data-tour="standing-handle"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
      >
        {open ? 'Close' : `${counted.open} builds open`}
      </button>

      {open ? (
        <div className="standing-body">
          {buildsOpen.length ? (
            <>
              <h2>Builds still open</h2>
              <ul className="standing-builds">
                {buildsOpen.map((one) => (
                  <li key={one.build.id} className={one.verdict.state === 'ON_TRACK' ? 'is-done' : ''}>
                    <span className="standing-build-name">{one.build.name}</span>
                    <span className="standing-build-why">{sayOf(one)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="standing-none">
              No build in the manager can still be finished this run. What you are holding is its own
              thing.
            </p>
          )}

          {gods.length ? (
            <>
              <h2>If you pick a god now</h2>
              <ul className="god-priority-list">
                {gods.slice(0, 4).map((god) => (
                  <li key={god.god} className={god.kills.length ? 'is-costly' : ''}>
                    <span className="god-name">{god.god}</span>
                    <span className="god-why">{god.why}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2>Closest to done</h2>
          {live.length ? (
            <ul className="target-list">
              {live.slice(0, 12).map((verdict) => (
                <TargetLine
                  key={verdict.target}
                  verdict={verdict}
                  rate={odds.get(verdict.target)}
                  pinned={pinned === verdict.target}
                  onPin={() => onPin(pinned === verdict.target ? null : verdict.target)}
                />
              ))}
            </ul>
          ) : (
            <p className="nothing-live">Nothing is still reachable. This run is what it is now.</p>
          )}

          <p className="odds-note">
            Counted over 300 simulated runs from where you are, assuming you take what gets you there. Every
            reward is treated as a god offer, so these read high.
          </p>
        </div>
      ) : null}
    </aside>
  )
}

function TargetLine({
  verdict,
  rate,
  pinned,
  onPin,
}: {
  verdict: Verdict
  rate: number | undefined
  pinned: boolean
  onPin: () => void
}) {
  const trait = traits.get(verdict.target)
  const kind = trait?.kind === 'legendary' ? 'Legendary' : trait?.kind === 'hex' ? 'Hex duo' : 'Duo'
  const name = trait?.name ?? verdict.target

  return (
    <li className={`target is-${verdict.state.toLowerCase()}${pinned ? ' is-pinned' : ''}`}>
      <span className="target-head">
        {/* The game's own checkmark, off the quest log. A target with every
            prerequisite in hand is done, and done is a different thing from
            a percentage. */}
        {verdict.state === 'ON_TRACK' ? (
          <img className="target-done" src="/icons/complete.png" alt="" aria-hidden="true" />
        ) : null}
        <span className="target-name">{name}</span>
        <span className="target-kind">
          {kind}
          {trait?.gods.length ? ` · ${trait.gods.join(' and ')}` : ''}
        </span>
        {rate !== undefined ? <span className="odds">{formatOdds(rate)}</span> : null}
        <button
          type="button"
          className="target-pin"
          aria-pressed={pinned}
          onClick={onPin}
          title={pinned ? `Stop chasing ${name}` : `Chase ${name}`}
        >
          <span className="visually-hidden">{pinned ? `Stop chasing ${name}` : `Chase ${name}`}</span>
        </button>
      </span>
      {trait?.text ? <span className="target-text">{trait.text}</span> : null}
      <span className="target-why">{verdict.why}</span>
    </li>
  )
}
