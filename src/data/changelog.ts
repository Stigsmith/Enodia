/**
 * What changed, for the person using it.
 *
 * **Not the commit log.** The history has sixty-odd entries and most of them
 * are about extractors, contrast ratios and CSS that was wrong. A reader
 * wants to know what is different on their screen, so entries are grouped by
 * the day the work landed and written in terms of what it does.
 *
 * Newest first, because that is the only order anybody reads a changelog in.
 */

export type Release = {
  /** ISO date, so the page can format it however it likes */
  date: string
  title: string
  /** one line, what this batch was about */
  say: string
  points: string[]
}

export const CHANGELOG: Release[] = [
  {
    date: '2026-09-01',
    title: 'Sharing, and a way out',
    say: 'The tool keeps everything in one browser, so this is the release that lets you get it back out again.',
    points: [
      'Export everything you have made to a file, from Settings. It says how long it has been since the last one, and starts saying it in amber after a week.',
      'Import a file back, which replaces what is here. It tells you what is in the file and what will go before it writes anything.',
      'Share one build as a link. Open a build, then Share in its menu. The whole build travels in the link itself, so there is no server and no account, and it is short enough to paste into a chat.',
      'A shared build carries no rating, runs or clears. Those are how a build has gone for you, and they stay with you.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Four themes',
    say: 'The tool can stand in one of four places now, and each one is a palette, a light, a weather and a set of pictures.',
    points: [
      'Unseen, Olympian, Infernal and Cthonic, each with its own colours taken from the game’s own art.',
      'Particles differ by more than colour: dust rises, pollen falls, embers flicker, and Cthonic’s stars hold still.',
      'Every theme ships several wallpapers, and each one is dimmed by measurement rather than by eye, so nothing behind the tool is ever brighter than the tool.',
      'The game draws its own dialogue plate twice, once by default and once for Olympus, and both are where those two themes get their metal.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Builds you own',
    say: 'A saved build stopped being a note and became a thing with an identity.',
    points: [
      'Duplicate any build, including the eight samples, which were read-only until now.',
      'Delete from the build’s own menu, and it asks first.',
      'Record how a build has played: a rating, runs, clears and how dependably it comes together. The win rate is worked out, never typed.',
      'Every build carries a stable id, so one sent to another install stays the same build.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Builds first',
    say: 'The tool used to open on "pick an arm". It opens on your builds now, because choosing one is the thing it is for.',
    points: [
      'The menu is on every screen, and nothing needs a Back button to reach it.',
      'On a desktop the menu can be a pop-out or a pinned pane down the side.',
      'The run counts builds you could still finish, rather than counting duos and legendaries you might not care about.',
      'Pick a build before a run and the tool says how that build is doing while you play.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'The Arcana board',
    say: 'The game’s five by five, in the game’s own positions, with the six free cards worked out rather than clicked.',
    points: [
      'Pick what you pay Grasp for and the board says which of the six switch themselves on.',
      'Every card that stays dark says why, in the game’s own terms.',
      'Point at any card to read what it does.',
    ],
  },
  {
    date: '2026-08-30',
    title: 'A build manager, and a builder',
    say: 'Five layouts went up so the shape of a build could be argued about, and two survived.',
    points: [
      'The overview filters and sorts by arm, aspect, gods, keepsake and familiar, and every filter derives itself from the builds themselves.',
      'A build opens as a Poster or a Constellation, whichever you prefer.',
      'Build your own, with the checker saying out loud what the game would not allow.',
    ],
  },
  {
    date: '2026-08-29',
    title: 'The run, finished',
    say: 'Everything the run surface was supposed to do by the end of the first phase.',
    points: [
      'What an Exit offers, ranked, with the reason a pick is worth refusing.',
      'A re-entry card when you come back to a run you left, saying what moved while you were away.',
      'Correcting a mis-tap costs one tap rather than the run.',
      'The whole surface answers to a keyboard and to a screen reader.',
    ],
  },
  {
    date: '2026-08-28',
    title: 'The run on screen',
    say: 'The first thing that was useful: a path you log as you go, with what each pick closed marked where it happened.',
    points: [
      'Every duo and legendary judged live against what you hold and how many Exits are left.',
      'Odds measured by simulating legal runs rather than asserted.',
      'The Cast-slot lockout that started this whole project, stated where it happens.',
    ],
  },
  {
    date: '2026-08-27',
    title: 'Reading the game',
    say: 'Before any of it, the part nobody sees: the game’s own files, read rather than guessed at.',
    points: [
      'Every mechanic comes out of the game’s shipped Lua, checked against its own markers rather than against a wiki.',
      '37 duos and 10 legendaries, because the game marks both itself and counting prerequisites gets it wrong.',
      'Every boon, aspect and card matched to the game’s own art.',
    ],
  },
]
