/**
 * What Dora says, step by step, and what she is pointing at while she says it.
 *
 * ## Why this is steps rather than paragraphs
 *
 * The first version put three lines on a black rectangle. It explained the page
 * accurately and it was the wrong shape: a wall of text over a page you could
 * no longer see is a manual, not a companion. A step names **one thing** and
 * lights it, so the words only have to say why it matters. The pointing does
 * the rest.
 *
 * ## The voice
 *
 * Hers in register, none of it hers in fact. `NPCData_Dora.lua` holds 763 lines
 * of her dialogue and none are reproduced; see `Dora.tsx` for the reasoning,
 * which has not changed.
 *
 * **Nudged further into her since the first pass.** Shorter sentences.
 * Fragments. The odd aside that explains nothing. What has not moved is the
 * rule that earns it: **the fact lands in the first clause**, every time. She
 * can be as put upon as she likes afterwards. A step that leaves somebody still
 * not knowing what a thing does has taken their time and given nothing back,
 * and that is true however funny it was.
 *
 * ## Anchors
 *
 * `at` is a `data-tour` value, not a class. A class is a styling decision and
 * gets renamed by styling work; an attribute whose only job is this cannot be
 * renamed by accident, and it shows up in the markup as a sign that something
 * points here.
 *
 * **A step whose anchor is not on the page is dropped, not shown empty.** An
 * empty library has no cards to point at, and a tour that lights nothing while
 * insisting there is something there is worse than a tour that is one step
 * shorter.
 *
 * A step with no `at` at all is deliberate: it is about the page as a whole, it
 * gets no cutout, and she stands in the middle to say it.
 */

export type Step = {
  /** the `data-tour` value she stands beside, or nothing for a whole-page line */
  at?: string
  say: string
  /**
   * The ghost voice, said first and in capitals, before she drops it and says
   * `say` instead.
   *
   * Same field and same behaviour as the poke loop in `Dora.tsx`, which is
   * where the joke started. A step with one of these holds, ignores clicks
   * while it holds, and moves itself on.
   */
  roar?: string
}

