/**
 * Help: the questions the tool cannot answer by being used.
 *
 * **Where the numbers come from, then what they mean.** Those are the two halves
 * and they belong in that order: a reader who does not know the rules were read
 * out of the game's own files has no reason to trust the definitions under them.
 *
 * The first section arrived here when the About page was binned. About had four
 * sections and three of them were already said elsewhere: the disclaimer word
 * for word in the landing fine print, the refusal to judge a build in the
 * roadmap, and a "your things stay here" promise that the landing page had
 * already dropped for making a promise with an expiry date. Provenance was the
 * one thing only About said, so provenance is the one thing that moved.
 *
 * **Every definition here is the one the engine actually implements**, not a
 * friendly approximation of it: a help page that rounds off a rule is worse than
 * none, because it is believed.
 */

import { gameVersion } from '../data/app.ts'
import { Page } from './Pages.tsx'

export function Help() {
  return (
    <Page
      broad
      title="Help"
      standfirst="Where the numbers come from, and what each term on the run screen means. These are the rules as the tool implements them."
    >
      {/* Two columns on a wide screen, because **this page was never too narrow**.
        * Measured before any of it: a line of body copy here ran to 113
        * characters at 1600px, against the 45 to 75 a reader is comfortable
        * with. It was two screens tall because there is a lot of it, not
        * because the column was thin, so widening would have made the reading
        * worse and the scrolling barely better. Columns put half of it beside
        * the other half: 104 characters a line now, and one screen. */}
      <div className="ref-cols">
        <section className="ref">
          <h3 className="ref-rule">Where the numbers come from</h3>
          <p className="ref-say">
            Hades II ships its logic as plain-text Lua. Everything mechanical in this tool is read
            out of those files rather than from a wiki or a guide: which boons occupy which slot,
            what every duo requires, how many Olympians a run allows, and how a boon&rsquo;s value
            changes as you stack it.
          </p>
          <p className="ref-say">
            Read from game build <span className="ref-mono">{gameVersion}</span>. When the game
            patches, the data is extracted again and the differences are reviewed rather than
            accepted.
          </p>
          <p className="ref-say">
            Every image here is the game&rsquo;s own, used to point at the thing it depicts.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The four states</h3>
          <p className="ref-say">
            Every duo and legendary sits in one of four, judged against what you are holding and how
            many Exits you have left.
          </p>
          <dl className="ref-list">
            <div className="ref-item is-good">
              <dt>Yours</dt>
              <dd>Every prerequisite is in hand. There is nothing left to do about it.</dd>
            </div>
            <div className="ref-item">
              <dt>Open</dt>
              <dd>
                Still reachable. There are enough Exits left, and every god it needs can still turn
                up.
              </dd>
            </div>
            <div className="ref-item is-risk">
              <dt>At risk</dt>
              <dd>
                Reachable, and only just. Either it needs as many picks as you have Exits, or it
                needs a god who has not appeared yet and you have nothing to spare.
              </dd>
            </div>
            <div className="ref-item is-dead">
              <dt>Closed</dt>
              <dd>
                Not reachable this run. A slot is taken by something else, or the four Olympian
                places are settled and the god it needs is not among them.
              </dd>
            </div>
          </dl>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The three bands</h3>
          <p className="ref-say">
            A rough read on how comfortable an open target is, before any simulation is run.
          </p>
          <dl className="ref-list">
            <div className="ref-item">
              <dt>Likely</dt>
              <dd>
                You have at least twice as many Exits left as the picks it needs, and every god it
                wants has already turned up.
              </dd>
            </div>
            <div className="ref-item">
              <dt>Possible</dt>
              <dd>The Exits are there, but not many to spare.</dd>
            </div>
            <div className="ref-item">
              <dt>Long shot</dt>
              <dd>
                It needs a swap, or it needs more than the Exits comfortably allow. Not impossible,
                which is a different word.
              </dd>
            </div>
          </dl>
        </section>

        <section className="ref">
          <h3 className="ref-rule">The percentages</h3>
          <p className="ref-say">
            A percentage next to a target is <strong>measured, not asserted</strong>. The tool plays
            out hundreds of legal runs from where you are standing, following the game&rsquo;s own
            rules about what an Exit can offer, and reports how often that target came together.
          </p>
          <p className="ref-say">
            Only the closest handful get one, because each is real work, and none of them appears
            until you open the drawer that shows them.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Why a boon can be closed</h3>
          <p className="ref-say">
            This is the thing the tool exists for. There are five core slots, and only 45 boons
            occupy one: nine per slot, one per Olympian. <strong>A filled slot blocks every other
            god&rsquo;s boon for that slot</strong>, so taking a Cast from one god quietly closes the
            Cast from all the others, and with it every duo that needed one.
          </p>
          <p className="ref-say">
            It is not quite a proof of impossible. A swap can still arrive, at long odds, and only
            while what you hold can still be upgraded. A boon already at its best rarity locks its
            slot outright.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Builds open</h3>
          <p className="ref-say">
            The number at the top of a run counts <strong>builds you could still finish</strong>,
            not duos. Nobody sits at an Exit chasing a prerequisite; they chase a build that happens
            to want one. Choosing an aspect settles most of the field before the first Exit, which
            is the point of the number.
          </p>
        </section>

        <section className="ref">
          <h3 className="ref-rule">Grasp, and the six free cards</h3>
          <p className="ref-say">
            Six Arcana cost nothing and switch themselves on when the rest of the board satisfies
            them. You choose what you pay Grasp for; the board works out the rest and every card
            that stays dark says why.
          </p>
          <p className="ref-say">
            Two of them can never be on together: one wants three cards or fewer, the other wants at
            least five. That conflict is most of the reason there are only a few shapes worth having.
          </p>
        </section>
      </div>
    </Page>
  )
}
