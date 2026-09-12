/**
 * The menu. One button, top left, opening a dropdown.
 *
 * `DESIGN.md` 8: it holds everything that is not the current run, it covers
 * like an overlay, and it returns you where you were, so it is never a place
 * the run navigates to.
 *
 * Most of what belongs in it does not exist yet. It is listed anyway, with the
 * phase it belongs to, because a menu that hides the shape of the product is
 * worse than one that admits it. The unbuilt entries are marked in the one
 * colour reserved for unbuilt things and they do nothing when pressed.
 *
 * Starting a run is always here and always first, because that is what the tool
 * is for.
 *
 * **It is navigation now, and nothing else.** Three settings used to live in
 * here: where the menu sits, how a build opens, and which frame rings a bubble.
 * Each of them has gone to the place it takes effect, because a setting you
 * cannot see the result of is a setting you have to guess at.
 */

import { useEffect, useRef, useState } from 'react'

import { PANE_QUERY, applyNav, readNav, writeNav } from './nav.ts'
import type { View } from './nav.ts'


/**
 * One row.
 *
 * **There was a `note` under every label and it is gone.** Every entry carried
 * a line of flavour text, and because those wrapped to one, two or three lines
 * the rows came out at four different heights: measured in the running app,
 * 57, 69, 70 and 81 pixels across fourteen rows. A menu whose rows are
 * different sizes for reasons that have nothing to do with the rows is a menu
 * that looks broken.
 *
 * The owner's argument for dropping them rather than truncating them: a note is
 * a first-time read. Once somebody has pressed a row and seen where it goes, the
 * sentence under it is furniture. So the label has to carry the row on its own,
 * and two of them were rewritten to do it.
 */
type Entry = {
  label: string
  /** a mark beside the label, where one says it faster than the words */
  icon?: string
  action?: () => void
  /** the screen this entry goes to is the screen you are on */
  here?: boolean
  /**
   * Built or not, said explicitly.
   *
   * **It used to be inferred from a missing `action`**, which stopped working
   * the moment the unbuilt sections got somewhere to go: they have actions now
   * and would have read as finished. The state and the ability to click are two
   * different facts and the row needs both.
   */
  unbuilt?: boolean
}

