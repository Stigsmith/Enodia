/**
 * The app shell.
 *
 * Setup is its own screen and happens once. Everything after it is one surface
 * in three parts: the rail for what you hold, the timeline for the run, and the
 * present entry for the decision in front of you. There is no navigation
 * between them, which is the point.
 */

import { gameVersion, traits, weapons } from './data/app.ts'
import { Rail } from './ui/Rail.tsx'
import { Setup } from './ui/Setup.tsx'
import { Present } from './ui/Present.tsx'
import { Timeline } from './ui/Timeline.tsx'
import { useRun } from './state/run.ts'

export function App() {
  const { run, entries, start, end, take, skip, setExitsLeft } = useRun()

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
          {run.path ? <span className="run-aspect">{run.path === 'surface' ? 'Surface' : 'Underworld'}</span> : null}
        </p>
        {/* An estimate, and the player's to correct. Nobody knows their Exit
            count at the start of a run, so this is never a question, only a
            number that can be nudged once the run makes it obvious. */}
        <p className="run-exits">
          <button type="button" onClick={() => setExitsLeft(run.exitsLeft - 1)} aria-label="One fewer Exit left">
            &minus;
          </button>
          <strong>{run.exitsLeft}</strong> {run.exitsLeft === 1 ? 'Exit' : 'Exits'} left
          <button type="button" onClick={() => setExitsLeft(run.exitsLeft + 1)} aria-label="One more Exit left">
            +
          </button>
          <span className="estimate">estimate</span>
        </p>
        <button type="button" className="quiet" onClick={end}>
          End run
        </button>
      </div>

      <Rail held={run.held} />

      <Timeline entries={entries} exitsLeft={run.exitsLeft} />

      <Present run={run} onTake={take} onSkip={skip} />

      <p className="unbuilt">
        Step 11 puts the three boons actually on offer here, ranked, with the case for rejecting all three.
        That needs the rating engine, which is step 10.
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