export const TOURS: Record<string, Step[]> = {
  builds: [
    { say: 'Everything you have made, as cards. This is the shelf.' },
    {
      at: 'builds-tools',
      say: 'Filters up here. Arm, aspect, which gods are in it. And the order they come in.',
    },
    {
      at: 'builds-card',
      say: 'The word under each name says how much has to go right to actually put it together. Not encouragement. Just the reading.',
    },
    {
      at: 'builds-new',
      say: 'New one starts there. None of this is a recommendation, mind. It is all yours, and it lives in this browser and nowhere else.',
    },
    {
      at: 'builds-bin',
      say: 'Deleted ones wait in here a while. In case you change your mind. I usually do.',
    },
  ],

  editor: [
    {
      at: 'editor-tray',
      say: 'What the build holds, all on one side. This is the answer. The middle is where you change it.',
    },
    {
      at: 'editor-tabs',
      say: 'Five tabs. Loadout, boons, the Arcana, your notes, and how it has actually gone.',
    },
    {
      at: 'editor-rail',
      say: 'Anything standing between you and a save turns up here. And nothing is written down until you press it, so poke about.',
    },
    {
      at: 'editor-reading',
      say: 'This is the honest one. How much luck the whole build needs, and then exactly where the luck goes.',
    },
    /**
     * The closer, and the fact in it is real.
     *
     * `caveats` in `BuildEditor.tsx` are the warnings that do not stop a save,
     * only make you tick that you read them, and a hard stop is one of those
     * rather than a blocker. `ratingCeiling` then returns 1 for any build with
     * a hard stop, whatever is stored against it. So: you can save it, you have
     * to admit you read the warning, and it will never show more than a star.
     */
    {
      at: 'editor-rail',
      say: 'Fun thing. You can save a build carrying every warning it has got. You only have to tick that you read them, which is this tool making you say it out loud.',
    },
    {
      say: 'And if it is properly out of reach, the stars stop at one. However many you gave it. It keeps your number and shows mine.',
    },
    {
      roar: 'AND YET YOU WOULD HAND THIS TO SOMEBODY. SIX OLYMPIANS. FOUR KEEPSAKES. A PRAYER. THEY WILL DIE IN EREBUS AND THEY WILL THINK IT WAS THEIR FAULT.',
      say: 'No, seriously. Do not be an arse. Make builds somebody can actually get to.',
    },
  ],

  arcana: [
    { at: 'arcana-grid', say: 'The board. All of it, in the game’s own positions.' },
    {
      at: 'arcana-grasp',
      say: 'You pay Grasp for what you pick. You do not have unlimited Grasp. I did check.',
    },
    {
      at: 'arcana-bases',
      say: 'Six cost nothing and switch themselves on when their neighbours line up. Point at one and it says what it is still waiting for.',
    },
  ],

  themes: [
    { at: 'theme-grid', say: 'Four looks. Colours, weather, wallpaper.' },
    {
      say: 'They change nothing about how any of this works. That is the entire feature. I am not going to dress it up for you.',
    },
  ],

  settings: [
    {
      at: 'setting-name',
      say: 'Your name. It travels with anything you share, so people know whose build they are looking at.',
    },
    {
      at: 'setting-export',
      say: 'Export. One file, the lot of it. No server behind any of this, so that file is the only copy there is. Lose it and it is properly gone.',
    },
    {
      at: 'setting-import',
      say: 'Import replaces what is here. Not a merge. Replaces. It tells you what is in the file before it touches anything.',
    },
  ],

  /**
   * The page that does her job, at length, in order.
   *
   * No anchors: it is a reference and the whole page is the point, so there is
   * nothing to single out. Three lines, standing in the middle.
   */
  help: [
    { say: 'The reference. Every state, band and percentage on the run screen, written out properly.' },
    { say: 'So this page does my job. Thoroughly. In order. With headings.' },
    { say: 'I am the short version. We have an understanding.' },
  ],

  about: [
    {
      at: 'about-standfirst',
      say: 'Who made this and where the numbers come from. One player, reading the game’s own files. Not a wiki.',
    },
    {
      at: 'about-version',
      say: 'That is the build it was all read out of. When something goes stale, at least you know what it was true for.',
    },
  ],

  roadmap: [
    { at: 'plan-bar', say: 'Built, next, stuck. The bar counts the first against the first three.' },
    { say: 'No dates. It is a side project, and a date would be a guess in a nice coat.' },
    {
      at: 'dora-watching',
      say: 'And that is me. Pinned to the corner so the plan scrolls past and I do not. Nobody asked.',
    },
  ],

  changelog: [
    { at: 'changelog-log', say: 'What changed. Newest at the top, so you can stop reading whenever.' },
    { say: 'There is an entry in there about me. I did not ask for that either.' },
  ],

  setup: [
    { say: 'Arm, then aspect, then which way you are heading. That is the whole setup.' },
    {
      at: 'setup-from-build',
      say: 'Start from a build if you have one in mind, and the run will know what you are chasing.',
    },
  ],

  run: [
    {
      at: 'topbar-exits',
      say: 'Roughly how much run is left. Four Regions, so it is an estimate and it says so.',
    },
    {
      at: 'railbar',
      say: 'Log each Exit as you take it. That is the whole job, and it is the only thing I will ask of you.',
    },
    {
      at: 'standing-handle',
      say: 'What you are still chasing lives in here. A pick can close things off, and when one does it says so at the pick that did it. Not four Exits later.',
    },
    { say: 'Got something wrong? Take the entry back. Everything after it works itself out again.' },
  ],

  /**
   * The four empty pages, sharing one tour.
   *
   * The vocabulary rule bans "room" and is right to: it cannot tell Dora
   * squatting from a Location. Reworded rather than escaped, which is the call
   * `Dora.tsx` made and the better one.
   */
  unbuilt: [
    { say: 'You pressed the help mark. On a page with nothing on it. To find out about the page with nothing on it.' },
    { at: 'unbuilt-dora', say: 'There is nothing here. Just me, and a hat I did not pick.' },
    { say: 'I admire the commitment, though.' },
  ],
}
