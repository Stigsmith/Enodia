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
 */

import { useEffect, useRef, useState } from 'react'

type Entry = {
  label: string
  note: string
  /** absent means it is not built, and it says so */
  action?: () => void
}

export function Menu({ onStartRun, hasRun, onEndRun }: { onStartRun: () => void; hasRun: boolean; onEndRun: () => void }) {
  const [open, setOpen] = useState(false)
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

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: 'This run',
      entries: [
        hasRun
          ? { label: 'End this run', note: 'Clears it and returns to setup', action: () => { onEndRun(); setOpen(false) } }
          : { label: 'Start a run', note: 'Pick an arm, an aspect and a way', action: () => { onStartRun(); setOpen(false) } },
      ],
    },
    {
      title: 'Builds',
      entries: [
        { label: 'Build manager', note: 'Define a build and track it. Waiting on the first definition' },
        { label: 'Build exchange', note: 'Share and import builds. Phase 4' },
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
        { label: 'Settings', note: 'Theme, spoiler level, display names' },
        { label: 'Help', note: 'What the states and the percentages mean' },
        { label: 'About', note: 'Where the data comes from, and the disclaimer' },
      ],
    },
  ]

  return (
    <div className="menu" ref={panel}>
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

      {open ? (
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
                      className={entry.action ? '' : 'is-unbuilt'}
                      onClick={entry.action}
                      disabled={!entry.action}
                    >
                      <span className="menu-label">{entry.label}</span>
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
