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

import { useEffect, useMemo, useRef, useState } from 'react'

import { olympians, traits } from '../data/app.ts'
import { readRepeat } from '../engine/repeat.ts'
import { Stamp } from './Stamp.tsx'
import { SAMPLE_BUILDS } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'
import { deleteBuild, duplicateBuild, emptyBin, loadBin, loadBuilds, restoreBuild, saveBuild } from '../state/builds.ts'
import { linkFor } from '../state/transfer.ts'
import { cardImage } from './card-image.ts'
import { loadPrefs, savePrefs } from '../state/prefs.ts'
import { readName } from '../state/identity.ts'
import type { BuildDetail } from '../state/prefs.ts'
import { BuildEditor } from './BuildEditor.tsx'
import { LogRun } from './LogRun.tsx'
import { BuildFilters } from './BuildFilters.tsx'
import { assemble } from './build-pieces.ts'
import type { Piece } from './build-pieces.ts'
import { EMPTY_SELECTION, apply, choose, facets, sortBuilds } from './build-filter.ts'
import type { FacetId, SortId } from './build-filter.ts'
import { Card } from './variants/Card.tsx'
import { Constellation } from './variants/Constellation.tsx'
import { Poster } from './variants/Poster.tsx'

/** The two layouts a single build can open in. */
const DETAILS: { id: BuildDetail; name: string; note: string }[] = [
  { id: 'poster', name: 'Poster', note: 'The art large, everything else demoted. One build as a page' },
  {
    id: 'constellation',
    name: 'Constellation',
    note: 'Five fixed positions round the arm. A dark spoke is a gap you see at once',
  },
]

