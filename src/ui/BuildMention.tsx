/**
 * A published build named inside a write-up, and how it stands in the run.
 *
 * **This is the reason a build can be mentioned at all.** A mention of a boon
 * says what the boon is. A mention of a build says, while a run is being
 * logged, whether this run can still finish it, with the same verdict the run
 * screen gives the builds in your library. So the same paragraph reads
 * differently at the fourth Exit than it did at the Crossroads.
 *
 * Outside a run the mention is the build's current name and nothing more,
 * because a verdict needs a run to be about.
 *
 * ## How it is drawn in each state `state/mentioned.ts` can report
 *
 * - found: the aspect's art and the build's current name, as a link, with the
 *   verdict after it during a run
 * - found and taken down, or gone: marked withdrawn, with no verdict. A
 *   taken-down build still opens by its link, as it does anywhere else
 * - unknown: the name it was written with, as plain text, the way a mention
 *   of a trait the data no longer knows is drawn
 *
 * The verdict is `sayOf`, the sentence with the build's name trimmed off the
 * front, so the name and the verdict together read as the run screen's
 * sentence, "Killer Current needs 3 more picks, with 8 Exits left", set apart
 * from the author's own. `Aside` says how.
 */

import { createContext, useContext, useEffect, useRef } from 'react'

import { iconOf, traits } from '../data/app.ts'
import type { RunContext } from '../data/types.ts'
import { sayOf, verdictForShown } from '../engine/build-run.ts'
import type { BuildStanding } from '../engine/build-run.ts'
import type { ReachState } from '../engine/reachability.ts'
import { useMentioned } from '../state/mentioned.ts'
import { usePeekBind } from './Peek.tsx'

/**
 * The run being logged, for anything drawn inside the app's frame.
 *
 * **A context, because the run lives in `App`.** `useRun` holds it in the
 * component's own state, so calling it again further down would give a copy
 * read once from storage that never hears about the next pick. `App` puts the
 * live one here. Null when there is no run, and outside the frame.
 */
const LiveRun = createContext<RunContext | null>(null)

export const LiveRunProvider = LiveRun.Provider

export const useLiveRun = () => useContext(LiveRun)

/** Where a click on a mentioned build goes: the copy in the library, or the published one. */
export type BuildAt = { local: string } | { published: string }

/**
 * Opening a mentioned build, which `App` knows how to do and a paragraph does
 * not. Absent outside a provider, where a click is left to the browser and
 * loads the page at the build's short address, which opens it too.
 */
const OpenBuild = createContext<((at: BuildAt) => void) | null>(null)

export const OpenBuildProvider = OpenBuild.Provider

/** The words `Briefing` uses for the same four states, for the hover's kind line. */
const STATE_WORD: Record<ReachState, string> = {
  DEAD: 'closed',
  AT_RISK: 'at risk',
  REACHABLE: 'open',
  ON_TRACK: 'yours',
}

/**
 * What is said about the build, after its name.
 *
 * Set apart by a rule on the screen, and by brackets that only a screen
 * reader and a copy of the text get, so the author's sentence still reads as
 * one: "Swap to Killer Current (needs 3 more picks, with 8 Exits left) if
 * Hestia shows early." The verdict's closing full stop goes, because the
 * author's sentence carries on after it.
 */
function Aside({ state, text }: { state: string; text: string }) {
  return (
    <>
      <span className="visually-hidden"> (</span>
      <span className={`mention-verdict is-${state}`}>{text.replace(/\.$/, '')}</span>
      <span className="visually-hidden">)</span>
    </>
  )
}

export function BuildMention({ id, name, linked }: { id: string; name: string; linked: boolean }) {
  const mentioned = useMentioned(id)
  const run = useLiveRun()
  const open = useContext(OpenBuild)
  const bind = usePeekBind()

  const found = mentioned.state === 'found' ? mentioned : null
  const withdrawn = mentioned.state === 'gone' || found?.takenDown === true
  const standing: BuildStanding | null =
    found && !withdrawn && run ? { build: found.build, verdict: verdictForShown(found.build, run, traits) } : null
  const shown = found?.build.name || name
  const icon = found ? (iconOf.get(found.build.aspect) ?? null) : null

  const author = found?.build.author ? `Build by ${found.build.author}` : 'Build'
  const kind = withdrawn ? `${author}, withdrawn` : standing ? `${author}, ${STATE_WORD[standing.verdict.state]}` : author
  const peek = bind(linked && found ? { name: shown, kind, text: found.build.say || null, boon: false } : null)

  /* Taken down on the way out, as `Prose` does for a trait: following the link
     leaves the screen, and the tooltip would stay up over whatever it opened. */
  const showing = useRef(false)
  const hide = useRef(peek.onPointerLeave)
  hide.current = peek.onPointerLeave
  useEffect(
    () => () => {
      if (showing.current) hide.current?.()
    },
    [],
  )

  if (mentioned.state === 'unknown') return <>{name}</>

  const face = (
    <>
      {icon ? <img className="mention-art" src={`/${icon}`} alt="" loading="lazy" /> : null}
      <span className="mention-name">{shown}</span>
      {standing ? <Aside state={standing.verdict.state.toLowerCase()} text={sayOf(standing)} /> : null}
      {withdrawn ? <Aside state="withdrawn" text="withdrawn" /> : null}
    </>
  )

  const className = `mention mention-build${withdrawn ? ' is-withdrawn' : ''}`
  if (!linked || !found) return <span className={className}>{face}</span>

  return (
    <a
      className={className}
      href={`/b/${id}`}
      data-build={id}
      onClick={(event) => {
        if (!open) return
        // Let the browser have anything that is not a plain left click.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        open(found.local ? { local: found.local } : { published: id })
      }}
      onPointerEnter={(event) => {
        showing.current = true
        peek.onPointerEnter?.(event)
      }}
      onPointerMove={(event) => peek.onPointerMove?.(event)}
      onPointerLeave={() => {
        showing.current = false
        peek.onPointerLeave?.()
      }}
      onFocus={(event) => {
        showing.current = true
        peek.onFocus?.(event)
      }}
      onBlur={() => {
        showing.current = false
        peek.onBlur?.()
      }}
    >
      {face}
    </a>
  )
}
