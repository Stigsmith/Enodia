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
 * ## Why the name is explained here, and what was checked
 *
 * The owner asked for it and wrote it, and it earns its place: somebody who
 * reads it once will remember the address.
 *
 * Every claim in that section was checked, because a landing page is the worst
 * place to be wrong:
 *
 * - **Headmistress Hecate** and **the Crossroads** are the game's own words,
 *   found verbatim in `Content/Game/Text/en/*.sjson`
 * - **Hades II never uses "Enodia"**, which is why the section can say so
 *   flatly. It appears nowhere in the English text files
 * - **krokopeplos, shared only by Hecate and Melinoë in the Orphic Hymns**, is
 *   Morand, *Études sur les Hymnes Orphiques* (Brill 2001), pp. 127 and 182.
 *   Note the scope: `krokopeplos` is a stock Homeric epithet for Eos, so the
 *   claim is true of the Orphic Hymns and would be false of Greek generally
 *
 * One line was rewritten. The owner's draft ended "the name was in the game
 * before it was on this page", which reads as though the game uses it, and it
 * does not. The reversal is kept and the claim made true: the game never uses
 * the name, it just already had the crossroads.
 *
 * Enodia was also a Thessalian goddess in her own right before the word became
 * a title, and it was applied to Artemis, Persephone and Selene as well as to
 * Hecate. "An epithet of Hecate" is correct and is the relevant half; the rest
 * is not worth a paragraph on a landing page.
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

        {/* The Greek and the pronunciation sit above the prose rather than
          * inside it, because they are the two things somebody actually wants
          * from this section and burying them in a sentence hides both. */}
        <p className="landing-greek" lang="grc">
          Ἐνοδία
        </p>
        <p className="landing-say">
          Enodia, <span className="landing-mono">eh·NOH·dee·uh</span>
        </p>

        <p>
          An epithet of <strong>Hecate</strong> meaning <em>she of the ways</em>, from{' '}
          <em lang="grc-Latn">en hodos</em>, on the road. She was invoked at crossroads and on
          night roads, where travellers left offerings and asked her to see them safely on.
        </p>
        <p>
          <strong>She kept the job.</strong> Headmistress Hecate is standing in the Crossroads
          you walk out of every single run. And in the Orphic hymns she and Melinoë are the
          only two goddesses given the same epithet, <em lang="grc-Latn">krokopeplos</em>,
          saffron-cloaked.
        </p>
        <p>
          Hades II never uses the name itself. It did not have to: the Crossroads was already
          there, and so was she.
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
