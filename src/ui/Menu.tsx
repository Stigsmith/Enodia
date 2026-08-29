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

import { FRAMES, applyFrame, frameVars, readFrame, writeFrame } from './frames.ts'

type Entry = {
  label: string
  note: string
  /** absent means it is not built, and it says so */
  action?: () => void
}

export function Menu({
  onStartRun,
  hasRun,
  onEndRun,
  onShowBriefing,
}: {
  onStartRun: () => void
  hasRun: boolean
  onEndRun: () => void
  /** absent outside a run. DESIGN.md 6.3 wants the briefing on demand too */
  onShowBriefing?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [frame, setFrame] = useState(readFrame)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyFrame(frame)
    writeFrame(frame)
  }, [frame])

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
        ...(hasRun && onShowBriefing
          ? [
              {
                label: 'Where you left off',
                note: 'What you hold, what you were chasing, and what moved',
                action: () => {
                  onShowBriefing()
                  setOpen(false)
                },
              },
            ]
          : []),
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

          {/* Which frame rings a bubble. It stays a setting until the owner
              picks one, and the swatch is the whole point of it being here:
              the answer is what it looks like, not what it is called. */}
          <section>
            <h2>Frame</h2>
            <ul className="menu-frames">
              {FRAMES.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={frame === option.id}
                    className={frame === option.id ? 'is-on' : ''}
                    onClick={() => setFrame(option.id)}
                  >
                    {/* Its own geometry, not the applied one, or every swatch
                        would draw the frame that is already on. */}
                    <span
                      className={`menu-frame-swatch${option.square ? ' is-square' : ''}`}
                      style={frameVars(option) as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <img className="menu-frame-face" src="/gods/zeus.webp" alt="" />
                      {option.file ? <img className="menu-frame-art" src={`/${option.file}`} alt="" /> : null}
                    </span>
                    <span className="menu-label">
                      {option.name}
                      {frame === option.id ? (
                        <img className="menu-chosen" src="/icons/selected.png" alt="" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="menu-note">{option.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  )
}
