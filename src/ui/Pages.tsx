/**
 * The reading screens: what changed, what is coming.
 *
 * They share a shell because they are the same kind of thing, and because a
 * tool whose text pages each look slightly different reads as three tools. The
 * shell is a header, a standfirst and a measure narrow enough to read.
 *
 * Help uses it too, from `Reference.tsx`. Nothing on these screens is
 * interactive, which is the point: they are the questions a reader has that the
 * rest of the tool cannot answer by being used.
 */

import { CHANGELOG } from '../data/changelog.ts'
import { ROADMAP, STAGES } from '../data/roadmap.ts'
import { UNDER_HOOD } from '../data/underhood.ts'
import { DoraWatching } from './Dora.tsx'
import type { Stage } from '../data/roadmap.ts'

export function Page({
  title,
  standfirst,
  measure,
  children,
}: {
  /**
   * Absent on a page drawn under a heading it does not own: everybody's side
   * of Builds, where `BuildsScreen` draws the title and the switch once for
   * both sides.
   */
  title?: string
  standfirst: string
  /**
   * How wide the page is allowed to be. Absent is the 44rem reading measure.
   *
   * **`broad` is not for making paragraphs wider.** Measured on a 1600px
   * screen, a line of body copy here was already 113 characters, well past the
   * 45 to 75 a reader is comfortable with, so the cap was doing its job and
   * widening it would have made these pages harder to read rather than shorter.
   * What it is for is pages whose content is a set of columns: Help came out at
   * 104 characters a line afterwards, and one screen instead of two. It only
   * lifts the cap above 78rem, where there are columns to fill.
   *
   * **`shelf` is a different question and takes its answer from `.builds`.**
   * The exchange is not prose at all, it is the build manager's grid with a
   * different list behind it, and the two have to be the same width because
   * they draw the same cards. Measured at 1600x950 with the reading measure on:
   * the page was 704px, Charon took 304 of it, and the shelf was left with
   * **336px, one column, one very large card**, which is what the owner
   * reported. The cards were never the problem.
   */
  measure?: 'broad' | 'shelf'
  children: React.ReactNode
}) {
  return (
    <div className={`page${measure ? ` is-${measure}` : ''}`}>
      {title ? (
        <header className="builds-top">
          <h2>{title}</h2>
        </header>
      ) : null}
      <p className="page-standfirst" data-tour="page-standfirst">{standfirst}</p>
      {children}
    </div>
  )
}

/** The day a batch landed, in words rather than in a slash-separated number. */
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * What changed, newest batch open and the rest a list of headings.
 *
 * **Measured at 5.53 screens of scrolling**, which was the worst page in the
 * app by some way: seventeen batches of seven paragraph-length points, every
 * one expanded, most of them describing something the reader read weeks ago.
 *
 * `<details>` rather than React state, because there is nothing to remember.
 * The browser handles the keyboard, the ARIA and the open animation, and this
 * page stays what the top of this file says it is: not interactive.
 *
 * **The one real cost is find-in-page.** Chrome opens a closed `<details>` when
 * a search lands inside it and Firefox does not, so on Firefox a Ctrl+F for
 * wording buried in an old batch will miss it. Every batch's date and title
 * stay on screen, which is most of what such a search is for.
 */
