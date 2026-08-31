/**
 * The build manager. A library you browse, and one build you open.
 *
 * The five-layout switcher did its job and is gone. What came out of it:
 *
 * - **Overview: the contact sheet**, shrunk. Uniform cards in a grid, the five
 *   core slots in fixed positions so a column scan compares one slot across
 *   every build. It lost the Arcana strip and the crossroads band, because a
 *   card that shows a whole build is a card you can only fit two of.
 * - **Detail: the Poster or the Constellation**, whichever the reader set in
 *   Settings. Both were kept because they answer different questions and the
 *   answer is a habit, not a per-build decision.
 * - **Loadout and Ribbon are deleted.** Both are in the history. The Ribbon had
 *   one idea worth stealing later: it marked which picks were actual
 *   prerequisites of the centrepiece rather than preferences, which nothing
 *   currently shows.
 *
 * ## Built for dozens
 *
 * The library is going to hold tested community builds and then community
 * submissions. So the overview filters and sorts rather than just listing, the
 * facets are derived so nothing has to be maintained alongside the data, and a
 * build carries `by` so a reader can tell a tested build from an uploaded one.
 * At eight builds most of that is invisible, which is the point of doing it now
 * rather than at eighty.
 */

import { useMemo, useState } from 'react'

import { SAMPLE_BUILDS } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'
import { deleteBuild, loadBuilds, saveBuild } from '../state/builds.ts'
import { loadPrefs } from '../state/prefs.ts'
import { BuildEditor } from './BuildEditor.tsx'
import { BuildFilters } from './BuildFilters.tsx'
import { assemble } from './build-pieces.ts'
import type { Piece } from './build-pieces.ts'
import { EMPTY_SELECTION, apply, choose, facets, sortBuilds } from './build-filter.ts'
import type { FacetId, SortId } from './build-filter.ts'
import { Card } from './variants/Card.tsx'
import { Constellation } from './variants/Constellation.tsx'
import { Poster } from './variants/Poster.tsx'

export function Builds({ onClose }: { onClose?: () => void }) {
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [sort, setSort] = useState<SortId>('name')
  const [openId, setOpenId] = useState<string | null>(null)
  const [piece, setPiece] = useState<Piece | null>(null)

  /**
   * The player's own builds, beside the samples.
   *
   * Held in state rather than read on every render, so a save shows up
   * immediately. They keep their `by: 'owner'`, which is what lets the card and
   * the detail view say which kind of build is being looked at.
   */
  const [mine, setMine] = useState<ShownBuild[]>(loadBuilds)
  const [editing, setEditing] = useState<ShownBuild | 'new' | null>(null)

  const library = useMemo(() => [...mine, ...SAMPLE_BUILDS], [mine])

  /**
   * The detail layout, read once when the screen mounts.
   *
   * Not live: changing it in Settings closes the menu and the reader comes back
   * to this screen, which remounts. Subscribing to storage for a setting that
   * cannot change while this is on screen would be machinery for nothing.
   */
  const [detail] = useState(() => loadPrefs().buildDetail)

  const bar = useMemo(() => facets(library, selection), [library, selection])
  const shown = useMemo(
    () => sortBuilds(apply(library, selection), sort),
    [library, selection, sort],
  )

  const open = openId ? library.find((build) => build.id === openId) : null

  if (editing) {
    return (
      <BuildEditor
        {...(editing === 'new' ? {} : { initial: editing })}
        onSave={(build) => {
          setMine(saveBuild(build))
          setEditing(null)
          setOpenId(build.id)
        }}
        onCancel={() => setEditing(null)}
        onDelete={(id) => {
          setMine(deleteBuild(id))
          setEditing(null)
          setOpenId(null)
        }}
      />
    )
  }

  if (open) {
    const built = assemble(open)
    return (
      <div className="builds is-detail">
        <header className="builds-top">
          <button type="button" className="builds-back" onClick={() => setOpenId(null)}>
            All builds
          </button>
          {open.by === 'sample' ? <SampleTag /> : null}
          {open.by === 'owner' ? (
            <button type="button" className="quiet builds-edit" onClick={() => setEditing(open)}>
              Edit
            </button>
          ) : null}
        </header>

        <div className="builds-stage">
          {detail === 'constellation' ? (
            <Constellation built={built} onOpen={setPiece} />
          ) : (
            <Poster built={built} onOpen={setPiece} />
          )}

          {/* How it works, which is the thing a reader opened a build for.
            * Under the layout rather than over it: the picture says what is in
            * the build faster than a paragraph can, and the paragraph says the
            * one thing the picture cannot. */}
          <section className="builds-how" aria-label="How it works">
            <h3>How it works</h3>
            <p>{open.how}</p>
          </section>
        </div>

        {piece ? <PieceCard piece={piece} onClose={() => setPiece(null)} /> : null}
      </div>
    )
  }

  return (
    <div className="builds">
      <header className="builds-top">
        {onClose ? (
          <button type="button" className="builds-back" onClick={onClose}>
            Back
          </button>
        ) : null}
        <h2>Builds</h2>
        <p className="builds-note">Pick an arm, or open one to see how it works.</p>
        <button type="button" className="quiet builds-new" onClick={() => setEditing('new')}>
          Create a build
        </button>
      </header>

      <BuildFilters
        facets={bar}
        onChoose={(facet: FacetId, value: string | null) =>
          setSelection((was) => choose(was, facet, value))
        }
        onClear={() => setSelection(EMPTY_SELECTION)}
        sort={sort}
        onSort={setSort}
        showing={shown.length}
        total={library.length}
      />

      {shown.length ? (
        <ul className="builds-grid">
          {shown.map((build) => (
            <Card key={build.id} built={assemble(build)} onOpen={setOpenId} />
          ))}
        </ul>
      ) : (
        <p className="builds-none">
          Nothing matches all of those. Drop a filter, or clear them and start again.
        </p>
      )}

      <SampleTag full />
    </div>
  )
}

/**
 * Sample data says so, plainly, wherever it is on screen.
 *
 * `data/curated/builds.json` is the owner's and is still empty. Nothing here is
 * a recommendation and the page must not be mistaken for one, which matters
 * more now that there are eight of them and they look like a library.
 */
function SampleTag({ full = false }: { full?: boolean }) {
  if (!full) return <p className="builds-sample">Sample build</p>
  return (
    <p className="builds-disclaimer">
      These eight are samples, built to test the layouts. Every id in them is real, every duo
      actually holds its prerequisites, and each explanation restates something the game files
      say. Which build is worth playing is not in any file and is not claimed here.
    </p>
  )
}

/**
 * One piece, opened.
 *
 * Both detail layouts hand clicks here rather than growing their own, because
 * what a boon does is the same fact in both and they are meant to differ only
 * in arrangement.
 */
function PieceCard({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  return (
    <div className="piececard" role="dialog" aria-label={piece.name}>
      <div className="piececard-body">
        <header>
          {piece.icon ? <img src={`/${piece.icon}`} alt="" /> : null}
          <div>
            <h3>{piece.name}</h3>
            <p>
              {piece.slotName ? <span>{piece.slotName}</span> : null}
              {piece.gods.length ? <span>{piece.gods.join(' + ')}</span> : null}
            </p>
          </div>
        </header>
        {piece.text ? <p className="piececard-text">{piece.text}</p> : <p className="piececard-gap">No text.</p>}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
