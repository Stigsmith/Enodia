/**
 * Writing a guide.
 *
 * A title and up to eight sections, each a plain field. The first four carry
 * the owner's prompts and the rest are the author's own, headings included,
 * which is the shape the owner chose: **a guide does not have to be about a
 * run**, so nothing here names an Exit, a Region or a boss, and anybody
 * writing about one weapon or one achievement is not filling in somebody
 * else's outline.
 *
 * An empty prompt is skipped when the guide is read, so a guide that is one
 * long answer is written by filling in one field and leaving the rest alone.
 *
 * ## The fields are `MentionField`s
 *
 * So `@` names a boon, an Arcana card, a familiar or a published build, and a
 * pasted short link becomes a mention of the build on the spot. With no build
 * of its own to rank by, a bare `@` here lists the builds this browser can
 * name: `rankMentions` says why that is the right first offer for a guide.
 *
 * ## The draft is in this browser until it is published
 *
 * Every keystroke writes `enodia.guide.draft`, so a stray reload costs
 * nothing. Publishing clears it. `state/guides.ts` says why there is one draft
 * rather than a shelf of them.
 */

import { useEffect, useRef, useState } from 'react'

import {
  MAX_GUIDE_TITLE,
  MAX_HEADING,
  MAX_SECTION,
  MAX_SECTIONS,
  PROMPTS,
  clearDraft,
  enough,
  publishGuide,
  replaceGuide,
  saveDraft,
} from '../state/guides.ts'
import type { Draft, GuideDoc } from '../state/guides.ts'
import { MentionField } from './MentionField.tsx'
import { useHelpTopic } from './PageHelp.tsx'

export function GuideEditor({
  start,
  onDone,
  onDrop,
}: {
  start: Draft
  /** published or replaced, with the id it went up under */
  onDone: (id: string) => void
  /** the draft is gone and nothing was published */
  onDrop: () => void
}) {
  useHelpTopic('guide-editor')

  const [doc, setDoc] = useState<GuideDoc>(start.doc)
  const [said, setSaid] = useState('')
  const [sending, setSending] = useState(false)
  const of = useRef(start.of)

  /* Written on every change rather than on a timer: the failure this is for is
     a reload, and a reload does not wait for a timer. */
  useEffect(() => {
    saveDraft({ of: of.current, doc })
  }, [doc])

  const change = (at: number, section: { heading?: string; text?: string }) =>
    setDoc((was) => ({
      ...was,
      sections: was.sections.map((one, index) => (index === at ? { ...one, ...section } : one)),
    }))

  const publish = async () => {
    setSaid('')
    setSending(true)
    const outcome = of.current ? await replaceGuide(of.current, doc) : await publishGuide(doc)
    setSending(false)
    if (!outcome.ok) {
      setSaid(outcome.say)
      return
    }
    clearDraft()
    onDone(outcome.id)
  }

  return (
    <div className="guide-editor" data-tour="guide-editor">
      <header className="builds-top guide-top">
        <h2>{of.current ? 'Edit your guide' : 'Write a guide'}</h2>
        <button
          type="button"
          className="quiet"
          onClick={() => {
            clearDraft()
            onDrop()
          }}
        >
          {of.current ? 'Leave it as it was' : 'Throw it away'}
        </button>
      </header>

      <label className="guide-title-field" data-tour="guide-title">
        <span>Title</span>
        <input
          type="text"
          value={doc.title}
          maxLength={MAX_GUIDE_TITLE}
          data-field="title"
          autoFocus
          onChange={(event) => setDoc((was) => ({ ...was, title: event.target.value }))}
        />
      </label>

      {doc.sections.map((section, at) => {
        const prompt = PROMPTS[at]
        return (
          <section className="guide-field" key={at}>
            {prompt ? (
              <>
                <h3>{prompt.heading}</h3>
                <p className="guide-hint">{prompt.hint}</p>
              </>
            ) : (
              <label className="guide-heading-field">
                <span className="visually-hidden">Heading for section {at + 1}</span>
                <input
                  type="text"
                  value={section.heading}
                  maxLength={MAX_HEADING}
                  placeholder="Your own heading"
                  onChange={(event) => change(at, { heading: event.target.value })}
                />
              </label>
            )}

            <MentionField
              value={section.text}
              onChange={(text) => change(at, { text })}
              build={null}
              maxLength={MAX_SECTION}
              rows={6}
              label={prompt ? prompt.heading : section.heading || `Section ${at + 1}`}
              field={`section-${at}`}
            />

            <p className="guide-field-foot">
              {/* Only near the end. A counter on an empty field is a limit
                * announced before anybody has written anything. */}
              {section.text.length > MAX_SECTION * 0.8
                ? `${MAX_SECTION - section.text.length} characters left`
                : ''}
              {prompt ? null : (
                <button
                  type="button"
                  className="quiet"
                  onClick={() =>
                    setDoc((was) => ({ ...was, sections: was.sections.filter((_, index) => index !== at) }))
                  }
                >
                  Remove this section
                </button>
              )}
            </p>
          </section>
        )
      })}

      {doc.sections.length < MAX_SECTIONS ? (
        <button
          type="button"
          className="quiet guide-add"
          data-tour="guide-add"
          onClick={() => setDoc((was) => ({ ...was, sections: [...was.sections, { heading: '', text: '' }] }))}
        >
          Add a section
        </button>
      ) : (
        <p className="guide-hint">
          {MAX_SECTIONS} sections is as many as a guide gets.
        </p>
      )}

      <footer className="guide-foot">
        <button
          type="button"
          className="quiet is-call"
          disabled={!enough(doc) || sending}
          onClick={() => void publish()}
        >
          {of.current ? 'Replace what people are reading' : 'Publish it'}
        </button>
        {/* Why the button is off, rather than a button that does nothing and
          * says nothing when pressed. */}
        {enough(doc) ? null : (
          <p className="guide-hint">A guide needs a title and something written in it.</p>
        )}
        {said ? (
          <p className="guide-said is-warn" role="status">
            {said}
          </p>
        ) : null}
      </footer>
    </div>
  )
}
