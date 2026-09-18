/**
 * Reading one guide.
 *
 * **This is the screen the whole feature exists for.** The sections go through
 * `Prose`, so every build named inside a sentence carries its verdict while a
 * run is being logged: the same paragraph says something different at the
 * fourth Exit than it did at the Crossroads, which is the one thing a guide
 * here can do that a guide anywhere else cannot. `decisions/2026-09-13-guides.md`
 * has the argument.
 *
 * ## One request, then nothing
 *
 * `/api/g/<id>` returns the guide and every build it names in the same
 * response, and `learnMentioned` puts those where the mentions look. So a guide
 * naming twenty builds costs one request rather than twenty-one, and a build
 * whose author took it down is drawn as withdrawn without the payload ever
 * being handed over. `ChangedProvider` carries the other half: which of them
 * have had their picks changed since this was written.
 *
 * ## What a reader can do, and what an author can
 *
 * A reader saves, likes, and reports. Saving and liking are two questions and
 * two counts, and neither takes your own guide. Reporting is stored for a
 * person to read and returned to nobody: `worker/guides.ts` says why there is
 * no moderator route.
 *
 * An author edits, takes it down and puts it back, and is told when a moderator
 * has hidden it, because a guide they cannot see is one they cannot fix.
 */

import { useEffect, useState } from 'react'

import { learnMentioned } from '../state/mentioned.ts'
import {
  guideLink,
  markGuide,
  openGuide,
  putBackGuide,
  reportGuide,
  takeDownGuide,
  unpackGuide,
  written,
} from '../state/guides.ts'
import type { GuideDoc, GuideRead } from '../state/guides.ts'
import { ChangedProvider } from './BuildMention.tsx'
import { useHelpTopic } from './PageHelp.tsx'
import { Prose } from './Prose.tsx'

/** As `MAX_REASON` in the worker, so the box stops where the route would refuse. */
const MAX_REASON = 500

const when = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * A blank line starts a paragraph, and that is the whole of the formatting.
 *
 * The field is a plain textarea for the reason `MentionField` gives: a rich
 * editor stores markup, and markup somebody else wrote has to be cleaned before
 * a stranger reads it. A blank line is what a person types anyway.
 */
const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((one) => one.trim())
    .filter(Boolean)

export function GuideReader({
  id,
  onBack,
  onEdit,
  signedIn,
  onChanged,
}: {
  id: string
  /** back to the shelf this was opened from */
  onBack: () => void
  /** the author's own lever, absent where editing is not offered */
  onEdit?: (guide: GuideRead, doc: GuideDoc) => void
  signedIn: boolean
  /** something about this guide moved, so the shelf behind it should read again */
  onChanged?: () => void
}) {
  useHelpTopic('guide-read')

  const [guide, setGuide] = useState<GuideRead | null>(null)
  const [doc, setDoc] = useState<GuideDoc | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    setGuide(null)
    setDoc(null)
    setMissing(false)
    void openGuide(id).then(async (found) => {
      if (!found) {
        if (live) setMissing(true)
        return
      }
      /* The builds it names, before the words that name them are drawn. */
      await learnMentioned(found.named)
      const opened = await unpackGuide(found.payload)
      if (!live) return
      setGuide(found)
      setDoc(opened)
      if (!opened) setMissing(true)
    })
    return () => {
      live = false
    }
  }, [id])

  if (missing) {
    return (
      <div className="guide">
        <Head onBack={onBack} title="Nothing here" />
        <p className="acct-quiet">
          That guide is not there. Its author may have taken it down, or the link may be wrong.
        </p>
      </div>
    )
  }

  if (!guide || !doc) {
    return (
      <div className="guide">
        <Head onBack={onBack} title="One moment" />
      </div>
    )
  }

  const changed = new Set(guide.named.flatMap((one) => (one.state === 'live' && one.changed ? [one.id] : [])))

  return (
    <ChangedProvider value={changed}>
      <article className="guide">
        <Head onBack={onBack} title={guide.title} />

        <p className="guide-by">
          {guide.mine ? 'Yours' : `By ${guide.by}`}
          <span aria-hidden="true"> · </span>
          {when(guide.createdAt)}
          {guide.updatedAt ? <span> · revised {when(guide.updatedAt)}</span> : null}
        </p>

        {guide.hidden ? (
          <p className="guide-said is-warn">
            A moderator hid this guide. Only you can see it. Editing it does not put it back.
          </p>
        ) : null}
        {guide.takenDown ? (
          <p className="guide-said">
            {guide.mine
              ? 'You have this off the shelves. The link still works for anybody who has it.'
              : 'The author has taken this off the shelves. This is the last version they published.'}
          </p>
        ) : null}

        {guide.mine ? (
          <Author guide={guide} onEdit={onEdit ? () => onEdit(guide, doc) : undefined} onChanged={onChanged} />
        ) : (
          <Reader guide={guide} signedIn={signedIn} onChanged={onChanged} />
        )}

        {written(doc).map((section, at) => (
          <section className="guide-section" key={`${at}:${section.heading}`}>
            <h3>{section.heading}</h3>
            {paragraphs(section.text).map((para, index) => (
              <p key={index}>
                <Prose text={para} />
              </p>
            ))}
          </section>
        ))}
      </article>
    </ChangedProvider>
  )
}

