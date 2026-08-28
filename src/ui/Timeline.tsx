/**
 * The run, as a path going down.
 *
 * `DESIGN.md` 8 asks for lit entries behind, one bright entry at the present,
 * and unlit beads ahead. This is that, laid out as a single vertical line: each
 * Exit is a station on it, large and centred, so moving between them is a
 * scroll rather than a scan. Going back in time is scrolling up, and it is
 * deliberately a long way, because each pick deserves the screen it changed.
 *
 * **The picker is the end of the path, not a screen under it.** The present
 * station is the ring, and finishing a pick advances the run and carries the
 * page down to the next Exit, the same way the weapon ring hands you to the
 * aspect ring.
 *
 * **A death is recorded where it happened.** Committing a slot can close a
 * dozen duos at once, and the station for that pick is the only place the cause
 * and the consequence sit next to each other.
 *
 * **Future stations carry shape, never content.** `RewardLogic.ChooseLoot`
 * draws uniformly from the eligible set, so predicting which god sits behind an
 * unreached Exit would be an invented offer model.
 */

import { useEffect, useRef } from 'react'

import { iconOf, traits } from '../data/app.ts'
import { Picker } from './Picker.tsx'
import type { RunEntry } from '../state/run.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'

export function Timeline({
  entries,
  run,
  onTake,
  onSkip,
}: {
  entries: RunEntry[]
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null) => void
  onSkip: (god: string | null) => void
}) {
  const present = useRef<HTMLLIElement>(null)

  // Finishing a pick carries the page to the next Exit. The thing needed in a
  // hurry sits at the far end of a history object, so position has to be
  // fought deliberately.
  useEffect(() => {
    present.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [entries.length])

  return (
    <ol className="path" aria-label="The run">
      {entries.map((entry) => (
        <Station key={entry.exit} entry={entry} />
      ))}

      <li className="station is-present" ref={present}>
        <span className="station-mark" aria-hidden="true" />
        <div className="station-body">
          <p className="station-exit">Exit {entries.length + 1}</p>
          <Picker run={run} onTake={onTake} onSkip={onSkip} />
        </div>
      </li>

      <li className="station is-ahead">
        <span className="station-mark" aria-hidden="true" />
        <div className="station-body">
          <Beads count={run.exitsLeft} />
        </div>
      </li>
    </ol>
  )
}

function Station({ entry }: { entry: RunEntry }) {
  const taken = entry.taken ? traits.get(entry.taken) : null
  const icon = entry.taken ? iconOf.get(entry.taken) : null

  return (
    <li className={`station${entry.died.length ? ' has-deaths' : ''}`}>
      <span className="station-mark" aria-hidden="true" />

      <div className="station-body">
        <p className="station-exit">
          Exit {entry.exit}
          {entry.god ? <span className="station-god">{entry.god}</span> : null}
        </p>

        {taken ? (
          <>
            {icon ? <img className="station-art" src={`/${icon}`} alt="" loading="lazy" /> : null}
            <p className="station-name">
              {taken.name}
              {entry.rarity ? <span className="station-rarity">{entry.rarity}</span> : null}
            </p>
            {taken.text ? <p className="station-text">{taken.text}</p> : null}
          </>
        ) : (
          <p className="station-name station-declined">
            {entry.god ? `Took nothing from ${entry.god}` : 'Nothing that changes what is reachable'}
          </p>
        )}

        {entry.died.length ? <Deaths died={entry.died} /> : null}
      </div>
    </li>
  )
}

/**
 * What this pick closed.
 *
 * The count carries the news and comes first. Settling the fourth Olympian can
 * close thirty five duos at once, and thirty five names is a wall rather than a
 * sentence, so the list opens on request.
 */
function Deaths({ died }: { died: string[] }) {
  const named = died.map((id) => traits.get(id)?.name ?? id)
  const shown = named.slice(0, 5)
  const rest = named.length - shown.length

  return (
    <details className="station-deaths">
      <summary>
        <span className="entry-deaths-count">
          {died.length === 1 ? '1 closed here' : `${died.length} closed here`}
        </span>
        <span className="entry-deaths-list">
          {shown.join(', ')}
          {rest > 0 ? `, and ${rest} more` : ''}
        </span>
      </summary>
      <p className="entry-deaths-all">{named.join(', ')}</p>
    </details>
  )
}

function Beads({ count }: { count: number }) {
  if (count <= 0) return <p className="beads-none">No Exits left.</p>
  return (
    <p className="beads" aria-label={`${count} ${count === 1 ? 'Exit' : 'Exits'} ahead`}>
      {Array.from({ length: Math.min(count, 20) }, (_, i) => (
        <span key={i} className="bead" aria-hidden="true" />
      ))}
      <span className="beads-count">
        {count} {count === 1 ? 'Exit' : 'Exits'} ahead
      </span>
    </p>
  )
}
