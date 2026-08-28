/**
 * The tray. The decision in front of you, pinned to the bottom.
 *
 * Collapsed it is one line: how many Exits, what is closest, and the button
 * that opens it. Open it is the picker and the shortlist. Either way it never
 * leaves the screen and it never pushes the timeline around, because the
 * timeline is the only thing that scrolls.
 *
 * Two tabs rather than one long column, because the two questions are
 * different: what did this Exit give, and what am I still chasing.
 */

import { useMemo, useState } from 'react'

import { godPools, olympians, traits } from '../data/app.ts'
import { completionOdds, formatOdds } from '../engine/odds.ts'
import { godPriority, reachable } from '../engine/reachability.ts'
import type { Verdict } from '../engine/reachability.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'
import { LogPick } from './LogPick.tsx'

/** How many get a simulated percentage. The rest get their sentence only. */
const RATED = 6

export function Tray({
  run,
  open,
  onToggle,
  onTake,
  onSkip,
}: {
  run: RunContext
  open: boolean
  onToggle: () => void
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null) => void
  onSkip: (god: string | null) => void
}) {
  const [tab, setTab] = useState<'log' | 'chasing'>('log')

  const verdicts = reachable(run, traits)
  const live = verdicts.filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK')
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
  const closest = live[0] ? traits.get(live[0].target)?.name : null

  return (
    <section className={`tray${open ? ' is-open' : ''}`} aria-label="This Exit">
      <button type="button" className="tray-handle" onClick={onToggle} aria-expanded={open}>
        <span className="tray-handle-label">{open ? 'Hide' : 'Log an Exit'}</span>
        {!open && closest ? <span className="tray-handle-hint">closest: {closest}</span> : null}
      </button>

      {open ? (
        <div className="tray-body">
          <div className="tray-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'log'}
              className={tab === 'log' ? 'is-active' : ''}
              onClick={() => setTab('log')}
            >
              What this Exit gave
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'chasing'}
              className={tab === 'chasing' ? 'is-active' : ''}
              onClick={() => setTab('chasing')}
            >
              Still open ({live.length})
            </button>
          </div>

          {tab === 'log' ? (
            <LogPick run={run} onTake={onTake} onSkip={onSkip} />
          ) : (
            <div className="chasing">
              {gods.length ? (
                <ul className="god-priority-list">
                  {gods.slice(0, 3).map((god) => (
                    <li key={god.god} className={god.kills.length ? 'is-costly' : ''}>
                      <span className="god-name">{god.god}</span>
                      <span className="god-why">{god.why}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {live.length ? (
                <ul className="target-list">
                  {live.slice(0, 12).map((verdict) => (
                    <TargetLine key={verdict.target} verdict={verdict} rate={odds.get(verdict.target)} />
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
          )}
        </div>
      ) : null}
    </section>
  )
}

function TargetLine({ verdict, rate }: { verdict: Verdict; rate: number | undefined }) {
  const trait = traits.get(verdict.target)
  const kind = trait?.kind === 'legendary' ? 'Legendary' : trait?.kind === 'hex' ? 'Hex duo' : 'Duo'

  return (
    <li className={`target is-${verdict.state.toLowerCase()}`}>
      <span className="target-head">
        <span className="target-name">{trait?.name ?? verdict.target}</span>
        <span className="target-kind">
          {kind}
          {trait?.gods.length ? ` · ${trait.gods.join(' and ')}` : ''}
        </span>
        {rate !== undefined ? <span className="odds">{formatOdds(rate)}</span> : null}
      </span>
      {trait?.text ? <span className="target-text">{trait.text}</span> : null}
      <span className="target-why">{verdict.why}</span>
    </li>
  )
}
