/**
 * The build exchange: other people's builds, and what happened when they played
 * them.
 *
 * ## It is the library screen pointed somewhere else
 *
 * Same filters, same cards, same sorts. That is the point rather than a saving:
 * somebody who has learned to narrow their own shelf by arm and god already
 * knows how to narrow this one, and a second filter idiom would be a second
 * thing to learn for no reason. `build-filter.ts` runs unchanged over builds
 * that arrived from other installs.
 *
 * ## What is different, and it is three things
 *
 * **Provenance.** Every card says who published it. A build in your library is
 * yours; a build here is somebody's.
 *
 * **Evidence.** Takes, runs, clears, best Fear, and what players rated it.
 * Counts, never a score. The tool has said in eight places that it will not
 * claim a build is good, and it still does not: it reports tallies and the
 * reader draws the conclusion. The mechanical reading sits on the same card in
 * its own words and is never folded in, because `engine/repeat.ts` is right that
 * a build can be five stars from five thousand people and still read Not in one
 * run.
 *
 * **The action is follow, and it used to be take.** A copy was frozen at the
 * moment you pressed the button and yours to edit; a build you follow stays its
 * author's and their edits reach you. The owner asked for it that way and was
 * right: a build somebody else maintains is a thing to subscribe to rather than
 * a thing to clone. Changing one forks it, and then it is an ordinary build of
 * yours.
 *
 * Two bugs died with the copy. Opening a card took one, because `Card` makes
 * its whole face a hit target and this screen passed `take` in as the open
 * handler; and nothing stopped you taking your own build, because the worker
 * never compared the listing's owner to the caller. N clicks made N builds, all
 * named the same thing. A listing now says whether it is yours, and following
 * twice is following once.
 *
 * ## Two shelves, and the missing third is said out loud
 *
 * Picked and From friends. Both passed a human before they were listed, which
 * is what keeps this on the right side of the line `REQUIREMENTS.md` 5 draws
 * around discoverability. The shelf that would cross it is everything anybody
 * published, and it needs a way to report a listing and a way to hide one
 * first. The screen says so, rather than presenting two shelves as though they
 * were the whole thing.
 */

import { useEffect, useMemo, useState } from 'react'

import { followBuild, listShelf } from '../state/exchange.ts'
import { loadBuilds } from '../state/builds.ts'
import { loadPrefs, savePrefs } from '../state/prefs.ts'
import type { BuildDensity } from '../state/prefs.ts'
import type { Listed, Shelf, Stats } from '../state/exchange.ts'
import { ACCOUNTS_LIVE } from '../state/account.ts'
import type { ShownBuild } from '../data/builds.ts'
import { BuildFilters } from './BuildFilters.tsx'
import { Card } from './variants/Card.tsx'
import { Poster } from './variants/Poster.tsx'
import { Page } from './Pages.tsx'
import { Tabs } from './Tabs.tsx'
import { useEscape } from './escape.ts'
import { assemble } from './build-pieces.ts'
import { EMPTY_SELECTION, apply, choose, facets, sortBuilds } from './build-filter.ts'
import type { FacetId, SortId } from './build-filter.ts'

const SHELVES = [
  { id: 'picked' as const, label: 'Picked' },
  { id: 'friends' as const, label: 'From friends' },
]

