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

  // ---- next --------------------------------------------------------------
  {
    stage: 'next',
    title: 'Real build definitions',
    say: 'The eight builds included are samples used to test the screens. They are mechanically valid but they are not recommendations. The library needs builds that have actually been played.',
  },
  {
    stage: 'next',
    title: 'Builds by aspect',
    say: 'The filters can answer this now, one selection at a time. A dedicated view would show which builds remain available for a given aspect at a glance.',
  },
  {
    stage: 'next',
    title: 'Owner builds in the run',
    say: 'The run currently counts only the sample builds. Builds you have made should count too, and should be selectable as a run target.',
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
  {
    stage: 'later',
    title: 'Build exchange',
    say: 'Sharing works one link at a time. A browsable collection would need somewhere to host builds, which means a server.',
  },

  // ---- stalled -----------------------------------------------------------
  {
    stage: 'waiting',
    title: 'Public deployment',
    say: 'The app builds to static files and runs on any static host.',
    on: 'Needs one deployment, which is the owner’s to run.',
  },
  {
    stage: 'waiting',
    title: 'Build quality ratings',
    say: 'Everything mechanical comes from the game files. Whether a build is strong is not in any file, so the tool does not claim it.',
    on: 'Needs someone with enough play time to judge.',
  },
  {
    stage: 'waiting',
    title: 'Accounts and sync',
    say: 'All data is stored in one browser. Using the tool across devices requires an account, and an account requires a server.',
    on: 'Needs a decision on whether to fund hosting.',
  },
]
