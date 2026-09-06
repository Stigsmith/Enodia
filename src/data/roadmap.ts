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
    say: 'Browse builds with filters for arm, aspect, gods, keepsake and familiar. Create your own, duplicate any build, and record how each has performed.',
  },
  {
    stage: 'now',
    title: 'Run companion',
    say: 'Log each Exit as you take it. Duos and legendaries are evaluated live, completion odds are simulated, and the header counts builds you can still complete.',
  },
  {
    stage: 'now',
    title: 'Arcana board',
    say: 'The full board. Select what you pay Grasp for and the six free cards resolve from that, with a reason given for each one that stays off.',
  },
  {
    stage: 'now',
    title: 'Themes, export and sharing',
    say: 'Four themes, a single export file for everything, and one build encoded in a shareable link.',
  },
  {
    stage: 'now',
    title: 'Accounts and short links',
    say: 'Sign in and a published build gets a link about thirty characters long instead of the 1,588 character one that carries the whole build inside it. It also carries your things between devices and lets a run count toward a build you took. Viewing, building and saving stay account free.',
  },
  {
    stage: 'now',
    title: 'Build exchange',
    say: 'Two shelves of other people’s builds: ones picked by hand, and ones from people you swapped codes with. Take a copy and it is an ordinary build of yours, and a run you log against it counts toward the build it came from.',
  },
  {
    stage: 'now',
    title: 'Builds across your devices',
    say: 'Signed in, your builds and runs follow you between devices. The newest version of each item wins, so a build edited on a phone and a different one on a desktop both survive.',
  },
  {
    stage: 'now',
    title: 'Friends',
    say: 'Swap an eight character code and you see each other’s published builds. There is no way to search for a person, so nobody can be found who did not want to be.',
  },

  // ---- next --------------------------------------------------------------
  {
    stage: 'next',
    title: 'Real build definitions',
    say: 'The library ships empty. Placeholder builds were cut because a placeholder in a library reads as a recommendation. It needs builds that have actually been played, which is what the owner and the testers are writing now.',
  },
  {
    stage: 'next',
    title: 'Builds by aspect',
    say: 'The filters can answer this now, one selection at a time. A dedicated view would show which builds remain available for a given aspect at a glance.',
  },
  {
    stage: 'next',
    title: 'Owner builds in the run',
    say: 'Starting a run already asks which build you are going for, and the run tracks it from there. What is missing is anything to choose from that is not your own: the library ships empty, so the list is whatever you have made on that aspect.',
  },

  // ---- planned -----------------------------------------------------------
  {
    stage: 'later',
    title: 'Play history',
    say: 'Which builds you have played and how they went is already recorded. The next step is summarising it: which gods, arms and build types you tend to avoid.',
  },
  {
    stage: 'later',
    title: 'Suggested builds',
    say: 'A build picked for you, checked against the reachability engine first so it is never a suggestion that cannot be completed.',
  },
  {
    stage: 'later',
    title: 'Boon interaction data',
    say: 'The game states each boon’s numbers but not how boons feed each other. That has to be written by hand. Three features depend on it, including build archetypes.',
  },

  // ---- stalled -----------------------------------------------------------
  {
    stage: 'waiting',
    title: 'Build quality ratings',
    say: 'Everything mechanical comes from the game files. Whether a build is strong is not in any file, so the tool does not claim it.',
    on: 'Needs someone with enough play time to judge.',
  },
  {
    stage: 'waiting',
    title: 'Leaderboards',
    say: 'Not who plays best. Who has shared the most, whose builds get taken up, that sort of thing, because the tool has no way to judge the first and no business claiming it.',
    on: 'Waiting on a shelf of everything published. The exchange holds a hand-picked set and your friends, and neither is a field to rank.',
  },
]
