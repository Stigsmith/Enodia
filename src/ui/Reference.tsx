/**
 * Help: the questions the tool cannot answer by being used.
 *
 * **Where the numbers come from, then what they mean.** Those are the two halves
 * and they belong in that order: a reader who does not know the rules were read
 * out of the game's own files has no reason to trust the definitions under them.
 *
 * **Every definition here is the one the engine actually implements**, not a
 * friendly approximation of it: a help page that rounds off a rule is worse than
 * none, because it is believed.
 *
 * ## Rewritten on 12 September 2026, for two faults
 *
 * **It had gone out of date without anybody noticing.** It described the run
 * screen, the exchange and the leaderboards, and said nothing about the wiki,
 * the stat lines under a boon, the four keepsakes a build can name, the notes on
 * a build's picks, or what the game means by damage from Olympians. A help page
 * that stops at the features it was written for is worse than a short one.
 *
 * **And it was a wall.** Ten sections of paragraphs, the exchange alone running
 * to eight of them, at a length nobody reads twice. It is the same material in
 * lists and short sections now, and three things are shown rather than
 * described: the five slots wear the game's own glyphs, the rarity ladder is
 * the real component drawing Heaven Strike's real numbers, and the mention is a
 * real mention. **Nothing here is a screenshot**: every example is the live
 * component reading the live data, so a page that goes stale shows it.
 */

import { gameVersion, traits } from '../data/app.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import { SLOT_GLYPH } from './build-pieces.ts'
import { Page } from './Pages.tsx'
import { Prose } from './Prose.tsx'
import { StatLines } from './StatLines.tsx'

/** Heaven Strike, which is the example everywhere else in the documents too. */
const EXAMPLE = 'ZeusWeaponBoon'

