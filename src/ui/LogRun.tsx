/**
 * A run, logged in four answers, without opening the editor.
 *
 * **The common update should not be the expensive one.** Playing a build and
 * coming back to say how it went is the thing that happens most, and the only
 * way to do it was to open the editor, find the Play tab and edit three
 * numbers by hand. This is that, as a form you can fill in without reading it.
 *
 * ## What it asks, and what it does with the answers
 *
 * Cleared or not, and whether the build actually came together, become `runs`
 * and `clears`, which is what `winRate` divides. Fear is kept if it beats what
 * is already recorded, because the record is the highest cleared and a Fear 10
 * run after a Fear 20 one does not undo the 20.
 *
 * **Fear only counts on a clear.** Dying at Fear 30 is not clearing Fear 30,
 * and a record that treated it as one would be the tool inflating somebody's
 * own history.
 *
 * The last question is where the run ended, and it is the one that is only
 * asked when it applies. Four Regions per path, which `CLAUDE.md` records and
 * `ESTIMATED_EXITS` is derived from.
 */

import { useState } from 'react'

import { MAX_FEAR } from '../data/builds.ts'
import { Stepper } from './Fear.tsx'
import type { PlayRecord, ShownBuild } from '../data/builds.ts'

/**
 * Where a run ended, by the boss that ended it.
 *
 * Numbered rather than named, because the four differ by path: the Underworld
 * runs Erebus, Oceanus, the Fields and Tartarus, the Surface its own four. A
 * build is not tied to a path, so the honest question is which of the four.
 */
const ENDED_AT = [
  { id: 1, say: 'Before the first boss' },
  { id: 2, say: 'Before the second' },
  { id: 3, say: 'Before the third' },
  { id: 4, say: 'At the last one' },
] as const

export function LogRun({
  build,
  onLog,
  onClose,
}: {
  build: ShownBuild
  onLog: (play: PlayRecord) => void
  onClose: () => void
}) {
  const [cleared, setCleared] = useState<boolean | null>(null)
  const [assembled, setAssembled] = useState<boolean | null>(null)
  const [fear, setFear] = useState<number | undefined>(build.play?.fear)
  const [endedAt, setEndedAt] = useState<number | null>(null)

  const play = build.play

  const save = () => {
    const runs = (play?.runs ?? 0) + 1
    const clears = (play?.clears ?? 0) + (cleared ? 1 : 0)
    onLog({
      ...play,
      runs,
      clears,
      // Highest cleared, so a lesser run afterwards does not undo it, and only
      // on a clear, because dying at Fear 30 is not clearing Fear 30.
      ...(cleared && fear ? { fear: Math.max(play?.fear ?? 0, fear) } : {}),
    })
    onClose()
  }

  return (
    <div className="logrun" role="dialog" aria-label="Log a run">
      {/* Two elements, and the inner one is not decoration. The panel holds the
        * art and its aspect ratio; the inner holds the padding. Percentage
        * padding resolves against the *containing block's* width, so on the
        * panel itself it was measuring against the full-screen overlay and
        * coming out two and a half times too big. On a child of the panel it
        * measures against the panel, which is what the frame insets are in. */}
      <div className="logrun-box">
        <div className="logrun-inner">
        <h3>How did it go?</h3>

        <Ask
          label="Did you clear it?"
          value={cleared}
          onChoose={(next) => {
            setCleared(next)
            if (next) setEndedAt(null)
          }}
        />

        <Ask label="Did the build come together?" value={assembled} onChoose={setAssembled} />

        {/* Only on a clear, because that is the only run it can describe. */}
        {cleared ? (
          <Stepper
            label="Fear cleared"
            value={fear}
            onChange={setFear}
            max={MAX_FEAR}
            icon={{ src: '/icons/fear.png' }}
            ofLabel={`of ${MAX_FEAR}`}
          />
        ) : null}

        {/* Only when there is a death to place. Optional even then. */}
        {cleared === false ? (
          <div className="editor-field">
            <span>Where did it end?</span>
            <div className="logrun-ended">
              {ENDED_AT.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={endedAt === one.id ? 'is-on' : ''}
                  onClick={() => setEndedAt(endedAt === one.id ? null : one.id)}
                >
                  {one.say}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* What it will write, before it writes it. Four taps is quick enough
          * to do by accident, and this is somebody's own record of their own
          * play. */}
        <p className="logrun-says">
          {cleared === null
            ? 'Answer the first one and this will say what it records.'
            : summary(play, cleared, fear)}
        </p>

        <div className="logrun-actions">
          <button type="button" className="quiet" disabled={cleared === null} onClick={save}>
            Log it
          </button>
          <button type="button" className="quiet" onClick={onClose}>
            Never mind
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

function summary(play: PlayRecord | undefined, cleared: boolean, fear: number | undefined): string {
  const runs = (play?.runs ?? 0) + 1
  const clears = (play?.clears ?? 0) + (cleared ? 1 : 0)
  const was = play?.fear ?? 0
  const raised = cleared && fear && fear > was ? `, and Fear cleared up to ${fear}` : ''
  return `${clears} of ${runs} runs cleared${raised}.`
}

/** One yes or no, with neither pressed until it is. */
function Ask({
  label,
  value,
  onChoose,
}: {
  label: string
  value: boolean | null
  onChoose: (next: boolean) => void
}) {
  return (
    <div className="editor-field">
      <span>{label}</span>
      <div className="logrun-yesno">
        <button type="button" className={value === true ? 'is-on' : ''} onClick={() => onChoose(true)}>
          Yes
        </button>
        <button type="button" className={value === false ? 'is-on' : ''} onClick={() => onChoose(false)}>
          No
        </button>
      </div>
    </div>
  )
}