/** The heading row, with the way back. The screen's shared one steps aside for it. */
function Head({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="builds-top guide-top">
      <h2>{title}</h2>
      <button type="button" className="quiet" onClick={onBack}>
        All guides
      </button>
    </header>
  )
}

/**
 * Save, like, report.
 *
 * The two counts move here before the server has answered, and move back if it
 * refuses: pressing Save and watching a number sit still is the kind of quiet
 * that makes somebody press it again. Everything is refused signed out, which
 * is said in one line rather than on three disabled buttons.
 */
function Reader({
  guide,
  signedIn,
  onChanged,
}: {
  guide: GuideRead
  signedIn: boolean
  onChanged?: () => void
}) {
  const [saved, setSaved] = useState(guide.saved === true)
  const [liked, setLiked] = useState(guide.liked === true)
  const [stats, setStats] = useState(guide.stats)
  const [said, setSaid] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const [reported, setReported] = useState(false)

  if (!signedIn) {
    return (
      <div className="guide-marks">
        <GuideTally stats={guide.stats} />
        <p className="guide-said">Sign in to save this, or to say something about it.</p>
      </div>
    )
  }

  const mark = async (what: 'save' | 'like', on: boolean) => {
    setSaid('')
    const was = { saved, liked, stats }
    if (what === 'save') setSaved(on)
    else setLiked(on)
    setStats({
      saves: stats.saves + (what === 'save' ? (on ? 1 : -1) : 0),
      likes: stats.likes + (what === 'like' ? (on ? 1 : -1) : 0),
    })
    const answer = await markGuide(guide.id, what, on)
    if (!answer.ok) {
      setSaved(was.saved)
      setLiked(was.liked)
      setStats(was.stats)
      setSaid(answer.say)
      return
    }
    onChanged?.()
  }

  return (
    <div className="guide-marks" data-tour="guide-marks">
      <button type="button" className={`quiet${saved ? ' is-on' : ''}`} aria-pressed={saved} onClick={() => void mark('save', !saved)}>
        {saved ? 'Saved' : 'Save it'}
      </button>
      <button type="button" className={`quiet${liked ? ' is-on' : ''}`} aria-pressed={liked} onClick={() => void mark('like', !liked)}>
        {liked ? 'Liked' : 'Like it'}
      </button>
      <GuideTally stats={stats} />

      {reported ? (
        <p className="guide-said" role="status">
          Reported. Somebody will read it.
        </p>
      ) : reporting ? (
        <div className="guide-report">
          <label htmlFor="guide-reason">What is wrong with it?</label>
          <textarea
            id="guide-reason"
            rows={3}
            maxLength={MAX_REASON}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="guide-report-foot">
            <button
              type="button"
              onClick={() => {
                void reportGuide(guide.id, reason).then((answer) => {
                  if (answer.ok) setReported(true)
                  else setSaid(answer.say)
                })
              }}
            >
              Send it
            </button>
            <button type="button" className="quiet" onClick={() => setReporting(false)}>
              Never mind
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="quiet guide-report-open" onClick={() => setReporting(true)}>
          Report it
        </button>
      )}

      {said ? (
        <p className="guide-said" role="status">
          {said}
        </p>
      ) : null}
    </div>
  )
}

/** Your own: edit it, take it off the shelves, put it back, and the link to it. */
function Author({
  guide,
  onEdit,
  onChanged,
}: {
  guide: GuideRead
  onEdit?: () => void
  onChanged?: () => void
}) {
  const [down, setDown] = useState(guide.takenDown)
  const [said, setSaid] = useState('')

  const flip = async () => {
    setSaid('')
    const answer = down ? await putBackGuide(guide.id) : await takeDownGuide(guide.id)
    if (!answer.ok) {
      setSaid(answer.say)
      return
    }
    setDown(!down)
    onChanged?.()
  }

  return (
    <div className="guide-marks">
      {onEdit ? (
        <button type="button" onClick={onEdit}>
          Edit it
        </button>
      ) : null}
      <button type="button" className="quiet" onClick={() => void flip()}>
        {down ? 'Put it back' : 'Take it down'}
      </button>
      <button
        type="button"
        className="quiet"
        onClick={() => {
          void navigator.clipboard?.writeText(guideLink(guide.id)).then(
            () => setSaid('The link is on your clipboard.'),
            () => setSaid(guideLink(guide.id)),
          )
        }}
      >
        Copy the link
      </button>
      <GuideTally stats={guide.stats} />
      {said ? (
        <p className="guide-said" role="status">
          {said}
        </p>
      ) : null}
    </div>
  )
}

/** Saves and likes, and nothing at all for a guide nobody has touched yet. */
function GuideTally({ stats }: { stats: { saves: number; likes: number } }) {
  if (!stats.saves && !stats.likes) return null
  return (
    <p className="guide-counts">
      {stats.saves ? <span>Saved by {stats.saves}</span> : null}
      {stats.likes ? <span>Liked by {stats.likes}</span> : null}
    </p>
  )
}
