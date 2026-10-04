/**
 * Your side of Guides: what you wrote, what you saved, and what you are in the
 * middle of writing.
 *
 * Three lists rather than a second switch under the first one. They are short
 * and they answer different questions, and a control inside a control is how
 * you end up not knowing which of them you are looking at.
 *
 * **Writing does not need an account and publishing does.** So the editor opens
 * for anybody, the draft is kept in this browser, and the refusal arrives at
 * the one moment it means something. Being asked to sign in before writing a
 * word is the wall this tool does not have anywhere else.
 *
 * Schelemeus stands here, as he does on your side of Builds, and `Figures.tsx`
 * says how the room beside him is made.
 */

import { useCallback, useEffect, useState } from 'react'

import { blankGuide, loadDraft, myGuides } from '../state/guides.ts'
import type { Draft, GuideListing, GuideRead } from '../state/guides.ts'
import { SchelemeusStand } from './Figures.tsx'
import { GuideCard, useGuideDocs } from './GuideCard.tsx'
import { GuideEditor } from './GuideEditor.tsx'
import { GuideReader } from './GuideReader.tsx'

/** Which of the three things this side is doing, so the screen's heading knows. */
export type GuideMode = 'shelf' | 'guide' | 'editor'

export function Guides({ signedIn, onMode }: { signedIn: boolean; onMode: (mode: GuideMode) => void }) {
  const [mine, setMine] = useState<{ written: GuideListing[]; saved: GuideListing[] } | null>(null)
  const [at, setAt] = useState(0)
  const [reading, setReading] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [held, setHeld] = useState<Draft | null>(() => loadDraft())

  /* Only when there is somebody to ask. Signed out this side is the draft and
     a line saying what an account buys, which costs no request at all. */
  useEffect(() => {
    if (!signedIn) {
      setMine(null)
      return
    }
    let live = true
    void myGuides().then((found) => {
      if (live) setMine(found)
    })
    return () => {
      live = false
    }
  }, [signedIn, at])

  const again = useCallback(() => setAt((was) => was + 1), [])

  const mode: GuideMode = draft ? 'editor' : reading ? 'guide' : 'shelf'
  useEffect(() => onMode(mode), [mode, onMode])

  if (draft) {
    return (
      <GuideEditor
        start={draft}
        onDone={(id) => {
          setDraft(null)
          setHeld(null)
          setReading(id)
          again()
        }}
        onDrop={() => {
          setDraft(null)
          setHeld(null)
        }}
      />
    )
  }

  if (reading) {
    return (
      <GuideReader
        id={reading}
        signedIn={signedIn}
        onBack={() => setReading(null)}
        onChanged={again}
        onEdit={(guide: GuideRead, doc) => {
          setDraft({ of: guide.id, doc })
          setReading(null)
        }}
      />
    )
  }

  const write = () => setDraft(held ?? { of: null, doc: blankGuide() })

  return (
    <div className="builds">
      <SchelemeusStand />
      <div className="guides-shelf">
        <div className="builds-mine-top">
          <p className="page-standfirst">
            Guides you wrote, and guides you kept. A guide is a few sections of writing with builds
            named inside it.
          </p>
          <button type="button" className="quiet is-call guides-new" data-tour="guides-new" onClick={write}>
            Write a guide
          </button>
        </div>

        {/* The draft, before the lists, because it is the only thing here that
          * is waiting on somebody. */}
        {held && !draft ? (
          <p className="guides-draft">
            You have {held.doc.title.trim() ? `"${held.doc.title.trim()}"` : 'a guide'} on the go in
            this browser.
            <button type="button" className="quiet" onClick={write}>
              Carry on with it
            </button>
          </p>
        ) : null}

        {!signedIn ? (
          <p className="acct-quiet">
            Write one now if you like, it stays in this browser. Publishing needs an account, which
            is what gives it an address other people can open.
          </p>
        ) : mine === null ? (
          <p className="acct-quiet">One moment.</p>
        ) : (
          <>
            <Shelf
              title="What you wrote"
              empty="Nothing published yet."
              listings={mine.written}
              onOpen={setReading}
            />
            <Shelf
              title="What you saved"
              empty="Guides you save are here. Nothing yet."
              listings={mine.saved}
              onOpen={setReading}
            />
          </>
        )}
      </div>
    </div>
  )
}

/** One list of cards, with its own heading, and a line where there are none. */
function Shelf({
  title,
  empty,
  listings,
  onOpen,
}: {
  title: string
  empty: string
  listings: GuideListing[]
  onOpen: (id: string) => void
}) {
  const docs = useGuideDocs(listings)
  return (
    <section className="guides-section">
      <h3>{title}</h3>
      {listings.length === 0 ? (
        <p className="acct-quiet">{empty}</p>
      ) : (
        <ul className="guides-grid">
          {listings.map((one) => (
            <GuideCard
              key={one.id}
              listing={one}
              doc={docs.get(one.id) ?? null}
              onOpen={() => onOpen(one.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
