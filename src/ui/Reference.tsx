/**
 * Help and About: the two questions the tool cannot answer by being used.
 *
 * **Help explains the four words and the three bands**, because those are the
 * whole vocabulary of the run surface and nothing on screen has room to define
 * them. Every definition here is the one the engine actually implements, not a
 * friendly approximation of it: a help page that rounds off a rule is worse
 * than none, because it is believed.
 *
 * **About says where the numbers come from and who owns the art.** The tool
 * reads the game's own shipped files, and it is somebody's fan project, and
 * both of those are things a reader is owed on one page rather than in a
 * footnote.
 */

import { gameVersion } from '../data/app.ts'
import { Page } from './Pages.tsx'

export function Help() {
  return (
    <Page
      title="Help"
      standfirst="Every word the run surface uses, and what the engine means by it. These are the rules as implemented, not a friendlier version of them."
    >
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
    </Page>
  )
}

export function About() {
  return (
    <Page
      title="About"
      standfirst="An in-run build companion for Hades II, made by a player, reading the game’s own files."
    >
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
      </section>

      <section className="ref">
        <h3 className="ref-rule">What it will not tell you</h3>
        <p className="ref-say">
          Whether a build is <em>good</em> is not in any file, and this tool does not pretend
          otherwise. It will say what the game would not allow, what is still reachable, and what a
          pick closed. It will not tell you a build is strong, and the eight builds it ships with
          are samples for testing the screens, labelled as such.
        </p>
      </section>

      <section className="ref">
        <h3 className="ref-rule">Your things stay here</h3>
        <p className="ref-say">
          There is no account and no server. Every build, run and setting lives in this
          browser&rsquo;s own storage and is sent nowhere. Nothing is tracked and nothing is
          measured about you.
        </p>
        <p className="ref-say">
          That has a cost worth knowing: clearing this browser&rsquo;s data takes everything with
          it. Settings has an export, and it says how long it has been since you used it. A build
          shared as a link carries the build inside the link itself, which is why that works
          without a server too.
        </p>
      </section>

      <section className="ref">
        <h3 className="ref-rule">The disclaimer</h3>
        <p className="ref-say">
          An unofficial fan project, free, non-commercial, and not affiliated with or endorsed by
          Supergiant Games. Hades II, its art and its text are theirs. Every image here is the
          game&rsquo;s own, used to point at the thing it depicts.
        </p>
      </section>
    </Page>
  )
}
