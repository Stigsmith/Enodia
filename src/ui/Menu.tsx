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

import { loadPrefs, savePrefs } from '../state/prefs.ts'
import type { BuildDetail } from '../state/prefs.ts'
import { FRAMES, applyFrame, frameVars, readFrame, writeFrame } from './frames.ts'
import { WALLPAPERS, applyWallpaper, readWallpaper, writeWallpaper } from './wallpaper.ts'

/** The two layouts a single build can open in. */
const DETAILS: { id: BuildDetail; name: string; note: string }[] = [
  { id: 'poster', name: 'Poster', note: 'The art large, everything else demoted. One build as a page' },
  {
    id: 'constellation',
    name: 'Constellation',
    note: 'Five fixed positions round the arm. A dark spoke is a gap you see at once',
  },
]

type Entry = {
  label: string
  note: string
  /** a mark beside the label, where one says it faster than the words */
  icon?: string
  /** absent means it is not built, and it says so */
  action?: () => void
}

export function Menu({
  onStartRun,
  hasRun,
  onEndRun,
  onShowBriefing,
  onShowBuilds,
  onShowArcana,
}: {
  onStartRun: () => void
  hasRun: boolean
  onEndRun: (outcome?: 'died' | 'finished') => void
  /** absent outside a run. DESIGN.md 6.3 wants the briefing on demand too */
  onShowBriefing?: () => void
  /** the build manager, which is a screen rather than an overlay */
  onShowBuilds?: () => void
  /** the Arcana board, likewise */
  onShowArcana?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [frame, setFrame] = useState(readFrame)
  const [wall, setWall] = useState(readWallpaper)
  /**
   * Which layout a single build opens in.
   *
   * A setting rather than a control on the build manager itself: a reader wants
   * one of the two and keeps wanting it, and a switcher on every build asks the
   * same question every time. Written straight through to `enodia.prefs`, and
   * the build manager reads it when it mounts.
   */
  const [buildDetail, setBuildDetail] = useState<BuildDetail>(() => loadPrefs().buildDetail)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyFrame(frame)
    writeFrame(frame)
  }, [frame])

  useEffect(() => {
    applyWallpaper(wall)
    writeWallpaper(wall)
  }, [wall])

  useEffect(() => {
    savePrefs({ ...loadPrefs(), buildDetail })
  }, [buildDetail])

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
        /**
         * Dying and stopping are different events, so they are different
         * entries. Both end the run and both keep it: `run.ts` archives what
         * was held and how far it got, tagged with which of the two it was.
         * A run ended before today was simply discarded, and a history is the
         * one thing that cannot be backfilled later.
         */
        ...(hasRun
          ? [
              {
                label: 'Died here',
                note: 'Ends the run and keeps it, with where it stopped',
                icon: 'shell/location-zagreus.png',
                action: () => {
                  onEndRun('died')
                  setOpen(false)
                },
              },
              {
                label: 'Finished the run',
                note: 'Reached the end. Ends it and keeps it',
                action: () => {
                  onEndRun('finished')
                  setOpen(false)
                },
              },
            ]
          : [
              {
                label: 'Start a run',
                note: 'Pick an arm, an aspect and a way',
                action: () => {
                  onStartRun()
                  setOpen(false)
                },
              },
            ]),
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
        onShowBuilds
          ? {
              label: 'Build manager',
              note: 'Five layouts to choose between, on three sample builds',
              action: () => {
                onShowBuilds()
                setOpen(false)
              },
            }
          : { label: 'Build manager', note: 'Define a build and track it. Waiting on the first definition' },
        onShowArcana
          ? {
              label: 'Arcana',
              note: 'The board, and which of the six free cards your set switches on',
              action: () => {
                onShowArcana()
                setOpen(false)
              },
            }
          : { label: 'Arcana', note: 'The board and the six conditional cards' },
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

          {/* How a single build opens in the build manager.
              *
              * Two of the five layouts survived the review and both were kept,
              * because they answer different questions: the Poster is "what
              * shall I try", the Constellation is "where are the gaps". */}
          <section>
            <h2>A build opens as</h2>
            <ul className="menu-choice">
              {DETAILS.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={buildDetail === option.id}
                    className={buildDetail === option.id ? 'is-on' : ''}
                    onClick={() => setBuildDetail(option.id)}
                  >
                    <span className="menu-label">
                      {option.name}
                      {buildDetail === option.id ? (
                        <img className="menu-chosen" src="/icons/selected.png" alt="" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="menu-note">{option.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Which frame rings a bubble. Three now: the owner picked the Exit
              reward marker and kept Hecate's two circles as alternatives. The
              swatch is the whole point of it being here: the answer is what it
              looks like, not what it is called. */}
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
                      <img className="menu-frame-face" src="/gifts/zeus-gift.png" alt="" />
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

          {/* What is behind the tool. The picture is dimmed to the app's own
              ink ramp rather than to taste, so the choice here is which room
              you are standing in and not how loud it is. */}
          <section>
            <h2>Behind it</h2>
            <ul className="menu-walls">
              {WALLPAPERS.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={wall === option.id}
                    className={wall === option.id ? 'is-on' : ''}
                    onClick={() => setWall(option.id)}
                  >
                    <span
                      className="menu-wall-swatch"
                      style={{ backgroundImage: option.file ? `url('/${option.file}')` : 'none' }}
                      aria-hidden="true"
                    />
                    <span className="menu-label">
                      {option.name}
                      {wall === option.id ? (
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
