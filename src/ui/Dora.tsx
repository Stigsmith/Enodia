import { useEffect, useState } from 'react'

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

/**
 * Things Dora says, written in her voice rather than taken from it.
 *
 * **Mimicked, not quoted.** `NPCData_Dora.lua` holds 763 lines of her dialogue
 * and none of them are reproduced here. `CLAUDE.md` says to use the game's own
 * words for *terminology*, which is Boon and Exit and Location; a character's
 * script is somebody's writing and copying it into a product is a different
 * thing entirely. So these are new lines that sound like her.
 *
 * What her actual lines sound like, from reading them: flat, unhurried, and
 * faintly put out at the suggestion of effort. Short sentences. Trailing off.
 * She calls Melinoe "Mel" and treats every request as negotiable. Her running
 * bit is doing a big spooky-ghost voice and then dropping it immediately, and
 * she has a whole set of barks for being stood too close to.
 *
 * That last one is why clicking her escalates. The game already made that joke.
 */
const IDLE = [
  'Not built yet. I am told this is a later problem, which is my favourite kind.',
  'Nothing here. I checked twice, which is once more than the job needed.',
  'This one is still on the list. The list is long and I am one shade.',
  'Empty. I could pretend to be busy in here if that helps.',
  'Not done. I have a clipboard about it, if you want to see the clipboard.',
  'Still a plan. Plans are lovely. No lifting involved.',
]

/**
 * A line she says when poked, and optionally the bit she says first.
 *
 * `roar` is the ghost voice, in capitals, and `say` is her dropping it. They
 * were one string with the join written into the middle of it, which read
 * correctly and played wrong: the scare and the climb-down landed in the same
 * instant, so the joke was over before you could see there had been one.
 * Two fields, shown in order, with a hold between them.
 */
type Poke = { say: string; roar?: string }

/**
 * Poked once, twice, and then rather too many times.
 *
 * Ordered, and the last one repeats. Randomising would lose the joke: it only
 * works if she notices you are still doing it.
 */
const POKES: Poke[] = [
  { say: 'Hm.' },
  { say: 'Yes. Still nothing here.' },
  { say: 'You know poking me does not build it.' },
  { say: 'I am going to start charging.' },
  /**
   * The one where she tries it on.
   *
   * `roar` is a field on the line rather than an index checked elsewhere,
   * because an index is a second place to remember when somebody reorders the
   * list, and the whole joke is that the scare lands on this exact sentence.
   */
  { roar: 'WHO DARES DISTURB MY...', say: 'no, sorry. I cannot keep that up.' },
  { say: 'Personal space. Please.' },
  { say: 'We are just doing this now, are we.' },
  // The vocabulary rule fails on "room", and it is right to: it cannot tell
  // Dora squatting from a Location. There is an escape hatch and this did not
  // need it, which is the better outcome.
  { say: 'Fine. I live here now. You may visit.' },
]

/**
 * The other loop, for the mascot on the roadmap.
 *
 * Same joke, different grievance. The unbuilt pages have her standing in
 * nothing, so those lines are about there being nothing; here she is pinned to
 * the corner of a list of work that is not hers and not finished, so these are
 * about the list. The owner asked for a set that matches the page she is on
 * rather than the one the others are on, and this is the difference.
 *
 * Same shape: ordered, the last one repeats, and one of them is the ghost voice
 * she cannot keep up.
 */
const PLAN_POKES: Poke[] = [
  { say: 'Hm.' },
  { say: 'I am watching the list. It is not getting any shorter.' },
  { say: 'You could read it. That is what it is for.' },
  { say: 'Every line on there is somebody’s evening. Just so you know.' },
  { roar: 'BEHOLD, THE WORKS OF...', say: 'no. Sorry. It is a list of jobs.' },
  { say: 'Poking me does not move anything into Built.' },
  { say: 'I have checked. Twice. Still in Next.' },
  { say: 'Fine. I have added it to the list. Near the bottom.' },
]

/**
 * How long she holds the voice.
 *
 * **1600, up from 700.** At 700 the owner could not see it happen: the turn,
 * the capitals and the climb-down all arrived inside a fifth of a second and it
 * read as a flicker rather than as a bit. This is long enough to register as
 * her having a go, and short enough that it is still a slip rather than a mode.
 */
export const ROAR_MS = 1600

