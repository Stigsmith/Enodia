/**
 * The Arcana board.
 *
 * **The question this answers is "and what about the other cards".** A build
 * says bring Eternity, Excellence and Death. That is three of the twenty-five
 * and it leaves the interesting part unsaid: what you fill the rest with
 * decides which of the six free cards switch themselves on, and one wrong
 * addition turns one off.
 *
 * So this is the game's own five by five, in the game's own positions, with the
 * six conditional cards **derived rather than clicked**. You choose what you
 * pay Grasp for; `engine/arcana.ts` works out the rest and says why each one
 * that stayed dark did.
 *
 * ## The board comes first, and everything else goes beside it
 *
 * On a wide screen the board is what the page is, so it takes the height and
 * the writing sits in a column next to it. The first version stacked an intro
 * and three buttons above the grid, which on 16:9 pushed the bottom row off the
 * screen: a board you have to scroll to see is not a board.
 *
 * ## Three bases, and they are the owner's
 *
 * `data/arcana-layouts.ts` holds three slots. Which cards belong in a base is a
 * judgement, so the slots ship empty and say so rather than carrying a
 * placeholder somebody would mistake for a recommendation.
 *
 * ## A fully unlocked board
 *
 * The game shrinks the grid while cards are still locked, which changes what
 * "a whole row" means for Divinity. That depends on a save this tool cannot
 * read, so the board is five by five here and the page says so.
 */

import { useMemo, useState } from 'react'

import { arcanaBoard, arcanaById } from '../data/app.ts'
import { ARCANA_LAYOUTS, isBlank } from '../data/arcana-layouts.ts'
import { isConditional, resolveBoard } from '../engine/arcana.ts'
import { loadPrefs, savePrefs } from '../state/prefs.ts'

/**
 * `MetaUpgradeCostData` starts at 10 and rises in `CostIncrease` steps as
 * MemPoints are spent. The owner reports it tops out at 30.
 */
const MAX_GRASP = 30

