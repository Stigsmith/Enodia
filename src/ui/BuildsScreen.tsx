/**
 * Builds: yours on one side, everybody's on the other.
 *
 * The build manager and the build exchange were two screens and two menu rows,
 * drawing the same cards with the same filters over two different lists. They
 * are one screen now, and the heading row carries a switch between the two
 * sides. That keeps the menu the length it was when Guides arrives beside this
 * as the other row.
 *
 * ## What each side is
 *
 * **Yours** is the library, `Builds.tsx`: what you made, what you follow, and
 * the counts on any of them that are published. **The exchange** is
 * `Exchange.tsx`: everything published, and what your friends published.
 *
 * ## Why the heading is drawn here
 *
 * The switch has to be one element that both sides share. Drawn inside each
 * side, pressing it would unmount the button under the finger, focus would
 * drop to the top of the page, and the plate would appear at its new place
 * rather than slide there.
 *
 * A single build and the editor have headings of their own with a way back,
 * so the shared one steps aside while either is up on your side.
 *
 * ## Both sides stay mounted
 *
 * The side not showing is `hidden`, not unmounted, so its filters, search and
 * scroll are where you left them when you come back. The exchange is mounted
 * the first time it is shown rather than on arrival, so opening your own
 * builds does not ask the server for everybody else's.
 *
 * The side that comes into view slides in from its own side, in the same beat
 * as the switch's plate. It moves by `left` rather than a transform, because
 * a transform on an ancestor becomes the box `position: fixed` resolves
 * against, and Charon is fixed.
 */

import { useState } from 'react'

import type { BuildSide } from '../state/prefs.ts'
import { Builds } from './Builds.tsx'
import { Exchange } from './Exchange.tsx'
import { useHelpTopic } from './PageHelp.tsx'
import { SideSwitch } from './SideSwitch.tsx'
import type { View } from './nav.ts'

/** Placeholders until the owner names them. */
const HALVES = [
  { id: 'mine', label: 'Yours' },
  { id: 'all', label: 'The exchange' },
] as const

export function BuildsScreen({
  side,
  onSide,
  onGo,
  libraryAt,
  onLibrary,
  reveal,
  onRevealed,
  signedIn,
}: {
  side: BuildSide
  onSide: (side: BuildSide) => void
  onGo: (view: View) => void
  libraryAt: number
  /** storage changed from this screen in a way the library side has to hear about */
  onLibrary: () => void
  reveal: string | null
  onRevealed: () => void
  signedIn: boolean
}) {
  const [mode, setMode] = useState<'shelf' | 'build'>('shelf')

  /**
   * Which sides have been shown, and whether the side has changed since this
   * screen opened. Both follow `side` during render rather than in an effect,
   * so the side coming into view is mounted and marked in the same frame.
   */
  const [shown, setShown] = useState<{ sides: BuildSide[]; last: BuildSide; moved: boolean }>({
    sides: [side],
    last: side,
    moved: false,
  })
  if (shown.last !== side) {
    setShown({ sides: shown.sides.includes(side) ? shown.sides : [...shown.sides, side], last: side, moved: true })
  }

  const headed = side === 'all' || mode === 'shelf'
  const pane = (of: BuildSide) =>
    `sides-pane${side === of && shown.moved ? ` is-from-${of === 'all' ? 'right' : 'left'}` : ''}`

  return (
    <div className="sides">
      {headed ? (
        <div className="builds sides-head">
          <header className="builds-top sides-top">
            <h2>Builds</h2>
            <SideSwitch halves={HALVES} side={side} onSide={onSide} label="Whose builds" />
          </header>
        </div>
      ) : null}

      <div className={pane('mine')} hidden={side !== 'mine'}>
        <Builds
          libraryAt={libraryAt}
          onGo={onGo}
          reveal={reveal}
          onRevealed={onRevealed}
          signedIn={signedIn}
          onMode={setMode}
        />
      </div>

      {shown.sides.includes('all') ? (
        <div className={pane('all')} hidden={side !== 'all'}>
          {side === 'all' ? <HelpTopic topic="exchange" /> : null}
          <Exchange onGo={onGo} onReclaimed={onLibrary} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The help mark's topic while everybody's side is showing.
 *
 * A component rather than a call in the screen, because the editor on your
 * side claims its own topic and a claim made up here would run after it and
 * take it back.
 */
function HelpTopic({ topic }: { topic: string }) {
  useHelpTopic(topic)
  return null
}
