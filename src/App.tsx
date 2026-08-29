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

import { useCallback, useEffect, useState } from 'react'

import { gameVersion, iconOf, traits, weapons } from './data/app.ts'
import { brief, isWorthShowing } from './engine/briefing.ts'
import type { Briefing as Card } from './engine/briefing.ts'
import { reachable } from './engine/reachability.ts'
import { loadPrefs } from './state/prefs.ts'
import { lastSeen, loadTrail, markSeen, saveTrail } from './state/snapshot.ts'
import { Briefing } from './ui/Briefing.tsx'
import { Hecate } from './ui/Hecate.tsx'
import { Builds } from './ui/Builds.tsx'
import { Menu } from './ui/Menu.tsx'
import { Rail } from './ui/Rail.tsx'
import { Setup } from './ui/Setup.tsx'
import { Timeline } from './ui/Timeline.tsx'
import { Standing } from './ui/Standing.tsx'
import { applyFrame, readFrame } from './ui/frames.ts'
import { useRun } from './state/run.ts'
import type { RunContext } from './data/types.ts'

export function App() {
  const { run, entries, pinned, lastPickAt, start, end, take, skip, pin, forget } = useRun()

  // The saved frame, before anything draws a ring. The menu owns it after
  // that; this only makes a reload keep what was chosen.
  useEffect(() => applyFrame(readFrame()), [])

  /**
   * The re-entry card.
   *
   * **Built at two moments and never in between.** On arrival, which is the
   * gap the feature exists for, and when the player asks for it from the menu,
   * which `DESIGN.md` 6.3 also requires. Recomputing it as picks land would
   * make it appear and vanish mid run, which is the opposite of a briefing.
   *
   * Held in state rather than derived, for the same reason.
   */
  const [card, setCard] = useState<Card | null>(null)
  const [showBriefing, setShowBriefing] = useState(false)

  /**
   * The build manager, which is a screen rather than an overlay.
   *
   * It replaces the surface entirely while it is open, because it is a place a
   * player goes between runs and looking at it is the whole activity. Coming
   * back leaves the run exactly as it was: the run lives in `useRun`, not here.
   */
  const [showBuilds, setShowBuilds] = useState(false)

  const buildCard = useCallback(
    (ctx: RunContext) => brief(ctx, lastSeen(loadTrail()), traits, { pinned, exit: entries.length }),
    [pinned, entries.length],
  )

  // Arrival. Mount only, and it reads the run as it was when the page opened.
  useEffect(() => {
    if (!run) return
    const arrival = buildCard(run)
    setCard(arrival)
    setShowBriefing(
      isWorthShowing(arrival, { lastPickAt, now: Date.now(), staleAfterHours: loadPrefs().staleAfterHours }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openBriefing = () => {
    if (!run) return
    // Rebuilt, because on demand means as things stand rather than as they
    // stood when the tab opened.
    setCard(buildCard(run))
    setShowBriefing(true)
  }

  const dismissBriefing = () => {
    setShowBriefing(false)
    saveTrail(markSeen(loadTrail(), entries.length))
  }

  if (showBuilds) {
    return (
      <div className="shell is-wide">
        <Hecate />
        <Builds onClose={() => setShowBuilds(false)} />
      </div>
    )
  }

  if (!run) {
    return (
      <main className="shell">
        <Hecate />
        <header className="masthead">
          <Menu
            onStartRun={() => {}}
            hasRun={false}
            onEndRun={end}
            onShowBuilds={() => setShowBuilds(true)}
          />
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
  // The aspect's icon, falling back to the arm's cutout before an aspect is set.
  const aspectIcon = (run.aspect ? iconOf.get(run.aspect) : null) ?? weapon?.icon ?? null
  const verdicts = reachable(run, traits)
  const open = verdicts.filter((v) => v.state !== 'DEAD' && v.state !== 'ON_TRACK').length
  const closed = verdicts.filter((v) => v.state === 'DEAD').length

  return (
    <div className="surface">
      <Hecate />

      {/* The picker is the live end of the path, so it is last in the
        * document: everything logged comes first, and each logged station
        * carries a correction of its own. On a keyboard that is a dozen tab
        * stops before the thing the player opened the page to do.
        *
        * A button rather than an `href="#present"`, because the timeline
        * lives in its own scroll container and the anchor did nothing there:
        * the hash stayed empty and focus fell through to the next control.
        * Moving focus and scrolling explicitly works wherever the target is. */}
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          const present = document.getElementById('present')
          present?.scrollIntoView({ block: 'center' })
          present?.focus()
        }}
      >
        Skip to this Exit
      </button>

      <header className="topbar">
        <Menu
          onStartRun={end}
          hasRun
          onEndRun={end}
          onShowBriefing={openBriefing}
          onShowBuilds={() => setShowBuilds(true)}
        />

        {/* The arm, by its own name.
         *
         * "Descura" and "Witch's Staff" are both the game's: the second is the
         * DisplayName its UI and patch notes use, the first is what Melinoe's
         * Codex calls her, because the Nocturnal Arms are characters rather
         * than equipment. The arm leads and the type qualifies it, which is
         * how the owner talks about the run.
         *
         * The mark is the aspect's own square icon, not the weapon's cutout:
         * the aspect is the thing that was chosen and the thing that changes
         * how the run plays. */}
        {/* The page's subject, and its only h1.
         *
         * The run surface had none: the document went straight to an h2 and a
         * screen reader had nothing to announce the page as. The arm and its
         * aspect are what this page is about. */}
        <h1
          className="topbar-run"
          /**
           * Named explicitly, because the separators between these are CSS
           * `::before` content and there is no whitespace between the spans.
           * Read off the DOM it announced as "DescuraWitch's StaffUnderworld".
           */
          aria-label={[weapon?.arm, aspect?.name?.replace(/^Aspect of /, ''), weapon?.name, run.path === 'surface' ? 'Surface' : run.path ? 'Underworld' : null]
            .filter(Boolean)
            .join(', ')}
        >
          {aspectIcon ? <img className="topbar-mark" src={`/${aspectIcon}`} alt="" /> : null}
          <span className="topbar-arm">{weapon?.arm ?? 'Unknown arm'}</span>
          {aspect ? <span className="topbar-aspect">{aspect.name?.replace(/^Aspect of /, '')}</span> : null}
          {weapon ? <span className="topbar-weapon">{weapon.name}</span> : null}
          {run.path ? (
            <span className="topbar-aspect">{run.path === 'surface' ? 'Surface' : 'Underworld'}</span>
          ) : null}
        </h1>

        {/* An estimate, and it says so.
         *
         * There used to be a plus and a minus here. A player has no way of
         * knowing how many Exits a run has left, so asking them to correct the
         * number was asking the tool's question instead of answering theirs.
         * It is derived from Exits taken now and reads as the guess it is. */}
        <p className="topbar-exits">
          <span className="topbar-about">about</span>
          <strong>{run.exitsLeft}</strong>
          <span>Exits left</span>
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
        {showBriefing && card ? <Briefing card={card} onDismiss={dismissBriefing} /> : null}
        <Timeline
          entries={entries}
          run={run}
          onTake={take}
          onSkip={skip}
          onForget={forget}
          scrollToPresent={!showBriefing}
        />
        <Colophon />
      </main>

      <Standing run={run} pinned={pinned} onPin={pin} />
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
