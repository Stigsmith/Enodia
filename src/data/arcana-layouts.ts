/**
 * Base Arcana layouts. **Three, and they are yours to fill.**
 *
 * The owner's read: there are only one to three base combinations worth
 * knowing, and a build asking for one, two or three specific cards is really
 * asking you to swap those into a base you already run. So the page shows the
 * bases and what a swap costs, rather than pretending every set of five is a
 * fresh decision.
 *
 * ## What goes in `cards`
 *
 * **Only the cards you pay Grasp for.** The six conditional ones are worked out
 * from what else is on, and listing one here would be stating an outcome as an
 * input. `engine/arcana.ts` derives them; `arcana-layouts.test.ts` will tell
 * you which came on.
 *
 * ## What the test does when you fill one
 *
 * Every filled layout is checked, and it reports rather than judges:
 *
 *   - every id is a real card, and is one you pay for
 *   - the Grasp total, so you can see it against your own limit
 *   - which conditionals came on, and why each of the rest did not
 *
 * It fails only on the impossible: an unknown id, or a conditional card listed
 * as an input. **Which cards belong in a base is yours** and no test will have
 * an opinion about it, the same rule the builds follow.
 *
 * ## The one conflict worth knowing before you start
 *
 * Judgment goes dark above three paid cards. The Centaur needs one card of
 * every cost 1 to 5, so at least five. **No layout can have both**, which is
 * most of why the number of sensible bases is small. `arcana.test.ts` proves
 * it rather than asserting it here.
 */

/** One base, and the swaps a build might ask of it. */
export type ArcanaLayout = {
  id: string
  /** what you call it */
  name: string
  /** one line: what this base is for */
  say: string
  /**
   * The cards you pay Grasp for, by id.
   *
   * Ids, not names, because a name is display text and can be localised. The
   * page and the test both resolve them, so a wrong one is caught rather than
   * rendered as a blank.
   */
  cards: string[]
}

/**
 * Empty on purpose.
 *
 * These are the owner's to write, exactly like `data/curated/builds.json`. The
 * page shows all three whether or not they are filled and says plainly which
 * are waiting, because an empty slot that admits it is better than a
 * placeholder somebody mistakes for a recommendation.
 */
export const ARCANA_LAYOUTS: ArcanaLayout[] = [
  { id: 'base-1', name: '', say: '', cards: [] },
  { id: 'base-2', name: '', say: '', cards: [] },
  { id: 'base-3', name: '', say: '', cards: [] },
]

/** A layout nobody has written yet. */
export const isBlank = (layout: ArcanaLayout): boolean =>
  !layout.name.trim() && layout.cards.length === 0