export function Arcana({ onClose }: { onClose?: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [grasp, setGrasp] = useState(() => loadPrefs().graspLimit)
  const [copied, setCopied] = useState(false)

  const board = useMemo(() => resolveBoard(chosen), [chosen])
  const over = board.grasp > grasp

  const toggle = (id: string) => {
    // A conditional card is an outcome. Clicking one would be stating a result
    // as a cause, so they are not controls.
    if (isConditional(id)) return
    setCopied(false)
    setChosen((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setLimit = (value: number) => {
    const clamped = Math.max(1, Math.min(MAX_GRASP, value))
    setGrasp(clamped)
    savePrefs({ ...loadPrefs(), graspLimit: clamped })
  }

  const picked = [...board.chosen]
    .flatMap((id) => {
      const card = arcanaById.get(id)
      return card ? [card] : []
    })
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0) || a.name.localeCompare(b.name))

  return (
    <div className="arcana">
      <header className="builds-top">
        {onClose ? (
          <button type="button" className="builds-back" onClick={onClose}>
            Back
          </button>
        ) : null}
        <h2>Arcana</h2>
      </header>

      <div className="arcana-stage">
        <div className="arcana-grid" role="group" aria-label="The Arcana board">
          {arcanaBoard.map((row, r) =>
            row.map((id, c) => {
              const card = arcanaById.get(id)
              const conditional = isConditional(id)
              const on = conditional ? board.live.has(id) : chosen.has(id)
              const why = board.dark.get(id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`arcana-card${on ? ' is-on' : ''}${conditional ? ' is-free' : ''}`}
                  style={{ gridArea: `${r + 1} / ${c + 1}` }}
                  aria-pressed={conditional ? undefined : on}
                  disabled={conditional}
                  onClick={() => toggle(id)}
                  title={
                    conditional
                      ? `${card?.name}. ${on ? 'On.' : (why ?? []).map((one) => one.say).join(' ')}`
                      : `${card?.name}. Costs ${card?.cost ?? 0}.`
                  }
                >
                  {/* The highlight belongs to the art and nothing else. It sat
                    * on the button before, so it drew a second box round the
                    * name and the cost as well. */}
                  <span className="arcana-art">
                    {card?.icon ? (
                      <img
                        src={`/${(on ? card.icon : card.iconOff) ?? card.icon}`}
                        alt=""
                        loading="lazy"
                      />
                    ) : null}
                  </span>
                  <span className="arcana-name">{card?.name}</span>
                  <span className="arcana-cost">{conditional ? 'free' : (card?.cost ?? 0)}</span>
                </button>
              )
            }),
          )}
        </div>

        <aside className="arcana-side">
          <p className="arcana-intro">
            Six of these cost nothing and switch themselves on. Pick what you pay for; the board
            works out the rest.
          </p>

          <div className="arcana-bases" aria-label="Base layouts">
            {ARCANA_LAYOUTS.map((layout) =>
              isBlank(layout) ? (
                <span key={layout.id} className="arcana-base is-empty">
                  Base not written
                </span>
              ) : (
                <button
                  key={layout.id}
                  type="button"
                  className="arcana-base"
                  onClick={() => {
                    setCopied(false)
                    setChosen(new Set(layout.cards))
                  }}
                  title={layout.say}
                >
                  {layout.name}
                </button>
              ),
            )}
          </div>

          <div className={`arcana-grasp${over ? ' is-over' : ''}`}>
            <span className="arcana-grasp-used">{board.grasp}</span>
            <span className="arcana-grasp-of">of</span>
            <label>
              <span className="visually-hidden">Your Grasp limit</span>
              <input
                type="number"
                min={1}
                max={MAX_GRASP}
                value={grasp}
                onChange={(event) => setLimit(Number(event.target.value) || 1)}
              />
            </label>
            <span className="arcana-grasp-word">Grasp</span>
          </div>
          {over ? <p className="arcana-over">More Grasp than you have.</p> : null}

          <p className="arcana-counted">
            <strong>{board.counted}</strong> paid for, <strong>{board.live.size}</strong> free
            {chosen.size ? (
              <button
                type="button"
                className="arcana-clear"
                onClick={() => {
                  setCopied(false)
                  setChosen(new Set())
                }}
              >
                Clear
              </button>
            ) : null}
          </p>

          {/* What is actually selected, and a way to get it out.
            *
            * The owner fills the three bases and the test checks them, so the
            * ids are the useful form rather than the names: this copies
            * something that can be pasted straight into
            * `data/arcana-layouts.ts`. */}
          {picked.length ? (
            <>
              <h3 className="arcana-rule">
                What you picked
                <button
                  type="button"
                  className="arcana-copy"
                  onClick={() => {
                    const ids = [...board.chosen].map((one) => `'${one}'`).join(', ')
                    navigator.clipboard?.writeText(`[${ids}]`).then(
                      () => setCopied(true),
                      () => setCopied(false),
                    )
                  }}
                >
                  {copied ? 'copied' : 'copy ids'}
                </button>
              </h3>
              <ul className="arcana-picked">
                {picked.map((one) => (
                  <li key={one.id}>
                    <span>{one.name}</span>
                    <span className="arcana-picked-cost">{one.cost ?? 0}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h3 className="arcana-rule">The six that switch themselves on</h3>
          <ul className="arcana-six">
            {arcanaBoard
              .flat()
              .filter(isConditional)
              .map((id) => {
                const on = board.live.has(id)
                const why = board.dark.get(id) ?? []
                return (
                  <li key={id} className={on ? 'is-on' : ''}>
                    <span className="arcana-six-name">{arcanaById.get(id)?.name}</span>
                    <span className="arcana-six-say">
                      {on ? 'On.' : why.map((one) => one.say).join(' ')}
                    </span>
                  </li>
                )
              })}
          </ul>

          <p className="arcana-note">
            A fully unlocked board. The game shrinks the grid while cards are still locked, which
            changes what a whole row means for Divinity.
          </p>
        </aside>
      </div>
    </div>
  )
}
