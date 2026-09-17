/**
 * What is built, what is planned, and what is not being worked on.
 *
 * `ROADMAP.md` is the version for whoever is developing this. This is the
 * version for whoever is using it: what a reader would notice, plus the items
 * that are stalled and the reason.
 *
 * No dates. This is a side project and any date given would be a guess.
 */

export type Stage = 'now' | 'next' | 'later' | 'waiting'

export type Plan = {
  title: string
  say: string
  stage: Stage
  /** for `waiting`, what it needs before it can move */
  on?: string
  /**
   * One path whose existence answers "is this built".
   *
   * **This file has gone false twice, and nothing could tell.** It says what
   * the tool does, nothing imports it for behaviour, so no test and no type can
   * fail when a claim stops being true. In September the exchange gained
   * following, offers, takedowns and per-version counts while this file still
   * described taking a copy, and the correction for the previous round of
   * exactly that is item 4a in `ROADMAP.md`.
   *
   * So each entry names a file, and `scripts/validate/roadmap.ts` holds it to
   * the stage: a built thing's file must exist, and a planned one's must not.
   * That catches both directions, and the second is the one that keeps
   * happening: something ships and nobody moves the entry.
   *
   * **Null is allowed and must be argued for.** Some claims are not about
   * whether a file exists: the library shipping empty is about the contents of
   * `SAMPLE_BUILDS`, not about whether it is there. Those carry `why` instead,
   * so an unprovable entry is a decision rather than an omission. The same
   * shape as `NO_ART` in `build-filter.icons.test.ts`.
   */
  proof: string | null
  /** Required when `proof` is null: why existence cannot answer it. */
  why?: string
}

export const STAGES: { id: Stage; name: string; say: string }[] = [
  { id: 'now', name: 'Built', say: 'Available in the app today.' },
  { id: 'next', name: 'Next', say: 'Being worked on, roughly in this order.' },
  { id: 'later', name: 'Planned', say: 'Intended, but not started.' },
  { id: 'waiting', name: 'Stalled', say: 'Not blocked by code.' },
]

