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
 * Poked once, twice, and then rather too many times.
 *
 * Ordered, and the last one repeats. Randomising would lose the joke: it only
 * works if she notices you are still doing it.
 */
const POKES: { say: string; spooky?: boolean }[] = [
  { say: 'Hm.' },
  { say: 'Yes. Still nothing here.' },
  { say: 'You know poking me does not build it.' },
  { say: 'I am going to start charging.' },
  /**
   * The one where she tries it on.
   *
   * `spooky` is a flag on the line rather than an index checked elsewhere,
   * because an index is a second place to remember when somebody reorders the
   * list, and the whole joke is that the scare lands on this exact sentence.
   */
  { say: 'WHO DARES DISTURB MY... no, sorry, I cannot keep that up.', spooky: true },
  { say: 'Personal space. Please.' },
  { say: 'We are just doing this now, are we.' },
  // The vocabulary rule fails on "room", and it is right to: it cannot tell
  // Dora squatting from a Location. There is an escape hatch and this did not
  // need it, which is the better outcome.
  { say: 'Fine. I live here now. You may visit.' },
]

/**
 * How long she holds the scare.
 *
 * Long enough to register, short enough that it reads as a slip rather than a
 * state. She drops the voice mid-sentence in the line itself, so the picture
 * should drop it about as fast.
 */
const SCARE_MS = 700

/** The full page, for a section that does not exist yet. */
export function Unbuilt({ title, phase }: { title: string; phase?: string }) {
  /**
   * The idle line is picked from the title rather than at random.
   *
   * Random would change it on every re-render, which turns a joke into a
   * flicker. Keyed to the room, so Friends always says the same thing and the
   * four rooms do not all say the same thing.
   */
  const idle = IDLE[[...title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % IDLE.length]!

  const [pokes, setPokes] = useState(0)
  const [scared, setScared] = useState(false)
  const line = pokes > 0 ? POKES[Math.min(pokes - 1, POKES.length - 1)]! : null

  /**
   * She turns for a moment on the line where she tries the voice.
   *
   * The timer is cleaned up on the way out, so poking again mid-scare restarts
   * it rather than leaving a stale timeout to end the next one early.
   */
  useEffect(() => {
    if (!line?.spooky) return setScared(false)
    setScared(true)
    const stop = window.setTimeout(() => setScared(false), SCARE_MS)
    return () => window.clearTimeout(stop)
  }, [line, pokes])

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
        {line ? (
          <p className="dora-says" role="status">
            {line.say}
          </p>
        ) : null}

        <button
          type="button"
          className={`unbuilt-poke${scared ? ' is-scared' : ''}`}
          data-tour="unbuilt-dora"
          title="Dora"
          onClick={() => setPokes((was) => was + 1)}
        >
          <img
            className="unbuilt-dora"
            src={scared ? '/ui/dora-spooky.png' : '/ui/dora-hardhat.webp'}
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
 * `aria-hidden` because she is decoration: a screen reader announcing "image"
 * beside every roadmap item is noise, and she carries no information the page
 * does not already state in words.
 */
export function DoraWatching() {
  return <img
      className="dora-watching"
      data-tour="dora-watching"
      src="/ui/dora-hardhat.webp"
      alt=""
      aria-hidden="true"
    />
}
