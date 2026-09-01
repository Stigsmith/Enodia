/**
 * What is coming, what is not, and what is waiting on a person.
 *
 * `ROADMAP.md` is the version for whoever is working on this. **This is the
 * version for whoever is using it**, which is a different document: it says
 * what a reader would notice, and it is honest about the two things a roadmap
 * usually hides, which are what has been given up on and what is stuck.
 *
 * Nothing here carries a date. A date on an unpaid side project is a promise
 * nobody has any business making.
 */

export type Stage = 'now' | 'next' | 'later' | 'waiting'

export type Plan = {
  title: string
  say: string
  stage: Stage
  /** for `waiting`, the thing it is waiting on, in plain words */
  on?: string
}

export const STAGES: { id: Stage; name: string; say: string }[] = [
  { id: 'now', name: 'Working now', say: 'Built, and on the screen today.' },
  { id: 'next', name: 'Next', say: 'What is being worked on, roughly in order.' },
  { id: 'later', name: 'Later', say: 'Real plans, with nothing started.' },
  { id: 'waiting', name: 'Waiting on somebody', say: 'Not blocked by code.' },
]

export const ROADMAP: Plan[] = [
  // ---- now ---------------------------------------------------------------
  {
    stage: 'now',
    title: 'The build manager',
    say: 'Every build, filtered by arm, aspect, gods, keepsake and familiar. Build your own, duplicate any of them, and keep a record of how each has played.',
  },
  {
    stage: 'now',
    title: 'The run companion',
    say: 'Log an Exit as you take it. Every duo and legendary judged live, the odds measured rather than asserted, and the builds you could still finish counted at the top.',
  },
  {
    stage: 'now',
    title: 'The Arcana board',
    say: 'The game’s five by five, with the six free cards worked out from what you paid for and every dark card saying why.',
  },
  {
    stage: 'now',
    title: 'Themes, export and sharing',
    say: 'Four themes, a file with everything in it, and one build in a link short enough for a chat.',
  },

  // ---- next --------------------------------------------------------------
  {
    stage: 'next',
    title: 'Builds worth reading',
    say: 'The eight in the tool are samples. They are mechanically real and they are not recommendations, and the library needs builds somebody has actually played.',
  },
  {
    stage: 'next',
    title: 'Your own name on a build',
    say: 'A name you pick, stored here and nowhere else, that travels with a build you share so the person receiving it knows whose it is.',
  },
  {
    stage: 'next',
    title: 'Which builds an aspect can still reach',
    say: 'The overview answers it by hand today. A veteran wants it at a glance: pick an aspect, see what is still open to it.',
  },

  // ---- later -------------------------------------------------------------
  {
    stage: 'later',
    title: 'What you keep avoiding',
    say: 'The tool already records which builds you played and how they went. The useful half is the other one: which gods, which arms and which shapes you never take.',
  },
  {
    stage: 'later',
    title: 'Surprise me',
    say: 'A build you would not have picked, checked for reachability before it is offered, so it is never a plan that is dead on arrival.',
  },
  {
    stage: 'later',
    title: 'What a boon actually does',
    say: 'The game states its numbers but not what feeds what. Writing that down by hand is the largest job left, and three separate features are waiting on it.',
  },
  {
    stage: 'later',
    title: 'A build exchange',
    say: 'Sharing works one link at a time. A place to put builds so other people can find them needs somewhere to put them, which means a server, which this has deliberately not had.',
  },

  // ---- waiting -----------------------------------------------------------
  {
    stage: 'waiting',
    title: 'Live on the web',
    say: 'The build runs from any plain static host and is ready to go up.',
    on: 'One deploy, which is the owner’s to run.',
  },
  {
    stage: 'waiting',
    title: 'Which builds are actually good',
    say: 'Everything mechanical comes out of the game’s files. Whether a build is worth playing is not in any file and this tool will not pretend otherwise.',
    on: 'Someone who has played enough to say so.',
  },
  {
    stage: 'waiting',
    title: 'Accounts, and builds that follow you',
    say: 'Everything lives in one browser today. Moving between devices means an account, and an account means a server and somebody paying for it.',
    on: 'A decision about whether this should cost anything to run.',
  },
]
