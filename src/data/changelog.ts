/**
 * What changed, for the person using it.
 *
 * Not the commit log. That has hundreds of entries and most of them are about
 * extractors and CSS. An entry here is a release: what is different on screen,
 * in a few short lines.
 *
 * **Every release has a version**, which the owner asked for on 3 October 2026.
 * `0.minor.patch`: the minor goes up for a release that adds something, the
 * patch for one that only fixes or corrects. Still 0, because the tool is not
 * finished and a 1.0 would say it was. `changelog.test.ts` holds the versions
 * to descending order and the newest to `package.json`.
 *
 * Newest first.
 */

export type Release = {
  version: string
  /** ISO date, so the page can format it however it likes */
  date: string
  title: string
  /** a few short lines, each one thing that changed */
  points: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: '0.35.0',
    date: '2026-10-04',
    title: 'A Nectar, if you are offering',
    points: [
      'Buy us a Nectar glows now, in the game’s own Nectar bottle.',
      'Every help tour ends on it, and the bottle sits beside Sign in.',
      'It is a plain link to Ko-fi. The tool stays free either way.',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-10-04',
    title: 'Guides are written in one rich field',
    points: [
      'One field in place of the prompted boxes: headings, bold, italic, underline, highlight, links, lists, quotes, tables, tips and warnings, and spoilers a reader opens on purpose.',
      'Type / for a menu of blocks, and @ to tag a boon, a card, a familiar, a build, and now a god, an arm or anybody you meet along the way.',
      'Dora keeps the empty field company until you start. Guides written before read exactly as they did.',
      'Text fields wear the theme everywhere, and the button each screen is asking for, like Write a guide or Publish, glows the way the help mark does.',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-10-03',
    title: 'The menu folds open, and the wiki’s pictures are bigger',
    points: [
      'Wiki, Settings and About fold open in the menu, so every page is listed there again: Under the hood, Appearance, How it works, this Changelog, the Roadmap and the Intro.',
      'With the menu pinned, Settings and About sit at the bottom of it.',
      'The Changelog has version numbers and shorter entries, and uses the width of a desktop screen.',
      'Settings uses more of a wide screen, and its boxes no longer run into each other.',
      'The wiki’s tiles are larger, and the gods and the people along the way wear the game’s own Codex portraits, sharp at any size.',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-10-02',
    title: 'A shorter menu, pages that fold, and a wiki you walk through',
    points: [
      'The menu is seven rows. The pages it dropped became tabs on the screens they belong to.',
      'The Roadmap, Help, Under the hood and the Changelog fold, one line per thing, so each fits on one screen.',
      'The wiki opens on ten large pictures, one per section. Point at one to light it, click to go in.',
      'A trail at the top of every wiki page says where you are, and every step of it is a way back.',
      'Switching sides on Builds or Guides swipes the page across.',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-10-02',
    title: 'Four ways to draw the interface',
    points: [
      'Settings can draw the buttons and panels in the game’s own art, or in Hairline, Carved or Soft.',
      'Boon icons, portraits, characters and wallpapers stay the same in all four.',
      'The three browser-drawn looks take their colours from your theme.',
      'The help mark is easier to find, and pings when a screen opens.',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-09-18',
    title: 'Guides',
    points: [
      'A new screen for writing with builds named inside it. Yours on one side, everybody’s on the other.',
      'Read a guide during a run and every build it names says how your run stands with it.',
      'What a guide is about is counted out of its writing. Nobody types tags.',
      'Save a guide, like it, or report it. A draft stays in this browser until you publish.',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-09-17',
    title: 'Builds is one screen, and a build can be named in a note',
    points: [
      'Your builds and the exchange are two sides of one screen, each remembering where you left it.',
      'Type @ to name a build in a write-up. During a run the name says how the run stands with it.',
      'Your own listings with no build behind them can be brought back in one press.',
      'Schelemeus stands on your side of Builds and Odysseus on the Wiki. Phones download neither.',
    ],
  },
  {
    version: '0.28.1',
    date: '2026-09-12',
    title: 'Help catches up',
    points: [
      'Help covers the wiki, boon numbers, keepsakes, notes and Olympian damage, in half the words.',
      'Its examples are drawn from real data, so one that goes stale shows it.',
      'The three screens not built yet open on Dora saying what each is waiting for.',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-09-12',
    title: 'Builds somebody else has finished',
    points: [
      'The exchange can show only builds cleared by another player, with the count on the button.',
      'Counts are kept per version, so changing the picks starts them again.',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-09-12',
    title: 'Under the hood is back, corrected',
    points: [
      'Rules the game never states, in three tiers of spoiler, beside the Wiki.',
      'One entry was wrong: a fifth Olympian is a keepsake away, not impossible. It says so now, with the line it was read from.',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-09-12',
    title: 'What counts as Olympian damage',
    points: [
      'Extended Family, Rallying Cry and Aspect of Persephone read one list of 63 projectiles and 3 effects.',
      'A build holding one of them says which of its picks are on the list. Wiki records say it too.',
      'The list includes Artemis and Athena, so which gods you hold does not answer it.',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-09-11',
    title: 'A note on each pick, and names that link',
    points: [
      'A line per pick in a build: why it is there. During a run it shows on the card at the Exit.',
      'Type @ to name a boon in a write-up. It is drawn with its art and links to its record.',
      'A run can go for builds you made or follow, not only ones that ship with the tool.',
      'A build’s notes share 500 characters, so it still fits in a Discord-sized link.',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-09-11',
    title: 'A wiki, read out of the game',
    points: [
      '597 records, each at its own address: boons, Hexes, keepsakes, aspects, hammers, Arcana and familiars.',
      'Each gives the game’s text and numbers, then what it never says: what a duo needs, whether a Pom raises it, which of your builds use it.',
      'Nothing in it is written by hand.',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-09-11',
    title: 'A build carries all four keepsakes',
    points: [
      'One for the Crossroads and one for each swap after the first three Guardians.',
      'Filtering by a keepsake finds builds that swap to it as well.',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-09-11',
    title: 'A boon says how much',
    points: [
      'The stat lines the game prints under a boon are shown, at all four rarities where they change.',
      'Most # gaps in descriptions have their number: 193 down to 27.',
      'Chaos boons give the range their numbers roll in.',
    ],
  },
  {
    version: '0.21.1',
    date: '2026-09-11',
    title: 'Coming back to the tab keeps what you had open',
    points: [
      'A background sync rebuilt the build screen and lost the open build, filters and unsaved edits. It no longer does.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-09-10',
    title: 'What a build is built around, and which keepsake helps',
    points: [
      'Each of the nine moves a build can lean on says what it is, in the game’s own words.',
      'A build with no keepsake lists the ones that would make its gods likelier.',
      'A listing on the exchange shows the author’s write-up.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-09-08',
    title: 'More shelves, leaderboards, and runs that count',
    points: [
      'Runs logged against most listings were being thrown away. They count now.',
      'Four shelves on the exchange: All, From friends, Mine and Followed.',
      'Leaderboards for what is followed, played and cleared most, and by whom.',
      'The hand-picked shelf is gone. You browse All instead.',
    ],
  },
  {
    version: '0.19.1',
    date: '2026-09-08',
    title: 'Two loose ends',
    points: [
      'Following a build counts toward its listing again.',
      'A listing taken down can be put back, from any of your devices.',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-09-07',
    title: 'Nobody else can rewrite a build in your library',
    points: [
      'An author’s new notes reach you. A change to the picks waits for you to accept it.',
      'Taking a build down hides it from the shelves and deletes nothing.',
      'Authors can update or take down what they published.',
    ],
  },
  {
    version: '0.18.1',
    date: '2026-09-07',
    title: 'Escape closes things, and Charon’s coins fit',
    points: [
      'Escape, or a click outside, closes what is on top.',
      'Charon’s coins are the right size and in the right place, and he always appears.',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-09-07',
    title: 'A shelf that holds hundreds',
    points: [
      'The exchange is full width, with cards or a list. A list shows twelve builds a screen.',
      'Charon moved out of the shelf’s way.',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-09-06',
    title: 'Follow a build rather than copying it',
    points: [
      'Opening a listing reads it. Follow keeps it the author’s and brings you their updates.',
      'Make it mine turns a followed build into your own.',
      'Your own runs and ratings no longer move your own listing’s numbers.',
      'Charon runs the exchange.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-09-06',
    title: 'Which vows a run took',
    points: [
      'A cleared run can record its vows and ranks, with the game’s own vow icons.',
      'The Roadmap, Help, Settings and this Changelog each fit on far fewer screens.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-09-04',
    title: 'The build exchange',
    points: [
      'Shelves of other people’s builds.',
      'A run logged against a build you took counts toward the original, unless you change it.',
      'Ratings need a run behind them, and always show how many people gave one.',
      'A switch in Settings turns the counting off. Nothing else is counted, anywhere.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-09-04',
    title: 'Accounts',
    points: [
      'Optional. Signing in gives a published build a short link, about 30 characters.',
      'Your builds, runs and settings follow you between devices.',
      'Friends, by swapping a code. There is no way to search for a person.',
      'Password reset by email, which signs out every other session.',
    ],
  },
  {
    version: '0.13.1',
    date: '2026-09-04',
    title: 'One page about the tool, not two',
    points: [
      'The About page is folded into the first page you see. Where the numbers come from moved to Help.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-09-02',
    title: 'Dora',
    points: [
      'Unbuilt sections open onto an empty page with Dora and a clipboard.',
      'She has eight opinions about being clicked, and they escalate.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-09-02',
    title: 'The build editor, rebuilt',
    points: [
      'Boons go into two trays, the build and worth adding, by drag or click.',
      'Anything a run could not give you is greyed out, with the reason.',
      'A missing prerequisite lists what would satisfy it and adds the one you pick.',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-09-02',
    title: 'Logging runs, and a bin',
    points: [
      'Log a run on a build: cleared, came together, Fear, and where it ended.',
      'Deleted builds go to a bin first.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-09-02',
    title: 'Reading a build',
    points: [
      'Hover anything to see what it is, on the game’s own plates.',
      'Copy the card puts a picture of the build on your clipboard.',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-09-01',
    title: 'A longer run, and an empty library',
    points: [
      'A run is about forty Exits, not twelve.',
      'A build may name a fifth Olympian.',
      'The library starts empty rather than with sample builds.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-09-01',
    title: 'Export, import and sharing',
    points: [
      'Export everything to a file, and import it again.',
      'Share one build as a link that carries the whole build.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-09-01',
    title: 'Themes',
    points: ['Unseen, Olympian, Infernal and Cthonic, each with its own colours, particles and wallpapers.'],
  },
  {
    version: '0.7.0',
    date: '2026-08-31',
    title: 'Saved builds',
    points: ['Builds can be duplicated, deleted and rated, with runs and clears recorded.'],
  },
  {
    version: '0.6.0',
    date: '2026-08-31',
    title: 'Builds as the home screen',
    points: ['The tool opens on your builds. The menu can be pinned as a side pane.'],
  },
  {
    version: '0.5.0',
    date: '2026-08-31',
    title: 'Arcana board',
    points: ['The full board in the game’s layout. Free cards say what they are waiting for.'],
  },
  {
    version: '0.4.0',
    date: '2026-08-30',
    title: 'Build manager and editor',
    points: ['Browse and filter builds, and an editor that checks a build against the game’s rules.'],
  },
  {
    version: '0.3.0',
    date: '2026-08-29',
    title: 'Run companion',
    points: ['Offers at an Exit ranked, a summary on return, and undo for a wrong entry.'],
  },
  {
    version: '0.2.0',
    date: '2026-08-28',
    title: 'The run screen',
    points: ['Log each Exit and see which duos and legendaries are still reachable.'],
  },
  {
    version: '0.1.0',
    date: '2026-08-27',
    title: 'Reading the game',
    points: ['Every mechanic read from the game’s own Lua: 37 duos and 10 legendaries, by the game’s markers.'],
  },
]
