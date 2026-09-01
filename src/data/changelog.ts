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
