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
 * ## Two shelves, and the other two moved to your side
 *
 * **All**, everything published, and **From friends**, the people whose codes
 * you swapped.
 *
 * There were four. **Mine** and **Followed** held your own listings and the
 * builds you took up, and both kinds were already in your library: a followed
 * build is an ordinary build with `by: 'community'`, and a published one carries
 * `publishedAs`. So they were the library a second time with counts on it. This
 * is everybody's side of Builds now, `BuildsScreen.tsx` has the switch, and the
 * counts went onto the library's own cards. A listing of yours whose build is
 * no longer in the library is listed there too, with a way to bring it back.
 *
 * Before that it was two, Picked and From friends, on the argument that both
 * had passed a human before they were listed. What that missed is that it left
 * your own builds on no shelf: the owner published nine and saw one.
 *
 * **The curated shelf is gone entirely**, table and route and owner gate. It
 * was the default and the only thing a stranger could see, which made sense
 * while there was no way to browse and stopped making sense the moment All
 * opened. The owner's call: people find what they want themselves.
 */

import { useEffect, useMemo, useState } from 'react'

import { clearedByAnother, followBuild, listShelf } from '../state/exchange.ts'
import { loadBuilds } from '../state/builds.ts'
import { loadPrefs, savePrefs } from '../state/prefs.ts'
import type { BuildDensity } from '../state/prefs.ts'
import type { Listed } from '../state/exchange.ts'
import { ACCOUNTS_LIVE } from '../state/account.ts'
import { reclaimListing } from '../state/publish.ts'
import type { ShownBuild } from '../data/builds.ts'
import { BuildFilters } from './BuildFilters.tsx'
import { Counted } from './Counted.tsx'
import { CharonStand } from './Figures.tsx'
import { Card } from './variants/Card.tsx'
import { Poster } from './variants/Poster.tsx'
import { Page } from './Pages.tsx'
import { Tabs } from './Tabs.tsx'
import { useBackdrop, useEscape } from './escape.ts'
import { assemble } from './build-pieces.ts'
import { PickNotes } from './PickNotes.tsx'
import { Prose } from './Prose.tsx'
import { EMPTY_SELECTION, apply, choose, facets, sortBuilds } from './build-filter.ts'
import type { FacetId, SortId } from './build-filter.ts'

type Everybody = 'all' | 'friends'

const SHELVES = [
  { id: 'all' as const, label: 'All' },
  { id: 'friends' as const, label: 'From friends' },
]

/** One line per shelf, saying what you are looking at rather than why. */
const SCOPE: Record<Everybody, string> = {
  all: 'Everything anybody has published and not taken back down.',
  friends: 'Published by the people whose codes you swapped.',
}

