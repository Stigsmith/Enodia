/**
 * Checking the base layouts, once the owner has filled them.
 *
 * This is the "you fill them and I check what you did" half, automated. It
 * reports what each layout produces and fails only on the impossible, because
 * which cards belong in a base is a judgement and judgements are the owner's.
 *
 * **Run `npx vitest run src/data/arcana-layouts.test.ts` after filling one**
 * and the console prints the Grasp total, which conditionals came on, and the
 * reason each of the rest stayed off.
 */

import { describe, expect, it } from 'vitest'

import { arcanaById } from './app.ts'
import { ARCANA_LAYOUTS, isBlank } from './arcana-layouts.ts'
import type { ArcanaLayout } from './arcana-layouts.ts'
import { isConditional, resolveBoard } from '../engine/arcana.ts'

const filled = ARCANA_LAYOUTS.filter((layout) => !isBlank(layout))
const name = (id: string) => arcanaById.get(id)?.name ?? id

describe('the base layouts', () => {
  it('has three slots, whether or not they are written', () => {
    expect(ARCANA_LAYOUTS).toHaveLength(3)
    expect(new Set(ARCANA_LAYOUTS.map((one) => one.id)).size).toBe(3)
  })

  it('says how many are still waiting', () => {
    const waiting = ARCANA_LAYOUTS.length - filled.length
    if (waiting) {
      console.log(`\n  ${waiting} of 3 base layouts are still empty. They are the owner's to write.`)
    }
    expect(waiting).toBeLessThanOrEqual(3)
  })
})

/**
 * `it.each` on an empty list fails the file, and an unwritten layout is not a
 * failure. So the per-layout checks only exist once there is one to check.
 */
describe.skipIf(filled.length === 0)('each filled layout', () => {
  it.each(filled)('$name names only real cards', (layout: ArcanaLayout) => {
    for (const id of layout.cards) {
      expect(arcanaById.has(id), `${layout.name}: no card with id ${id}`).toBe(true)
    }
  })

  it.each(filled)('$name lists only cards you pay for', (layout: ArcanaLayout) => {
    // A conditional card is an outcome, not an input. Listing one would state
    // a result as a cause and the board would disagree with the page.
    for (const id of layout.cards) {
      expect(isConditional(id), `${layout.name}: ${name(id)} switches itself on, so it is not an input`).toBe(
        false,
      )
    }
  })

  it.each(filled)('$name has no card twice', (layout: ArcanaLayout) => {
    expect(new Set(layout.cards).size).toBe(layout.cards.length)
  })

  it.each(filled)('$name reports what it produces', (layout: ArcanaLayout) => {
    const board = resolveBoard(new Set(layout.cards))
    const lines = [
      `\n  ${layout.name}`,
      `    ${board.counted} cards, ${board.grasp} Grasp`,
      `    on:  ${[...board.live].map(name).join(', ') || 'none of the six'}`,
    ]
    for (const [id, unmet] of board.dark) {
      lines.push(`    off: ${name(id)} - ${unmet.map((one) => one.say).join(' ')}`)
    }
    console.log(lines.join('\n'))

    // The only assertion: the six are all accounted for, on or off with a
    // reason. Nothing here says the layout is good.
    expect(board.live.size + board.dark.size).toBe(6)
  })
})
