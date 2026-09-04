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
import type { ReactNode } from 'react'

import { gameVersion, iconOf, traits, weapons } from './data/app.ts'
import { brief, isWorthShowing } from './engine/briefing.ts'
import type { Briefing as Card } from './engine/briefing.ts'
import { buildStanding, buildTally, sayOf } from './engine/build-run.ts'
import { loadPrefs, savePrefs } from './state/prefs.ts'
import { lastSeen, loadTrail, markSeen, saveTrail } from './state/snapshot.ts'
import { Briefing } from './ui/Briefing.tsx'
import { Hecate } from './ui/Hecate.tsx'
import { Arcana } from './ui/Arcana.tsx'
import { Themes } from './ui/Themes.tsx'
import { Settings } from './ui/Settings.tsx'
import { Changelog, Roadmap } from './ui/Pages.tsx'
import { Help } from './ui/Reference.tsx'
import { Unbuilt } from './ui/Dora.tsx'
import { Account, ResetPassword } from './ui/Account.tsx'
import { Exchange } from './ui/Exchange.tsx'
import { You } from './ui/You.tsx'
import { Friends } from './ui/Friends.tsx'
import { ACCOUNTS_LIVE, ACCOUNT_CHANGED, currentAccount, resetInUrl } from './state/account.ts'
import type { ResetArrival } from './state/account.ts'
import { useSync } from './state/useSync.ts'
import { KOFI, kofiUrl } from './data/kofi.ts'
import { Shared } from './ui/Shared.tsx'
import { buildInUrl, received, unpackBuild } from './state/transfer.ts'
import { openPublished, publishedInUrl } from './state/publish.ts'
import { loadBuilds, saveBuild } from './state/builds.ts'
import type { ShownBuild } from './data/builds.ts'
import { Builds } from './ui/Builds.tsx'
import { Menu } from './ui/Menu.tsx'
import { PeekProvider } from './ui/Peek.tsx'
import { HelpProvider, PageHelp } from './ui/PageHelp.tsx'
import { Rail } from './ui/Rail.tsx'
import { Landing } from './ui/Landing.tsx'
import { Setup } from './ui/Setup.tsx'
import { Timeline } from './ui/Timeline.tsx'
import { Standing } from './ui/Standing.tsx'
import { FRAMES, applyFrame, readFrame, writeFrame } from './ui/frames.ts'
import { applyTheme, readTheme, readWallpapers, writeTheme, writeWallpapers } from './ui/theme.ts'
import { applyNav, readNav } from './ui/nav.ts'
import type { View } from './ui/nav.ts'
import { useRun } from './state/run.ts'
import type { RunContext } from './data/types.ts'

