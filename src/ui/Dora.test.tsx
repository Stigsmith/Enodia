// @vitest-environment jsdom

/**
 * Dora on the Roadmap, and the screens that downloaded her without drawing her.
 *
 * `DoraWatching` rendered a plain `<img>` inside a wrapper that `builds.css` hid
 * unless the window was at least 96rem wide and 58rem tall, so a phone or a
 * short window that opened the Roadmap fetched `dora-hardhat.webp`, 71 KB, and
 * never showed it. Measured under `wrangler dev` on 17 September 2026 at
 * 375x812: requested with a 200, 71,518 bytes over the wire, `complete` true,
 * `naturalWidth` 427, and the wrapper `display: none`.
 *
 * jsdom has no layout and fetches no images, so these check what decides the
 * request: whether the image element exists at all.
 *
 * **Her gate has two conditions and Charon's has one**, so the window here has a
 * width and a height and answers her query from them. A stand-in that gave
 * every query the same answer would pass with the height condition deleted.
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Roadmap } from './Pages.tsx'

/**
 * One rem, as a media query reads it.
 *
 * A query takes rem from the browser's initial font size and never from the
 * page's own CSS, so this is the browser default of 16 whatever the stylesheet
 * sets.
 */
const REM = 16

/**
 * A window of a given size, answering media queries the way a browser does.
 *
 * Only `min-width` and `min-height` in rem, joined by `and`, because that is
 * all the Roadmap asks. Anything else throws, so a new query on this page fails
 * here rather than being answered wrong.
 *
 * Returns a resize, which tells every query whose answer changed, the way a
 * browser fires `change`.
 */
function aWindow(width: number, height: number) {
  const size = { width, height }
  const asked: { answer: () => boolean; was: boolean; listeners: Set<() => void> }[] = []

  const answering = (query: string) => {
    const parts = query.split(' and ').map((part) => {
      const found = /^\(min-(width|height): (\d+(?:\.\d+)?)rem\)$/.exec(part)
      if (!found) throw new Error(`The stand-in window cannot answer ${query}`)
      return { axis: found[1] as 'width' | 'height', px: Number(found[2]) * REM }
    })
    return () => parts.every(({ axis, px }) => size[axis] >= px)
  }

  const matchMedia = (query: string) => {
    const one = { answer: answering(query), was: false, listeners: new Set<() => void>() }
    one.was = one.answer()
    asked.push(one)
    return {
      media: query,
      get matches() {
        return one.answer()
      },
      addEventListener: (_type: string, listener: () => void) => one.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => one.listeners.delete(listener),
    }
  }
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia })

  return (toWidth: number, toHeight: number) => {
    size.width = toWidth
    size.height = toHeight
    for (const one of asked) {
      const now = one.answer()
      if (now === one.was) continue
      one.was = now
      for (const listener of one.listeners) listener()
    }
  }
}

const dora = () => document.querySelector('.dora-watching')
/** Either of her two pictures, since both are what a browser would fetch. */
const picture = () => document.querySelector('img[src^="/ui/dora-"]')

afterEach(cleanup)

describe('Dora on the Roadmap', () => {
  /* The one every phone paid for. */
  it('is not in the page, and so not downloaded, on a phone', () => {
    aWindow(375, 812)
    render(<Roadmap />)

    expect(dora()).toBeNull()
    expect(picture()).toBeNull()
  })

  /**
   * The half of her gate Charon does not have.
   *
   * Wide enough and not tall enough. `builds.css` measured two paragraphs
   * behind her at 1600x900.
   */
  it('is not in the page on a window wide enough but too short', () => {
    aWindow(1600, 900)
    render(<Roadmap />)

    expect(dora()).toBeNull()
    expect(picture()).toBeNull()
  })

  it('is drawn where there is room, holding the anchor the Roadmap tour points at', () => {
    aWindow(1600, 950)
    render(<Roadmap />)

    const anchor = document.querySelector('[data-tour="dora-watching"]')
    expect(anchor?.closest('.dora-watching')).not.toBeNull()
    expect(anchor?.querySelector('img')?.getAttribute('src')).toBe('/ui/dora-hardhat.webp')
  })

  it('answers a poke where she is drawn', () => {
    aWindow(1600, 950)
    const view = render(<Roadmap />)

    fireEvent.click(view.getByTitle('Dora'))

    expect(view.getByRole('status').textContent).toBe('Hm.')
  })

  /* Across each of the two lines, both ways, without a reload. */
  it('arrives and leaves as the window crosses her gate', () => {
    const resize = aWindow(1600, 900)
    render(<Roadmap />)
    expect(dora()).toBeNull()

    act(() => resize(1600, 950))
    expect(picture()).not.toBeNull()

    act(() => resize(1535, 950))
    expect(dora()).toBeNull()

    act(() => resize(1536, 950))
    expect(picture()).not.toBeNull()

    act(() => resize(1536, 927))
    expect(dora()).toBeNull()
  })

  /**
   * Leaving the page does not reset her, which is how it was when the
   * stylesheet hid her instead.
   *
   * The poke loop only works if she notices you are still doing it, and a
   * window dragged across the line is not a new visitor. Compared against her
   * first line rather than her second, so rewording her does not break this.
   */
  it('still knows she was poked after the window takes her away and brings her back', () => {
    const resize = aWindow(1600, 950)
    const view = render(<Roadmap />)
    fireEvent.click(view.getByTitle('Dora'))
    const first = view.getByRole('status').textContent

    act(() => resize(1600, 900))
    act(() => resize(1600, 950))
    fireEvent.click(view.getByTitle('Dora'))

    expect(view.getByRole('status').textContent).not.toBe(first)
  })
})