export function Exchange({ onGo }: { onGo?: (view: 'account' | 'builds' | 'friends') => void }) {
  const [shelf, setShelf] = useState<Shelf>('picked')
  const [listed, setListed] = useState<Listed[] | null>(null)
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [sort, setSort] = useState<SortId>('name')
  const [query, setQuery] = useState('')
  const [said, setSaid] = useState<string | null>(null)

  /**
   * The listing being read, by build id, or nothing.
   *
   * **Opening a build used to take a copy of it.** `Card` makes its whole face a
   * hit target, and this screen passed `take` in as the open handler, so any
   * click anywhere on a card put a new build in your library. There was no way
   * to read a listing at all: no preview, no confirm, and nothing to undo. The
   * owner found it by taking copies of their own build, and then copies of
   * those.
   *
   * So opening is reading now, and taking is the button you press on purpose.
   */
  const [reading, setReading] = useState<string | null>(null)

  /**
   * Cards or a list, and **absent means the shelf decides**.
   *
   * The library opens as cards because it holds your own handful. This one is
   * expected to hold hundreds, and measured at 1600x950 a card shelf puts five
   * of eighteen on screen with 2.38 screens of scroll. So once there is more
   * than a screenful here it opens as a list, which is how a list of hundreds
   * is read. The moment anybody presses the control their answer is stored and
   * both screens obey it.
   */
  const [chosenDensity, setChosenDensity] = useState<BuildDensity | undefined>(
    () => loadPrefs().buildDensity,
  )
  const chooseDensity = (one: BuildDensity) => {
    setChosenDensity(one)
    savePrefs({ ...loadPrefs(), buildDensity: one })
  }

  useEffect(() => {
    let live = true
    setListed(null)
    void listShelf(shelf).then((rows) => {
      if (live) setListed(rows)
    })
    return () => {
      live = false
    }
  }, [shelf])

  /**
   * The builds, keyed back to their listing.
   *
   * The filters work on `ShownBuild`, and everything a shelf adds hangs off the
   * published id rather than the build's own: two people can publish forks of
   * the same build and they are two listings.
   */
  const rows = listed ?? []
  const builds = useMemo(() => rows.map((row) => row.build), [rows])
  const listingOf = useMemo(
    () => new Map(rows.map((row) => [row.build.id, row] as const)),
    [rows],
  )

  const bar = useMemo(() => facets(builds, selection), [builds, selection])
  const shown = useMemo(() => {
    const found = apply(builds, selection)
    const needle = query.trim().toLowerCase()
    const narrowed = needle
      ? found.filter((build) =>
          [build.name, build.say, listingOf.get(build.id)?.by ?? ''].some((text) =>
            text.toLowerCase().includes(needle),
          ),
        )
      : found
    return sortBuilds(narrowed, sort)
  }, [builds, selection, sort, query, listingOf])

  /* Escape closes the listing. It is read-only, so there is nothing here to
     lose by leaving, and this is the screen the owner asked for it on. */
  useEscape(reading !== null, () => setReading(null))

  /** What the shelf is showing, once the count is known. */
  const density: BuildDensity = chosenDensity ?? (rows.length > 12 ? 'list' : 'cards')

  /** The listing open for reading, or null. */
  const readingRow = reading ? (listingOf.get(reading) ?? null) : null

  /**
   * Which published ids are already on your shelf, so a listing can say so.
   *
   * Read from the library rather than remembered, because following writes a
   * build and the library is where builds live. Recomputed whenever `said`
   * changes, which is what following sets.
   */
  const followed = useMemo(() => {
    const ids = new Set<string>()
    for (const one of loadBuilds()) {
      if (one.by === 'community' && one.derivedFrom) ids.add(one.derivedFrom)
    }
    return ids
  }, [said])

  /**
   * Follow one, which is what this screen offers instead of a copy.
   *
   * **It used to take a copy, and the copy was the whole problem.** A copy is
   * frozen at the moment you press the button and yours to edit; following
   * leaves the build its author's and brings their edits with it. The owner's
   * reading, and the right one: a build somebody else maintains is a thing you
   * subscribe to rather than a thing you clone.
   *
   * Following twice is following once. `followBuild` writes over the entry it
   * already has rather than adding a second, which is the other half of the
   * reported bug.
   */
  const follow = async (build: ShownBuild) => {
    const listing = listingOf.get(build.id)
    if (!listing) return
    setSaid(null)
    setReading(null)
    const outcome = await followBuild(listing.id)
    setSaid(
      outcome.ok
        ? `Following ${outcome.build.name}. It is in your builds, and it stays ${listing.by}'s.`
        : outcome.say,
    )
  }

  return (
    <Page
      measure="shelf"
      title="Build exchange"
      standfirst="Builds other people published, and what happened when people played them."
    >
      <CharonShop />
      {/* Everything the shelf is, inset past him where he is drawn. The grid
        * alone was not enough: the scope line and the filter bar are full width
        * and sit above it, and at 1600x950 both crossed his box. Measured, not
        * noticed. */}
      <div className="xchange-shelf">
      <Tabs tabs={SHELVES} open={shelf} onOpen={setShelf} label="Which shelf" />

      {/**
        * One line, where there were six.
        *
        * The claim still has to be here: two shelves presented as the whole
        * exchange would be a quieter kind of untrue, and that argument has not
        * changed. What changed is the price. Measured on a 420 by 880 phone,
        * the paragraph was 139px, **16% of the screen**, and it pushed the
        * first build to y=544, so most of a phone screen was spent explaining
        * an absence before anybody saw a build.
        *
        * The reasoning went to Help, which is where reasoning lives, is two
        * columns wide and fits on one screen. This keeps the fact and drops the
        * essay.
        */}
      <p className="xchange-scope">
        Both shelves passed a person. Help says why there is no third.
      </p>

      {listed === null ? (
        <p className="acct-quiet">One moment.</p>
      ) : rows.length === 0 ? (
        <Empty shelf={shelf} onGo={onGo} />
      ) : (
        <>
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
            total={builds.length}
          />

          {said ? (
            <p className="xchange-said" role="status">
              {said}
            </p>
          ) : null}

          {shown.length ? (
            <ul className={`builds-grid${density === 'list' ? ' is-list' : ''}`}>
              {shown.map((build) => {
                const listing = listingOf.get(build.id)
                return (
                  <Card
                    key={listing?.id ?? build.id}
                    built={assemble(build)}
                    onOpen={() => setReading(build.id)}
                    foot={
                      listing ? (
                        <div className="xchange-foot">
                          <p className="xchange-by">by {listing.by}</p>
                          {listing.note ? (
                            /* The owner's own words, and the only opinion the
                             * tool states as its own. It is signed, which is
                             * what makes it allowed. */
                            <p className="xchange-note">&ldquo;{listing.note}&rdquo;</p>
                          ) : null}
                          <Counted stats={listing.stats} />
                          <Relation
                            listing={listing}
                            following={followed.has(listing.id)}
                            onFollow={() => void follow(build)}
                          />
                        </div>
                      ) : null
                    }
                  />
                )
              })}
            </ul>
          ) : (
            <p className="builds-none">
              Nothing matches all of those. Drop a filter, or clear them and start again.
            </p>
          )}
        </>
      )}

      {/* Reading one, which is what opening a card does now. Read only: the
        * `Poster` takes no `onOpen`, so nothing in here can be edited, and the
        * one button that changes anything says what it does. */}
      {readingRow ? (
        <div className="xchange-read" role="dialog" aria-label={readingRow.build.name}>
          <div className="xchange-read-body">
            <Poster built={assemble(readingRow.build)} />
            <div className="xchange-read-foot">
              <p className="xchange-by">by {readingRow.by}</p>
              {readingRow.note ? <p className="xchange-note">&ldquo;{readingRow.note}&rdquo;</p> : null}
              <Counted stats={readingRow.stats} />
              <div className="xchange-read-actions">
                <Relation
                  listing={readingRow}
                  following={followed.has(readingRow.id)}
                  onFollow={() => void follow(readingRow.build)}
                />
                <button type="button" className="quiet" onClick={() => setReading(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </Page>
  )
}

/**
 * What happened when people played this, as counts.
 *
 * **Every number here is a tally and none of them is combined.** Runs beside
 * clears rather than a percentage on its own, because "38 of 61" carries how
 * much evidence there is and "62%" does not. The rating carries its own count
 * for the same reason: an average of two is a different thing from an average of
 * two hundred and a reader has to be able to tell them apart.
 *
 * Draws nothing at all for a build nobody has touched, which on a new shelf is
 * every build. A row of zeroes reads as a verdict.
 */
function Counted({ stats }: { stats: Stats }) {
  const anything =
    stats.takes > 0 || stats.runs > 0 || stats.raters > 0 || stats.bestFear !== null
  if (!anything) return null

  return (
    <p className="xchange-counts">
      <img className="xchange-coin" src="/shell/coins.png" alt="" aria-hidden="true" />
      {stats.takes ? <span>Taken {stats.takes}</span> : null}
      {stats.runs ? (
        <span>
          {stats.clears} of {stats.runs} cleared
          {stats.players > 1 ? `, ${stats.players} people` : null}
        </span>
      ) : null}
      {stats.bestFear ? <span>Best Fear {stats.bestFear}</span> : null}
      {/* Never the average on its own. `raters` is not a footnote to it: two
        * people saying four is a different claim from two hundred saying four,
        * and a bare 4.0 hides which one you are reading. */}
      {stats.rating !== null ? (
        <span>
          ★ {stats.rating.toFixed(1)} from {stats.raters}{' '}
          {stats.raters === 1 ? 'player' : 'players'}
        </span>
      ) : null}
    </p>
  )
}

/** Each shelf is empty for its own reason, and the reason is what to say. */
function Empty({
  shelf,
  onGo,
}: {
  shelf: Shelf
  onGo?: (view: 'account' | 'builds' | 'friends') => void
}) {
  if (shelf === 'picked') {
    return (
      <p className="ref-say">
        Nothing picked yet. This shelf holds builds chosen by hand, one at a time, each with a
        note saying why it is here.
      </p>
    )
  }

  return (
    <div>
      <p className="ref-say">
        Nothing here yet. This shelf fills up when somebody whose code you swapped publishes a
        build.
      </p>
      {ACCOUNTS_LIVE && onGo ? (
        <button type="button" className="quiet" onClick={() => onGo('friends')}>
          Swap a code
        </button>
      ) : null}
    </div>
  )
}

/**
 * What you can do with a listing: follow it, or nothing, because it is yours.
 *
 * Three states and one of them used to be impossible to express. The worker
 * never told the screen whose build a listing was, so it offered "Take a copy"
 * on the reader's own builds and the owner duly took copies of their own, and
 * then copies of those. A listing carries `mine` now, a boolean computed in the
 * worker against a session it never sends back.
 */
function Relation({
  listing,
  following,
  onFollow,
}: {
  listing: Listed
  following: boolean
  onFollow: () => void
}) {
  if (listing.mine) {
    return <p className="xchange-yours">This one is yours. It is already in your builds.</p>
  }
  if (following) {
    return (
      <p className="xchange-yours">
        Following. It is in your builds, and {listing.by}&rsquo;s edits reach you.
      </p>
    )
  }
  return (
    <button type="button" className="quiet xchange-take" onClick={onFollow}>
      Follow
    </button>
  )
}

/**
 * Charon, standing at the foot of his own shop.
 *
 * The exchange was the build manager with a different list behind it: same
 * cards, same grid, same filters, and nothing on screen saying you had gone
 * anywhere. He says it before the heading does.
 *
 * **Anchored to the bottom and cropped by it**, which is how the game draws
 * every character and how this art is drawn: the portrait runs off the bottom
 * of its own frame, so floating it in the middle of a panel would be wrong on
 * the art's own terms. Fixed rather than scrolled, so the shelf goes past him.
 *
 * **He has a column rather than a corner.** `DoraWatching` is the same idea on
 * the Roadmap and it spent a session covering text, because a page whose
 * content fills its width has no free corner to put a figure in. Dora got a
 * `min-height` gate; that works there because the roadmap's columns end where
 * their content does. The exchange is a grid that fills, so the fix is to give
 * him room instead: `.xchange-grid` is inset by his width where he is drawn,
 * and he is not drawn where that inset would cost a card column.
 *
 * `aria-hidden` and `pointer-events: none`. He is scenery, and a screen reader
 * announcing a decorative portrait between the filters and the shelf is noise.
 */
function CharonShop() {
  return (
    <div className="xchange-charon" aria-hidden="true">
      {/**
        * **Not lazy, and that was a deadlock rather than a preference.** The
        * wrapper is `position: fixed; right: 0` and takes its width from this
        * image, so before the image loads the box is zero wide and sits exactly
        * on the right edge of the window. The lazy loader then sees an element
        * that is not on screen and does not fetch it, which keeps the box zero
        * wide. Caught by measuring: `complete` false and `naturalWidth` 0 two
        * seconds after load, while a plain `new Image()` for the same path
        * returned 768 by 760 immediately. He is the largest thing on this screen
        * and is above the fold by construction, so there was nothing to defer.
        */}
      <img className="xchange-charon-art" src="/characters/charon-shop.png" alt="" />
      {/* The coins, over his open palm, where the game puts them. Its own
        * element rather than part of the picture, because it is sixty frames
        * and an additive blend. `builds.css` has the arithmetic. */}
      <span className="xchange-coins" />
    </div>
  )
}
