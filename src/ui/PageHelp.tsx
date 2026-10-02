/**
 * The mark that starts the tour.
 *
 * ## What this is
 *
 * An info mark in the corner of every screen. Press it and Dora walks you round
 * the page, one thing at a time: she lights a control, says a line about it, and
 * moves on when you click.
 *
 * `info-button.png` was adopted in the art audit and then rejected for want of
 * a home: an info mark belongs on a control that opens help, and there was no
 * such control. This is the control.
 *
 * ## What changed, and why
 *
 * The first version put three lines on a near-black rectangle. The writing was
 * right and the shape was wrong: dimming the page to nothing turns an explainer
 * into a manual, and a manual is what the Help page already is. **A companion
 * points.** So the dim came up to where you can still see the page, she came
 * down to half the size, and the words moved onto the thing they describe.
 *
 * This file is now only the mark and the topic. `Tour.tsx` is the mechanics and
 * `tour.ts` is what she says.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { Tour } from './Tour.tsx'
import { TOURS } from './tour.ts'
import type { View } from './nav.ts'

/** Views that share a topic rather than owning one. */
const ALIAS: Partial<Record<View, string>> = {
  account: 'unbuilt',
  friends: 'unbuilt',
}

// ---------------------------------------------------------------------------
// The override, so a mode inside a screen can name its own topic
// ---------------------------------------------------------------------------

/**
 * **A context rather than a prop, for the same reason `Peek` is one.**
 *
 * The editor is the most complicated screen in the tool and it is not a `View`:
 * `editing` is state inside `Builds.tsx`, so a `PageHelp` keyed on the view
 * would cheerfully explain the overview to somebody standing in the editor.
 * Lifting that state into `App` to fix it would couple the shell to the
 * internals of one screen.
 *
 * So a screen says what it is instead. The default is null, which means a
 * screen that says nothing simply gets its own view's entry.
 */
const HelpTopic = createContext<{ topic: string | null; set: (topic: string | null) => void }>({
  topic: null,
  set: () => {},
})

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [topic, setTopic] = useState<string | null>(null)
  // `setTopic` is stable, so this only changes when the topic does.
  const value = useMemo(() => ({ topic, set: setTopic }), [topic])
  return <HelpTopic.Provider value={value}>{children}</HelpTopic.Provider>
}

/**
 * Claim the help topic for as long as this component is mounted.
 *
 * Cleared on the way out, so an override can never outlive the screen that set
 * it. Under StrictMode the effect runs, cleans up and runs again, which lands
 * on the topic either way.
 */
export function useHelpTopic(topic: string) {
  const { set } = useContext(HelpTopic)
  useEffect(() => {
    set(topic)
    return () => set(null)
  }, [set, topic])
}

// ---------------------------------------------------------------------------

export function PageHelp({ view }: { view: View }) {
  const { topic: override } = useContext(HelpTopic)
  const [open, setOpen] = useState(false)
  const mark = useRef<HTMLButtonElement>(null)

  const topic = override ?? ALIAS[view] ?? view
  const steps = TOURS[topic]

  // Moving to another screen mid-tour should not leave her walking you round
  // the one you left.
  useEffect(() => setOpen(false), [topic])

  // No tour for a screen means no mark. A help control that opens an empty
  // panel is worse than no control, which is the lesson the unbuilt menu rows
  // already taught.
  if (!steps?.length) return null

  return (
    <>
      {/* The art is the background rather than an `img`, so the game's own
        * highlight sprite can take over on hover the way it does in the game.
        * Both paths are literals, which is what `prune` reads. */}
      <button
        /* Keyed on the topic so each screen gets a fresh button, which is what
           replays the beacon's few pings there rather than only on the first. */
        key={topic}
        ref={mark}
        type="button"
        className={`pagehelp-open${open ? ' is-away' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="visually-hidden">Show me round this page</span>
      </button>

      {open ? (
        <Tour
          steps={steps}
          onClose={() => {
            setOpen(false)
            // Back where it came from, rather than at the top of the document.
            mark.current?.focus()
          }}
        />
      ) : null}
    </>
  )
}
