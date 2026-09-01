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

import { PANE_QUERY, readNav } from './nav.ts'
import type { View } from './nav.ts'


type Entry = {
  label: string
  note: string
  /** a mark beside the label, where one says it faster than the words */
  icon?: string
  /** absent means it is not built, and it says so */
  action?: () => void
  /** the screen this entry goes to is the screen you are on */
  here?: boolean
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
  const nav = readNav()
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
   *
   * Read rather than owned. The control that sets this lives in Settings now,
   * and `applyNav` has already written `data-nav` on the root by the time this
   * renders, so the menu asks the document what it is instead of keeping a
   * second copy that could disagree with it.
   */
  const pinned = wide && nav === 'pane'
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
          note: 'Every build, by arm and by aspect. Where the tool starts',
          here: view === 'builds',
          action: () => {
            onGo('builds')
            leave()
          },
        },
        {
          label: 'Arcana',
          note: 'The board, and which of the six free cards your set switches on',
          here: view === 'arcana',
          action: () => {
            onGo('arcana')
            leave()
          },
        },
        { label: 'Build exchange', note: 'Share and import builds. Phase 4' },
      ],
    },
    {
      title: 'This run',
      entries: hasRun
        ? [
            {
              label: 'Back to the run',
              note: 'The Exits you have taken and the one in front of you',
              here: view === 'run',
              action: () => {
                onGo('run')
                leave()
              },
            },
            ...(onShowBriefing
              ? [
                  {
                    label: 'Where you left off',
                    note: 'What you hold, what you were chasing, and what moved',
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
             */
            {
              label: 'Died here',
              note: 'Ends the run and keeps it, with where it stopped',
              icon: 'shell/location-zagreus.png',
              action: () => {
                onEndRun('died')
                leave()
              },
            },
            {
              label: 'Finished the run',
              note: 'Reached the end. Ends it and keeps it',
              action: () => {
                onEndRun('finished')
                leave()
              },
            },
          ]
        : [
            {
              label: 'Start a run',
              note: 'Pick an arm, an aspect and a way. Or start one from a build',
              here: view === 'setup',
              action: () => {
                onGo('setup')
                leave()
              },
            },
          ],
    },
    {
      title: 'You',
      entries: [
        { label: 'Account', note: 'Phase 4' },
        { label: 'Friends', note: 'Phase 4' },
        { label: 'Leaderboards', note: 'Phase 4' },
      ],
    },
    {
      title: 'The tool',
      entries: [
        {
          label: 'Themes',
          note: 'Four of them, each with its own light, weather and pictures',
          here: view === 'themes',
          action: () => {
            onGo('themes')
            leave()
          },
        },
        {
          label: 'Settings',
          note: 'Your name, how the menu sits, and getting your things out',
          here: view === 'settings',
          action: () => {
            onGo('settings')
            leave()
          },
        },
        {
          label: 'Help',
          note: 'What the states, the bands and the percentages mean',
          here: view === 'help',
          action: () => {
            onGo('help')
            leave()
          },
        },
        {
          label: 'Roadmap',
          note: 'What is here, what is coming, and what is stuck',
          here: view === 'roadmap',
          action: () => {
            onGo('roadmap')
            leave()
          },
        },
        {
          label: 'Changelog',
          note: 'What changed, newest first',
          here: view === 'changelog',
          action: () => {
            onGo('changelog')
            leave()
          },
        },
        {
          label: 'About',
          note: 'Where the data comes from, and the disclaimer',
          here: view === 'about',
          action: () => {
            onGo('about')
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
                      className={`${entry.action ? '' : 'is-unbuilt'}${entry.here ? ' is-here' : ''}`}
                      onClick={entry.action}
                      disabled={!entry.action}
                    >
                      <span className="menu-label">
                        {entry.icon ? (
                          <img className="menu-entry-icon" src={`/${entry.icon}`} alt="" />
                        ) : null}
                        {entry.label}
                      </span>
                      <span className="menu-note">{entry.note}</span>
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
