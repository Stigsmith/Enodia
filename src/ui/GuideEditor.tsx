/**
 * Writing a guide.
 *
 * A title and one rich field, which is the owner's call of 4 October 2026: the
 * four prompted boxes and the "Add a section" button are gone, an author makes
 * their own headings with `/`, and until they start Dora says what the field
 * can do. **A guide does not have to be about a run**, so nothing here names
 * an Exit, a Region or a boss, and nobody is filling in somebody else's
 * outline.
 *
 * ## The field is `RichEditor`, loaded when it is needed
 *
 * `React.lazy`, so the editor and ProseMirror are a chunk of their own that
 * only somebody writing a guide downloads. `/` offers blocks and `@` tags
 * anything `ui/mentions.ts` can name: records, sections of the wiki (which is
 * how a god is named) and published builds. A pasted short link becomes a
 * mention of its build.
 *
 * ## The draft is in this browser until it is published
 *
 * Every change writes `enodia.guide.draft`, so a stray reload costs nothing.
 * Publishing clears it. `state/guides.ts` says why there is one draft rather
 * than a shelf of them.
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react'

import {
  MAX_GUIDE_TITLE,
  clearDraft,
  enough,
  publishGuide,
  replaceGuide,
  saveDraft,
  tooLong,
} from '../state/guides.ts'
import type { Draft, GuideDoc } from '../state/guides.ts'
import { hasWriting } from '../state/rich.ts'
import { useHelpTopic } from './PageHelp.tsx'

const RichEditor = lazy(() => import('./RichEditor.tsx'))

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

  /** Why the button is off, rather than a button that does nothing and says nothing. */
  const why = !doc.title.trim()
    ? 'A guide needs a title.'
    : !hasWriting(doc.body)
      ? 'And something written in it.'
      : tooLong(doc)
        ? 'That is longer than a guide can be. Trim it a little.'
        : ''

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
          placeholder="How to beat the RNG"
          onChange={(event) => setDoc((was) => ({ ...was, title: event.target.value }))}
        />
      </label>

      <Suspense fallback={<div className="rich-editor is-loading">Fetching the quill.</div>}>
        <RichEditor value={start.doc.body} onChange={(body) => setDoc((was) => ({ ...was, body }))} />
      </Suspense>

      <footer className="guide-foot">
        <button
          type="button"
          className="quiet is-call"
          disabled={!enough(doc) || sending}
          onClick={() => void publish()}
        >
          {of.current ? 'Replace what people are reading' : 'Publish it'}
        </button>
        {why ? <p className="guide-hint">{why}</p> : null}
        {said ? (
          <p className="guide-said is-warn" role="status">
            {said}
          </p>
        ) : null}
      </footer>
    </div>
  )
}
