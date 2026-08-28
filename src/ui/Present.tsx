/**
 * The present entry. What is still live, which god feeds it, and the pick.
 *
 * `DESIGN.md` 8 puts the offer, the reject verdict and the ranked god list
 * here. The offer block and the reject verdict are step 11 and need the rating
 * engine; the god list and the verdicts are reachability, which exists, so this
 * is what the surface can honestly say today.
 *
 * Silence is the normal state, so nothing here reports that everything is fine.
 * The dead count appears only when something is dead, and the god list appears
 * only while there is a slot left to spend.
 */

import { useEffect, useRef, useState } from 'react'

import { traits } from '../data/app.ts'
import { godPriority, reachable } from '../engine/reachability.ts'
import type { Verdict } from '../engine/reachability.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'
import { LogPick } from './LogPick.tsx'

export function Present({
  run,
  onTake,
  onSkip,
}: {
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string) => void
  onSkip: (god: string | null) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const anchor = useRef<HTMLElement>(null)

  // The thing needed in a hurry sits at the far end of a history object, so
  // position has to be fought deliberately. DESIGN.md 8.
  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [run.exitsLeft])

  const verdicts = reachable(run, traits)
  const dead = verdicts.filter((v) => v.state === 'DEAD')
  const live = verdicts.filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK')
  const done = verdicts.filter((v) => v.state === 'ON_TRACK')

  const gods = godPriority(run, traits).filter((god) => god.keeps.length || god.kills.length)

  return (
    <section className="present" aria-label="Where the run stands" ref={anchor}>
      <p className="tally">
        <strong>{live.length}</strong> still live
        {done.length ? <span className="tally-done">{done.length} already yours</span> : null}
        {dead.length ? <span className="tally-dead">{dead.length} closed</span> : null}
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
              <TargetLine key={verdict.target} verdict={verdict} />
            ))}
          </ul>
          {live.length > 4 ? (
            <button type="button" className="quiet" onClick={() => setShowAll((open) => !open)}>
              {showAll ? 'Show fewer' : `Show all ${live.length}`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="nothing-live">Nothing is still reachable. This run is what it is now.</p>
      )}

      <LogPick run={run} onTake={onTake} onSkip={onSkip} />
    </section>
  )
}

function TargetLine({ verdict }: { verdict: Verdict }) {
  const trait = traits.get(verdict.target)
  return (
    <li className={`target is-${verdict.state.toLowerCase()}`}>
      <span className="target-name">{trait?.name ?? verdict.target}</span>
      {verdict.band ? <span className={`band is-${verdict.band.replace(' ', '-').toLowerCase()}`}>{verdict.band}</span> : null}
      <span className="target-why">{verdict.why}</span>
    </li>
  )
}
