/**
 * Buy us a Nectar: the one ask, drawn the same wherever it appears.
 *
 * The owner, 4 October 2026: make it glow, put it after every help tour, and
 * put the Nectar itself in a circle the help mark's size, right beside it.
 *
 * The bottle is the game's own: `ResourceData.GiftPoints`, whose display name is Nectar, draws
 * `TextIconPath = "Items\\Resources\\Other\\GiftDrop_Text"`, the small one it
 * puts inline in text. Not `GiftPointsRare` or `GiftPointsEpic`, which are Bath
 * Salts and Twin Lures, whatever the file names suggest.
 *
 * A plain link, never Ko-fi's widget: `data/kofi.ts` says why. And nothing at
 * all when there is no handle, so it cannot point at a stranger.
 */

import { kofiUrl } from '../data/kofi.ts'

const BOTTLE = '/icons/nectar.png'

/** The glowing plate: the bottle and the words. */
export function NectarLink({ say = 'Buy us a Nectar' }: { say?: string }) {
  const url = kofiUrl()
  if (!url) return null
  return (
    <a className="quiet is-call nectar" href={url} target="_blank" rel="noopener noreferrer">
      <img className="nectar-bottle" src={BOTTLE} alt="" />
      {say}
    </a>
  )
}

/**
 * The bottle alone, in a circle beside the help mark. `beside` is false on a
 * screen with no mark, where it takes the mark's corner; `away` hides it while
 * a tour runs, as the mark is hidden, since the tour ends on the Nectar.
 */
export function NectarMark({ beside, away = false }: { beside: boolean; away?: boolean }) {
  const url = kofiUrl()
  if (!url) return null
  return (
    <a
      className={`nectar-mark${beside ? ' is-beside' : ''}${away ? ' is-away' : ''}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Buy us a Nectar"
      aria-label="Buy us a Nectar"
    >
      <img src={BOTTLE} alt="" />
    </a>
  )
}
