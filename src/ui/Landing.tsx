/**
 * The first screen a stranger sees, and the only one that has to sell anything.
 *
 * ## It fits on one screen, and that is a constraint rather than a preference
 *
 * On a desktop this does not scroll. A landing page you have to scroll is one
 * whose second half is optional, and if it is optional it should not be
 * written. So the layout is two columns on a wide screen and the copy is cut to
 * fit them rather than the other way round.
 *
 * ## It sells, it does not block
 *
 * `REQUIREMENTS.md` 5 settled the gate at its loosest: viewing is free,
 * creating is free, saving locally is free, and an account is only needed to
 * publish or to have friends. So this is a page you walk through, not a door
 * you knock on. There is no form on it and the way in is the first control.
 *
 * ## What it sells, which changed
 *
 * The pitch used to lead on the run tracker. That is not what the tool is for
 * and the owner said so: the editor is, and sharing a build is, and the things
 * coming after it are. The Exit is where the idea started, not the product.
 *
 * **There is no "your things stay yours" section any more, deliberately.** It
 * promised that nothing ever leaves the browser, which was true and is about to
 * stop being: builds are meant to end up somewhere people can rate them. A
 * promise with a planned expiry date does not belong on a landing page.
 *
 * ## Shown once, and never to somebody who came for a build
 *
 * A share link carries a build in its fragment and a short link carries an id.
 * Anybody arriving on either clicked through for one specific thing, and an
 * explainer answers a question they did not ask. `App.tsx` checks both first.
 *
 * ## The name, and what was checked
 *
 * It does not explain that Hecate stands at a crossroads. Anybody reading this
 * has walked out of the Crossroads a hundred times, and telling them is not a
 * fact, it is filler. What they will not know is the hymn.
 *
 * - **Hades II never uses "Enodia"**, which is why this can say so flatly.
 *   Checked against every English text file in `Content/Game/Text/en/`
 * - **krokopeplos, shared only by Hecate and Melinoë in the Orphic Hymns**, is
 *   Morand, *Études sur les Hymnes Orphiques* (Brill 2001), pp. 127 and 182.
 *   The scope matters: it is a stock Homeric epithet for Eos, so the claim is
 *   true of the Orphic Hymns and false of Greek generally
 */

import { gameVersion } from '../data/app.ts'
import { DoraAsking } from './Dora.tsx'

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing">
      <header className="landing-top">
        <h1 className="landing-mark">Enodia</h1>
        <p className="landing-lede">
          A build companion for Hades II. Put one together, check it against the game&rsquo;s own
          rules, and send it to somebody.
        </p>
        {/* The way in, above everything that explains it. Somebody who already
          * knows what this is should never have to read past it. */}
        <p className="landing-go">
          <button type="button" className="landing-in" onClick={onEnter}>
            Open it
          </button>
          <span className="landing-in-note">No account. Nothing to install.</span>
        </p>
      </header>

      <div className="landing-cols">
        <section className="landing-block">
          <h2>What it does</h2>
          <p>
            <strong>Builds that hold up.</strong> The editor reads the game&rsquo;s own script
            files, so it knows a filled slot blocks every other god&rsquo;s boon for that slot,
            and that a Heroic one locks it for good. It says so while you are still choosing.
          </p>
          <p>
            <strong>Send one to somebody.</strong> Any build is a link. Sign in and publish it
            and the link gets short, and people you have swapped codes with see what you put up.
          </p>
          <p>
            <strong>Coming.</strong> Surprise me, for when you would rather be handed one. More
            help while you build. And a mod that watches a live run and says whether you are
            still on for the build you wanted, or whether it is time to make something else out
            of what you have.
          </p>
        </section>

        <section className="landing-block">
          <h2>Where the name comes from</h2>
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
            <strong>The pairing goes further than the Crossroads.</strong> In the Orphic hymns,
            Hecate and Melinoë are the only two goddesses called{' '}
            <em lang="grc-Latn">krokopeplos</em>, saffron-cloaked. Hades II never uses the name
            Enodia, so it is borrowed from the hymns rather than from the game.
          </p>
        </section>
      </div>

      <DoraAsking />

      <p className="landing-fine">
        Free, and staying free. Read from game build{' '}
        <span className="landing-mono">{gameVersion}</span>. An unofficial fan project, not
        affiliated with or endorsed by Supergiant Games. Hades II, its art and its text are
        theirs.
      </p>
    </div>
  )
}