export function Builds({ onClose }: { onClose?: () => void }) {
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [sort, setSort] = useState<SortId>('name')
  const [openId, setOpenId] = useState<string | null>(null)
  const [piece, setPiece] = useState<Piece | null>(null)
  const [logging, setLogging] = useState(false)
  const [bin, setBin] = useState(() => loadBin())
  const [showBin, setShowBin] = useState(false)

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
   * How a single build opens, and it is set from here now.
   *
   * It used to live in the menu, which meant choosing between two layouts
   * without either of them on screen. It is a control on the overview instead:
   * pick one, open a build, and that is what you get. Still written straight
   * through to `enodia.prefs`, because a reader wants one of the two and keeps
   * wanting it.
   */
  const [detail, setDetail] = useState<BuildDetail>(() => loadPrefs().buildDetail)

  const chooseDetail = (id: BuildDetail) => {
    setDetail(id)
    savePrefs({ ...loadPrefs(), buildDetail: id })
  }

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
          {/* Whose it is, when it is not yours. Your own name on your own
            * builds is noise; somebody else's is the thing worth knowing. */}
          {open.author && open.author !== readName() ? (
            <p className="builds-author">by {open.author}</p>
          ) : null}

          {/* How this build is drawn, on the screen that draws it.
            *
            * It was in the overview's filter bar, which was the wrong half of
            * the same mistake the menu was making: a control for a layout you
            * cannot see while you set it. Here, pressing it changes the thing
            * you are looking at. */}
          <div className="builds-layout" role="radiogroup" aria-label="How this build is drawn">
            {DETAILS.map((one) => (
              <button
                key={one.id}
                type="button"
                role="radio"
                aria-checked={detail === one.id}
                className={detail === one.id ? 'is-on' : ''}
                title={one.note}
                onClick={() => chooseDetail(one.id)}
              >
                {one.name}
              </button>
            ))}
          </div>

          {/* Two controls now, so the `margin-left: auto` that pushed a single
            * one right moves onto a wrapper holding both. */}
          <div className="builds-tools" data-tour="builds-tools">
            {/* Beside Edit rather than inside it. Playing a build and coming
              * back to say how it went is the thing that happens most, and it
              * was the one update that meant opening the editor and hand
              * editing three numbers. */}
            <button type="button" className="quiet builds-log" onClick={() => setLogging(true)}>
              Log run
            </button>
            {open.by === 'owner' ? (
              <button type="button" className="quiet builds-edit" onClick={() => setEditing(open)}>
                Edit
              </button>
            ) : null}
            <BuildMenu
              build={open}
              onDuplicate={() => {
                const { builds, copy } = duplicateBuild(open)
                setMine(builds)
                setOpenId(copy.id)
              }}
              onDelete={() => {
                setMine(deleteBuild(open.id))
                setBin(loadBin())
                setOpenId(null)
              }}
            />
          </div>
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

          {open.luck ? (
            <section className="builds-how builds-luck" aria-label="If the run goes your way">
              <h3>If the run goes your way</h3>
              <p>{open.luck}</p>
            </section>
          ) : null}

          {/* The tool's read, next to the player's own. They answer the same
            * question in the same three words and they are allowed to disagree:
            * the player has actually played it and the reading has not. */}
          <section className="builds-repeat" aria-label="Putting it together">
            <h3>Putting it together</h3>
            {/* One reading. This called `readRepeat` twice, once for the stamp
              * and once for the charges, which is the same work done twice and
              * two objects that could in principle disagree. */}
            {(() => {
              const read = readRepeat(open, traits, olympians)
              return (
                <>
                  <Stamp read={read} size="large" showSay />
                  <ul>
                    {read.charges.map((charge) => (
                      <li key={charge.id}>{charge.say}</li>
                    ))}
                  </ul>
                </>
              )
            })()}
          </section>
        </div>

        {piece ? <PieceCard piece={piece} onClose={() => setPiece(null)} /> : null}

        {logging ? (
          <LogRun
            build={open}
            onClose={() => setLogging(false)}
            onLog={(play) => {
              // Straight to storage. A logged run is a fact about how it went,
              // not an edit to the build, so it does not go through the editor
              // or the checker.
              setMine(saveBuild({ ...open, play }))
            }}
          />
        ) : null}
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
        <p className="builds-note">
          {library.length
            ? 'Pick an arm, or open one to see how it works.'
            : 'Nothing here yet. What you make is yours and stays in this browser.'}
        </p>
        <button
          type="button"
          className="quiet builds-new"
          data-tour="builds-new"
          onClick={() => setEditing('new')}
        >
          Create a build
        </button>
      </header>

      {/* The bin, which is only mentioned when there is something in it.
        *
        * Deleting used to be the end of a build: one browser, no server, and a
        * mis-click was final. The confirm step stops the accident and not the
        * change of mind an hour later. */}
      {bin.length ? (
        <p className="builds-binline">
          <button type="button" onClick={() => setShowBin((was) => !was)}>
            {showBin ? 'Hide the bin' : `${bin.length} in the bin`}
          </button>
        </p>
      ) : null}

      {showBin && bin.length ? (
        <section className="builds-bin" data-tour="builds-bin" aria-label="Deleted builds">
          <ul>
            {bin.map((one) => (
              <li key={one.id}>
                <span className="builds-bin-name">{one.name || 'Untitled build'}</span>
                <button
                  type="button"
                  onClick={() => {
                    const back = restoreBuild(one.id)
                    setMine(back.builds)
                    setBin(back.bin)
                  }}
                >
                  Put it back
                </button>
                <button
                  type="button"
                  className="is-final"
                  onClick={() => setBin(emptyBin(one.id))}
                >
                  Gone for good
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="builds-bin-all is-final"
            onClick={() => {
              setBin(emptyBin())
              setShowBin(false)
            }}
          >
            Empty the bin
          </button>
        </section>
      ) : null}

      {/* No bar over an empty shelf. Sorting and filtering nothing is furniture,
        * and it was worse than that: it offered to clear six filters nobody had
        * set. */}
      {library.length ? (
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
      ) : null}

      {shown.length ? (
        <ul className="builds-grid" data-tour="builds-grid">
          {shown.map((build, at) => (
            /* The tour points at the first card rather than the whole grid.
              * The grid is most of the viewport, which leaves Dora nowhere to
              * stand outside the thing she is describing, and she is describing
              * one card's reading anyway. */
            <Card key={build.id} built={assemble(build)} onOpen={setOpenId} first={at === 0} />
          ))}
        </ul>
      ) : library.length === 0 ? (
        /* An empty library and an empty result are two different things and used
         * to print the same sentence. Telling somebody to drop a filter when
         * they have not set one is the tool blaming them for its own state. */
        <p className="builds-none">
          No builds yet. Make the first one, or open a link somebody sent you.
        </p>
      ) : (
        <p className="builds-none">
          Nothing matches all of those. Drop a filter, or clear them and start again.
        </p>
      )}

      {library.length ? <SampleTag full /> : null}
    </div>
  )
}

/**
 * The build's own menu: fork it, and remove it.
 *
 * **Duplicate is offered on every build, samples included.** The eight samples
 * were read-only dead ends, and forking one is the cheapest way for somebody to
 * start from a build that already works rather than from blank.
 *
 * **Delete asks first.** It used to live inside the editor, two clicks deep,
 * and fired straight into storage with no confirmation and nothing to undo it
 * with. Moving it here puts it next to the build it removes, which is the right
 * place and also a closer place, so the question is what stands between a
 * misclick and somebody's work.
 */
function BuildMenu({
  build,
  onDuplicate,
  onDelete,
}: {
  build: ShownBuild
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null)
  const [picture, setPicture] = useState<'working' | 'copied' | 'saved' | 'failed' | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  // Closing the menu drops a half-asked question, so reopening it never lands
  // on a Delete that is already armed.
  useEffect(() => {
    if (!open) {
      setConfirming(false)
      setShared(null)
      setPicture(null)
    }
  }, [open])

  return (
    <div className="bmenu" ref={panel}>
      <button
        type="button"
        className="quiet bmenu-button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((was) => !was)}
      >
        <span aria-hidden="true">More</span>
        <span className="visually-hidden">More for this build</span>
      </button>

      {open ? (
        <div className="bmenu-panel" role="menu">
          {/* A whole build in a link, with no server behind it. DESIGN.md 9.
              The menu stays open so the copied line can be read. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              linkFor(build, window.location.href).then(
                (link) =>
                  navigator.clipboard?.writeText(link).then(
                    () => setShared('copied'),
                    () => setShared('failed'),
                  ) ?? setShared('failed'),
                () => setShared('failed'),
              )
            }}
          >
            <span className="bmenu-label">Share</span>
            <span className="bmenu-note">
              {shared === 'copied'
                ? 'Link copied. Paste it anywhere'
                : shared === 'failed'
                  ? 'Could not reach the clipboard'
                  : 'Copies a link holding the whole build'}
            </span>
          </button>

          {/* The picture, separately.
            *
            * **A link cannot carry one.** A preview in WhatsApp or Discord comes
            * from OpenGraph tags on the page the link points at, which needs a
            * server rendering per-build tags, and this is a static site whose
            * shared build lives in a fragment that never reaches one. So the
            * card goes on the clipboard beside the link and you paste both.
            *
            * Two buttons rather than one that does both, because copying an
            * image replaces whatever the link copy just put there. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setPicture('working')
              cardImage(build).then(
                async (blob) => {
                  if (!blob) return setPicture('failed')
                  try {
                    // Not every browser will write an image, and Firefox needs
                    // it enabled. The download is the honest fallback rather
                    // than a failure message on something that did render.
                    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
                      throw new Error('no image clipboard')
                    }
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                    setPicture('copied')
                  } catch {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${build.name || 'build'}.png`
                    a.click()
                    URL.revokeObjectURL(url)
                    setPicture('saved')
                  }
                },
                () => setPicture('failed'),
              )
            }}
          >
            <span className="bmenu-label">Copy the card</span>
            <span className="bmenu-note">
              {picture === 'working'
                ? 'Drawing it'
                : picture === 'copied'
                  ? 'Card copied. Paste it beside the link'
                  : picture === 'saved'
                    ? 'Saved as a file: this browser will not copy images'
                    : picture === 'failed'
                      ? 'Could not draw it'
                      : 'A picture of the build, to paste with the link'}
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDuplicate()
              setOpen(false)
            }}
          >
            <span className="bmenu-label">Duplicate</span>
            <span className="bmenu-note">
              {build.by === 'sample'
                ? 'Fork this sample into a build of your own'
                : 'A copy you can change, with its own identity'}
            </span>
          </button>

          {build.by === 'owner' ? (
            confirming ? (
              <div className="bmenu-confirm">
                <p>Delete this build?</p>
                <div>
                  <button type="button" className="bmenu-yes" onClick={onDelete}>
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" role="menuitem" onClick={() => setConfirming(true)}>
                <span className="bmenu-label is-danger">Delete</span>
                <span className="bmenu-note">Gone from this browser, and not recoverable</span>
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Sample data says so, plainly, wherever it is on screen.
 *
 * **Nothing ships as a sample any more**, so this only fires for a build marked
 * `by: 'sample'` that somebody has kept from a link or written themselves. It
 * stays because the distinction between a build the owner tested and a build
 * somebody uploaded is one a reader is owed, and `data/curated/builds.json` is
 * still where the real ones will go.
 */
function SampleTag({ full = false }: { full?: boolean }) {
  if (!full) return <p className="builds-sample">Sample build</p>
  return (
    <p className="builds-disclaimer">
      Builds here are yours and live in this browser. Nothing in this tool says whether a build
      is worth playing: that is not in any file and is not claimed here. What it does say is
      whether a build is legal and how much has to go right to assemble one.
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
