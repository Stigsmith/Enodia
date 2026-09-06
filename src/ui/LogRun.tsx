/**
 * A run, logged in a handful of answers, without opening the editor.
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
 *
 * ## It is also where the exchange's numbers come from
 *
 * A build taken off a shelf reports its runs back to the build it came from,
 * and that happens here rather than anywhere else, because here is the only
 * place that knows whether *this* run cleared. `onLog` is handed a cumulative
 * record and cannot tell.
 *
 * **The report is fire and forget and nothing on this screen waits for it.**
 * Somebody logging a run is writing their own history; whether a tally moved on
 * a shelf they are not looking at is not their problem, and a server that is
 * down must not stop them recording what they did. `state/exchange.ts` decides
 * whether to send at all: it reports only while the copy still is the build,
 * and only while the switch in Settings is on.
 */

import { useState } from 'react'

import { ASSEMBLES, MAX_FEAR } from '../data/builds.ts'
import { olympians, traits } from '../data/app.ts'
import { ratingCeiling, readRepeat } from '../engine/repeat.ts'
import { rateBuild, reportRun, reportsTo } from '../state/exchange.ts'
import { Stars, Stepper } from './Fear.tsx'
import { VowScreen } from './VowSheet.tsx'
import { tidyVows, vowsTakenCount } from '../engine/vows.ts'
import type { VowsTaken } from '../engine/vows.ts'
import type { Assembles, PlayRecord, ShownBuild } from '../data/builds.ts'

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
  const [fear, setFear] = useState<number | undefined>(build.play?.fear)
  const [endedAt, setEndedAt] = useState<number | null>(null)

  /**
   * Which vows were on, tidied on the way in rather than trusted.
   *
   * What is stored came from a JSON file a person can edit and an import can
   * carry, and a game update can retire a rank underneath it. `tidyVows` drops
   * anything that cannot mean what it says, so the sheet and the sum it draws
   * are always about vows that exist.
   */
  const [vowsTaken, setVowsTaken] = useState<VowsTaken>(() => tidyVows(build.play?.vows))

  /**
   * Which of the two screens this dialog is, and it is two screens rather than
   * a form with a drawer in it.
   *
   * The vows opened as a bordered box inside the panel first, which put a frame
   * inside a frame and pushed the form's own buttons 17px through the bottom of
   * the art. The shrine has a screen for this; the dialog borrows it and Back
   * comes home. Nothing is committed by going there, so leaving is free.
   */
  const [view, setView] = useState<'form' | 'vows'>('form')

  const play = build.play

  /**
   * How dependably it comes together, and it starts where the record already is.
   *
   * **Three answers rather than yes and no**, which is what the question was
   * before and what threw the answer away. `assembles` has three states, the
   * editor offers three and the detail strip draws three, so a yes/no here
   * would have had to invent a mapping and lose Situational on the way past.
   * `ASSEMBLES` in `data/builds.ts` exists so those three cannot drift.
   *
   * Starting at what is recorded means leaving it alone keeps it, which is the
   * right default: one unlucky run is not a reason to rewrite a judgement built
   * over twelve.
   */
  const [assembles, setAssembles] = useState<Assembles | undefined>(play?.assembles)

  /**
   * Stars, capped the same way the editor caps them.
   *
   * A build asking for something a run cannot hand over must not be able to
   * look like a recommendation, and that clamp lives wherever stars are
   * offered rather than in one of the two places that offer them.
   */
  const ceiling = ratingCeiling(readRepeat(build, traits, olympians))
  const [rating, setRating] = useState<number | undefined>(play?.rating)

  /**
   * The published build this one would report to, or null.
   *
   * **Asked rather than assumed.** Reading the two `derived` fields would say
   * yes for a copy that has since been edited, and the hint below would promise
   * a report the hash check then refuses. `reportsTo` is the same question the
   * sending path asks, so what the screen says and what it does are one answer.
   */
  const reportTo = reportsTo(build)

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
      /**
       * The vows go with the Fear they describe, or they do not go at all.
       *
       * `fear` is the highest ever cleared, not the last one. So a Fear 12 run
       * logged after a Fear 30 one leaves the 30 standing, and writing this
       * run's vows over the record would then have three vows worth 9 sitting
       * under a number earned by five worth 30. The list is only replaced when
       * this run is the one setting the number.
       */
      ...(cleared && fear && fear >= (play?.fear ?? 0)
        ? { vows: vowsTakenCount(vowsTaken) ? vowsTaken : undefined }
        : {}),
      ...(assembles ? { assembles } : {}),
      ...(rating ? { rating } : {}),
    })

    /**
     * Off to the build this one came from, if it came from one.
     *
     * Ordered, and it has to be: `worker/exchange.ts` refuses a rating with no
     * logged run behind it, so the rating goes second and only once the run
     * has actually landed. Unawaited, because nothing on this screen depends on
     * either of them and `onClose` is about to run.
     */
    if (reportTo) {
      void (async () => {
        const sent = await reportRun(build, Boolean(cleared), cleared && fear ? fear : null)
        if (sent && rating && rating !== play?.rating) await rateBuild(reportTo, rating)
      })()
    }

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
      <div className={`logrun-box${view === 'vows' ? ' is-vows' : ''}`}>
        <div className="logrun-inner">
        {view === 'vows' ? (
          <VowScreen
            taken={vowsTaken}
            onChange={setVowsTaken}
            onBack={() => setView('form')}
            target={fear}
          />
        ) : (
        <>
        <h3>How did it go?</h3>

        <Ask
          label="Did you clear it?"
          value={cleared}
          onChoose={(next) => {
            setCleared(next)
            if (next) setEndedAt(null)
          }}
        />

        {/* `logrun-three`, not the four-button row below it: three answers in a
          * two-column grid leaves the last one alone in the left column. */}
        <div className="editor-field">
          <span>Did the build come together?</span>
          <div className="logrun-three">
            {ASSEMBLES.map((one) => (
              <button
                key={one.id}
                type="button"
                className={assembles === one.id ? 'is-on' : ''}
                onClick={() => setAssembles(assembles === one.id ? undefined : one.id)}
              >
                {one.name}
              </button>
            ))}
          </div>
        </div>

        {/* Only on a clear, because that is the only run it can describe. */}
        {cleared ? (
          <>
            <Stepper
              label="Fear cleared"
              value={fear}
              onChange={setFear}
              max={MAX_FEAR}
              icon={{ src: '/icons/fear.png' }}
              ofLabel={`of ${MAX_FEAR}`}
            />

            {/* A way through to the shrine's screen, not a drawer on this
              * one. Most runs will be a number and nothing else; this is for
              * the one somebody wants to be exact about. */}
            <button type="button" className="logrun-tovows" onClick={() => setView('vows')}>
              {vowsTakenCount(vowsTaken)
                ? `${vowsTakenCount(vowsTaken)} vows named`
                : 'Name the vows'}
            </button>
          </>
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

        <div className="editor-field">
          <span>What would you give it?</span>
          <Stars value={rating} ceiling={ceiling} onChange={setRating} />
          {/* Said here rather than discovered later. A rating on a build you
            * took is the one answer on this form that other people see, and
            * somebody should know that before they give it three stars. */}
          {reportTo ? (
            <p className="editor-hint">
              This one came off the exchange, so your stars count toward it there. Everything
              else on this form stays here.
            </p>
          ) : null}
        </div>

        {/* What it will write, before it writes it. Four taps is quick enough
          * to do by accident, and this is somebody's own record of their own
          * play. */}
        <p className="logrun-says">
          {cleared === null
            ? 'Answer the first one and this will say what it records.'
            : summary(play, cleared, fear, assembles)}
        </p>

        <div className="logrun-actions">
          <button type="button" className="quiet" disabled={cleared === null} onClick={save}>
            Log it
          </button>
          <button type="button" className="quiet" onClick={onClose}>
            Never mind
          </button>
        </div>
        </>
        )}
        </div>
      </div>
    </div>
  )
}

function summary(
  play: PlayRecord | undefined,
  cleared: boolean,
  fear: number | undefined,
  assembles: Assembles | undefined,
): string {
  const runs = (play?.runs ?? 0) + 1
  const clears = (play?.clears ?? 0) + (cleared ? 1 : 0)
  const was = play?.fear ?? 0
  const raised = cleared && fear && fear > was ? `, and Fear cleared up to ${fear}` : ''
  /**
   * A sentence of its own, and it has to be.
   *
   * The first attempt read "it comes together situational", because it
   * lowercased the name and dropped it into a clause. Only Reliably is an
   * adverb; the other two are not, and `ASSEMBLES` is a list of labels rather
   * than a list of words that fit a sentence. So the label is quoted rather
   * than conjugated.
   *
   * Only when it is a change. Repeating back what was already recorded reads as
   * though this run said it, and this line is a list of what this run writes.
   */
  const comes =
    assembles && assembles !== play?.assembles
      ? ` Comes together: ${ASSEMBLES.find((one) => one.id === assembles)?.name}.`
      : ''
  return `${clears} of ${runs} runs cleared${raised}.${comes}`
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
