/**
 * The app shell.
 *
 * Setup is its own screen and happens once. Everything after it is the run
 * surface, which is one place: the rail down the side, the run above, and
 * nothing to navigate between. The timeline that fills the middle arrives at
 * build order step 8.
 */

import { gameVersion, traits, weapons } from './data/app.ts'
import { Rail } from './ui/Rail.tsx'
import { Setup } from './ui/Setup.tsx'
import { LogPick } from './ui/LogPick.tsx'
import { useRun } from './state/run.ts'

export function App() {
  const { run, start, end, take, skip } = useRun()

  if (!run) {
    return (
      <main className="shell">
        <Header />
        <Setup onStart={start} />
        <Footer />
      </main>
    )
  }

  const weapon = weapons.find((entry) => entry.id === run.weapon)
  const aspect = run.aspect ? traits.get(run.aspect) : null

  return (
    <main className="shell run-surface">
      <Header />

      <div className="run-head">
        <p className="run-what">
          {weapon?.name ?? 'Unknown arm'}
          {aspect ? <span className="run-aspect">{aspect.name?.replace(/^Aspect of /, '')}</span> : null}
        </p>
        <p className="run-exits">
          <strong>{run.exitsLeft}</strong> {run.exitsLeft === 1 ? 'Exit' : 'Exits'} left
        </p>
        <button type="button" className="quiet" onClick={end}>
          End run
        </button>
      </div>

      <Rail held={run.held} />

      <LogPick run={run} onTake={take} onSkip={skip} />

      <p className="unbuilt">
        The timeline goes here at step 8: every Exit behind you, what it gave, and what died at that moment.
      </p>

      <Footer />
    </main>
  )
}

function Header() {
  return (
    <header className="masthead">
      <h1 className="wordmark">Enodia</h1>
      <p className="tagline">A build companion for Hades II, read at an Exit.</p>
    </header>
  )
}

function Footer() {
  return (
    <footer className="colophon">
      <p>
        Game data read from build <span className="mono">{gameVersion}</span>. Unofficial fan project, not
        affiliated with Supergiant Games.
      </p>
    </footer>
  )
}
