/**
 * One guide, as a card on a shelf.
 *
 * The title, who wrote it, its opening line, and **what it keeps naming**,
 * which nobody types: `counted` reads the mentions out of the guide's own text
 * and the three most named come out as the card's subject. The owner's call, so
 * there is no tag list to maintain and nothing to go stale.
 *
 * The counts are saves and likes, both per guide, neither saying who.
 *
 * ## The payload is unpacked here, not by the list
 *
 * A listing carries the guide packed, because that is what the server stores.
 * `useGuideDocs` unpacks a page of them once and hands back a map, so a shelf
 * of sixty does sixty decompressions on arrival rather than one per render,
 * and a card drawn before its guide has opened draws its title and waits.
 */

import { useEffect, useRef, useState } from 'react'

import { counted, opening, unpackGuide } from '../state/guides.ts'
import type { GuideDoc, GuideListing } from '../state/guides.ts'
import { pieceOf } from './build-pieces.ts'
import { MentionFace, PlaceFace } from './ProseText.tsx'

/**
 * Every guide in a list, unpacked.
 *
 * Keyed on the ids and revisions rather than the array, so a list re-read from
 * the server with the same guides in it does not unpack them all again. A
 * guide that will not unpack is simply absent from the map, and its card says
 * so rather than disappearing: a reader should be told the payload is broken,
 * not shown a shelf with a hole in it.
 */
export function useGuideDocs(listings: readonly GuideListing[]): Map<string, GuideDoc> {
  const [docs, setDocs] = useState<Map<string, GuideDoc>>(new Map())
  /* The work is worth doing when the guides change, and a shelf that joins two
     lists together hands over a new array on every render. So the effect keys
     on what is in the list and reads the list itself out of a ref. */
  const key = listings.map((one) => `${one.id}:${one.revision}`).join(',')
  const held = useRef(listings)
  held.current = listings

  useEffect(() => {
    let live = true
    void Promise.all(
      held.current.map(async (one) => [one.id, await unpackGuide(one.payload)] as const),
    ).then((pairs) => {
      if (!live) return
      setDocs(new Map(pairs.flatMap(([id, doc]) => (doc ? [[id, doc] as const] : []))))
    })
    return () => {
      live = false
    }
  }, [key])

  return docs
}

const when = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export function GuideCard({
  listing,
  doc,
  onOpen,
}: {
  listing: GuideListing
  /** absent while the payload is still being unpacked, or if it will not open */
  doc: GuideDoc | null
  onOpen: () => void
}) {
  const subjects = doc ? counted(doc) : []

  return (
    <li className="gcard" data-tour="guide-card">
      {/* The whole card is the hit area, as a build's card is: a title that is
        * the only way in makes a 300px card with a 20px target in it. */}
      <button type="button" className="gcard-hit" onClick={onOpen}>
        <span className="visually-hidden">Read </span>
        <span className="gcard-title">{listing.title}</span>
      </button>

      <p className="gcard-by">
        {listing.mine ? 'Yours' : `By ${listing.by}`}
        <span className="gcard-dot" aria-hidden="true">
          ·
        </span>
        {when(listing.createdAt)}
        {listing.revision > 1 ? <span className="gcard-rev"> · revised</span> : null}
      </p>

      {/* Marked before the words, because both change what the words mean. */}
      {listing.hidden ? <p className="gcard-mark is-hidden">Hidden by a moderator</p> : null}
      {listing.takenDown ? <p className="gcard-mark">Off the shelves</p> : null}

      {doc === null ? null : <p className="gcard-open">{opening(doc)}</p>}

      {subjects.length ? (
        <ul className="gcard-about">
          {subjects.map((one) => {
            const piece = one.at.kind === 'build' || one.at.kind === 'place' ? null : pieceOf(one.at)
            return (
              <li key={`${one.at.kind}:${one.at.id}`} className="gcard-subject">
                {piece ? (
                  <MentionFace piece={piece} />
                ) : one.at.kind === 'place' ? (
                  <PlaceFace id={one.at.id} name={one.name} />
                ) : (
                  <span className="mention-name">{one.name}</span>
                )}
                {/* How often, and only where it is more than once: a "1" beside
                  * every row is a column of ones. */}
                {one.times > 1 ? <span className="gcard-times">{one.times}</span> : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <GuideCounts stats={listing.stats} />
    </li>
  )
}

/**
 * Saves and likes, and nothing drawn for a guide nobody has touched.
 *
 * `Counted` in `Counted.tsx` makes the same call for a build's numbers, and
 * for the same reason: a row of zeroes reads as a verdict on a guide that has
 * simply just been written.
 */
export function GuideCounts({ stats }: { stats: { saves: number; likes: number } }) {
  if (!stats.saves && !stats.likes) return null
  return (
    <p className="gcard-counts">
      {stats.saves ? <span>Saved by {stats.saves}</span> : null}
      {stats.likes ? <span>Liked by {stats.likes}</span> : null}
    </p>
  )
}
