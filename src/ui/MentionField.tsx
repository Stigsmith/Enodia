/**
 * A text field that names game things when you type `@`.
 *
 * Typing `@` and a few letters lists what could be meant, the build's own
 * picks first, and Enter or Tab puts the highlighted one in as a stored
 * mention, `@[Name](t:Id)`, which `Prose` draws as the thing itself. The arrow
 * keys move through the list and Escape closes it, leaving what was typed.
 *
 * **It stays a plain textarea.** A rich editor stores markup, which has to be
 * cleaned before a stranger reads it, and these fields hold a paragraph at
 * most. So the stored mention is visible while writing and drawn everywhere
 * else.
 *
 * The list sits under the field rather than at the caret, which would need a
 * copy of the text laid out to find where the caret is. Focus never leaves the
 * field: the list is pointed at with `aria-activedescendant`, the way
 * `Dropdown.tsx` does it, so typing carries on where it was.
 */

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { ShownBuild } from '../data/builds.ts'
import { mentionQuery, mentionToken, rankMentions } from './mentions.ts'

type Query = { start: number; query: string }

export function MentionField({
  value,
  onChange,
  build,
  maxLength,
  rows = 3,
  placeholder,
  label,
  field,
  autoFocus = false,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  /** whose picks go first in the list */
  build: ShownBuild | null
  maxLength: number
  rows?: number
  placeholder?: string
  /** for a field with no visible label around it */
  label?: string
  /** `data-field`, which the editor uses to put the cursor in the field a problem is about */
  field?: string
  autoFocus?: boolean
  onBlur?: () => void
}) {
  const [query, setQuery] = useState<Query | null>(null)
  const [active, setActive] = useState(0)
  /** A mention that would not fit under `maxLength`, so the field says so rather than doing nothing. */
  const [full, setFull] = useState(false)
  /** The `@` the list was closed on with Escape. It stays closed until the caret leaves it. */
  const dismissed = useRef<number | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  /** Where the caret goes once a mention is in, which has to wait for the new text to render. */
  const caret = useRef<number | null>(null)
  const id = useId()

  const found = useMemo(() => (query ? rankMentions(query.query, build) : []), [query, build])

  /**
   * Whether the list, or its "nothing" line, is showing.
   *
   * A bare `@` on a build with nothing in it has nothing to offer and says
   * nothing. A query with a space in it and no match is a sentence carrying on
   * rather than a search, so the list gets out of the way of it.
   */
  const open = query !== null && (found.length > 0 || (query.query.length > 0 && !query.query.includes(' ')))

  const look = (element: HTMLTextAreaElement) => {
    const at = element.selectionStart
    const next = at === element.selectionEnd ? mentionQuery(element.value, at) : null
    if (!next) dismissed.current = null
    const shown = next && next.start !== dismissed.current ? next : null
    if (shown?.start === query?.start && shown?.query === query?.query) return
    setQuery(shown)
    setActive(0)
    setFull(false)
  }

  const put = (index: number) => {
    const one = found[index]
    if (!one || !query) return
    const after = value.slice(query.start + 1 + query.query.length)
    // One space after it, unless the text already has one there.
    const token = mentionToken(one, one.name) + (after.startsWith(' ') ? '' : ' ')
    const next = value.slice(0, query.start) + token + after
    if (next.length > maxLength) {
      setFull(true)
      return
    }
    caret.current = query.start + token.length + (after.startsWith(' ') ? 1 : 0)
    setQuery(null)
    onChange(next)
  }

  useLayoutEffect(() => {
    const at = caret.current
    if (at === null || !area.current) return
    caret.current = null
    area.current.setSelectionRange(at, at)
  }, [value])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || event.nativeEvent.isComposing) return
    const last = found.length - 1
    switch (event.key) {
      case 'ArrowDown':
        if (last < 0) return
        event.preventDefault()
        setActive((was) => Math.min(was + 1, last))
        return
      case 'ArrowUp':
        if (last < 0) return
        event.preventDefault()
        setActive((was) => Math.max(was - 1, 0))
        return
      case 'Enter':
      case 'Tab':
        if (last < 0) return
        event.preventDefault()
        put(active)
        return
      case 'Escape':
        // Closing the list is this field's business. The dialog around it
        // must not close as well.
        event.preventDefault()
        event.stopPropagation()
        dismissed.current = query?.start ?? null
        setQuery(null)
        return
    }
  }

  const listed = open && found.length > 0

  return (
    <div className="mention-field">
      <textarea
        ref={area}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={label}
        data-field={field}
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-controls={listed ? `${id}-list` : undefined}
        aria-activedescendant={listed ? `${id}-row-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          look(event.target)
        }}
        onSelect={(event) => look(event.currentTarget)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setQuery(null)
          onBlur?.()
        }}
      />

      {listed ? (
        <ul className="mention-list" role="listbox" id={`${id}-list`} aria-label="Name something from the game">
          {found.map((one, index) => (
            <li
              key={`${one.kind}:${one.id}`}
              id={`${id}-row-${index}`}
              role="option"
              aria-selected={index === active}
              className={`mention-row${index === active ? ' is-active' : ''}`}
              /* Pointer down rather than click, so the field keeps its focus
                 and its caret, which is where the mention goes. */
              onPointerDown={(event) => {
                event.preventDefault()
                put(index)
              }}
              onPointerEnter={() => setActive(index)}
            >
              <span className="mention-row-art">
                {one.icon ? <img src={`/${one.icon}`} alt="" loading="lazy" /> : null}
              </span>
              <span className="mention-row-name">{one.name}</span>
              {one.sub ? <span className="mention-row-sub">{one.sub}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mention-status" role="status">
        {full ? 'That would not fit in this field.' : open && !listed ? 'Nothing by that name.' : ''}
      </p>
    </div>
  )
}
