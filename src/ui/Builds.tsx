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
import { ACCOUNTS_LIVE } from '../state/account.ts'
import { publishBuild, republishBuild, takeDownBuild } from '../state/publish.ts'
import { cardImage } from './card-image.ts'
import { loadPrefs, savePrefs } from '../state/prefs.ts'
import type { BuildDensity } from '../state/prefs.ts'
import { readName } from '../state/identity.ts'
import type { BuildDetail } from '../state/prefs.ts'
import type { View } from './nav.ts'
import { BuildEditor } from './BuildEditor.tsx'
import { acceptOffer, forkFollowed, republishChangesTheBuild } from '../state/exchange.ts'
import { declineOffer, loadOffers, offerFor } from '../state/offers.ts'
import { LogRun } from './LogRun.tsx'
import { BuildFilters } from './BuildFilters.tsx'
import { assemble } from './build-pieces.ts'
import { useBackdrop, useEscape } from './escape.ts'
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

export function Builds({ onClose, onGo }: { onClose?: () => void; onGo?: (view: View) => void }) {
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [sort, setSort] = useState<SortId>('name')
  /** What was typed into the search box. Not part of `Selection`: see below. */
  const [query, setQuery] = useState('')
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

  /**
   * Cards or a list. Absent in prefs means nobody has chosen, and the library's
   * answer to that is cards: it holds your own handful, and the plate is worth
   * the room when there are eight of something rather than eight hundred.
   */
  const [density, setDensity] = useState<BuildDensity>(() => loadPrefs().buildDensity ?? 'cards')
  const chooseDensity = (one: BuildDensity) => {
    setDensity(one)
    savePrefs({ ...loadPrefs(), buildDensity: one })
  }

  /**
   * Whether to say out loud that these can be lost. Read once on mount, because
   * it only changes when somebody dismisses it and that path sets the state.
   */
  const [warned, setWarned] = useState(() => loadPrefs().backupWarningSeen)

  const stopWarning = () => {
    setWarned(true)
    savePrefs({ ...loadPrefs(), backupWarningSeen: true })
  }

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

  /**
   * Followed builds with something waiting, recomputed whenever the library is.
   *
   * A declined offer is not waiting: saying no once should not leave a line on
   * the screen forever. `refreshFollowed` raises it again if the author moves
   * again, which is the only thing that should bring it back.
   */
  const waiting = useMemo(() => {
    const offers = loadOffers()
    return mine
      .filter((one) => {
        const offer = offers[one.id]
        return offer?.kind === 'changed' && offer.declined !== offer.revision
      })
      .map((one) => one.id)
  }, [mine])

  const chooseDetail = (id: BuildDetail) => {
    setDetail(id)
    savePrefs({ ...loadPrefs(), buildDetail: id })
  }

  /**
   * Text narrowing, applied after the facets and before the sort.
   *
   * **The facets are computed on the unsearched library on purpose.** An option
   * count promises "how many builds would I get if I picked this instead", and
   * counting against the searched list would quietly change that to "of the
   * ones matching what you typed", which is a different promise and a smaller
   * number with nothing on screen explaining it.
   *
   * Name, the line the author wrote about it, and who wrote it. Not the boons:
   * somebody typing "Zeus" wants the god facet, and a text match would return
   * every build mentioning Zeus in prose alongside it.
   */
  const bar = useMemo(() => facets(library, selection), [library, selection])
  const shown = useMemo(() => {
    const found = apply(library, selection)
    const needle = query.trim().toLowerCase()
    const narrowed = needle
      ? found.filter((build) =>
          [build.name, build.say, build.author ?? ''].some((text) =>
            text.toLowerCase().includes(needle),
          ),
        )
      : found
    return sortBuilds(narrowed, sort)
  }, [library, selection, sort, query])

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
            {/**
              * Changing somebody else's build is what makes it yours.
              *
              * A followed build has no Edit, and that is not a restriction so
              * much as what following means: it is the author's, their edits
              * reach you, and yours would be overwritten by the next one of
              * theirs. So the way to change it is to stop following and take
              * it on, which is one build in the library rather than two.
              *
              * `derivedFrom` and `derivedHash` survive the fork, so runs still
              * count toward the build it came from until you change a pick.
              */}
            {open.by === 'community' ? (
              <button
                type="button"
                className="quiet builds-edit"
                onClick={() => {
                  const mine = forkFollowed(open)
                  setMine(loadBuilds())
                  setEditing(mine)
                }}
              >
                Make it mine
              </button>
            ) : null}
            <BuildMenu
              build={open}
              onListed={() => setMine(loadBuilds())}
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
              {...(onGo ? { onGo } : {})}
            />
          </div>
        </header>

        {/**
          * What the author did to a build you follow, and what you can do about
          * it.
          *
          * Only ever drawn for a substantive change: a rewritten note or a
          * better name has already been applied, quietly, because being asked
          * about a typo is worse than not being told. `state/exchange.ts` draws
          * that line on the picks.
          */}
        <FollowNews
          build={open}
          onTook={() => setMine(loadBuilds())}
          onFork={() => {
            const mine = forkFollowed(open)
            setMine(loadBuilds())
            setEditing(mine)
          }}
        />

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
            : 'Nothing here yet. What you make is yours, and it stays in this browser unless you sign in or send it somewhere.'}
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
      {/**
        * Somebody changed a build you follow, said once, above the shelf.
        *
        * Without this the whole thing is undiscoverable: the answer lives on
        * the build's own screen, and nothing would tell you there was a build
        * worth opening. Same idiom as the bin line below, which is already the
        * pattern for a thing only mentioned when there is something in it.
        */}
      {waiting.length ? (
        <p className="builds-binline builds-waiting">
          <button type="button" onClick={() => setOpenId(waiting[0] as string)}>
            {waiting.length === 1
              ? 'One build you follow has changed'
              : `${waiting.length} builds you follow have changed`}
          </button>
        </p>
      ) : null}

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
        onClear={() => {
          setSelection(EMPTY_SELECTION)
          setQuery('')
        }}
        sort={sort}
        onSort={setSort}
        density={density}
        onDensity={chooseDensity}
        query={query}
        onQuery={setQuery}
        showing={shown.length}
        total={library.length}
      />
      ) : null}

      {/*
        * The loss warning, and it appears only once there is something to lose.
        *
        * The empty state has always said the library stays in this browser,
        * which is the right sentence at the wrong moment: somebody with no
        * builds has nothing at stake and does not read it. The same sentence
        * over a library they have actually filled is the one that gets a copy
        * made. So the empty state keeps its line and this arrives after it.
        *
        * `mine` and not `library`: a warning about losing the sample builds
        * would be a warning about losing nothing.
        *
        * It points at the export rather than at an account, on purpose. An
        * account publishes one build to get a short link. It does not back
        * anything up, and saying otherwise would sell a thing that does not
        * exist yet.
        */}
      {mine.length > 0 && !warned ? (
        <aside className="keep" role="note">
          <p className="keep-say">
            These live in this browser. Clearing site data takes them with it, and so does a
            new phone. An account keeps a copy and carries them between your devices; the
            export is the copy that does not need one.
          </p>
          <p className="keep-do">
            {onGo ? (
              <button type="button" className="keep-go" onClick={() => onGo('settings')}>
                Export them
              </button>
            ) : (
              <span>Settings has an export.</span>
            )}{' '}
            It writes one file you keep.
          </p>
          <button type="button" className="keep-dismiss" onClick={stopWarning}>
            Got it
          </button>
        </aside>
      ) : null}

      {shown.length ? (
        <ul className={`builds-grid${density === 'list' ? ' is-list' : ''}`} data-tour="builds-grid">
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
  onListed,
  onGo,
}: {
  build: ShownBuild
  onDuplicate: () => void
  onDelete: () => void
  /**
   * The listing changed, so the library has to be read again.
   *
   * `publishBuild` stamps `publishedAs` on the build in storage, and without
   * this the menu goes on holding the copy it was rendered with and offers
   * Publish for a build that is already published. Caught by publishing one and
   * watching the menu not change.
   */
  onListed: () => void
  onGo?: (view: View) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null)
  const [published, setPublished] = useState<string | null>(null)
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
          {/**
            * Before a republish that replaces the build rather than its
            * write-up.
            *
            * It says what will actually happen rather than asking to confirm,
            * and the recommended answer is first: publish this as a second
            * build, which costs the author nothing and costs their followers
            * nothing either. Replacing is still there, one press away, because
            * it is a legitimate thing to want.
            *
            * `republishChangesTheBuild` decides, and the request uses the same
            * function, so this cannot warn on a rule the server does not apply.
            */}
          {published === 'warn' ? (
            <div className="bmenu-warn" role="alertdialog" aria-label="This replaces the build">
              <p>
                <strong>This is a different build now, not a reworded one.</strong> The picks
                have changed since you published it.
              </p>
              <p>
                Everybody following it will be asked rather than updated, and the listing starts
                again from no runs and no rating. What it earned so far stays visible, marked as
                being from before the change.
              </p>
              <div className="bmenu-warn-answers">
                <button
                  type="button"
                  onClick={() => {
                    setPublished('working')
                    void publishBuild(build).then((outcome) => {
                      setPublished(outcome.ok ? 'Published as a second build' : outcome.say)
                      if (outcome.ok) onListed()
                    })
                  }}
                >
                  Publish this as a second build
                </button>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => {
                    setPublished('working')
                    void republishBuild(build).then((outcome) => {
                      setPublished(outcome.ok ? 'Replaced' : outcome.say)
                      if (outcome.ok) onListed()
                    })
                  }}
                >
                  Replace it anyway
                </button>
                <button type="button" className="quiet" onClick={() => setPublished(null)}>
                  Never mind
                </button>
              </div>
            </div>
          ) : null}

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

          {/*
            * Publish, which is the same job done shorter.
            *
            * Share above needs no account and never will: the build travels
            * inside the link. It is also 1,588 characters, which Discord
            * renders as a wall. Publishing stores the build and hands back
            * about thirty characters instead. That difference is the only
            * thing an account buys, which is why the item sits here, next to
            * the thing it improves, rather than on a screen of its own.
            */}
          {/**
            * A build that is already published gets different verbs.
            *
            * Update replaces what people are reading. Take it down removes it
            * from the shelves and leaves the link answering for anybody who
            * already has it, which is why it is not called Delete: nothing is
            * destroyed and saying so would be a lie about somebody else's runs.
            *
            * **The warning is the point of this whole batch.** Republishing a
            * build whose picks have moved starts the listing's counts again and
            * asks everybody following it, so the author is told before it lands
            * and offered the gentler option first.
            */}
          {ACCOUNTS_LIVE && build.publishedAs ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (republishChangesTheBuild(build)) return setPublished('warn')
                  setPublished('working')
                  void republishBuild(build).then((outcome) => {
                    setPublished(outcome.ok ? 'Updated' : outcome.say)
                    if (outcome.ok) onListed()
                  })
                }}
              >
                <span className="bmenu-label">Update the published copy</span>
                <span className="bmenu-note">
                  {published === 'working'
                    ? 'Updating'
                    : published && published !== 'warn'
                      ? published
                      : 'Replaces what people following it are reading'}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPublished('working')
                  void takeDownBuild(build.publishedAs as string).then((ok) =>
                    setPublished(ok ? 'Taken off the exchange' : 'That did not work.'),
                  )
                  onListed()
                }}
              >
                <span className="bmenu-label">Take it down</span>
                <span className="bmenu-note">
                  Off the shelves. The link keeps working for anybody who has it
                </span>
              </button>
            </>
          ) : null}

          {ACCOUNTS_LIVE && !build.publishedAs ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPublished('working')
                void publishBuild(build).then((outcome) => {
                  if (!outcome.ok) {
                    // Not signed in is the one refusal worth acting on rather
                    // than just reporting, so it offers the way to fix it.
                    setPublished(outcome.say)
                    return
                  }
                  onListed()
                  navigator.clipboard?.writeText(outcome.link).then(
                    () => setPublished('Short link copied'),
                    () => setPublished(outcome.link),
                  ) ?? setPublished(outcome.link)
                })
              }}
            >
              <span className="bmenu-label">Publish</span>
              <span className="bmenu-note">
                {published === 'working'
                  ? 'Publishing'
                  : published
                    ? published
                    : 'Stores it, and copies a short link instead of a long one'}
              </span>
            </button>
          ) : null}

          {ACCOUNTS_LIVE && published?.includes('signed in') && onGo ? (
            <button type="button" role="menuitem" onClick={() => onGo('account')}>
              <span className="bmenu-label">Sign in</span>
              <span className="bmenu-note">Publishing needs an account. Sharing never will</span>
            </button>
          ) : null}

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
  /* It only ever tells you what a boon does, so leaving it costs nothing. */
  useEscape(true, onClose)
  const backdrop = useBackdrop(onClose)

  return (
    <div className="piececard" role="dialog" aria-label={piece.name} {...backdrop}>
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

/**
 * The author of a build you follow changed it, or took it down.
 *
 * **Three answers, and two of them already existed.** Taking their version goes
 * through `followBuild`, so there is still exactly one function that writes a
 * follow; making it yours is the same `forkFollowed` the header already offers.
 * Only "Keep mine" is new, and all it does is remember which revision was
 * refused so the same one is not raised twice.
 *
 * A build the author has taken down has nothing to answer. It says so and stops
 * there: the build stays in the library, it still works, and it will not change
 * again.
 */
function FollowNews({
  build,
  onTook,
  onFork,
}: {
  build: ShownBuild
  onTook: () => void
  onFork: () => void
}) {
  const [offer, setOffer] = useState(() => offerFor(build.id))
  const [busy, setBusy] = useState(false)
  useEffect(() => setOffer(offerFor(build.id)), [build.id])

  if (!offer) return null

  if (offer.kind === 'takenDown') {
    return (
      <p className="builds-news">
        {build.author ?? 'The author'} has taken this off the exchange. It stays here and it
        still works, and it will not change again.
      </p>
    )
  }

  /* Said no to this one already. Kept quiet until the author moves again. */
  if (offer.declined === offer.revision) return null

  return (
    <div className="builds-news">
      <p>
        {build.author ?? 'The author'} has changed this build. Not the words: the picks are
        different, so it is not the build you followed.
      </p>
      <div className="builds-news-answers">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void acceptOffer(build).then((outcome) => {
              setBusy(false)
              if (!outcome.ok) return
              setOffer(null)
              onTook()
            })
          }}
        >
          Take their version
        </button>
        <button
          type="button"
          className="quiet"
          onClick={() => {
            declineOffer(build.id)
            setOffer(offerFor(build.id))
          }}
        >
          Keep mine
        </button>
        {/* For somebody who wants these picks for good. It ends the follow,
          * which is the honest outcome: you are not reading their build now. */}
        <button type="button" className="quiet" onClick={onFork}>
          Make it mine
        </button>
      </div>
    </div>
  )
}
