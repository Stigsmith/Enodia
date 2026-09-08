/**
 * Leaderboards. The counts the exchange already keeps, put beside each other.
 *
 * ## What is and is not being said
 *
 * Every board here orders by **one counted thing**. None of them combines two,
 * and none is a rate, which is the line this tool has drawn since the exchange
 * shipped: a clear rate reads as a ranking of quality and is not one, because
 * five clears from five runs would beat ninety from a hundred. A count says
 * what happened. Ordering counts does not turn them into a verdict, and the
 * page says so once, at the bottom, rather than hedging on every board.
 *
 * ## One page, two scopes
 *
 * Everybody, or the people you swapped codes with. The same boards either way,
 * so there is one thing to build and one thing to read, and the friends view is
 * the same question asked of fewer people. **You are on your own friends
 * board**: a board of your circle that leaves you off it cannot answer the
 * question somebody opens it to ask.
 *
 * ## Nothing is padded
 *
 * A board with no rows is not drawn, and `worker/boards.ts` drops it before it
 * gets here. A zero is not a placing: a build nobody has followed has not come
 * tenth in a following contest. So at this size the page is short, and a short
 * page of real numbers is better than a full page of noughts.
 */

import { useEffect, useState } from 'react'

import { counted, loadBoards } from '../state/boards.ts'
import type { Board, BoardRow, Scope } from '../state/boards.ts'
import { render } from '../state/facets.ts'
import { ACCOUNTS_LIVE } from '../state/account.ts'
import { linkTo } from '../state/publish.ts'
import { Page } from './Pages.tsx'
import { Tabs } from './Tabs.tsx'

const SCOPES = [
  { id: 'global' as const, label: 'Everybody' },
  { id: 'friends' as const, label: 'Your friends' },
]

/** One line per scope, saying whose numbers these are. */
const SAYS: Record<Scope, string> = {
  global: 'Everybody who has published a build.',
  friends: 'You, and the people whose codes you swapped.',
}

/** Loading, needs an account, or the answer. Three states, so none is guessed. */
type Showing = 'waiting' | 'signed-out' | Board[]

export function Leaderboards({ onGo }: { onGo?: (view: 'builds' | 'friends' | 'account') => void }) {
  const [scope, setScope] = useState<Scope>('global')
  const [showing, setShowing] = useState<Showing>('waiting')

  useEffect(() => {
    let live = true
    setShowing('waiting')
    void loadBoards(scope).then((found) => {
      if (live) setShowing(found === null ? 'signed-out' : found)
    })
    return () => {
      live = false
    }
  }, [scope])

  const boards = Array.isArray(showing) ? showing : []
  const builds = boards.filter((one) => one.kind === 'build')
  const folk = boards.filter((one) => one.kind === 'person')
  const stuff = boards.filter((one) => one.kind === 'facet')

  return (
    <Page
      measure="broad"
      title="Leaderboards"
      standfirst="What people have followed, played and got through, counted."
    >
      {ACCOUNTS_LIVE ? (
        <Tabs tabs={SCOPES} open={scope} onOpen={setScope} label="Whose numbers" />
      ) : null}
      <p className="board-scope">{SAYS[scope]}</p>

      {showing === 'waiting' ? (
        <p className="acct-quiet">One moment.</p>
      ) : showing === 'signed-out' ? (
        /* Only the friends scope can land here, and saying "nothing counted
           yet among the people you swapped codes with" to somebody with no
           account was telling them about a circle they do not have. */
        <div>
          <p className="ref-say">
            This one needs an account, because it is a question about yours. Everybody&rsquo;s
            boards are up above and open to anybody.
          </p>
          {ACCOUNTS_LIVE && onGo ? (
            <button type="button" className="quiet" onClick={() => onGo('account')}>
              Sign in
            </button>
          ) : null}
        </div>
      ) : boards.length === 0 ? (
        <Empty scope={scope} onGo={onGo} />
      ) : (
        <>
          {builds.length ? <Wall title="Builds" boards={builds} /> : null}
          {folk.length ? <Wall title="People" boards={folk} /> : null}
          {stuff.length ? <Wall title="What people build" boards={stuff} /> : null}

          {/**
           * The disclaimer, once, at the foot.
           *
           * It has to be here: a leaderboard is the single most inviting place
           * in this tool to read a number as a verdict, and the tool has said
           * from the first commit that it does not know whether a build is
           * good. Saying it once at the end beats hedging on every board, which
           * would be twelve sentences nobody reads.
           */}
          <p className="board-caveat">
            These are counts, not rankings of how good a build is. Nothing here knows that, and
            a build that has been followed more has been followed more.
          </p>
        </>
      )}
    </Page>
  )
}

/** A set of boards under one heading. */
function Wall({ title, boards }: { title: string; boards: Board[] }) {
  return (
    <section className="board-wall">
      <h2 className="board-wall-name">{title}</h2>
      <div className="board-grid">
        {boards.map((board) => (
          <One key={board.id} board={board} />
        ))}
      </div>
    </section>
  )
}

/**
 * What a row says.
 *
 * A facet row arrives as a token this browser has to name. One it does not
 * recognise is **dropped rather than shown raw**: a board reading
 * `arm:something-new` tells nobody anything, and the count belongs to a client
 * that knows what it is. An unknown value inside a known kind still shows, as
 * its id, because that is a real count of a real thing.
 */
function nameOf(board: Board, row: BoardRow): string | null {
  if (board.kind !== 'facet') return row.name
  return render(row.name)?.name ?? null
}

function One({ board }: { board: Board }) {
  const rows = board.rows
    .map((row) => ({ row, label: nameOf(board, row) }))
    .filter((one): one is { row: BoardRow; label: string } => one.label !== null)

  if (!rows.length) return null

  return (
    <article className="board">
      <h3 className="board-name">{board.title}</h3>
      <ol className="board-rows">
        {rows.map(({ row, label }, at) => (
          <li className="board-row" key={`${row.id ?? row.name}-${at}`}>
            <span className="board-place" aria-hidden="true">
              {at + 1}
            </span>
            <span className="board-what">
              {/* A build links to itself. The short link is the one thing an
                  account buys, so a board is a good place to spend it. */}
              {row.id ? (
                <a className="board-link" href={linkTo(row.id)}>
                  {label}
                </a>
              ) : (
                label
              )}
              {row.by ? <span className="board-by">by {row.by}</span> : null}
            </span>
            <span className="board-count">{counted(row.count, board.unit)}</span>
          </li>
        ))}
      </ol>
    </article>
  )
}

function Empty({
  scope,
  onGo,
}: {
  scope: Scope
  onGo?: (view: 'builds' | 'friends' | 'account') => void
}) {
  if (scope === 'friends') {
    return (
      <div>
        <p className="ref-say">
          Nothing counted yet among the people you have swapped codes with. These fill up when
          somebody follows one of your builds, or logs a run against one.
        </p>
        {ACCOUNTS_LIVE && onGo ? (
          <button type="button" className="quiet" onClick={() => onGo('friends')}>
            Swap a code
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <p className="ref-say">
        Nothing counted yet. A board appears once something has actually happened to a published
        build: somebody followed it, played it, or got through a run with it.
      </p>
      {ACCOUNTS_LIVE && onGo ? (
        <button type="button" className="quiet" onClick={() => onGo('builds')}>
          Go to your builds
        </button>
      ) : null}
    </div>
  )
}