export function App() {
  const { run, entries, pinned, lastPickAt, start, end, take, skip, pin, forget } = useRun()

  /**
   * Which frame rings a bubble.
   *
   * It used to be a list in the menu, which meant choosing between three rings
   * with none of them on screen. It is a small control in the run view now,
   * beside the ring it changes: pick one and the bubbles in front of you
   * change while you are looking at them.
   */
  const [ring, setRing] = useState(readFrame)

  useEffect(() => {
    applyFrame(ring)
    writeFrame(ring)
  }, [ring])

  /**
    * The theme, and the wallpaper it is wearing.
    *
    * Held here rather than in the picker because every screen is painted by
    * it, and a reload has to keep it whether or not anyone opens the picker.
    */
  const [theme, setTheme] = useState(readTheme)
  const [wallpapers, setWallpapers] = useState(readWallpapers)

  useEffect(() => {
    applyTheme(theme, wallpapers)
    writeTheme(theme)
  }, [theme, wallpapers])

  // Pop-out or pinned pane, on a desktop. `nav.ts` explains why the CSS
  // ignores it below 60rem rather than this having to.
  useEffect(() => applyNav(readNav()), [])

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
   * Which screen. One value rather than a boolean each, because they are
   * exclusive and two booleans can say something the app has no answer for.
   *
   * The run wins on arrival when there is one. Everything else lands on Builds.
   */
  const [view, setView] = useState<View>(() => {
    if (run) return 'run'
    /**
     * The landing page, once, and never in front of somebody who came for a
     * build. A share link means they clicked through to see one specific thing,
     * and an explainer there answers a question they did not ask.
     */
    if (
      !loadPrefs().seenLanding &&
      !buildInUrl(window.location.hash) &&
      !publishedInUrl(window.location.pathname)
    ) {
      return 'landing'
    }
    return 'builds'
  })

  /**
   * Somebody arriving from a password reset letter.
   *
   * Read once from the URL rather than watched, because this only ever arrives
   * on a fresh load: the browser follows the link in the letter, better-auth
   * bounces it here, and nothing in the app navigates to it afterwards.
   */
  const [resetting, setResetting] = useState<ResetArrival | null>(() =>
    resetInUrl(window.location.search),
  )

  /**
   * Whether there is an account behind this browser, asked once.
   *
   * Only sync needs to know, and only to decide whether to bother. Everything
   * else works identically signed in or out, which is the property worth
   * keeping: the account adds a copy elsewhere, it does not become the source.
   */
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    if (!ACCOUNTS_LIVE) return
    let live = true
    const check = () =>
      void currentAccount().then((who) => {
        if (live) setSignedIn(Boolean(who))
      })

    check()
    /**
     * And again whenever somebody signs in or out.
     *
     * Asking once was a real bug and a quiet one: signing in did not start
     * syncing, so a build made in that same session saved locally, reached
     * nothing, and only travelled after a reload. Nothing errored and the
     * screen looked correct, which is exactly the kind of thing driving the
     * interface catches and driving the API does not.
     */
    window.addEventListener(ACCOUNT_CHANGED, check)
    return () => {
      live = false
      window.removeEventListener(ACCOUNT_CHANGED, check)
    }
  }, [])

  /** Walked through, so it stops being a screen and becomes a menu entry. */
  const leaveLanding = () => {
    savePrefs({ ...loadPrefs(), seenLanding: true })
    setView('builds')
  }

  /**
   * A build that arrived in a link.
   *
   * Read once, on arrival, and the fragment is cleared as soon as it has been
   * read: leaving it in the address bar means a reload offers the same build
   * again after it has already been answered.
   */
  const [arrived, setArrived] = useState<ShownBuild | null>(null)

  /**
   * Bumped when storage changes underneath a screen that has already read it.
   *
   * `Builds` reads the library once, when it mounts, which is right: it owns
   * that list while it is open. A build arriving in a link writes to storage
   * from outside it, and if the build manager happens to be the screen behind
   * the card it keeps showing the list it read before. Remounting it is the
   * honest fix; reaching into its state from here would give the same list two
   * owners.
   */
  const [libraryAt, setLibraryAt] = useState(0)

  /**
   * Keep this browser in step with the account.
   *
   * The redraw is deliberately coarse and reuses `libraryAt`, the remount key
   * right above, which exists for exactly this class of problem: storage
   * changing underneath a list that has already read it. Sync is that, arriving
   * from another device rather than from a share link.
   *
   * The theme, the wallpapers and the frame are re-read as well, because they
   * are the things held in state up here rather than read fresh by whoever
   * draws them. A theme chosen on a phone should not wait for a reload.
   *
   * Setting them here does put them back through the effects that persist
   * them, which would stamp an arriving change as though this device had made
   * it. `writeStamped` is what makes that harmless: a write of the value
   * already stored is not a change and is not stamped, so the two devices stop
   * rather than trading the same setting forever.
   */
  useSync(signedIn, () => {
    setLibraryAt((at) => at + 1)
    setTheme(readTheme())
    setWallpapers(readWallpapers())
    setRing(readFrame())
  })

  useEffect(() => {
    const take = () => {
      const payload = buildInUrl(window.location.hash)
      if (!payload) return
      // Cleared before the unpack rather than after, so a slow decode cannot
      // leave the link sitting in the address bar to be offered again on the
      // next reload. `replaceState` does not fire `hashchange`, so this cannot
      // re-enter.
      history.replaceState(null, '', window.location.pathname + window.location.search)
      unpackBuild(payload).then((build) => {
        if (build) setArrived(build)
      })
    }

    take()
    // Pasting a link into a tab that already has the tool open is a same
    // document navigation: nothing remounts and nothing reloads, so without
    // this the link would sit in the address bar doing nothing at all.
    window.addEventListener('hashchange', take)
    return () => window.removeEventListener('hashchange', take)
  }, [])

  /**
   * A published build, arriving as `/b/<id>`.
   *
   * The other half of the same feature as the fragment above. A fragment
   * carries the whole build and needs no server; a short link carries an id and
   * fetches one. Both end in the same place, which is `arrived`, so everything
   * downstream treats them identically.
   *
   * Mount only, and no listener: a short link is a real navigation, so the page
   * reloads and this runs again on its own.
   */
  useEffect(() => {
    const id = publishedInUrl(window.location.pathname)
    if (!id) return
    // Cleared first, for the same reason the fragment is: a reload should not
    // offer the same build again after it has been answered.
    history.replaceState(null, '', '/')
    void openPublished(id).then((build) => {
      if (build) setArrived(build)
    })
  }, [])

  /**
   * There is deliberately no `live` flag around that decode.
   *
   * There was one, and under `StrictMode` it swallowed every shared link:
   * React runs an effect twice in development, so the first run read the hash,
   * cleared it and started decoding, its cleanup set the flag false, the second
   * run found an empty hash and did nothing, and the decode then resolved into
   * a guard that was already closed. Settling state after an unmount is a
   * no-op in React 18 and later, so the flag was protecting against nothing and
   * costing the whole feature.
   */

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

  const startRun: typeof start = (weapon, aspect, path, build) => {
    start(weapon, aspect, path, build)
    setView('run')
  }

  const endRun: typeof end = (outcome) => {
    end(outcome)
    setView('builds')
  }

  // A run that has just ended leaves the run screen with nothing to draw.
  const screen: View = view === 'run' && !run ? 'builds' : view

  /**
   * One shell around every screen.
   *
   * The menu used to be a cell inside each screen's own header, which is how
   * there came to be screens with no menu at all and a Back button whose job
   * was to reach one. It is drawn once, here, outside the view, so it is on
   * every screen and every screen is one click from every other.
   *
   * `Hecate` moves out for the same reason: four copies of the same fixed
   * backdrop were four chances for them to drift apart.
   */
  const frame = (children: ReactNode) => (
    /* Every `Mark` on every screen reads its hover handlers out of here, so
     * this wraps the whole app rather than any one layout. */
    <PeekProvider>
    {/* The editor is a mode inside Builds rather than a view of its own, so it
      * names its own help topic from in there. This is what it names it to. */}
    <HelpProvider>
    <div className="app">
      <Hecate />
      <Menu
        view={screen}
        hasRun={Boolean(run)}
        onGo={setView}
        onEndRun={endRun}
        onShowBriefing={run ? openBriefing : undefined}
      />
      {/* The other corner. Where you go on the left, who you are on the right,
        * on every screen, which is the split that makes two of them worth
        * having. `ui/You.tsx` says why it is the full convention rather than a
        * quiet link. */}
      {ACCOUNTS_LIVE ? <You onGo={setView} /> : null}
      <div className="app-view">{children}</div>

      {/* One mark, every screen, because `frame` wraps all of them. It draws
        * nothing on a screen that has no explanation written for it. */}
      <PageHelp view={screen} />

      {/* A shared build covers whatever screen you were on, because it is a
        * question that has to be answered before anything else makes sense. */}
      {arrived ? (
        <Shared
          build={arrived}
          replaces={loadBuilds().find((one) => one.id === arrived.id) ?? null}
          onKeep={() => {
            saveBuild(received(arrived))
            setArrived(null)
            setLibraryAt((was) => was + 1)
            setView('builds')
          }}
          onDismiss={() => setArrived(null)}
        />
      ) : null}
    </div>
    </HelpProvider>
    </PeekProvider>
  )

  /**
   * A password reset, before anything else on the screen.
   *
   * First because somebody who clicked a link in an email has exactly one job,
   * and every other screen is in the way of it. It sits above the
   * `ACCOUNTS_LIVE` gate on purpose: a token exists only because a letter was
   * sent, a letter is sent only for a real account, and refusing to finish the
   * reset because a flag is off would be the trap the flag exists to prevent.
   *
   * `replaceState` on the way out takes the token off the address bar, so a
   * reload cannot replay a spent one into a confusing error and the URL is not
   * carrying a credential around after it has been used.
   */
  if (resetting) {
    return frame(
      <div className="shell is-wide">
        <ResetPassword
          arrival={resetting}
          onDone={() => {
            history.replaceState(null, '', window.location.pathname)
            setResetting(null)
            setView(ACCOUNTS_LIVE ? 'account' : 'builds')
          }}
        />
      </div>,
    )
  }

  /* The reading screens. Nothing on them is interactive, so they share one
   * branch and one shell rather than four of each. */
  const reading: Partial<Record<View, () => React.JSX.Element>> = {
    help: Help,
    roadmap: Roadmap,
    changelog: Changelog,
  }
  const Reading = reading[screen]
  if (Reading) {
    return frame(
      <div className="shell is-wide">
        <Reading />
      </div>,
    )
  }

  /* The rooms that are empty on purpose. One branch, because the only thing
   * that differs between them is the name over the door. */
  /**
   * The account room opens only when accounts are actually safe to hand a
   * stranger. `ACCOUNTS_LIVE` is false until password reset exists, because an
   * account with no way back in is a trap with a nice form on it. Until then
   * this stays one of Dora's empty rooms, which is the truthful state.
   */
  if (screen === 'account' && ACCOUNTS_LIVE) {
    return frame(
      <div className="shell is-wide">
        <Account />
      </div>,
    )
  }

  if (screen === 'friends' && ACCOUNTS_LIVE) {
    return frame(
      <div className="shell is-wide">
        <Friends />
      </div>,
    )
  }

  /**
   * The exchange, which is no longer one of Dora's empty rooms.
   *
   * Above the `unbuilt` map on purpose: that map still lists the rooms that are
   * genuinely empty, and leaving `exchange` in it with a branch above would be
   * two places disagreeing about whether a thing exists.
   */
  if (screen === 'exchange') {
    return frame(
      <div className="shell is-wide">
        <Exchange onGo={setView} />
      </div>,
    )
  }

  const unbuilt: Partial<Record<View, { title: string; phase: string }>> = {
    account: { title: 'Account', phase: 'Phase 4' },
    friends: { title: 'Friends', phase: 'Phase 4' },
    leaderboards: { title: 'Leaderboards', phase: 'Phase 4' },
  }
  const room = unbuilt[screen]
  if (room) {
    return frame(
      <div className="shell is-wide">
        <Unbuilt title={room.title} phase={room.phase} />
      </div>,
    )
  }

  if (screen === 'settings') {
    return frame(
      <div className="shell is-wide">
        <Settings />
      </div>,
    )
  }

  if (screen === 'themes') {
    return frame(
      <div className="shell is-wide">
        <Themes
          theme={theme}
          wallpapers={wallpapers}
          onTheme={setTheme}
          onWallpaper={(themeId, wallpaperId) => {
            const next = { ...wallpapers, [themeId]: wallpaperId }
            setWallpapers(next)
            writeWallpapers(next)
          }}
        />
      </div>,
    )
  }

  if (screen === 'arcana') {
    return frame(
      <div className="shell is-wide">
        <Arcana />
      </div>,
    )
  }

  if (screen === 'landing') {
    return frame(
      /* `is-wide` and not the plain shell: that one caps at 46rem, which
       * squeezed the landing's two columns to 296px each and made the page
       * 118px too tall to fit a screen. `is-wide` also scrolls itself rather
       * than the document, the way every other screen here does. */
      <div className="shell is-wide">
        <Landing onEnter={leaveLanding} />
      </div>,
    )
  }

  if (screen === 'builds') {
    return frame(
      <div className="shell is-wide">
        <Builds key={libraryAt} onGo={setView} />
      </div>,
    )
  }

  if (screen === 'setup' || !run) {
    return frame(
      <main className="shell">
        <header className="masthead">
          <div>
            <h1 className="wordmark">Enodia</h1>
            <p className="tagline">A build companion for Hades II, read at an Exit.</p>
          </div>
        </header>
        <Setup onStart={startRun} />
        <Colophon />
      </main>,
    )
  }

  const weapon = weapons.find((entry) => entry.id === run.weapon)
  const aspect = run.aspect ? traits.get(run.aspect) : null
  // The aspect's icon, falling back to the arm's cutout before an aspect is set.
  const aspectIcon = (run.aspect ? iconOf.get(run.aspect) : null) ?? weapon?.icon ?? null
  /**
   * The headline is builds, not targets.
   *
   * It counted duos and legendaries, which is the engine's unit and not the
   * player's: nobody sits at an Exit chasing Ripple Effect, they chase a build
   * that wants it. `engine/build-run.ts` asks the same question of a whole
   * build, and an aspect closes most of the field before the first Exit.
   */
  const standing = buildStanding(run, traits)
  const tally = buildTally(standing)

  /**
   * The build the run said it was going for, and how it is doing.
   *
   * This is the half the tally cannot give: a count says the field is still
   * open, and it does not say that the one thing you came for died two Exits
   * ago. The verdict carries its own sentence, so this only has to show it.
   */
  const chasing = run.build ? (standing.find((one) => one.build.id === run.build) ?? null) : null

  return frame(
    <div className="surface">

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
        <p className="topbar-exits" data-tour="topbar-exits">
          <span className="topbar-about">about</span>
          <strong>{run.exitsLeft}</strong>
          <span>Exits left</span>
        </p>

        {chasing ? (
          <p className={`topbar-chasing is-${chasing.verdict.state.toLowerCase()}`}>
            <span className="topbar-chasing-label">Going for</span>
            <strong>{chasing.build.name}</strong>
            <span className="topbar-chasing-why">{sayOf(chasing)}</span>
          </p>
        ) : null}

        {/* Small, and next to the thing it changes. Three options is a select's
          * job; the swatches it had in the menu were only there because the
          * ring was on another screen entirely. */}
        <label className="topbar-frame">
          <span className="visually-hidden">Which frame rings a bubble</span>
          <select value={ring} onChange={(event) => setRing(event.target.value)}>
            {FRAMES.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
          </select>
        </label>

        <p className="topbar-tally">
          <strong>{tally.open}</strong> builds open
          {tally.done ? <span className="topbar-done">{tally.done} built</span> : null}
          {tally.closed ? <span className="topbar-closed">{tally.closed} closed</span> : null}
        </p>

      </header>

      <aside className="railbar" data-tour="railbar" aria-label="Your slots">
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
    </div>,
  )
}



function Colophon() {
  return (
    <footer className="colophon">
      <p>
        Game data read from build <span className="mono">{gameVersion}</span>. Unofficial fan project, not
        affiliated with Supergiant Games.
        {KOFI ? (
          <>
            {' '}
            Free, and staying free.{' '}
            <a href={kofiUrl() ?? undefined} target="_blank" rel="noopener noreferrer">
              Chip in for hosting
            </a>
            .
          </>
        ) : null}
      </p>
    </footer>
  )
}