export const ROADMAP: Plan[] = [
  // ---- built -------------------------------------------------------------
  {
    stage: 'now',
    title: 'Builds',
    proof: 'src/ui/BuildsScreen.tsx',
    say: 'One screen with two sides and a switch between them: yours, and everybody’s. Your side is your library, with filters for arm, aspect, gods, keepsake and familiar, the builds you follow beside your own, and the counts from the exchange on any of them that are published. Create your own, duplicate any build, and record how each has performed. A build names all four keepsakes a run gives you, in the order you take them, and the editor says out loud what the game would not allow rather than refusing to save.',
  },
  {
    stage: 'now',
    title: 'Run companion',
    proof: 'src/engine/build-run.ts',
    say: 'Log each Exit as you take it. Duos and legendaries are evaluated live, completion odds are simulated, and the header counts builds you can still complete. Say at the start which build you are going for, out of your own and the ones you follow, and its author’s note on a boon shows on that boon’s card at the Exit where you are offered it.',
  },
  {
    stage: 'now',
    title: 'Arcana board',
    proof: 'src/ui/Arcana.tsx',
    say: 'The full board. Select what you pay Grasp for and the six free cards resolve from that, with a reason given for each one that stays off.',
  },
  {
    stage: 'now',
    title: 'Themes, export and sharing',
    proof: 'src/ui/theme.ts',
    say: 'Four themes, a single export file for everything, and one build encoded in a shareable link.',
  },
  {
    stage: 'now',
    title: 'Accounts and short links',
    proof: 'src/state/publish.ts',
    say: 'Sign in and a published build gets a link about thirty characters long instead of the 1,588 character one that carries the whole build inside it. It also carries your things between devices and lets a run count toward the build you followed, for as long as your picks still match theirs. Viewing, building and saving stay account free.',
  },
  {
    stage: 'now',
    title: 'Build exchange',
    proof: 'src/ui/Exchange.tsx',
    say: 'Everybody’s side of Builds. Two shelves: everything anybody has published, and builds from people you swapped codes with. Your own listings and the builds you follow are on your side, where they always were, with their counts on their cards, and a listing of yours whose build you deleted is listed there with a way to put it back. You follow a build rather than copying it, so it stays theirs and their improvements reach you, and changing anything about it is what makes it your own. Runs you log count toward the build you followed while your picks still match theirs. One filter narrows the shelf to builds somebody other than the author has actually finished a run with.',
  },
  {
    stage: 'now',
    title: 'Leaderboards',
    proof: 'src/ui/Leaderboards.tsx',
    say: 'What people have followed, played and got through, counted. Everybody, or just the people you swapped codes with. Every board counts one thing and none of them is a rate or a score: a build followed more has been followed more, and nothing here knows whether it is good.',
  },
  {
    stage: 'now',
    title: 'What following protects you from',
    proof: 'src/state/offers.ts',
    say: 'Nobody else can rewrite a build in your library. A reworded note arrives on its own; a change to the picks is a different build, so you are told and you choose. Taking a build off the exchange does not delete it: it stays in the library of everyone following it and the link keeps working. And if an author replaces a build with a substantially different one, its counts start again rather than carrying over, with the old ones still shown as being from before the change.',
  },
  {
    stage: 'now',
    title: 'Managing what you published',
    proof: 'src/state/publish.ts',
    say: 'A build of yours that is on the exchange can be updated in place, so people following it get your new version instead of being orphaned on the old one. You can take it off the shelves and put it back. Replacing it with a substantially different build warns you first, and offers to publish it as a second build instead.',
  },
  {
    stage: 'now',
    title: 'Builds across your devices',
    proof: 'src/state/sync.ts',
    say: 'Signed in, your builds and runs follow you between devices. The newest version of each item wins, so a build edited on a phone and a different one on a desktop both survive.',
  },
  {
    stage: 'now',
    title: 'Friends',
    proof: 'src/ui/Friends.tsx',
    say: 'Swap an eight character code and you see each other’s published builds. There is no way to search for a person, so nobody can be found who did not want to be.',
  },
  {
    stage: 'now',
    title: 'Wiki',
    proof: 'src/ui/Wiki.tsx',
    say: 'Every boon, Hex, keepsake, aspect, hammer, Arcana card and familiar the tool knows, each with a record at its own address and an index of them all. All of it is read out of the game’s files, including what a duo needs, what a boon counts toward, whether a Pom can raise it, and whether its damage is on the list the game calls Olympian.',
  },
  {
    stage: 'now',
    title: 'What a boon actually does',
    proof: 'src/ui/StatLines.tsx',
    say: 'The lines the game prints under a boon’s sentence, which this tool never drew: Heaven Strike’s Blitz damage, Storm Ring’s bolts, Extended Family’s bonus for each god. 275 things carry at least one. A build does not know what rarity you will find a boon at, so where the number moves with rarity you get all four, in the game’s own colours. The holes in the game’s own sentences, where a # stood for a number, went from 193 to 27.',
  },
  {
    stage: 'now',
    title: 'Under the hood',
    proof: 'src/data/underhood.ts',
    say: 'Rules the game never states, sorted by how likely you were to find them yourself, and nothing opens unless you open it. Every entry names the code it was read from, and the two that are our opinion rather than the game’s rule say so.',
  },
  {
    stage: 'now',
    title: 'Notes on the picks',
    proof: 'src/ui/MentionField.tsx',
    say: 'A line on any pick that needs one, shown wherever the pick is described and on its card at an Exit when a run is going for that build. Type @ in a build’s write-up to name a boon, a keepsake, an Arcana card or a familiar, and it links to its record in the wiki.',
  },
  {
    stage: 'now',
    title: 'Builds named in a write-up',
    proof: 'src/ui/BuildMention.tsx',
    say: 'Type @ to name a build you published or follow, or paste a build’s short link, and it links to the build. While you are logging a run, the name carries how that run stands with the build, the same sentence the run screen would give it. A build its author took down, or that is gone, says withdrawn.',
  },

  // ---- next --------------------------------------------------------------
  {
    stage: 'next',
    title: 'Real build definitions',
    proof: null,
    why: 'About what is inside SAMPLE_BUILDS, which is empty, not about whether a file exists.',
    say: 'The library ships empty. Placeholder builds were cut because a placeholder in a library reads as a recommendation. It needs builds that have actually been played, which is what the owner and the testers are writing now.',
  },
  {
    stage: 'next',
    title: 'Builds by aspect',
    proof: 'src/ui/BuildsByAspect.tsx',
    say: 'The filters can answer this now, one selection at a time. A dedicated view would show which builds remain available for a given aspect at a glance.',
  },
  {
    stage: 'next',
    title: 'Guides',
    proof: 'src/ui/Guides.tsx',
    say: 'A write-up in a few sections with builds named inside it, published like a build and read like one. It is what Collections became: a list of builds added little over the shelf and its filters, and a guide read during a run shows how that run stands with every build it names, so it reads differently at the fourth Exit than at the Crossroads. Its builds are whatever it names, in that order, and a note about somebody else’s build stays inside the guide.',
  },
  {
    stage: 'next',
    title: 'The last numbers that still read #',
    proof: null,
    why: 'A pass in the extractor rather than a screen, so no file’s existence answers it.',
    say: 'Eleven values in the game’s own text still show a # where a number belongs, because they are read from the per-weapon files and those are not loaded yet. Ten are Hex costs and one is a hammer’s charge stage. A # rather than a guess is the deliberate half of that.',
  },

  // ---- planned -----------------------------------------------------------
  {
    stage: 'next',
    title: 'Play history',
    proof: 'src/ui/PlayHistory.tsx',
    say: 'Every build now carries what it has actually done: how many runs cleared, how often, and the highest Fear it managed, and you can sort and filter your library on all three. What is still missing is the picture across the whole library rather than one build at a time: which gods, arms and build types you tend to avoid.',
  },
  {
    stage: 'later',
    title: 'Suggested builds',
    proof: 'src/engine/suggest.ts',
    say: 'A build picked for you, checked against the reachability engine first so it is never a suggestion that cannot be completed.',
  },
  {
    stage: 'later',
    title: 'Boon interaction data',
    proof: null,
    why: 'The deliverable is a curated data file rather than a module, and the validator only reads src/.',
    say: 'The game states each boon’s numbers, and in a few places it states what feeds what: the lists behind Olympian damage are read out of the files and are in the wiki already. What it never states is the rest of it, which boon makes another worth taking, and that has to be written by hand. Three features depend on it, including build archetypes.',
  },

  // ---- stalled -----------------------------------------------------------
  {
    stage: 'waiting',
    title: 'Build quality ratings',
    proof: null,
    why: 'A standing refusal rather than unbuilt work. No file will ever prove it, because shipping one would be the thing this says the tool will not do.',
    say: 'Everything mechanical comes from the game files. Whether a build is strong is not in any file, so the tool does not claim it.',
    on: 'Needs someone with enough play time to judge.',
  },
]
