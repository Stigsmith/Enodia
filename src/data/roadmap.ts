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
    title: 'Build manager',
    proof: 'src/ui/Builds.tsx',
    say: 'Browse builds with filters for arm, aspect, gods, keepsake and familiar. Create your own, duplicate any build, and record how each has performed.',
  },
  {
    stage: 'now',
    title: 'Run companion',
    proof: 'src/engine/build-run.ts',
    say: 'Log each Exit as you take it. Duos and legendaries are evaluated live, completion odds are simulated, and the header counts builds you can still complete.',
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
    say: 'Four shelves: everything anybody has published, builds from people you swapped codes with, your own listings, and the ones you follow. You follow a build rather than copying it, so it stays theirs and their improvements reach you, and changing anything about it is what makes it your own. Runs you log count toward the build you followed while your picks still match theirs.',
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
    title: 'Owner builds in the run',
    proof: null,
    why: 'The step exists in Setup.tsx. What is missing is builds to choose from, which is the item above.',
    say: 'Starting a run already asks which build you are going for, and the run tracks it from there. What is missing is anything to choose from that is not your own: the library ships empty, so the list is whatever you have made on that aspect.',
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
    say: 'The game states each boon’s numbers but not how boons feed each other. That has to be written by hand. Three features depend on it, including build archetypes.',
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
