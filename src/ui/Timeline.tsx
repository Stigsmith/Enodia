/**
 * The timeline. The run itself, one entry per Exit.
 *
 * `DESIGN.md` 8: lit entries behind you, one bright entry at the present, unlit
 * beads ahead for the Exits that remain.
 *
 * Two rules from that section are load bearing here.
 *
 * **A death is recorded where it happened.** Committing a slot can close a
 * dozen duos at once, and the entry for that pick is the only place the cause
 * and the consequence sit next to each other.
 *
 * **Future entries carry shape, never content.** `RewardLogic.ChooseLoot` draws
 * uniformly from the eligible set, so predicting which god sits behind an
 * unreached Exit would be an invented offer model. The beads state the pace of
 * the run, which is real.
 */

import { iconOf, traits } from '../data/app.ts'
import type { RunEntry } from '../state/run.ts'

export function Timeline({ entries, exitsLeft }: { entries: RunEntry[]; exitsLeft: number }) {
  const newest = entries.at(-1)?.exit ?? 0
  return (
    <section className="timeline" aria-label="The run so far">
      {entries.length === 0 ? (
        <p className="timeline-empty">Nothing behind you yet. The first Exit is below.</p>
      ) : (
        <ol className="timeline-list">
          {entries.map((entry) => (
            <PastEntry key={entry.exit} entry={entry} isNewest={entry.exit === newest} />
          ))}
        </ol>
      )}

      <Beads count={exitsLeft} />
    </section>
  )
}

function PastEntry({ entry, isNewest }: { entry: RunEntry; isNewest: boolean }) {
  const taken = entry.taken ? traits.get(entry.taken) : null
  const icon = entry.taken ? iconOf.get(entry.taken) : null

  return (
    <li className={`entry${entry.died.length ? ' has-deaths' : ''}`}>
      {/* The game's own pickup burst, played once on the entry that just
          arrived. 19 frames of ItemConsume as one strip, stepped in CSS. */}
      {isNewest && taken ? <span className="fx-item-consume entry-fx" aria-hidden="true" /> : null}
      <span className="entry-exit">{entry.exit}</span>

      <div className="entry-body">
        <p className="entry-what">
          {taken ? (
            <>
              {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : null}
              <span className="entry-boon">{taken.name}</span>
              {entry.rarity ? <span className="entry-rarity">{entry.rarity}</span> : null}
              {entry.god ? <span className="entry-god">from {entry.god}</span> : null}
            </>
          ) : (
            <span className="entry-boon entry-declined">
              {entry.god ? `Took nothing from ${entry.god}` : 'No god at this Exit'}
            </span>
          )}
        </p>

        {entry.died.length ? <Deaths died={entry.died} /> : null}
      </div>
    </li>
  )
}

/**
 * What this pick closed.
 *
 * The count carries the news and comes first. Settling the fourth Olympian can
 * close thirty five builds at once, and thirty five names is a wall rather than
 * a sentence, so the list opens on request.
 */
function Deaths({ died }: { died: string[] }) {
  const named = died.map((id) => traits.get(id)?.name ?? id)
  const shown = named.slice(0, 5)
  const rest = named.length - shown.length

  return (
    <details className="entry-deaths">
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
 * The Exits ahead. A count, and nothing else.
 *
 * Deliberately unlabelled: any content here would be a prediction, and the
 * offer model that would license one has not been measured.
 */
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
