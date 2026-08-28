/**
 * The present entry. What is still open, how likely it is, and the pick.
 *
 * **Words matter here and the first version got them wrong.** It called every
 * duo and legendary a "build", which invented a concept the player never gave
 * us: a duo is one boon with prerequisites, not a build. They are named for
 * what they are now, and each carries the game's own sentence about itself,
 * because "Ecstatic Obsession needs one more pick" tells a new player nothing.
 *
 * The percentage is measured, not asserted. See engine/odds.ts for what it
 * rests on and what it assumes, both of which are on screen with it.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { godPools, olympians, traits } from '../data/app.ts'
import { completionOdds, formatOdds } from '../engine/odds.ts'
import { godPriority, reachable } from '../engine/reachability.ts'
import type { Verdict } from '../engine/reachability.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'
import { LogPick } from './LogPick.tsx'

/** How many get a simulated percentage. The rest get their sentence only. */
const RATED = 8

export function Present({
  run,
  onTake,
  onSkip,
}: {
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null) => void
  onSkip: (god: string | null) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const anchor = useRef<HTMLElement>(null)

  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [run.exitsLeft])

  const verdicts = reachable(run, traits)
  const dead = verdicts.filter((v) => v.state === 'DEAD')
  const live = verdicts.filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK')
  const done = verdicts.filter((v) => v.state === 'ON_TRACK')

  // Simulating costs real milliseconds, so it runs when the run changes rather
  // than on every render, and only for the ones on screen.
  const shortlist = live.slice(0, RATED).map((verdict) => verdict.target)
  const shortlistKey = shortlist.join(',')
  const odds = useMemo(
    () =>
      new Map(
        completionOdds(run, shortlist, traits, godPools, olympians, { runs: 300 }).map((entry) => [
          entry.target,
          entry.rate,
        ]),
      ),
    [run, shortlistKey],
  )

  const gods = godPriority(run, traits).filter((god) => god.keeps.length || god.kills.length)

  return (
    <section className="present" aria-label="Where the run stands" ref={anchor}>
      <p className="tally">
        <strong>{live.length}</strong> duos and legendaries still open
        {done.length ? <span className="tally-done">{done.length} already yours</span> : null}
        {dead.length ? <span className="tally-dead">{dead.length} closed for this run</span> : null}
      </p>

      {gods.length ? (
        <div className="god-priority">
          <h3 className="block-heading">If you pick a god now</h3>
          <ul>
            {gods.slice(0, showAll ? gods.length : 3).map((god) => (
              <li key={god.god} className={god.kills.length ? 'is-costly' : ''}>
                <span className="god-name">{god.god}</span>
                <span className="god-why">{god.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {live.length ? (
        <div className="live-targets">
          <h3 className="block-heading">Closest to done</h3>
          <ul>
            {live.slice(0, showAll ? live.length : 4).map((verdict) => (
              <TargetLine key={verdict.target} verdict={verdict} rate={odds.get(verdict.target)} />
            ))}
          </ul>
          {live.length > 4 ? (
            <button type="button" className="quiet" onClick={() => setShowAll((open) => !open)}>
              {showAll ? 'Show fewer' : `Show all ${live.length}`}
            </button>
          ) : null}
          <p className="odds-note">
            Counted over 300 simulated runs from where you are, assuming you take what gets you there. Every
            reward is treated as a god offer, so these read high.
          </p>
        </div>
      ) : (
        <p className="nothing-live">Nothing is still reachable. This run is what it is now.</p>
      )}

      <LogPick run={run} onTake={onTake} onSkip={onSkip} />
    </section>
  )
}

function TargetLine({ verdict, rate }: { verdict: Verdict; rate: number | undefined }) {
  const trait = traits.get(verdict.target)
  const kind = trait?.kind === 'legendary' ? 'Legendary' : trait?.kind === 'hex' ? 'Hex duo' : 'Duo'
  const gods = trait?.gods.join(' and ')

  return (
    <li className={`target is-${verdict.state.toLowerCase()}`}>
      <span className="target-head">
        <span className="target-name">{trait?.name ?? verdict.target}</span>
        <span className="target-kind">
          {kind}
          {gods ? ` · ${gods}` : ''}
        </span>
        {rate !== undefined ? <span className="odds">{formatOdds(rate)}</span> : null}
      </span>
      {trait?.text ? <span className="target-text">{trait.text}</span> : null}
      <span className="target-why">{verdict.why}</span>
    </li>
  )
}
