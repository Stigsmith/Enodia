/**
 * The app shell.
 *
 * **The timeline is the only thing that scrolls.** Everything else is pinned:
 * the run and the tally along the top, the rail down the side, and the pick
 * waiting in a tray at the bottom. A tool read in four seconds mid run cannot
 * ask anyone to scroll to find what they came for, and the first version did
 * exactly that.
 *
 * Setup is its own screen and happens once.
 */

import { useEffect } from 'react'

import { gameVersion, traits, weapons } from './data/app.ts'
import { reachable } from './engine/reachability.ts'
import { Menu } from './ui/Menu.tsx'
import { Rail } from './ui/Rail.tsx'
import { Setup } from './ui/Setup.tsx'
import { Timeline } from './ui/Timeline.tsx'
import { Standing } from './ui/Standing.tsx'
import { applyFrame, readFrame } from './ui/frames.ts'
import { useRun } from './state/run.ts'

export function App() {
  const { run, entries, start, end, take, skip, setExitsLeft } = useRun()

  // The saved frame, before anything draws a ring. The menu owns it after
  // that; this only makes a reload keep what was chosen.
  useEffect(() => applyFrame(readFrame()), [])

  if (!run) {
    return (
      <main className="shell">
        <header className="masthead">
          <Menu onStartRun={() => {}} hasRun={false} onEndRun={end} />
          <div>
            <h1 className="wordmark">Enodia</h1>
            <p className="tagline">A build companion for Hades II, read at an Exit.</p>
          </div>
        </header>
        <Setup onStart={start} />
        <Colophon />
      </main>
    )
  }

  const weapon = weapons.find((entry) => entry.id === run.weapon)
  const aspect = run.aspect ? traits.get(run.aspect) : null
  const verdicts = reachable(run, traits)
  const open = verdicts.filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK').length
  const closed = verdicts.filter((v) => v.state === 'DEAD').length

  return (
    <div className="surface">
      <header className="topbar">
        <Menu onStartRun={end} hasRun onEndRun={end} />

        <p className="topbar-run">
          <span className="topbar-weapon">{weapon?.name ?? 'Unknown arm'}</span>
          {aspect ? <span className="topbar-aspect">{aspect.name?.replace(/^Aspect of /, '')}</span> : null}
          {run.path ? (
            <span className="topbar-aspect">{run.path === 'surface' ? 'Surface' : 'Underworld'}</span>
          ) : null}
        </p>

        <p className="topbar-exits">
          <button type="button" onClick={() => setExitsLeft(run.exitsLeft - 1)} aria-label="One fewer Exit left">
            &minus;
          </button>
          <strong>{run.exitsLeft}</strong>
          <span>Exits left</span>
          <button type="button" onClick={() => setExitsLeft(run.exitsLeft + 1)} aria-label="One more Exit left">
            +
          </button>
        </p>

        <p className="topbar-tally">
          <strong>{open}</strong> open
          {closed ? <span className="topbar-closed">{closed} closed</span> : null}
        </p>

      </header>

      <aside className="railbar" aria-label="Your slots">
        <Rail held={run.held} />
      </aside>

      <main className="scroller">
        <Timeline entries={entries} run={run} onTake={take} onSkip={skip} />
        <Colophon />
      </main>

      <Standing run={run} />
    </div>
  )
}

function Colophon() {
  return (
    <footer className="colophon">
      <p>
        Game data read from build <span className="mono">{gameVersion}</span>. Unofficial fan project, not
        affiliated with Supergiant Games.
      </p>
    </footer>
  )
}
