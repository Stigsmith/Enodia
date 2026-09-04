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
 * **The action is take, not edit.** A copy becomes an ordinary build of yours.
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

import { listShelf, takeBuild } from '../state/exchange.ts'
import type { Listed, Shelf, Stats } from '../state/exchange.ts'
import { ACCOUNTS_LIVE } from '../state/account.ts'
import type { ShownBuild } from '../data/builds.ts'
import { BuildFilters } from './BuildFilters.tsx'
import { Card } from './variants/Card.tsx'
import { Page } from './Pages.tsx'
import { Tabs } from './Tabs.tsx'
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

  const take = async (build: ShownBuild) => {
    const listing = listingOf.get(build.id)
    if (!listing) return
    setSaid(null)
    const outcome = await takeBuild(listing.id)
    setSaid(outcome.ok ? `${outcome.build.name} is in your builds.` : outcome.say)
  }

  return (
    <Page
      title="Build exchange"
      standfirst="Builds other people published, and what happened when people played them."
    >
      <Tabs tabs={SHELVES} open={shelf} onOpen={setShelf} label="Which shelf" />

      {/* Said out loud rather than left as an absence. Two shelves presented as
        * the whole exchange would be a quieter kind of untrue. */}
      <p className="ref-say xchange-scope">
        Two shelves, and both of them passed a person: builds picked by hand, and builds from
        people you swapped codes with. There is no shelf of everything anybody published yet,
        because that is the first thing a stranger could stumble across and it needs a way to
        report and hide a listing before it opens rather than after.
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
            <ul className="builds-grid">
              {shown.map((build) => {
                const listing = listingOf.get(build.id)
                return (
                  <Card
                    key={build.id}
                    built={assemble(build)}
                    onOpen={() => void take(build)}
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
                          <button
                            type="button"
                            className="quiet xchange-take"
                            onClick={() => void take(build)}
                          >
                            Take a copy
                          </button>
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
