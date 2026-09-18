/**
 * Guides: yours on one side, everybody's on the other.
 *
 * The same shape as `BuildsScreen.tsx`, and for the same reason: two menu rows
 * into one screen, with a switch in the heading row that both sides share. That
 * is what let Guides arrive without the menu growing, which was the owner's
 * condition for it.
 *
 * Read that file for why the heading is drawn up here, why the side not showing
 * is `hidden` rather than unmounted, and why the slide moves by `left` rather
 * than a transform. This one differs in exactly one way: **both sides open a
 * guide**, so the shared heading steps aside for either, and each side keeps
 * its own answer while the other is up.
 */

import { useCallback, useState } from 'react'

import type { GuideSide } from '../state/prefs.ts'
import { GuideShelf } from './GuideShelf.tsx'
import { Guides } from './Guides.tsx'
import type { GuideMode } from './Guides.tsx'
import { useHelpTopic } from './PageHelp.tsx'
import { SideSwitch } from './SideSwitch.tsx'

/** Placeholders until the owner names them, as the Builds pair are. */
const HALVES = [
  { id: 'mine', label: 'Yours' },
  { id: 'all', label: 'Everybody' },
] as const

export function GuidesScreen({
  side,
  onSide,
  signedIn,
  reveal,
  onRevealed,
}: {
  side: GuideSide
  onSide: (side: GuideSide) => void
  signedIn: boolean
  /** a guide arriving as `/g/<id>`, which lands on everybody's side */
  reveal?: string | null
  onRevealed?: () => void
}) {
  const [mode, setMode] = useState<Record<GuideSide, GuideMode>>({ mine: 'shelf', all: 'shelf' })
  const mineMode = useCallback((next: GuideMode) => setMode((was) => ({ ...was, mine: next })), [])
  const allMode = useCallback((next: GuideMode) => setMode((was) => ({ ...was, all: next })), [])

  /**
   * Which sides have been shown, and whether the side has changed since this
   * screen opened. Both follow `side` during render rather than in an effect,
   * so the side coming into view is mounted and marked in the same frame.
   */
  const [shown, setShown] = useState<{ sides: GuideSide[]; last: GuideSide; moved: boolean }>({
    sides: [side],
    last: side,
    moved: false,
  })
  if (shown.last !== side) {
    setShown({
      sides: shown.sides.includes(side) ? shown.sides : [...shown.sides, side],
      last: side,
      moved: true,
    })
  }

  const headed = mode[side] === 'shelf'
  const pane = (of: GuideSide) =>
    `sides-pane${side === of && shown.moved ? ` is-from-${of === 'all' ? 'right' : 'left'}` : ''}`

  return (
    <div className="sides">
      {headed ? (
        <div className="builds sides-head">
          <header className="builds-top sides-top">
            <h2>Guides</h2>
            <SideSwitch halves={HALVES} side={side} onSide={onSide} label="Whose guides" />
          </header>
        </div>
      ) : null}

      <div className={pane('mine')} hidden={side !== 'mine'}>
        <Guides signedIn={signedIn} onMode={mineMode} />
      </div>

      {/* Not asked for until it is shown, so opening your own guides does not
        * ask the server for everybody else's. A guide arriving by link opens
        * this side, so it counts as shown from the first render. */}
      {shown.sides.includes('all') ? (
        <div className={pane('all')} hidden={side !== 'all'}>
          {side === 'all' ? <HelpTopic topic="guides-all" /> : null}
          <GuideShelf signedIn={signedIn} onMode={allMode} reveal={reveal} onRevealed={onRevealed} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The help mark's topic while everybody's side is showing.
 *
 * A component rather than a call in the screen, because the editor on your side
 * claims its own topic and a claim made up here would run after it and take it
 * back. `BuildsScreen.tsx` hit the same thing first.
 */
function HelpTopic({ topic }: { topic: string }) {
  useHelpTopic(topic)
  return null
}
