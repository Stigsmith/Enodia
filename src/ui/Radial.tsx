/**
 * A radial picker. Bubbles on a circle, with the medallion behind them.
 *
 * Built for the reading posture rather than for looks: a ring of large round
 * targets is faster to hit with a thumb than a column of slabs, and it does not
 * reorder, so the position of a thing is learnable.
 *
 * Hovering lifts one bubble and dims the rest, which is the emphasis tier in
 * `VISUAL.md` doing the work a tooltip would otherwise have to. The tooltip is
 * there too, for the name and the sentence.
 *
 * The medallion behind it is `chrome/medallion.png`, the Daedalus Hammer
 * screen's own backdrop, counter-rotating in the game at RotationSpeed 0.5.
 * Here it turns once every two minutes, which is ambient tier: always running,
 * never asking for attention, and it stops dead under prefers-reduced-motion.
 */

import { useState } from 'react'

export type RadialItem = {
  id: string
  name: string
  icon: string | null
  /** the second line in the tooltip, when there is something worth saying */
  note?: string | null
}

export function Radial({
  items,
  chosen,
  onChoose,
  label,
  /** the one that has already been picked sits in the middle */
  centre,
  /**
   * "cards" zooms the art inside each bubble. The Codex weapon cards are
   * portrait parchment with the weapon in the middle, so a circular crop of one
   * at natural size is mostly card.
   */
  variant = 'default',
}: {
  items: RadialItem[]
  chosen: string | null
  onChoose: (id: string) => void
  label: string
  centre?: RadialItem | null
  variant?: 'default' | 'cards'
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
        <div className="radial-medallion" aria-hidden="true" />

        {centre ? (
          <div className="radial-centre">
            {centre.icon ? <img src={`/${centre.icon}`} alt="" /> : null}
            <span>{centre.name}</span>
          </div>
        ) : null}

        <ul className="radial-ring" style={{ '--count': items.length } as React.CSSProperties}>
        {items.map((item, index) => (
          <li key={item.id} style={{ '--index': index } as React.CSSProperties}>
            <button
              type="button"
              className={`bubble${chosen === item.id ? ' is-chosen' : ''}${hovered === item.id ? ' is-hovered' : ''}`}
              aria-pressed={chosen === item.id}
              onClick={() => onChoose(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(item.id)}
              onBlur={() => setHovered(null)}
            >
              {item.icon ? <img src={`/${item.icon}`} alt="" loading="lazy" /> : <span className="bubble-blank" />}
              <span className="visually-hidden">{item.name}</span>
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
