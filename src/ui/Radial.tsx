/**
 * A radial picker. Bubbles on a circle, each ringed by the game's own frame.
 *
 * Built for the reading posture rather than for looks: a ring of large round
 * targets is faster to hit with a thumb than a column of slabs, and it does not
 * reorder, so the position of a thing is learnable.
 *
 * Hovering lifts one bubble and dims the rest, which is the emphasis tier in
 * `VISUAL.md` doing the work a tooltip would otherwise have to. The tooltip is
 * there too, for the name and the sentence.
 *
 * There is no backdrop behind the ring. The rotating medallion that used to sit
 * there read as a spinning logo rather than as the Crossroads, and the owner
 * cut it. Whatever replaces it is still open.
 *
 * **Art is shaped, and the shape decides the treatment.** A portrait is a face
 * and fills its circle. A boon mark, a slot glyph and a weapon render are
 * rounded squares and cutouts, and a circular crop takes their corners off, so
 * they sit inside the ring at a size that clears it instead.
 */

import { useState } from 'react'

/**
 * How a piece of art wants to be drawn.
 *
 * `portrait` fills the circle, `icon` and `render` sit inside it uncropped.
 * The variant supplies a default, so a ring of one kind never has to say it.
 */
export type ArtShape = 'portrait' | 'icon' | 'render'

export type RadialItem = {
  id: string
  name: string
  icon: string | null
  /** the second line in the tooltip, when there is something worth saying */
  note?: string | null
  art?: ArtShape
}

const DEFAULT_ART: Record<'default' | 'renders' | 'portraits', ArtShape> = {
  default: 'icon',
  renders: 'render',
  portraits: 'portrait',
}

export function Radial({
  items,
  chosen,
  onChoose,
  label,
  /** the one that has already been picked sits in the middle */
  centre,
  /**
   * The default shape for items that do not name one: "renders" for weapon and
   * aspect cutouts, "portraits" for faces.
   */
  variant = 'default',
}: {
  items: RadialItem[]
  chosen: string | null
  onChoose: (id: string) => void
  label: string
  centre?: RadialItem | null
  variant?: 'default' | 'renders' | 'portraits'
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  // A ring of twelve needs smaller bubbles than a ring of four, or they overlap.
  const bubble = items.length <= 6 ? 0.24 : items.length <= 9 ? 0.19 : 0.16

  return (
    <div
      className={`radial is-${variant}${hovered ? ' is-hovering' : ''}`}
      role="group"
      aria-label={label}
      style={{ '--bubble-scale': bubble } as React.CSSProperties}
    >
      <div className="radial-ring-area">

        {centre ? (
          <div className="radial-centre">
            {centre.icon ? <img src={`/${centre.icon}`} alt="" /> : null}
            <span>{centre.name}</span>
          </div>
        ) : null}

        <ul className="radial-ring" style={{ '--count': items.length } as React.CSSProperties}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className={`bubble-slot is-${item.art ?? DEFAULT_ART[variant]}`}
            style={{ '--index': index } as React.CSSProperties}
          >
            <button
              type="button"
              className={`bubble${chosen === item.id ? ' is-chosen' : ''}${hovered === item.id ? ' is-hovered' : ''}`}
              aria-label={item.name}
              aria-pressed={chosen === item.id}
              onClick={() => onChoose(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(item.id)}
              onBlur={() => setHovered(null)}
            >
              {/* Not lazy. A ring holds at most a dozen and they are all on
                  screen at once, so deferring them only buys a pop-in. */}
              {item.icon ? <img src={`/${item.icon}`} alt="" /> : <span className="bubble-blank" />}
            </button>
          </li>
        ))}
        </ul>
      </div>

      <p className="radial-caption" aria-live="polite">
        {hovered ? (
          <>
            <span className="radial-caption-name">{items.find((item) => item.id === hovered)?.name}</span>
            {items.find((item) => item.id === hovered)?.note ? (
              <span className="radial-caption-note">{items.find((item) => item.id === hovered)?.note}</span>
            ) : null}
          </>
        ) : (
          <span className="radial-caption-idle">{label}</span>
        )}
      </p>
    </div>
  )
}
