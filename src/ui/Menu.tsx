/**
 * The menu. One button, top left, opening a dropdown.
 *
 * `DESIGN.md` 8: it holds everything that is not the current run, it covers
 * like an overlay, and it returns you where you were, so it is never a place
 * the run navigates to.
 *
 * It used to list what was not built as well, on the argument that a menu
 * hiding the shape of the product is worse than one admitting it. That shape
 * lives on the Roadmap now, under Help, and the menu lists places you can go.
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
import { bundleOf } from './ScreenTabs.tsx'


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
   * One row to go somewhere, and the rest on the tabs of where it goes.
   *
   * **This menu had sixteen rows**, and the owner said plainly that a stranger
   * would be put off by it before pressing one. It had grown a row per page:
   * the wiki and Under the hood, Themes beside Settings, Help beside the
   * Roadmap, the Changelog and About, Leaderboards beside the exchange it
   * counts, and three rows for things that are not built. Each family is one
   * row now and its members are tabs at the top of the screen it opens
   * (`ScreenTabs.tsx`); Leaderboards is the Top shelf of the exchange; the
   * unbuilt three are on the Roadmap, which is where a reader looks for what
   * is coming.
   *
   * A row is lit while you are anywhere in its family, so the pinned menu
   * still says where you are.
   */
  const go = (to: View) => () => {
    onGo(to)
    leave()
  }
  const inFamily = (home: View) => view === home || bundleOf(view)?.home === home

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: '',
      entries: [
        /* Yours and the exchange, the switch in its heading saying which. */
        { label: 'Builds', here: view === 'builds', action: go('builds') },
        { label: 'Guides', here: view === 'guides', action: go('guides') },
        { label: 'Arcana', here: view === 'arcana', action: go('arcana') },
        /* The records, and Under the hood on the tab beside them. */
        { label: 'Wiki', here: inFamily('wiki'), action: go('wiki') },
      ],
    },
    {
      title: 'This run',
      entries: hasRun
        ? [
            { label: 'Back to the run', here: view === 'run', action: go('run') },
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
             * was.
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
        : [{ label: 'Start a run', here: view === 'setup', action: go('setup') }],
    },
    /**
     * **Account and Friends are not here.** They live in the corner control,
     * top right, with signing out: `src/ui/You.tsx` says why. This one is
     * where you go; that one is who you are.
     */
    {
      title: '',
      entries: [
        /* General, and Appearance: the theme, its wallpaper, and how the
         * buttons are drawn. */
        { label: 'Settings', here: inFamily('settings'), action: go('settings') },
        /* How it works, what is new, what is coming, and About, which is the
         * landing page once it has been seen. */
        { label: 'Help', here: inFamily('help'), action: go('help') },
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
          {groups.map((group, at) => (
            <section key={at}>
              {/* A group with no title is set apart by its gap alone. */}
              {group.title ? <h2>{group.title}</h2> : null}
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