export function Changelog() {
  return (
    <Page
      title="Changelog"
      standfirst="What has changed in the app, newest first. The latest batch is open, and the rest open when you want them."
    >
      <ol className="log" data-tour="changelog-log">
        {CHANGELOG.map((release, at) => (
          <li key={`${release.date}-${release.title}`} className="log-entry">
            <details className="log-fold" open={at === 0}>
              {/* Title first, date after it and pushed to the right margin.
                * A span rather than a paragraph for the date, because
                * `<summary>` takes phrasing and heading content and a `<p>` is
                * neither. */}
              <summary className="log-head">
                <h3 className="log-title">{release.title}</h3>
                <span className="log-when">
                  <time dateTime={release.date}>{when(release.date)}</time>
                </span>
              </summary>
              <p className="log-say">{release.say}</p>
              <ul className="log-points">
                {release.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </Page>
  )
}

export function Roadmap() {
  const inStage = (stage: Stage) => ROADMAP.filter((one) => one.stage === stage)

  /**
   * How much of what is planned is built.
   *
   * **Counted, not asserted.** A roadmap that says "we are making progress" is
   * a claim; one that says twelve of nineteen is a fact you can check against
   * the list underneath it. Stalled is excluded from the denominator, because a
   * thing that is not blocked by code is not work outstanding: counting it
   * would make the bar move by giving up on something.
   */
  const built = inStage('now').length
  const outstanding = built + inStage('next').length + inStage('later').length
  const share = outstanding ? Math.round((built / outstanding) * 100) : 0

  return (
    <Page
      measure="broad"
      title="Roadmap"
      standfirst="What is built, what is planned, and what is stalled. No dates: this is a side project and any date would be a guess."
    >
      {/* Dora, watching it go by. Fixed to the viewport rather than the page,
        * so the plan scrolls past her and she does not move. */}
      <DoraWatching />

      {/* The whole thing at a glance, before any of the detail. */}
      <div className="plan-progress">
        <div className="plan-bar" data-tour="plan-bar" role="img" aria-label={`${built} of ${outstanding} built`}>
          <span className="plan-bar-fill" style={{ width: `${share}%` }} />
        </div>
        <p className="plan-count">
          <strong>{built}</strong> of {outstanding} built
          {inStage('waiting').length ? `, ${inStage('waiting').length} stalled` : ''}
        </p>
      </div>

      <div className="plan">
        {STAGES.map((stage) => {
          const items = inStage(stage.id)
          if (!items.length) return null
          return (
            <section key={stage.id} className={`plan-stage is-${stage.id}`}>
              <header className="plan-head">
                <h3 className="plan-name">{stage.name}</h3>
                <span className="plan-tally">{items.length}</span>
              </header>
              <p className="plan-say">{stage.say}</p>
              <ul className="plan-list">
                {items.map((one) => (
                  <li key={one.title}>
                    {/* The marker carries the state, so a reader skimming the
                      * left edge gets the shape without reading the headings. */}
                    <span className="plan-dot" aria-hidden="true" />
                    <div>
                      <h4>{one.title}</h4>
                      <p>{one.say}</p>
                      {one.on ? <p className="plan-on">{one.on}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Page>
  )
}

/**
 * Things the game never tells you, in three tiers of spoiler.
 *
 * A closed `<details>` per entry, because the page's own promise is that
 * nothing opens unless the reader opens it, and the tier says what kind of
 * thing is inside before anybody commits to knowing it. The same reason the
 * changelog uses them: there is nothing here to remember, so the browser can
 * own the keyboard and the ARIA.
 *
 * **The source line is not decoration.** Every entry that states a rule carries
 * the symbols it was read from, and the two that are ours are marked as ours.
 * `underhood.test.ts` fails if either of those slips.
 */
export function UnderHood() {
  return (
    <Page
      title="Under the hood"
      standfirst="Building this means reading the game's own code, and that turns up rules nobody is told. Some you would never have found. Some you would get to eventually, and finding those yourself is the better way round, so nothing opens unless you open it."
    >
      {UNDER_HOOD.map((tier) => (
        <section key={tier.level} className={`hood is-level-${tier.level}`}>
          <header className="hood-head">
            <span className="hood-level">Level {tier.level}</span>
            <h3>{tier.title}</h3>
            <p>{tier.say}</p>
          </header>

          {tier.entries.map((entry) => (
            <details key={entry.summary} className="hood-entry">
              <summary>{entry.summary}</summary>
              <div className="hood-body">
                {entry.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {entry.ours ? (
                  <p className="hood-ours">Ours: how to play it, rather than a rule stated in the files.</p>
                ) : null}
                {entry.source ? (
                  <p className="hood-source">
                    <span>source</span> {entry.source}
                  </p>
                ) : null}
              </div>
            </details>
          ))}
        </section>
      ))}
    </Page>
  )
}
