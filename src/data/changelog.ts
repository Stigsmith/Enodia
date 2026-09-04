/**
 * What changed, for the person using it.
 *
 * Not the commit log. That has sixty-odd entries and most of them are about
 * extractors and CSS. Entries here are grouped by the day the work landed and
 * describe what is different on screen.
 *
 * Newest first.
 */

export type Release = {
  /** ISO date, so the page can format it however it likes */
  date: string
  title: string
  /** one line, what this batch covered */
  say: string
  points: string[]
}

export const CHANGELOG: Release[] = [
  {
    date: '2026-09-04',
    title: 'The build exchange, and what happens after you take one',
    say: 'Two shelves of other people’s builds, and runs that count toward the build they came from.',
    points: [
      'Two shelves: builds picked by hand, and builds from people you swapped codes with. There is no shelf of everything anybody published yet, because that needs a way to report and hide a listing first.',
      'Take a copy and it is an ordinary build of yours: your name on it, and none of somebody else’s runs.',
      'A run you log against a copy is counted toward the build it came from, which is where “1 of 1 cleared” on a listing comes from. It stops the moment you change the build, because it is your build then rather than theirs.',
      'Rating a build needs a run behind it, so a rating is always somebody saying how it went rather than how it read. The number of raters is always shown beside the average, because two people saying four is a different thing from two hundred.',
      'Logging a run now asks how dependably the build came together, and keeps the answer. It used to ask and throw it away.',
      'A switch in Settings turns the counting off. Everything else keeps working: you can still take builds, still log runs, still read the counts.',
      'Nothing else about you is counted anywhere. No analytics, nothing about what you look at or how long for.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'Accounts, short links, and your things on both devices',
    say: 'You can sign in now. It buys two things, and the tool still works entirely without it.',
    points: [
      'Sign in, and a build you publish gets a link about thirty characters long instead of the 1,588 character one that carries the whole build inside it. Discord renders the long one as a wall.',
      'Viewing, building, checking and saving are all still free and none of them asks who you are. An account is what gets you the rest.',
      'Your builds, your runs and your settings follow you between devices. Sign in on a phone and what you made on a desktop is already there. Where two devices disagree about the same build, the one changed most recently wins.',
      'It copies rather than moves. Everything still lives in this browser, everything still works signed out, and Settings still has the export.',
      'Friends, by swapping an eight character code. You see what they publish, they see what you publish, and nobody else sees either.',
      'There is no way to search for a person, which is deliberate: it means nobody can be found who did not want to be.',
      'Forgotten your password now sends a letter that actually arrives, from Dora, who has read it and has notes.',
      'Resetting signs out every other session, because people reset a password when they think somebody else has it.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'The About page is gone',
    say: 'It was saying what the front page already said.',
    points: [
      'Where the numbers come from moved into Help, at the top, because knowing the rules were read out of the game’s own files is the reason to trust the definitions underneath them.',
      'The menu had both About and What this is. It has one entry now, called About, and it opens the page a first visit opens on.',
      'The claim that nothing ever leaves your browser is gone from the few places it was still written. It was true, and publishing is the point at which it stops being.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Dora',
    say: 'None of this makes the tool better. It is going in anyway.',
    points: [
      'The sections that are not built yet used to be greyed out and unclickable. They open now, onto an empty page with Dora standing in it holding a clipboard. The phase marker is still there, so nothing is pretending.',
      'Dora has opinions about being clicked. She has eight of them and they escalate.',
      'On the fifth click she attempts a frightening voice. It does not hold.',
      'She also stands on the roadmap and watches it scroll past, which she is not being paid for.',
      'Her lines were written by reading the 763 she has in the game and copying none of them.',
      'This entry exists so that the changelog, which is a document about work, contains a note about the work of adding a ghost who does no work.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'The build editor, rebuilt',
    say: 'Most of the first round of playtest feedback, and the editor took the bulk of it.',
    points: [
      'Boons are sorted into two trays instead of picked from two lists. A boon is either in the build or worth adding, and it can no longer be in both at once.',
      'Drag a boon into a tray, or click it to send it into the build. Rows are larger and the game’s own plates sit behind them.',
      'The picker greys out anything a run could not give you, and says why on the row.',
      'A missing prerequisite now lists the boons that would satisfy it, says which of them would replace something you already hold, and adds the one you pick.',
      'Warnings jump to the control they are about rather than to the nearest tab, and put the cursor in it.',
      'The worst thing about a build is always visible in the left pane, whichever tab you are on.',
      'Hammer upgrades locked to one aspect no longer appear on the others, in the editor and in the run.',
      'The Arcana tab now refuses a board a save could not hold, matching the Arcana screen.',
      'Delete asks first.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Logging runs, and a bin',
    say: 'Recording how a build went, and getting one back after deleting it.',
    points: [
      'Log run, on an open build. Four answers: cleared or not, whether the build came together, the Fear, and where it ended. It says what it will record before it records it.',
      'Fear is only kept on a clear, and only when it beats what is already there.',
      'Deleting a build moves it to a bin rather than removing it. Put one back, remove one for good, or empty the bin.',
      'The bin travels with an export, so a restored browser still has its undo.',
      'Runs and clears use the game’s own steppers, the way Fear already did.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Reading a build',
    say: 'What the screens show, and what they show it on.',
    points: [
      'Hovering anything says what it is: boons on the game’s boon plate, keepsakes, familiars, Hexes and Arcana on its tooltip backing.',
      'The five core slots wear the game’s primary frame.',
      'Worth adding is drawn on both detail layouts, with the Olympians it would cost.',
      'The Constellation shows the build’s name.',
      'Copy the card puts a picture of the build on your clipboard, to paste beside the link. A link on its own cannot carry a preview without a server.',
      'A build can say what it leans on: Attack, Ω Attack, Cast and the rest.',
      'The Arcana card preview fills the middle of the screen instead of a thin strip.',
      'The roadmap counts how much of itself is built.',
      'Wallpapers renamed: Retribution, Hermes, Olympos, Hades chained, Pact of Punishment, Stygian Blade, The Cauldron.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'An empty library, and a longer run',
    say: 'Two corrections, one of them to a number a lot of the tool reads.',
    points: [
      'The library ships empty. The placeholder builds are gone: a placeholder in a library reads as a recommendation.',
      'A run is about forty Exits, not twelve. Four Regions of eight to twelve each. Everything that judges whether a build is still reachable was working against a third of a real run.',
      'A build may name a fifth Olympian. The cap of four is on the random pool, and a keepsake gets past it.',
      'Arcana on a build are a couple of suggestions rather than a whole board. Five at the outside.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Export, import and sharing',
    say: 'Ways to get your builds out of this browser and into another one.',
    points: [
      'Export everything to a file, from Settings. The button says how long it has been since the last export.',
      'Import a file. It replaces what is in the browser, and it tells you what the file holds before it writes anything.',
      'Share one build as a link, from the build’s own menu. The build is encoded in the link, so there is no server involved.',
      'A shared build does not carry the rating, runs or clears you recorded for it.',
      'Set a name in Settings. It is added to builds you make and travels with a build you share.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Themes',
    say: 'Four colour schemes, each with its own background, particles and wallpapers.',
    points: [
      'Unseen, Olympian, Infernal and Cthonic. Colours are taken from the game’s own art.',
      'Particle effects differ per theme: rising dust, falling motes, embers, and a static star field.',
      'Each theme has several wallpapers. Every one is dimmed so it does not compete with the interface.',
      'Buttons, panels and card frames shift colour with the theme.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Saved builds',
    say: 'Builds you make are now editable, forkable and removable.',
    points: [
      'Duplicate any build, including the eight samples.',
      'Delete a build from its own menu. It asks for confirmation.',
      'Record a rating, runs, clears and how reliably a build comes together. The win rate is calculated.',
      'Each build has a permanent id, so a build sent to another browser stays the same build.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Builds as the home screen',
    say: 'The app opens on your builds instead of on run setup.',
    points: [
      'The menu is available on every screen.',
      'On a desktop the menu can be pinned open as a side pane.',
      'The run header counts builds you can still complete, instead of counting duos and legendaries.',
      'You can pick a build before starting a run, and the run tracks it.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Arcana board',
    say: 'The full five by five board, in the game’s own layout.',
    points: [
      'Select the cards you pay Grasp for. The six free cards are worked out from that.',
      'Any free card that stays off explains which condition it fails.',
      'Hovering a card shows what it does.',
    ],
  },
  {
    date: '2026-08-30',
    title: 'Build manager and editor',
    say: 'A screen for browsing builds, and a form for making them.',
    points: [
      'Filter by arm, aspect, gods, keepsake and familiar. Filter options are derived from the builds themselves.',
      'A build opens as a Poster or a Constellation layout.',
      'The editor checks a build as you write it and lists anything the game would not allow.',
    ],
  },
  {
    date: '2026-08-29',
    title: 'Run companion completed',
    say: 'The remaining features for logging a run.',
    points: [
      'The offers at an Exit, ranked, with a reason to decline where there is one.',
      'A summary when you return to a run you left, showing what changed while you were away.',
      'Undo a mistaken entry without restarting the run.',
      'Keyboard and screen reader support across the run screen.',
    ],
  },
  {
    date: '2026-08-28',
    title: 'The run screen',
    say: 'Log each Exit as you take it and see what is still reachable.',
    points: [
      'Every duo and legendary evaluated against what you hold and how many Exits remain.',
      'Completion odds calculated by simulating runs, not estimated.',
      'Picks that close off a target are marked at the Exit where it happened.',
    ],
  },
  {
    date: '2026-08-27',
    title: 'Game data extraction',
    say: 'Reading the game’s own files, which everything else depends on.',
    points: [
      'All mechanics are read from the game’s shipped Lua rather than from wikis.',
      '37 duos and 10 legendaries, counted using the game’s own markers.',
      'Every boon, aspect and Arcana card matched to its art from the game packages.',
    ],
  },
]
