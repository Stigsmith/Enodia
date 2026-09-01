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
      <p className="page-standfirst">{standfirst}</p>
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
      <ol className="log">
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

  return (
    <Page
      title="Roadmap"
      standfirst="What is built, what is planned, and what is stalled. No dates: this is a side project and any date would be a guess."
    >
      <div className="plan">
        {STAGES.map((stage) => {
          const items = inStage(stage.id)
          if (!items.length) return null
          return (
            <section key={stage.id} className={`plan-stage is-${stage.id}`}>
              <h3 className="plan-name">{stage.name}</h3>
              <p className="plan-say">{stage.say}</p>
              <ul className="plan-list">
                {items.map((one) => (
                  <li key={one.title}>
                    <h4>{one.title}</h4>
                    <p>{one.say}</p>
                    {one.on ? <p className="plan-on">{one.on}</p> : null}
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
