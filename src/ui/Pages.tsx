/**
 * The reading screens: what changed, what is coming.
 *
 * They share a shell because they are the same kind of thing, and because a
 * tool whose text pages each look slightly different reads as four tools. The
 * shell is a header, a standfirst and a measure narrow enough to read.
 *
 * Help and About live here too when they are written. Nothing on these screens
 * is interactive, which is the point: they are the two questions a reader has
 * that the rest of the tool cannot answer by being used.
 */

import { CHANGELOG } from '../data/changelog.ts'
import { ROADMAP, STAGES } from '../data/roadmap.ts'
import { DoraWatching } from './Dora.tsx'
import type { Stage } from '../data/roadmap.ts'

export function Page({
  title,
  standfirst,
  children,
}: {
  title: string
  standfirst: string
  children: React.ReactNode
}) {
  return (
    <div className="page">
      <header className="builds-top">
        <h2>{title}</h2>
      </header>
      <p className="page-standfirst" data-tour="about-standfirst">{standfirst}</p>
      {children}
    </div>
  )
}

/** The day a batch landed, in words rather than in a slash-separated number. */
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export function Changelog() {
  return (
    <Page
      title="Changelog"
      standfirst="What has changed in the app, newest first."
    >
      <ol className="log" data-tour="changelog-log">
        {CHANGELOG.map((release) => (
          <li key={`${release.date}-${release.title}`} className="log-entry">
            <p className="log-when">
              <time dateTime={release.date}>{when(release.date)}</time>
            </p>
            <h3 className="log-title">{release.title}</h3>
            <p className="log-say">{release.say}</p>
            <ul className="log-points">
              {release.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
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
