/**
 * The first screen a stranger sees, and the only one that has to sell anything.
 *
 * ## It sells, it does not block
 *
 * `REQUIREMENTS.md` 5 settled the gate at its loosest: viewing is free,
 * creating is free, saving locally is free, and an account is only needed to
 * publish. So this is a page you walk through, not a door you knock on. There
 * is no form on it, nothing is disabled behind it, and the way in is the first
 * control on the page rather than the last.
 *
 * The alternative, which most tools pick, is a sign-in wall. That charges every
 * visitor a conversion cost before they can tell whether they want the thing,
 * and this tool's whole pitch is that it works the moment you open it.
 *
 * ## Shown once, and never to somebody who came for a build
 *
 * A share link carries a build in its fragment. Anybody arriving on one clicked
 * through to see a specific build, and putting an explainer in front of them is
 * answering a question they did not ask. `App.tsx` checks the fragment first.
 *
 * ## Why the name is explained here
 *
 * The owner asked for it, and it earns its place: **Enodia is an epithet of
 * Hecate, and it means she of the ways.** The game only ever calls her Hecate,
 * so the name is not lifted from it, and it says what the tool does. Somebody
 * who reads that once will remember the address.
 */

import { gameVersion } from '../data/app.ts'
import { DoraAsking } from './Dora.tsx'

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing">
      <header className="landing-top">
        <h1 className="landing-mark">Enodia</h1>
        <p className="landing-lede">
          A build companion for Hades II, read at an Exit.
        </p>
      </header>

      {/* The way in, above everything that explains it. Somebody who already
        * knows what this is should never have to scroll past the pitch. */}
      <button type="button" className="landing-in" onClick={onEnter}>
        Open it
      </button>
      <p className="landing-in-note">No account. Nothing to install.</p>

      <section className="landing-block">
        <h2>The moment it is for</h2>
        <p>
          You are standing at an Exit with fifteen seconds and four symbols in front of you.
          You know roughly what you are building. You do not know which of those four is the
          one that quietly ends it.
        </p>
      </section>

      <section className="landing-block">
        <h2>What it tells you</h2>
        <p>
          Which builds are still reachable, what your last pick closed, and what you were
          chasing before you put the run down. A filled slot blocks every other god&rsquo;s boon
          for that slot, and a Heroic one locks it outright. That is the thing this exists to
          say out loud.
        </p>
        <p>
          Every mechanical claim is read out of the game&rsquo;s own script files rather than a
          wiki, from build <span className="landing-mono">{gameVersion}</span>. It will not tell
          you a build is good. That is not in any file and it does not pretend otherwise.
        </p>
      </section>

      <section className="landing-block">
        <h2>Where the name comes from</h2>
        <p>
          <strong>Enodia</strong> is Greek, and it means roughly <em>she of the ways</em>, or
          the one in the road. It is not a name so much as a job description: it was an epithet
          of <strong>Hecate</strong>, who stands where three roads meet, holding a torch,
          because the crossroads is the place you most need somebody who knows what each way
          leads to.
        </p>
        <p>
          That is the whole reason it is on this. You are standing at an Exit with four symbols
          in front of you, which is a crossroads with a timer on it. A tool for that moment
          could hardly be called anything else.
        </p>
        <p>
          Hecate is in Hades II and the game <em>never</em> uses this name for her, which was
          checked rather than assumed: &ldquo;Enodia&rdquo; appears nowhere in the game&rsquo;s
          text files. She is only ever Hecate there. So the name is borrowed from the myth
          rather than lifted from the game, which felt like the right distance for something
          unofficial.
        </p>
      </section>

      <section className="landing-block">
        <h2>Who made you do all this</h2>
        <DoraAsking />
      </section>

      <section className="landing-block">
        <h2>Your things stay yours</h2>
        <p>
          Every build, run and setting lives in this browser and is sent nowhere. Nothing is
          tracked and nothing is measured about you. A build shared as a link carries the whole
          build inside the link, which is why sharing works without a server at all.
        </p>
      </section>

      <button type="button" className="landing-in landing-in-again" onClick={onEnter}>
        Open it
      </button>

      <p className="landing-fine">
        Free, and staying free. An unofficial fan project, not affiliated with or endorsed by
        Supergiant Games. Hades II, its art and its text are theirs.
      </p>
    </div>
  )
}