export function Menu({
  view,
  hasRun,
  onGo,
  onEndRun,
  onShowBriefing,
}: {
  /** which screen is showing, so the menu can mark where you already are */
  view: View
  hasRun: boolean
  onGo: (view: View) => void
  onEndRun: (outcome?: 'died' | 'finished') => void
  /** absent outside a run. DESIGN.md 6.3 wants the briefing on demand too */
  onShowBriefing?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [nav, setNav] = useState(readNav)
  const [wide, setWide] = useState(() => window.matchMedia(PANE_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(PANE_QUERY)
    const sync = () => setWide(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  const panel = useRef<HTMLDivElement>(null)

  /**
   * Pinned open, so nothing that closes a pop-out applies: not a click outside
   * it, not Escape, and not choosing something in it.
   */
  const pinned = wide && nav === 'pane'

  /**
   * The pin, and it is the whole control.
   *
   * This was two labelled options in Settings, which meant leaving the menu to
   * change where the menu sits. One button on the panel does the same job
   * without going anywhere, and it only exists on a screen wide enough for a
   * pane: below 60rem the pop-out is the only mode there is.
   */
  const togglePin = () => {
    const next = pinned ? 'popout' : 'pane'
    setNav(next)
    applyNav(next)
    writeNav(next)
  }
  const showing = pinned || open
  const leave = () => {
    if (!pinned) setOpen(false)
  }

  useEffect(() => {
    if (!open || pinned) return
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
  }, [open, pinned])

  /**
   * Builds first, and that is the whole reorganisation.
   *
   * The run used to lead, because the run was the front door. Choosing a build
   * and seeing which builds an aspect can still reach is what the tool is for,
   * and a run is one thing you might do about it, so the run is a section like
   * any other and only fills out while one is live.
   */
  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: 'Builds',
      entries: [
        {
          label: 'Build manager',
          here: view === 'builds',
          action: () => {
            onGo('builds')
            leave()
          },
        },
        {
          label: 'Arcana',
          here: view === 'arcana',
          action: () => {
            onGo('arcana')
            leave()
          },
        },
        /* Everything the tool knows, a record each. Beside the Arcana because
         * both are reference rather than your own work. */
        {
          label: 'Wiki',
          here: view === 'wiki',
          action: () => {
            onGo('wiki')
            leave()
          },
        },
        /* Beside the wiki, because it is the same material read the other way
         * round: the wiki answers what a thing is, this answers what the game
         * never says out loud. */
        {
          label: 'Under the hood',
          here: view === 'underhood',
          action: () => {
            onGo('underhood')
            leave()
          },
        },
        {
          label: 'Build exchange',
          here: view === 'exchange',
          action: () => {
            onGo('exchange')
            leave()
          },
        },
        /* After the exchange, because it is built on it: a board is the counts
         * the exchange keeps, and it has nothing to show until something has
         * been published and followed. */
        {
          label: 'Leaderboards',
          here: view === 'leaderboards',
          action: () => {
            onGo('leaderboards')
            leave()
          },
        },
        /**
         * What the roadmap promises and the tool does not have yet.
         *
         * Here rather than left off the menu, because a menu that only lists
         * what exists hides the shape of the product, which is the argument
         * this file opens with. Each one opens onto Dora's empty room saying
         * what it will be. The mark beside the label is what says they are not
         * built, and `Entry.unbuilt` is what draws it.
         */
        {
          label: 'Builds by aspect',
          here: view === 'byaspect',
          unbuilt: true,
          action: () => {
            onGo('byaspect')
            leave()
          },
        },
        {
          label: 'Play history',
          here: view === 'playhistory',
          unbuilt: true,
          action: () => {
            onGo('playhistory')
            leave()
          },
        },
        {
          label: 'Suggested builds',
          here: view === 'suggested',
          unbuilt: true,
          action: () => {
            onGo('suggested')
            leave()
          },
        },
      ],
    },
    {
      title: 'This run',
      entries: hasRun
        ? [
            {
              label: 'Back to the run',
              here: view === 'run',
              action: () => {
                onGo('run')
                leave()
              },
            },
            ...(onShowBriefing
              ? [
                  {
                    label: 'Resume briefing',
                    action: () => {
                      onShowBriefing()
                      leave()
                    },
                  },
                ]
              : []),
            /**
             * Dying and stopping are different events, so they are different
             * entries. Both end the run and both keep it: `run.ts` archives
             * what was held and how far it got, tagged with which of the two it
             * was. A run ended before today was simply discarded, and a history
             * is the one thing that cannot be backfilled later.
             *
             * **The pair has to separate on outcome now that the notes are
             * gone.** "End the run" and "Finished the run" would both read as
             * endings, which is exactly the ambiguity the notes were covering,
             * so the second says what actually happened instead.
             */
            {
              label: 'End the run',
              icon: 'shell/location-zagreus.png',
              action: () => {
                onEndRun('died')
                leave()
              },
            },
            {
              label: 'Cleared it',
              action: () => {
                onEndRun('finished')
                leave()
              },
            },
          ]
        : [
            {
              label: 'Start a run',
              here: view === 'setup',
              action: () => {
                onGo('setup')
                leave()
              },
            },
          ],
    },
    /**
     * **Account and Friends are not here any more.** They live in the corner
     * control, top right, with signing out: `src/ui/You.tsx` says why.
     *
     * The split is what makes two menus worth having rather than confusing.
     * This one is where you go; that one is who you are. Mixing them was why
     * this list had a group called "You" holding one thing that was about
     * everybody.
     *
     * **Leaderboards stayed**, because it is a place about everyone rather than
     * a fact about you, and it is a room like the exchange is a room. So it
     * joins the rooms and the group it used to sit in dissolves.
     */
    {
      title: 'The tool',
      entries: [
        {
          label: 'Themes',
          here: view === 'themes',
          action: () => {
            onGo('themes')
            leave()
          },
        },
        {
          label: 'Settings',
          here: view === 'settings',
          action: () => {
            onGo('settings')
            leave()
          },
        },
        {
          label: 'Help',
          here: view === 'help',
          action: () => {
            onGo('help')
            leave()
          },
        },
        {
          label: 'Roadmap',
          here: view === 'roadmap',
          action: () => {
            onGo('roadmap')
            leave()
          },
        },
        {
          label: 'Changelog',
          here: view === 'changelog',
          action: () => {
            onGo('changelog')
            leave()
          },
        },
        {
          /* The landing page shows itself once and then lives here. Somebody
           * who skipped it, or who wants the line to send a friend, should
           * still be able to get at it.
           *
           * It carries the About name now. This row sat under a separate About
           * page for a while and the two had grown into the same page: one said
           * what the tool is, the other said what the tool is and then repeated
           * the landing page's own disclaimer back at you. Where the numbers
           * come from was the only part worth keeping and it is in Help. */
          label: 'About',
          here: view === 'landing',
          action: () => {
            onGo('landing')
            leave()
          },
        },
      ],
    },
  ]

  return (
    <div className={`menu${pinned ? ' is-pinned' : ''}`} ref={panel}>
      {/* Nothing to toggle when the panel is pinned, and a control that does
          nothing is worse than no control. */}
      {pinned ? null : (
        <button
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((was) => !was)}
        >
          <span className="menu-glyph" aria-hidden="true" />
          <span className="visually-hidden">Menu</span>
        </button>
      )}

      {showing ? (
        <div className="menu-panel" role="menu">
          {wide ? (
            <button
              type="button"
              className={`menu-pin${pinned ? ' is-on' : ''}`}
              aria-pressed={pinned}
              title={pinned ? 'Unpin the menu' : 'Pin the menu open'}
              onClick={togglePin}
            >
              <span className="visually-hidden">
                {pinned ? 'Unpin the menu' : 'Pin the menu open'}
              </span>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                {/* A drawing pin seen from the side: head, shaft, point. */}
                <path
                  d="M6 1.6h4a.6.6 0 0 1 0 1.2h-.5l.6 3.3 1.9 1.6a.8.8 0 0 1-.5 1.4H8.6v5a.6.6 0 0 1-1.2 0v-5H4.5a.8.8 0 0 1-.5-1.4l1.9-1.6.6-3.3H6a.6.6 0 0 1 0-1.2Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : null}
          {groups.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.entries.map((entry) => (
                  <li key={entry.label}>
                    <button
                      type="button"
                      role="menuitem"
                      /* Where you already are, which a pinned pane has to say
                         because it is on screen the whole time. */
                      aria-current={entry.here ? 'page' : undefined}
                      /* The mark beside an unbuilt entry is a glyph drawn by
                         CSS, so it says nothing to a screen reader and nothing
                         on hover. It used to read "not built" in words. This is
                         where those words went. */
                      title={entry.unbuilt ? 'Not built yet' : undefined}
                      className={`${entry.unbuilt ? 'is-unbuilt' : ''}${entry.here ? ' is-here' : ''}`}
                      onClick={entry.action}
                      disabled={!entry.action}
                    >
                      <span className="menu-label">
                        {entry.icon ? (
                          <img className="menu-entry-icon" src={`/${entry.icon}`} alt="" />
                        ) : null}
                        {entry.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        </div>
      ) : null}
    </div>
  )
}
