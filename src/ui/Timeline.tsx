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
 *
 * **A logged station can be taken back.** `DESIGN.md` 8 asks for "the entry
 * point for correcting a mistake" and the station is it: a mis-tap is noticed
 * by looking at what got logged, so the way to undo it belongs where it is
 * being looked at. Removing one replays the whole run, so everything after it
 * comes back, deaths included.
 */

import { useEffect, useRef } from 'react'

import { iconOf, traits } from '../data/app.ts'
import { Picker } from './Picker.tsx'
import type { Advice } from './Offer.tsx'
import type { RunEntry } from '../state/run.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'

export function Timeline({
  entries,
  run,
  onTake,
  onSkip,
  onForget,
  /**
   * Whether to carry the page to the present on mount.
   *
   * False while the re-entry briefing is up: that card sits above the timeline
   * and scrolling the present into view would push it off screen before it had
   * been read, which is the whole of the feature.
   */
  scrollToPresent = true,
  advice = null,
}: {
  entries: RunEntry[]
  run: RunContext
  onTake: (trait: TraitId, rarity: HeldTrait['rarity'], god: string | null, kind: RunEntry['kind']) => void
  onSkip: (god: string | null, kind: RunEntry['kind'], note?: string) => void
  /** take a logged entry back out, replaying everything after it */
  onForget: (exit: number, kind: RunEntry['kind']) => void
  scrollToPresent?: boolean
  /** the notes of the build this run is going for, for the offer at the present Exit */
  advice?: Advice | null
}) {
  const present = useRef<HTMLLIElement>(null)

  // Finishing a pick carries the page to the next Exit. The thing needed in a
  // hurry sits at the far end of a history object, so position has to be
  // fought deliberately.
  useEffect(() => {
    if (!scrollToPresent) return
    present.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [entries.length, scrollToPresent])

  return (
    <ol className="path" aria-label="The run">
      {entries.map((entry, index) => (
        <Station key={`${entry.kind}-${entry.exit}-${index}`} entry={entry} onForget={onForget} />
      ))}

      <li className="station is-present" id="present" ref={present} tabIndex={-1}>
        <span className="station-mark" aria-hidden="true" />
        <div className="station-body">
          <p className="station-exit">Exit {entries.filter((entry) => entry.kind === 'exit').length + 1}</p>
          <Picker run={run} onTake={onTake} onSkip={onSkip} advice={advice} />
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

function Station({ entry, onForget }: { entry: RunEntry; onForget: (exit: number, kind: RunEntry['kind']) => void }) {
  const taken = entry.taken ? traits.get(entry.taken) : null
  const icon = entry.taken ? iconOf.get(entry.taken) : null

  return (
    <li className={`station is-${entry.kind}${entry.died.length ? ' has-deaths' : ''}`}>
      <span className="station-mark" aria-hidden="true" />

      <div className="station-body">
        <p className="station-exit">
          {/* An Encounter carries the number of the Exit that led to the
              Location it happened in, and says what it was rather than
              claiming an Exit of its own. */}
          {entry.kind === 'encounter' ? `Encounter, at Exit ${entry.exit}` : `Exit ${entry.exit}`}
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
            {/* What it was, when it was anything. Declining a god's offer is
                the one case with nothing to name, and it keeps its sentence. */}
            {entry.note ?? (entry.god ? `Took nothing from ${entry.god}` : 'Nothing that changes what is reachable')}
          </p>
        )}

        {entry.died.length ? <Deaths died={entry.died} /> : null}

        {/* Quiet, and last. It is the thing you want the moment you notice,
            and never the thing you want to see while reading the run. */}
        <button type="button" className="station-forget" onClick={() => onForget(entry.exit, entry.kind)}>
          This did not happen
        </button>
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
      {/* The game's own downward pointer as the disclosure marker, in place of
          the browser's triangle. DialogueContinueArrow, which is what it puts
          under a line of dialogue that has more behind it. */}
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

/**
 * The road ahead, as shape and not as a count.
 *
 * It used to read "7 Exits ahead", which states a fact nobody has. A run's Exit
 * count is not knowable to a player and it is not in the files either: it wants
 * the region data, which is a map generator rather than a table. So the beads
 * carry that there is more run left and roughly how much, and the number is
 * labelled as the guess it is.
 */
function Beads({ count }: { count: number }) {
  if (count <= 0) return <p className="beads-none">Near the end of the run.</p>
  return (
    <p className="beads" aria-label={`About ${count} more ${count === 1 ? 'Exit' : 'Exits'}`}>
      {Array.from({ length: Math.min(count, 20) }, (_, i) => (
        <span key={i} className="bead" aria-hidden="true" />
      ))}
      <span className="beads-count">about {count} more, if this run is a usual length</span>
    </p>
  )
}
