/**
 * Dora explains the page you are on.
 *
 * ## What this is
 *
 * An info mark in the corner of every screen. Press it, the page dims, Dora
 * arrives and says what you are looking at. Press anything to send her away.
 *
 * `info-button.png` was adopted in the art audit and then rejected for want of
 * a home: an info mark belongs on a control that opens help, and there was no
 * such control. This is the control.
 *
 * ## Why she narrates it rather than a paragraph doing it
 *
 * Because the Help page already exists and is the reference. This is the other
 * thing: what is this screen for, in two or three lines, from somebody who is
 * not going to oversell it. A page whose explanation needs more than she would
 * be willing to say out loud probably needs a simpler page.
 *
 * ## The lines
 *
 * Hers in register, none of them hers in fact: `NPCData_Dora.lua` holds 763 and
 * none are reproduced. See `Dora.tsx` for the reasoning, which is the same here.
 *
 * **They explain the page.** The deadpan is the delivery, not a substitute for
 * saying what the thing does. A joke that leaves somebody still not knowing
 * what a screen is for has cost them something for nothing. So the explaining
 * happens first, and a joke is the last line rather than the only one.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import type { View } from './nav.ts'

/**
 * What she says, per topic.
 *
 * Keyed by topic rather than by `View`, because two of these are not views: the
 * editor is a mode inside Builds, and the four empty pages share one entry
 * rather than repeating themselves four times.
 */
const SAYS: Record<string, string[]> = {
  builds: [
    'Every build you have made, as cards. The filters up top narrow them by arm, by aspect, and by which gods are in them.',
    'Open one to read it properly. The word under each name says how much has to go right to actually put it together, which is this thing being honest rather than encouraging.',
    'None of it is a recommendation. It is all yours, and it lives in this browser and nowhere else.',
  ],

  editor: [
    'Three columns. What the build holds on the left, what you are editing in the middle, and on the right everything standing between you and a save.',
    'Five tabs in the middle: the loadout, the boons, the Arcana, your notes, and how it has actually played.',
    'The strip along the bottom is the honest one. It totals up how much luck the whole thing needs, then itemises exactly where the luck goes.',
    'Nothing is written down until you press Save. The right column will tell you if it is refusing to.',
  ],

  arcana: [
    'The whole board. You pay Grasp for the cards you pick, and you only have so much Grasp.',
    'Six of them cost nothing at all and switch themselves on when the cards around them line up. Point at any card and it will say what it is still waiting for.',
  ],

  themes: [
    'Four looks, each with its own colours, weather and wallpapers.',
    'They change nothing whatsoever about how any of this works. That is the entire feature and I am not going to dress it up.',
  ],

  settings: [
    'Your name, which travels with any build you share, so people know whose it is.',
    'Export puts everything in one file. There is no account and no server behind this, so that file is the only copy that exists anywhere. It tells you how long since you last made one, which is a hint.',
    'Import replaces what is here. Not a merge. It says what is in the file before it touches anything.',
  ],

  /**
   * The page that does her job, at length, in order.
   *
   * One of the four the owner asked to turn and look at itself. The explaining
   * is still real: the first line says what the page is for, and only then does
   * she work out what that makes her.
   */
  help: [
    'The reference. Every state, band and percentage on the run screen, written out properly.',
    'So that page does my job. Thoroughly. In order. With headings.',
    'I am the short version. I have made my peace with it.',
  ],

  about: [
    'Who made this, and where the numbers come from. Short version: one player, reading the game files rather than a wiki.',
    'It names the game build everything was read out of, so when you find something out of date you know what it was true for.',
  ],

  /** She is fixed to the right edge of this one, watching it scroll past. */
  roadmap: [
    'What is built, what is next, and what is stuck. The bar counts the first against the first three.',
    'No dates anywhere. It is a side project and a date would be a guess dressed as a promise.',
    'And yes, that is me over there, pinned to the corner so the plan scrolls and I do not. Nobody asked me.',
  ],

  changelog: [
    'What changed, newest at the top.',
    'There is an entry in there about me. I did not ask for that either.',
  ],

  setup: [
    'Pick an arm, then an aspect, then which way you are heading. That is the whole of it.',
    'If you already have a build in mind, start from it, and the run will know what you are chasing.',
  ],

  run: [
    'Log each Exit as you take it, and this keeps track of what is still reachable.',
    'A pick can close things off. When one does, it says so at the pick that did it, rather than letting you find out four Exits later.',
    'Got something wrong? Every entry can be taken back, and everything after it works itself out again.',
  ],

  /**
   * The four empty pages, which share one entry.
   *
   * She is already standing in these in a hard hat, so this is the fourth of
   * the self-aware ones. The vocabulary rule bans "room" and is right to: it
   * cannot tell Dora squatting from a Location. Reworded rather than escaped,
   * which is the call `Dora.tsx` made and the better one.
   */
  unbuilt: [
    'You pressed the help mark, on a page with nothing on it, to find out about the page with nothing on it.',
    'There is nothing here. That is the whole of it.',
    'I admire the commitment, though.',
  ],
}

/** Views that share a topic rather than owning one. */
const ALIAS: Partial<Record<View, string>> = {
  exchange: 'unbuilt',
  account: 'unbuilt',
  friends: 'unbuilt',
  leaderboards: 'unbuilt',
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
  const panel = useRef<HTMLDivElement>(null)

  const topic = override ?? ALIAS[view] ?? view
  const lines = SAYS[topic]

  const close = useCallback(() => {
    setOpen(false)
    // Back where it came from, rather than at the top of the document.
    mark.current?.focus()
  }, [])

  // Moving to another screen while she is talking should not leave her
  // explaining the one you left.
  useEffect(() => setOpen(false), [topic])

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, close])

  // No copy for a screen means no mark. A help control that opens an empty
  // panel is worse than no control, which is the lesson the unbuilt menu rows
  // already taught.
  if (!lines) return null

  return (
    <>
      {/* The art is the background rather than an `img`, so the game's own
        * highlight sprite can take over on hover the way it does in the game.
        * Both paths are literals, which is what `prune` reads. */}
      <button
        ref={mark}
        type="button"
        className="pagehelp-open"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="visually-hidden">What is this page?</span>
      </button>

      {open ? (
        /* Closes on a click anywhere, because there is nothing to do in here
          * except read. The close mark is there for a keyboard, and for anyone
          * who would rather aim at a control than have guessed the rule. */
        <div
          ref={panel}
          className="pagehelp"
          role="dialog"
          aria-modal="true"
          aria-label="What is this page?"
          tabIndex={-1}
          onClick={close}
        >
          <div className="pagehelp-body">
            {lines.map((line) => (
              <p key={line} className="pagehelp-line">
                {line}
              </p>
            ))}
            <button type="button" className="pagehelp-close" onClick={close}>
              Right you are
            </button>
          </div>

          <img className="pagehelp-dora" src="/ui/dora-thoughtful.png" alt="" aria-hidden="true" />
        </div>
      ) : null}
    </>
  )
}
