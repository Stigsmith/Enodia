/**
 * A dropdown that can hold pictures.
 *
 * **This exists because `<option>` cannot.** A native select renders its
 * options as plain strings in every engine, so an icon beside "Aspect of Circe"
 * is not a styling problem, it is impossible. The choice is between text-only
 * options and rebuilding the control.
 *
 * Rebuilding it means giving up things the native control had for free, and
 * they are not small:
 *
 * - **The mobile picker.** iOS and Android render a `<select>` as a native
 *   wheel or sheet, which is genuinely better than anything a page can draw.
 *   The compensation here is that below 34rem the list opens as a sheet across
 *   the bottom of the screen rather than as a popup pinned to a control, so it
 *   is still thumb-reachable and still large enough to hit.
 * - **Keyboard behaviour.** Arrow keys, Home and End, Enter and Escape, and
 *   type-ahead are all reimplemented below. A custom listbox without them is a
 *   control keyboard users cannot operate at all.
 * - **Assistive technology.** `combobox` and `listbox` roles, `aria-expanded`,
 *   `aria-selected` and `aria-activedescendant`, so it announces as the control
 *   it is imitating.
 *
 * Focus stays on the button and `aria-activedescendant` points at the highlighted
 * option, rather than moving focus into the list. Both patterns are valid; this
 * one keeps typing where it started, which is what makes type-ahead work.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type DropdownOption = {
  value: string
  label: string
  count?: number
  icon?: string | null
}

export function Dropdown({
  label,
  all,
  options,
  chosen,
  onChoose,
  many = false,
  held,
}: {
  label: string
  /** what the empty choice reads as */
  all: string
  options: DropdownOption[]
  chosen: string | null
  onChoose: (value: string | null) => void
  /**
   * Hold several at once. Off by default, so the nine single-value dropdowns in
   * the editor were not touched to add this.
   *
   * In this mode `onChoose(value)` is a **toggle** and the list stays open,
   * because picking three gods should be three clicks rather than three
   * open-pick-close cycles. `onChoose(null)` still means clear, and still
   * closes: that is the end of the interaction rather than a step in it.
   */
  many?: boolean
  /** What is held, when `many`. Ignored otherwise. */
  held?: readonly string[]
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()

  // The empty choice is a row like any other, so one index space covers both.
  const rows: DropdownOption[] = [{ value: '', label: all }, ...options]
  const picked = many ? (held ?? []) : chosen ? [chosen] : []
  const isPicked = (value: string) => (value === '' ? picked.length === 0 : picked.includes(value))

  /**
   * What the closed control says.
   *
   * One held value shows that value with its art, which is what the single
   * version always did. Several cannot: three icons and three labels do not fit
   * the button, and truncating them picks a winner arbitrarily. So it counts,
   * and the count is the honest summary of a set.
   */
  const current =
    picked.length === 1
      ? (options.find((option) => option.value === picked[0]) ?? null)
      : picked.length > 1
        ? { value: '', label: `${picked.length} chosen` }
        : null

  const close = useCallback(() => {
    setOpen(false)
    typed.current = { text: '', at: 0 }
  }, [])

  const openAt = useCallback(() => {
    const first = picked[0] ?? ''
    const index = rows.findIndex((row) => row.value === first)
    setActive(index < 0 ? 0 : index)
    setOpen(true)
  }, [picked, rows])

  const commit = (index: number) => {
    const row = rows[index]
    if (!row) return
    onChoose(row.value === '' ? null : row.value)
    // Choosing one of several is a step, not the end of the interaction, so the
    // list stays where it is. Clearing is the end, so it closes.
    if (many && row.value !== '') return
    close()
    root.current?.querySelector('button')?.focus()
  }

  /**
   * Anything pressed outside closes it, including another of these.
   *
   * `pointerdown` rather than `mousedown`: it covers mouse, touch and pen with
   * one listener, and it fires before the click that would open the next
   * control, which is what keeps two lists from being on screen at once.
   */
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open, close])

  // Keep the highlighted row in view when arrowing past the visible edge.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = rows.length - 1

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openAt()
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close()
        return
      case 'ArrowDown':
        event.preventDefault()
        setActive((was) => Math.min(was + 1, last))
        return
      case 'ArrowUp':
        event.preventDefault()
        setActive((was) => Math.max(was - 1, 0))
        return
      case 'Home':
        event.preventDefault()
        setActive(0)
        return
      case 'End':
        event.preventDefault()
        setActive(last)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(active)
        return
      case 'Tab':
        close()
        return
    }

    /**
     * Type-ahead, the way a native select does it.
     *
     * Consecutive letters within a second build a prefix and jump to the first
     * row that starts with it, so "he" reaches Hera rather than bouncing
     * between Hephaestus and Hestia on each keystroke.
     */
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now()
      const text = (now - typed.current.at < 1000 ? typed.current.text : '') + event.key.toLowerCase()
      typed.current = { text, at: now }
      const found = rows.findIndex((row) => row.label.toLowerCase().startsWith(text))
      if (found >= 0) {
        event.preventDefault()
        setActive(found)
      }
    }
  }

  return (
    <div className={`bdrop${chosen ? ' is-on' : ''}${open ? ' is-open' : ''}`} ref={root}>
      <span className="bdrop-label" id={`${id}-label`}>
        {label}
      </span>

      <button
        type="button"
        className="bdrop-button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label`}
        aria-activedescendant={open ? `${id}-row-${active}` : undefined}
        onClick={() => (open ? close() : openAt())}
        onKeyDown={onKeyDown}
      >
        <Face option={current} fallback={all} />
        <span className="bdrop-caret" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          className="bdrop-list"
          role="listbox"
          id={`${id}-list`}
          aria-labelledby={`${id}-label`}
          aria-multiselectable={many || undefined}
          ref={list}
        >
          {rows.map((row, index) => (
            <li
              key={row.value || '_all'}
              id={`${id}-row-${index}`}
              role="option"
              aria-selected={isPicked(row.value)}
              data-active={index === active}
              className={`bdrop-row${index === active ? ' is-active' : ''}${
                isPicked(row.value) ? ' is-chosen' : ''
              }`}
              /* Pointer down rather than click, so the button's own blur does
                 not close the list before the click lands, and so a touch
                 commits on the same event a mouse does. */
              onPointerDown={(event) => {
                event.preventDefault()
                commit(index)
              }}
              onPointerEnter={() => setActive(index)}
            >
              <Face option={row.value ? row : null} fallback={all} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * One row's contents, used by the button and by the list.
 *
 * Shared so the closed control shows exactly what the open list showed, art
 * included. A row with no icon keeps the icon column, or the labels in a list
 * of mixed rows would not line up.
 */
function Face({ option, fallback }: { option: DropdownOption | null; fallback: string }) {
  if (!option) return <span className="bdrop-face is-empty">{fallback}</span>
  return (
    <span className="bdrop-face">
      <span className="bdrop-icon">
        {option.icon ? <img src={`/${option.icon}`} alt="" loading="lazy" /> : null}
      </span>
      <span className="bdrop-text">{option.label}</span>
      {typeof option.count === 'number' ? <span className="bdrop-count">{option.count}</span> : null}
    </span>
  )
}
