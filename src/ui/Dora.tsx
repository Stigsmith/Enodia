import { useEffect, useState } from 'react'

import { kofiUrl } from '../data/kofi.ts'

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
type Poke = {
  say: string
  roar?: string
  /**
   * A word of `say` to turn into the Ko-fi link.
   *
   * The word rather than the markup, so `say` stays a plain string and the two
   * cannot drift apart. Matched on its first occurrence and left alone if it is
   * not there, which is what makes editing the line safe.
   */
  tip?: string
}

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
    /* Not while she is roaring: that is `roar`, a different sentence, and the
     * word is not in it. */
    tip: line && !roaring ? line.tip : undefined,
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
        /* The tour points here to say "that is me over there". On the button
         * rather than the wrapper, so it lights her and not the speech box
         * above her, which may be empty at the time. */
        data-tour="dora-watching"
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

/**
 * The lines for the landing page, where she asks for a tip.
 *
 * A third set rather than a third copy of the loop. `usePoke` is the same one
 * the other two use; only the lines differ, which is the arrangement the hook
 * exists for.
 *
 * Nectar and Ambrosia because those are what you give somebody in this game
 * when you like them. Asking for money in a fan tool reads as a hand out;
 * asking for a drink reads as her.
 */
const TIP_POKES: Poke[] = [
  { say: 'Hm.' },
  { say: 'Still here. Still owed a drink, by my reckoning.' },
  { say: 'A tip. That is all. Nectar, Ambrosia, whatever is going.' },
  /**
   * The one the owner wrote, and the shape the mechanic was already built for:
   * the voice lands on its own sentence and the climb-down is a separate one,
   * so the scare and the apology never arrive together.
   */
  {
    roar: 'OR I WILL HAUNT YOUR OFFSPRING',
    say: 'but seriously. If you love the tool, a tip would be appreciated.',
    /* The one line where she means it, so it is the one that can be clicked. */
    tip: 'tip',
  },
  { say: 'That was the whole bit. There is not a second bit.' },
  { say: 'I am going to start charging for the poking as well.' },
]

/**
 * One word of a line, turned into the Ko-fi link.
 *
 * Returns the string untouched when there is no word to link, no handle to
 * point at, or the word is not in the line, so an edit to her copy can only
 * ever lose the link rather than break the render.
 */
function linkTip(text: string, word: string | undefined, url: string | null) {
  if (!word || !url) return text
  const at = text.indexOf(word)
  if (at < 0) return text

  return (
    <>
      {text.slice(0, at)}
      <a className="dora-says-tip" href={url} target="_blank" rel="noopener noreferrer">
        {word}
      </a>
      {text.slice(at + word.length)}
    </>
  )
}

/**
 * Dora on the landing page: her column, and the ask underneath it.
 *
 * **Two elements, not one, and they are not siblings on the page.** She stands
 * in the third column beside the two text ones; her paragraphs run the full
 * width below all three. So this returns a fragment and `.landing` places both
 * by grid area. Wrapping them in a shared box would put her paragraph in a
 * column, which is where it was and is not where it goes.
 *
 * The bubble is back, and this time it has somewhere to be. It kept landing on
 * a paragraph before because the layout had no space for it; a column of her
 * own is that space. Its row is a fixed height so a longer line does not move
 * her, the way `.unbuilt-her` reserves a row for the same reason.
 *
 * **The paragraphs light up while she is talking.** She is small and off to one
 * side, and somebody poking her should get a cue somewhere they are already
 * reading rather than only in the corner.
 *
 * The link is a plain anchor and nothing is embedded: `data/kofi.ts` says why.
 * Draws nothing at all when there is no handle, so this cannot ship pointing at
 * a stranger.
 */
export function DoraAsking() {
  const { say, tip, roaring, poke } = usePoke(TIP_POKES)
  const url = kofiUrl()

  return (
    <>
      <div className="dora-col">
        {/* Always rendered, empty or not: a row that appears when she speaks is
          * a row that moves her picture every time somebody pokes her. */}
        <div className="dora-col-says">
          {say ? (
            <p className="dora-says" role="status">
              {linkTip(say, tip, url)}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className={`dora-col-poke${roaring ? ' is-scared' : ''}`}
          title="Dora"
          aria-disabled={roaring || undefined}
          onClick={poke}
        >
          <img
            src={roaring ? '/ui/dora-spooky.png' : '/ui/dora-hardhat.webp'}
            alt={say ? 'Dora, who has been poked' : 'Dora, who would like a tip'}
          />
        </button>
      </div>

      <div className={`dora-ask${say ? ' is-talking' : ''}`}>
        <p className="dora-ask-say">
          Do you have any idea how much work went into this? Neither do we, Dora and I stopped
          counting. A bottle of Nectar would not go unnoticed.
        </p>
        {url ? (
          <p className="dora-ask-do">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Buy us a Nectar
            </a>{' '}
            if the tool has been any use. It stays free either way.
          </p>
        ) : null}
      </div>
    </>
  )
}
