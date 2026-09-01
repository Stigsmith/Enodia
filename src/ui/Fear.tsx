/**
 * How much Fear a build has cleared, as the game would draw it.
 *
 * The skull is the game's own `ShrinePoint.png`, which is the icon it puts
 * beside a Fear total on the Oath of the Unseen, and the arrows are its own
 * settings arrows. Both were already extracted and sitting unused, which was
 * the point: the tool holds ninety-odd pieces of this chrome and the builder
 * was using almost none of it.
 *
 * **A number, not a vow sheet.** Seventeen vows with thirty-eight ranks between
 * them is a screen of its own. This is the one number that answers the question
 * anybody actually asks of a build, which is how far it got.
 */

import { MAX_FEAR } from '../data/builds.ts'

export function FearStepper({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (fear: number | undefined) => void
}) {
  const held = value ?? 0

  /**
   * Clamped here as well as at the edges of the range.
   *
   * The arrows cannot leave the range on their own, but the field can be typed
   * into, and `PlayStrip` clamps again when it draws. Same reasoning `winRate`
   * gives for clamping clears against runs: storage is a text file a person can
   * edit and a build can arrive from another install.
   */
  const step = (by: number) => {
    const next = Math.max(0, Math.min(MAX_FEAR, held + by))
    onChange(next === 0 ? undefined : next)
  }

  return (
    <div className="editor-field">
      <span>Fear cleared</span>
      <div className="fear">
        <img className="fear-skull" src="/icons/fear.png" alt="" aria-hidden="true" />

        <input
          className="fear-value"
          type="number"
          min={0}
          max={MAX_FEAR}
          value={value ?? ''}
          placeholder="0"
          aria-label={`Fear cleared, 0 to ${MAX_FEAR}`}
          onChange={(event) => {
            const read = Number.parseInt(event.target.value, 10)
            if (!Number.isFinite(read)) return onChange(undefined)
            onChange(Math.max(0, Math.min(MAX_FEAR, read)) || undefined)
          }}
        />

        <span className="fear-arrows">
          <button
            type="button"
            className="fear-arrow"
            disabled={held >= MAX_FEAR}
            aria-label="More Fear"
            onClick={() => step(1)}
          >
            <img src="/shell/settings-arrow-up.png" alt="" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="fear-arrow"
            disabled={held <= 0}
            aria-label="Less Fear"
            onClick={() => step(-1)}
          >
            <img src="/shell/settings-arrow-down.png" alt="" aria-hidden="true" />
          </button>
        </span>

        <span className="fear-of">of {MAX_FEAR}</span>
      </div>
    </div>
  )
}

/**
 * The skull and the number, for anywhere that is reading rather than editing.
 *
 * Draws nothing at zero. A build nobody has taken into a Fear run has no Fear
 * to report, and a row of zeroes across a library would be furniture claiming
 * to be information, which is the same argument `PlayStrip` makes for itself.
 */
export function FearMark({ fear }: { fear: number | undefined }) {
  const held = Math.max(0, Math.min(MAX_FEAR, fear ?? 0))
  if (!held) return null

  return (
    <span className="fearmark" title={`Cleared at Fear ${held} of ${MAX_FEAR}`}>
      <img src="/icons/fear.png" alt="" aria-hidden="true" />
      <span>{held}</span>
      <span className="visually-hidden">Fear cleared</span>
    </span>
  )
}
