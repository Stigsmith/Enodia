/**
 * Your side or everybody's, as one control in a screen's heading row.
 *
 * Builds had two screens, the manager and the exchange, drawing the same cards
 * over two different lists. They are one screen now, and this is how you
 * cross it: two halves, a lit plate behind the side you are on, and the plate
 * sliding across when you press the other half, in the same beat as the page
 * below it.
 *
 * **Two real buttons with `aria-pressed`**, not a tab list, because nothing
 * here owns a panel id and the page under it is not a tab panel: it is the
 * same screen showing a different list. Focus stays on the button that was
 * pressed, which is what a keyboard needs to press the other one straight
 * back.
 *
 * The slide is Response tier in `VISUAL.md`, one curve and one duration, and
 * under `prefers-reduced-motion` it is an instant swap rather than nothing,
 * because where the plate sits is what says which side you are on.
 *
 * The labels are placeholders until the owner names them.
 */

export type Half<T extends string> = { id: T; label: string }

export function SideSwitch<T extends string>({
  halves,
  side,
  onSide,
  label,
}: {
  /** left, then right */
  halves: readonly [Half<T>, Half<T>]
  side: T
  onSide: (side: T) => void
  /** what the pair is choosing between, for a screen reader */
  label: string
}) {
  const right = side === halves[1].id
  return (
    <div className={`side-switch${right ? ' is-right' : ''}`} role="group" aria-label={label} data-tour="side-switch">
      <span className="side-switch-plate" aria-hidden="true" />
      {halves.map((half) => (
        <button
          key={half.id}
          type="button"
          className="side-switch-half"
          aria-pressed={half.id === side}
          onClick={() => {
            if (half.id !== side) onSide(half.id)
          }}
        >
          {half.label}
        </button>
      ))}
    </div>
  )
}