export function Help() {
  const example = traits.get(EXAMPLE)

  return (
    <Page
      measure="broad"
      title="Help"
      standfirst="Where the numbers come from, and what each word on the screen means. These are the rules as the tool implements them, and the examples are live rather than drawn."
    >
      {/* Two columns on a wide screen. Measured before any of it: a line of body
        * copy here ran to 113 characters at 1600px, against the 45 to 75 a
        * reader is comfortable with, so this is about the number of sections
        * rather than the width of one. */}
      <div className="ref-cols">
        <section className="ref">
          <h3 className="ref-rule">Where the numbers come from</h3>
          <p className="ref-say">
            Hades II ships its logic as plain-text Lua, and everything mechanical here is read out
            of those files rather than from a wiki or a guide: which boons occupy which slot, what
            every duo needs, how a boon&rsquo;s numbers change with rarity, and what a Pom is worth
            to it.
          </p>
          <p className="ref-say">
            Read from game build <span className="ref-mono">{gameVersion}</span>. When the game
            patches, the data is extracted again and the differences are reviewed rather than
            accepted. Every image is the game&rsquo;s own, used to point at the thing it depicts.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The five slots, and why a boon closes</h3>
          <p className="ref-say">
            This is the thing the tool exists for. Only 45 boons occupy a slot, nine per slot, one
            per Olympian, and each slot holds one for the whole run.
          </p>
          <ul className="ref-slots">
            {CORE_SLOTS.map((slot) => (
              <li key={slot}>
                {SLOT_GLYPH[slot] ? <img src={`/${SLOT_GLYPH[slot]}`} alt="" /> : null}
                <span>{slotLabel(slot)}</span>
              </li>
            ))}
          </ul>
          <p className="ref-say">
            So taking a Cast from one god quietly closes the Cast from every other god, and with it
            every duo that needed one. It is not a proof of impossible: a swap can still arrive, at
            long odds, and only while what you hold can still be upgraded. A boon already at its
            best rarity locks its slot outright.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">What a boon&rsquo;s numbers mean</h3>
          <p className="ref-say">
            A boon&rsquo;s tooltip in the game is its sentence plus the lines under it, and both are
            here. A build cannot know what rarity you will find a boon at, so where the number moves
            with rarity you get the whole ladder in the game&rsquo;s own colours. This is Heaven
            Strike, drawn by the same component the hover uses:
          </p>
          {example?.stats?.length ? (
            <figure className="ref-figure">
              <StatLines lines={example.stats} spelled />
              <figcaption>{example.name}. Common, Rare, Epic, Heroic.</figcaption>
            </figure>
          ) : null}
          <p className="ref-say">
            A <span className="ref-mono">#</span> in one of the game&rsquo;s sentences is a number
            the tool cannot read yet. There are eleven left, and a <span className="ref-mono">#</span>{' '}
            rather than a guess is deliberate.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The four states</h3>
          <p className="ref-say">
            Every duo and legendary sits in one of four, judged against what you hold and how many
            Exits are left.
          </p>
          <dl className="ref-list">
            <div className="ref-item is-good">
              <dt>Yours</dt>
              <dd>Every prerequisite is in hand.</dd>
            </div>
            <div className="ref-item">
              <dt>Open</dt>
              <dd>Enough Exits left, and every god it needs can still turn up.</dd>
            </div>
            <div className="ref-item is-risk">
              <dt>At risk</dt>
              <dd>
                Reachable and only just: it needs as many picks as you have Exits, or a god who has
                not appeared and nothing to spare.
              </dd>
            </div>
            <div className="ref-item is-dead">
              <dt>Closed</dt>
              <dd>
                A slot it needed is taken by something else, or the god it needs is out of the
                random pool for the rest of the run.
              </dd>
            </div>
          </dl>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Likely, possible, long shot</h3>
          <p className="ref-say">
            A rough read on an open target before anything is simulated: twice as many Exits as
            picks and every god already seen is <strong>likely</strong>; enough Exits with little to
            spare is <strong>possible</strong>; needing a swap, or more Exits than you comfortably
            have, is a <strong>long shot</strong>. Not impossible, which is a different word.
          </p>
          <p className="ref-say">
            A percentage beside a target is <strong>measured, not asserted</strong>. The tool plays
            out hundreds of legal runs from where you are standing, by the game&rsquo;s own rules
            about what an Exit can offer, and reports how often that target came together. Only the
            closest handful get one, because each is real work.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Builds open</h3>
          <p className="ref-say">
            The number at the top of a run counts <strong>builds you could still finish</strong>,
            not duos. Nobody sits at an Exit chasing a prerequisite; they chase a build that happens
            to want one. Choosing an aspect settles most of the field before the first Exit.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">What a build can say</h3>
          <dl className="ref-list">
            <div className="ref-item">
              <dt>Four keepsakes</dt>
              <dd>
                One at the Crossroads and a swap at the rack after each of the first three
                Guardians, in the order a run gives them to you.
              </dd>
            </div>
            <div className="ref-item">
              <dt>A line on any pick</dt>
              <dd>
                Why it is there, shown wherever that pick is described, and on its card at the Exit
                where it is offered when a run is going for that build.
              </dd>
            </div>
            <div className="ref-item">
              <dt>Worth adding</dt>
              <dd>
                Picks that raise the ceiling without being the build. Nothing over there is counted
                against how hard the build is to assemble.
              </dd>
            </div>
          </dl>
          <p className="ref-say">
            Type <span className="ref-mono">@</span> in any of a build&rsquo;s writing to name
            something from the game. It is stored as the thing rather than as its name, so it
            survives a patch renaming it, and it becomes a link to that thing&rsquo;s record:
          </p>
          <figure className="ref-figure">
            <p className="ref-say">
              <Prose text={`Take @[Heaven Strike](t:${EXAMPLE}) before anything else.`} />
            </p>
            <figcaption>A mention, as it is drawn.</figcaption>
          </figure>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The wiki, and Under the hood</h3>
          <p className="ref-say">
            Every boon, Hex, keepsake, aspect, Daedalus Hammer, Arcana card and familiar the tool
            knows has a record at its own address, so a link to one opens it. The records are
            generated: what a duo needs, what a boon counts toward, how much of an element it takes,
            whether a Pom can raise it, and whether its damage is on the list the game calls
            Olympian.
          </p>
          <p className="ref-say">
            Under the hood is the other half: rules the game never states, sorted by how likely you
            were to find them yourself, and nothing opens unless you open it.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Grasp, and the six free cards</h3>
          <p className="ref-say">
            Six Arcana cost nothing and switch themselves on when the rest of the board satisfies
            them. You choose what you pay Grasp for, the board works out the rest, and every card
            that stays dark says why. Two of them can never be on together: one wants three cards or
            fewer and the other wants at least five.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The exchange</h3>
          <dl className="ref-list">
            <div className="ref-item">
              <dt>Four shelves</dt>
              <dd>
                Everything published, builds from people whose codes you swapped, your own listings,
                and the ones you follow. The last two keep builds that have been taken down.
              </dd>
            </div>
            <div className="ref-item">
              <dt>Follow, not copy</dt>
              <dd>
                A build you follow stays its author&rsquo;s and sits in your library marked as
                theirs. Changing anything forks it into a build of your own and ends the following.
              </dd>
            </div>
            <div className="ref-item">
              <dt>What reaches you</dt>
              <dd>
                A better note or a clearer name simply arrives. A change to the picks is a different
                build, so you are told, shown what changed, and asked.
              </dd>
            </div>
            <div className="ref-item">
              <dt>Taken down</dt>
              <dd>
                Off the shelves so nobody new finds it. It stays in the library of everybody
                following it, the link keeps working, and the counts stay.
              </dd>
            </div>
            <div className="ref-item">
              <dt>Counts, never a score</dt>
              <dd>
                Takes, runs, clears, the best Fear anybody cleared with it, and a rating with the
                number of raters beside it. A rating needs a run behind it. Replace a build with a
                substantially different one and its counts start again, with the old ones still
                shown and marked as from before.
              </dd>
            </div>
            <div className="ref-item">
              <dt>Cleared by somebody else</dt>
              <dd>
                One filter, over one count: at least one clear on the version on the shelf now,
                logged by somebody other than whoever published it. Nobody grants it, and it is
                never called Verified.
              </dd>
            </div>
          </dl>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Leaderboards, and what they do not say</h3>
          <p className="ref-say">
            The same counts, put beside each other: followed most, played most, cleared most, at the
            highest Fear, everybody or just the people whose codes you swapped.
          </p>
          <p className="ref-say">
            <strong>Every board counts one thing.</strong> None is a rate and none adds two numbers
            into a score. Five clears from five runs would beat ninety from a hundred, which is a
            claim about how much evidence there is rather than about the builds. A board with
            nothing in it is not drawn, and there are no zeroes on any of them.
          </p>
        </section>
      </div>
    </Page>
  )
}
