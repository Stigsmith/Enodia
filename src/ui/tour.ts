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
   * A `data-tour` value to press before the step is shown.
   *
   * So a step can open the thing it is about rather than describing something
   * you cannot see. She names five tabs and then walks you through them, which
   * is the difference between a list and being shown round.
   *
   * It presses whatever a person would press, so nothing here has to know what
   * a tab is or reach into a screen's own state.
   */
  press?: string
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
      say: 'New one starts there. None of this is a recommendation, mind. It is all yours, and it stays in this browser unless you send it somewhere.',
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
      say: 'Five tabs across the top, and you press them. That is how you get at everything. Here, I will show you.',
    },
    {
      press: 'tab-boons',
      at: 'editor-panel',
      say: 'Boons. The five slots along the top, then everything else and this arm’s hammer upgrades, all in one list. Press a slot to see only what fits it.',
    },
    {
      press: 'tab-loadout',
      at: 'editor-panel',
      say: 'Before you go. The arm, the aspect, and what you are carrying in with you. One of each, chosen once.',
    },
    /**
     * Why the split is worth explaining, and the fact that makes it free.
     *
     * `loadBearing` in `repeat.ts` leaves `optional` out of the reading
     * entirely, and its comment says why: it is already declared as upside
     * rather than as the build, so counting it would be telling somebody off
     * for labelling their build correctly. Sorting honestly therefore costs
     * nothing, which is the part nobody would guess.
     */
    {
      at: 'editor-panel',
      say: 'The build is what it genuinely does not work without. Everything else goes in Worth adding, and being honest about that is free: whatever sits over there is not counted against the reading.',
    },
    /**
     * The owner's example, and the numbers behind it are the hammer charge in
     * `repeat.ts`: two named upgrades cost 3, and its tip records that a run
     * offers two hammers at most out of everything an arm has.
     */
    {
      at: 'editor-panel',
      say: 'Say you name two hammer upgrades. A run offers two at most, out of everything your arm has, so you are asking for both to land exactly as you wrote them. Lovely the once. Less lovely on the tenth go.',
    },
    {
      press: 'tab-arcana',
      at: 'editor-panel',
      say: 'Arcana. Not the whole board, just the cards worth bringing for this particular idea.',
    },
    {
      press: 'tab-notes',
      at: 'editor-panel',
      say: 'Notes. Its name lives here, which is the one thing it will refuse to save without. Further down there is a line for each pick, for why it is there. Type @ and you can name a boon right in the middle of a sentence.',
    },
    {
      press: 'tab-play',
      at: 'editor-panel',
      say: 'And how it has actually gone. Runs, clears, the highest Fear you cleared with it.',
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
      say: 'Fun thing. You can save a build carrying every warning it has got, so long as you tick that you read them. And if it is properly out of reach, the stars stop at one however many you gave it.',
    },
    /**
     * The closer.
     *
     * **A threat rather than a pronouncement**, which was the owner's fix and
     * the right one: she is a shade, haunting people is the one thing she is
     * actually qualified for, and it makes it personal instead of a sermon.
     * Sharing is the sting because sharing is where an impossible build stops
     * being your own problem.
     *
     * Six is checked rather than picked: `hardStop` fires above five Olympians.
     *
     * **This roar waits for a click rather than timing out.** Every other one
     * in the tool drops itself, because there a click means "poke again" and
     * a timer is the only way to stop somebody skipping the punchline. The tour
     * advances on clicks anyway, so here she can just hold it, and holding it
     * is funnier when it is the last thing you see.
     */
    {
      roar: 'SHARE A BUILD WITH SIX OLYMPIANS IN IT AND I WILL HAUNT YOU. NOT BRIEFLY. NOT SYMBOLICALLY. FOREVER.',
      say: 'No, seriously. Do not be an arse. Make builds somebody can recreate.',
    },
  ],

  arcana: [
    { at: 'arcana-grid', say: 'The board. All of it, in the game’s own positions.' },
    {
      at: 'arcana-grasp',
      say: 'You pay Grasp for what you pick, and the board will not let you overspend. Set the number to what your save actually holds. It starts at 30, which is the most anyone gets.',
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
      say: 'Export. One file, the lot of it. Nothing here is backed up anywhere, so that file is the only copy there is. Lose it and it is properly gone.',
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
    { say: 'Where the numbers came from first, though. One player, reading the game’s own files. Not a wiki.' },
    { say: 'And the build they were read out of is up there. When something goes stale, at least you know what it was true for.' },
    { say: 'So this page does my job. Thoroughly. In order. With headings.' },
    { say: 'I am the short version. We have an understanding.' },
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
