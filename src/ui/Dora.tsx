/**
 * Dora, in a hard hat, standing where a screen is not built yet.
 *
 * ## Why the unbuilt menu items became clickable
 *
 * They were `disabled`, which is honest and dead. A greyed row tells you a
 * thing exists and refuses to say anything else, and there were four of them:
 * Build exchange, Account, Friends, Leaderboards. Clicking one now opens the
 * room, and the room is empty apart from Dora, who is holding a clipboard and
 * has clearly been told the same thing you have.
 *
 * The marker stays. The menu still says which phase it belongs to and the page
 * says it again, so nothing here pretends the feature is coming sooner than it
 * is. The change is that "not yet" is now something you can walk into rather
 * than something that refuses to be clicked.
 *
 * ## The mascot on the roadmap
 *
 * Same character, different job. On the roadmap she is fixed to the viewport
 * rather than to the page, so the plan scrolls past her and she does not move.
 * She is facing left, which is where the roadmap is, so she reads as watching
 * it go by.
 */

/** The full page, for a section that does not exist yet. */
export function Unbuilt({ title, phase }: { title: string; phase?: string }) {
  return (
    <div className="unbuilt">
      <div className="unbuilt-body">
        <h2>{title}</h2>
        <p className="unbuilt-say">
          Not built yet. Dora has the clipboard and is as informed as you are.
        </p>
        {phase ? <p className="unbuilt-phase">{phase}</p> : null}
      </div>

      <img className="unbuilt-dora" src="/ui/dora-hardhat.webp" alt="" />
    </div>
  )
}

/**
 * The mascot alone, for a page that has content of its own.
 *
 * Fixed to the viewport, so whatever it stands beside scrolls and she does not.
 * `aria-hidden` because she is decoration: a screen reader announcing "image"
 * beside every roadmap item is noise, and she carries no information the page
 * does not already state in words.
 */
export function DoraWatching() {
  return <img className="dora-watching" src="/ui/dora-hardhat.webp" alt="" aria-hidden="true" />
}
