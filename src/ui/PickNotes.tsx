/**
 * The notes on a build's picks, as a list, each beside the pick it is about.
 *
 * The hover and the dialog each show the note on the one pick they describe.
 * This is the same notes read all at once: on a phone, where nothing hovers,
 * and by somebody deciding whether to follow a build, who wants the author's
 * reasons before committing rather than one pick at a time.
 */

import { Mark } from './BuildMark.tsx'
import { Prose } from './Prose.tsx'
import type { Assembled, Piece } from './build-pieces.ts'

export function PickNotes({
  built,
  onOpen,
  className = 'builds-how builds-notes',
  heading: Heading = 'h3',
}: {
  built: Assembled
  onOpen?: (piece: Piece) => void
  className?: string
  heading?: 'h3' | 'h4'
}) {
  // A keepsake carried at the start and swapped back to later has one note.
  const seen = new Set<string>()
  const noted = [...built.all, ...built.optional].filter((piece) => {
    if (!piece.note || seen.has(piece.id)) return false
    seen.add(piece.id)
    return true
  })
  if (!noted.length) return null

  return (
    <section className={className} aria-label="Notes on the picks">
      <Heading>Notes on the picks</Heading>
      <ul className="picknotes">
        {noted.map((piece) => (
          <li key={piece.key} className="picknotes-one">
            <Mark piece={piece} size="2.2rem" {...(onOpen ? { onOpen } : {})} />
            <div className="picknotes-body">
              <span className="picknotes-name">{piece.name}</span>
              <p>
                <Prose text={piece.note?.text ?? ''} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