/**
 * The poke loop, shared by both of her.
 *
 * Two components wanted the same escalation with different lines, and the
 * second one having its own copy is how the two drift apart. One hook, and the
 * lines are the argument.
 *
 * **The hold is locked.** While she is doing the voice, poking does nothing:
 * the climb-down is the punchline and clicking past it before it arrives throws
 * the joke away. It unlocks itself, so there is nothing to get stuck behind.
 */
function usePoke(lines: Poke[]) {
  const [pokes, setPokes] = useState(0)
  const [dropped, setDropped] = useState(false)

  const line = pokes > 0 ? lines[Math.min(pokes - 1, lines.length - 1)]! : null
  const roaring = Boolean(line?.roar) && !dropped

  /**
   * The voice, then her dropping it, on a timer rather than on a click.
   *
   * Cleaned up on the way out, so poking again mid-hold cannot leave a stale
   * timeout to end the next one early.
   */
  useEffect(() => {
    setDropped(false)
    if (!line?.roar) return
    const stop = window.setTimeout(() => setDropped(true), ROAR_MS)
    return () => window.clearTimeout(stop)
  }, [line, pokes])

  return {
    say: line ? (roaring ? line.roar : line.say) : null,
    roaring,
    poke: () => {
      if (roaring) return
      setPokes((was) => was + 1)
    },
  }
}

/** The full page, for a section that does not exist yet. *//** The full page, for a section that does not exist yet. */
export function Unbuilt({ title, phase }: { title: string; phase?: string }) {
  /**
   * The idle line is picked from the title rather than at random.
   *
   * Random would change it on every re-render, which turns a joke into a
   * flicker. Keyed to the room, so Friends always says the same thing and the
   * four rooms do not all say the same thing.
   */
  const idle = IDLE[[...title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % IDLE.length]!

  const { say, roaring, poke } = usePoke(POKES)

  return (
    <div className="unbuilt">
      <div className="unbuilt-body">
        <h2>{title}</h2>
        <p className="unbuilt-say">{idle}</p>
        {phase ? <p className="unbuilt-phase">{phase}</p> : null}
      </div>

      <div className="unbuilt-her">
        {/* The game's own dialogue box, which is what it is for. It was tried
          * once behind the caveats bar and rejected: the crescent ornament is
          * baked in at 1.78:1 and a wide warning strip flattened the moon. A
          * speech box is close to its native shape, so here it fits. */}
        {say ? (
          <p className="dora-says" role="status">
            {say}
          </p>
        ) : null}

        <button
          type="button"
          className={`unbuilt-poke${roaring ? ' is-scared' : ''}`}
          data-tour="unbuilt-dora"
          title="Dora"
          aria-disabled={roaring || undefined}
          onClick={poke}
        >
          <img
            className="unbuilt-dora"
            src={roaring ? '/ui/dora-spooky.png' : '/ui/dora-hardhat.webp'}
            alt="Dora, who has nothing to add"
          />
        </button>
      </div>
    </div>
  )
}

/**
 * The mascot alone, for a page that has content of its own.
 *
 * Fixed to the viewport, so whatever it stands beside scrolls and she does not.
 *
 * **She answers back now.** She was `aria-hidden` decoration and the owner
 * wanted the poke loop the unbuilt pages already had, which is fair: she is the
 * same character in the same tool and being clickable in one place and inert in
 * another is the sort of inconsistency that reads as a bug. The loop is shared
 * with `Unbuilt` below, and only the lines differ.
 *
 * She stays out of the accessibility tree until she has something to say. A
 * screen reader announcing a decorative image beside every roadmap item is
 * noise; a line of dialogue somebody deliberately asked for is not.
 */
export function DoraWatching() {
  const { say, roaring, poke } = usePoke(PLAN_POKES)

  return (
    <div className="dora-watching">
      {say ? (
        <p className="dora-says" role="status">
          {say}
        </p>
      ) : null}

      <button
        type="button"
        className={`dora-watching-poke${roaring ? ' is-scared' : ''}`}
        title="Dora"
        aria-disabled={roaring || undefined}
        onClick={poke}
      >
        <img
          src={roaring ? '/ui/dora-spooky.png' : '/ui/dora-hardhat.webp'}
          alt={say ? 'Dora, who has been poked' : ''}
          aria-hidden={say ? undefined : true}
        />
      </button>
    </div>
  )
}