export function Exchange({
  onGo,
  onReclaimed,
}: {
  onGo?: (view: 'account' | 'friends') => void
  /** a listing of yours was put back in the library, which the other side has to re-read */
  onReclaimed?: () => void
}) {
  const [shelf, setShelf] = useState<Everybody>('all')
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

  /**
   * Evidence, which is the one thing a shelf can say that a library cannot.
   *
   * **Not a tier and not a badge.** `REQUIREMENTS.md` 8 wants a credible
   * consensus before any second opinion, and the owner removed the one curated
   * shelf on 8 September on the grounds that people find what they want
   * themselves. So this is a filter over the one list rather than a second
   * list, and what it filters on is a count the worker already keeps: clears
   * logged against the version on the shelf now.
   *
   * **One clear is one other player.** `worker/exchange.ts` refuses an author's
   * own runs before they are counted, and the counts are per version, so a
   * listing whose author replaced the picks starts again rather than carrying
   * somebody else's evidence forward.
   *
   * Not persisted. A filter that survives a visit is one somebody can leave on
   * and forget, and this one can empty a shelf.
   */
  const [cleared, setCleared] = useState(false)
  const hasClear = (build: ShownBuild) => {
    const listing = listingOf.get(build.id)
    return listing ? clearedByAnother(listing) : false
  }

  const { shown, evidenceMatches } = useMemo(() => {
    const found = apply(builds, selection)
    const needle = query.trim().toLowerCase()
    const narrowed = needle
      ? found.filter((build) =>
          [build.name, build.say, listingOf.get(build.id)?.by ?? ''].some((text) =>
            text.toLowerCase().includes(needle),
          ),
        )
      : found
    const matches = narrowed.filter(hasClear)
    return { shown: sortBuilds(cleared ? matches : narrowed, sort), evidenceMatches: matches.length }
  }, [builds, selection, sort, query, listingOf, cleared])

  /* Escape closes the listing. It is read-only, so there is nothing here to
     lose by leaving, and this is the screen the owner asked for it on. */
  useEscape(reading !== null, () => setReading(null))
  /* The dim around the listing. Same answer as Escape, and it is read only, so
     there is nothing here to lose by leaving. */
  const backdrop = useBackdrop(() => setReading(null))

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
  const { followed, held } = useMemo(() => {
    const following = new Set<string>()
    const published = new Set<string>()
    for (const one of loadBuilds()) {
      if (one.by === 'community' && one.derivedFrom) following.add(one.derivedFrom)
      if (one.publishedAs) published.add(one.publishedAs)
    }
    return { followed: following, held: published }
  }, [said])

  /**
   * A listing of yours whose build is not in this library, put back in it.
   *
   * The All shelf is where somebody who deleted a build and emptied the bin
   * would still see its listing, and it used to tell them "It is already in
   * your builds", which was then false.
   */
  const reclaim = async (listing: Listed) => {
    setSaid(null)
    setReading(null)
    const outcome = await reclaimListing(listing.id)
    setSaid(outcome.ok ? `${outcome.build.name} is back in your builds.` : outcome.say)
    if (outcome.ok) onReclaimed?.()
  }

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
    /* A page with no title of its own: `BuildsScreen` draws the heading, and
       the switch in it, above both sides. */
    <Page measure="shelf" standfirst="Builds other people published, and what happened when people played them.">
      <CharonStand />
      {/* Everything the shelf is, inset past him where he is drawn. The grid
        * alone was not enough: the scope line and the filter bar are full width
        * and sit above it, and at 1600x950 both crossed his box. Measured, not
        * noticed. The inset is `.xchange-charon + .xchange-shelf`, so nothing
        * goes between him and this. */}
      <div className="xchange-shelf">
      <Tabs tabs={SHELVES} open={shelf} onOpen={setShelf} label="Which shelf" />

      {/**
        * One line, and it used to be the sentence explaining an absence.
        *
        * There were two shelves and a paragraph saying why there was no third.
        * That paragraph was measured at 139px on a 420 by 880 phone, **16% of
        * the screen**, spent on an absence before anybody saw a build, so the
        * reasoning went to Help and one line stayed.
        *
        * The absence is gone now. What is left worth saying is which shelf you
        * are on, because Picked and All look alike and mean different things.
        */}
      <p className="xchange-scope">{SCOPE[shelf]}</p>

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
              setCleared(false)
            }}
            sort={sort}
            onSort={setSort}
            density={density}
            onDensity={chooseDensity}
            query={query}
            onQuery={setQuery}
            showing={shown.length}
            total={builds.length}
            evidence={{ on: cleared, matches: evidenceMatches, onToggle: setCleared }}
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
                          <Counted stats={listing.stats} {...(listing.before ? { before: listing.before } : {})} />
                          <Relation
                            listing={listing}
                            following={followed.has(listing.id)}
                            held={held.has(listing.id)}
                            onFollow={() => void follow(build)}
                            onReclaim={() => void reclaim(listing)}
                          />
                        </div>
                      ) : null
                    }
                  />
                )
              })}
            </ul>
          ) : cleared && evidenceMatches === 0 ? (
            /* A real state rather than a filter mistake, and worth saying
               plainly: early on, nothing here has been played by anybody but
               the people who published it. */
            <p className="builds-none">
              Nothing on this shelf has been cleared by another player yet. Turn that filter off to
              see the rest.
            </p>
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
        <div
          className="xchange-read"
          role="dialog"
          aria-label={readingRow.build.name}
          {...backdrop}
        >
          <div className="xchange-read-body">
            <Poster built={assemble(readingRow.build)} />
            <div className="xchange-read-foot">
              <p className="xchange-by">by {readingRow.by}</p>
              {/* The author's own explanation, which this dialog did not show.
                * The Poster draws what is in a build; `how` is the one thing it
                * cannot draw, and it is the reason somebody opens a stranger's
                * listing rather than glancing at the card. Reading a build you
                * are deciding whether to follow without it was reading half. */}
              {readingRow.build.how ? (
                <section className="xchange-read-how" aria-label="How it works">
                  <h4>How it works</h4>
                  <p>
                    <Prose text={readingRow.build.how} />
                  </p>
                </section>
              ) : null}
              {readingRow.build.luck ? (
                <section className="xchange-read-how" aria-label="If the run goes your way">
                  <h4>If the run goes your way</h4>
                  <p>
                    <Prose text={readingRow.build.luck} />
                  </p>
                </section>
              ) : null}
              <PickNotes
                built={assemble(readingRow.build)}
                className="xchange-read-how xchange-read-notes"
                heading="h4"
              />
              <Counted stats={readingRow.stats} {...(readingRow.before ? { before: readingRow.before } : {})} />
              <div className="xchange-read-actions">
                <Relation
                  listing={readingRow}
                  following={followed.has(readingRow.id)}
                  held={held.has(readingRow.id)}
                  onFollow={() => void follow(readingRow.build)}
                  onReclaim={() => void reclaim(readingRow)}
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

/** Each shelf is empty for its own reason, and the reason is what to say. */
function Empty({ shelf, onGo }: { shelf: Everybody; onGo?: (view: 'account' | 'friends') => void }) {
  if (shelf === 'all') {
    return (
      <p className="ref-say">
        Nothing published yet. This shelf holds every build anybody has published and not taken
        back down.
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
 * What you can do with a listing: follow it, bring it back, or nothing,
 * because it is yours and you have it.
 *
 * One of these states used to be impossible to express. The worker never told
 * the screen whose build a listing was, so it offered "Take a copy" on the
 * reader's own builds and the owner duly took copies of their own, and then
 * copies of those. A listing carries `mine` now, a boolean computed in the
 * worker against a session it never sends back.
 *
 * **Yours is two states, and it said one.** "It is already in your builds" was
 * printed for every listing of yours, including one whose build had been
 * deleted and the bin emptied, where the listing is the only copy left. `held`
 * is whether the library has a build published as this listing.
 *
 * There is no taken-down branch any more. Only the Mine shelf returned those
 * rows, and it moved to your side of Builds.
 */
function Relation({
  listing,
  following,
  held,
  onFollow,
  onReclaim,
}: {
  listing: Listed
  following: boolean
  held: boolean
  onFollow: () => void
  onReclaim: () => void
}) {
  if (listing.mine && held) {
    return <p className="xchange-yours">This one is yours. It is in your builds.</p>
  }
  if (listing.mine) {
    return (
      <p className="xchange-yours">
        This one is yours, and its build is not in your builds.{' '}
        <button type="button" className="quiet xchange-take" onClick={onReclaim}>
          Put it back
        </button>
      </p>
    )
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

