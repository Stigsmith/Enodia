/**
 * Everybody's side of Guides.
 *
 * Every guide that is up, newest first, as cards. No filters and no shelves
 * under it, and that is deliberate rather than unfinished: the exchange earned
 * its filter bar by holding builds that differ along six axes the tool already
 * knows about. A guide's axes are its words, and a facet bar over sixty of them
 * would be six controls that each say "all".
 *
 * Charon stands here, as he does on everybody's side of Builds, because this is
 * the other side of the same crossing. `Figures.tsx` has the rules he follows.
 */

import { useCallback, useEffect, useState } from 'react'

import { everyGuide } from '../state/guides.ts'
import type { GuideListing } from '../state/guides.ts'
import { CharonStand } from './Figures.tsx'
import { GuideCard, useGuideDocs } from './GuideCard.tsx'
import { GuideReader } from './GuideReader.tsx'
import type { GuideMode } from './Guides.tsx'

export function GuideShelf({
  signedIn,
  onMode,
  reveal,
  onRevealed,
}: {
  signedIn: boolean
  onMode: (mode: GuideMode) => void
  /** a guide arriving as `/g/<id>`, opened straight away */
  reveal?: string | null
  onRevealed?: () => void
}) {
  const [listed, setListed] = useState<GuideListing[] | null>(null)
  const [at, setAt] = useState(0)
  const [reading, setReading] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void everyGuide().then((found) => {
      if (live) setListed(found)
    })
    return () => {
      live = false
    }
  }, [at])

  const again = useCallback(() => setAt((was) => was + 1), [])

  useEffect(() => {
    if (!reveal) return
    setReading(reveal)
    onRevealed?.()
  }, [reveal, onRevealed])

  const mode: GuideMode = reading ? 'guide' : 'shelf'
  useEffect(() => onMode(mode), [mode, onMode])

  const docs = useGuideDocs(listed ?? [])

  if (reading) {
    return (
      <GuideReader
        id={reading}
        signedIn={signedIn}
        onBack={() => setReading(null)}
        onChanged={again}
      />
    )
  }

  return (
    <div className="builds">
      <CharonStand />
      <div className="guides-shelf">
        <p className="page-standfirst">
          Guides other people wrote. A build named inside one says how it stands in your run while
          you are logging one.
        </p>

        {listed === null ? (
          <p className="acct-quiet">One moment.</p>
        ) : listed.length === 0 ? (
          <p className="acct-quiet">Nobody has published a guide yet. Yours would be the first.</p>
        ) : (
          <ul className="guides-grid">
            {listed.map((one) => (
              <GuideCard
                key={one.id}
                listing={one}
                doc={docs.get(one.id) ?? null}
                onOpen={() => setReading(one.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
