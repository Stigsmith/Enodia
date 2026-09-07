/**
 * Escape closes the thing on top.
 *
 * Five places had already written this by hand before there was a hook, and the
 * dialogs had not written it at all: the exchange's listing, a boon's card, a
 * shared build and the run log all opened over the page with no way out but the
 * mouse. That is the gap the owner reported, and it is the one gesture every
 * overlay on every other piece of software answers to.
 *
 * **The listener is on `document` rather than on the dialog** because a dialog
 * that has not been focused never sees the key otherwise, and nothing here traps
 * focus. That is also why the guard below exists.
 */

import type React from 'react'
import { useEffect, useRef } from 'react'

/**
 * Run `close` when Escape is pressed, while `active`.
 *
 * **An Escape somebody nearer the keyboard has already answered is left alone.**
 * `Dropdown.tsx` handles its own Escape on the element and calls
 * `preventDefault`, and React's handlers run on the way up to the root, which is
 * inside `document`, so by the time this listener sees the event the flag is
 * already set. Without the check, one Escape would close the open menu and the
 * dialog underneath it in the same keystroke. Native controls set the flag the
 * same way: a `<select>` with its list open, or a search field being cleared.
 *
 * **The callback goes through a ref rather than the dependency list.** Callers
 * pass an inline arrow, so listing it would tear the listener down and rebuild
 * it every render; leaving it out would freeze the first one, which is wrong the
 * moment the answer depends on state. `LogRun` is exactly that case: Escape
 * means Back while the vow screen is up and Close while it is not.
 */
export function useEscape(active: boolean, close: () => void) {
  const latest = useRef(close)
  latest.current = close

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      latest.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active])
}

/**
 * Clicking the dim outside a dialog closes it, the way Escape does.
 *
 * The four dialogs that answer to `useEscape` are all the same shape: a fixed
 * sheet covering the screen with a panel in the middle of it. Everything
 * outside the panel is that sheet, so "clicked outside" and "clicked the sheet
 * itself rather than anything in it" are the same event, and comparing the
 * target to the element the handler is on says so without a ref or a document
 * listener.
 *
 * The popovers do not use this. `Menu`, `You`, `Dropdown` and the build menu
 * each watch `mousedown` on the document, because none of them draws a sheet:
 * there is no element of theirs for an outside click to land on.
 *
 * **A drag that starts inside must not close it.** Selecting a paragraph and
 * releasing past the edge of the panel fires a click whose target is the sheet,
 * because that is the first ancestor the press and the release have in common.
 * Closing there would eat the selection somebody was making. So the press is
 * recorded too, and both ends have to be on the sheet.
 */
export function useBackdrop(close: () => void): {
  onMouseDown: (event: React.MouseEvent) => void
  onClick: (event: React.MouseEvent) => void
} {
  const startedOutside = useRef(false)
  return {
    onMouseDown: (event) => {
      startedOutside.current = event.target === event.currentTarget
    },
    onClick: (event) => {
      const outside = event.target === event.currentTarget && startedOutside.current
      startedOutside.current = false
      if (outside) close()
    },
  }
}
