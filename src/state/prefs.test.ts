/**
 * The settings, read back.
 *
 * `loadPrefs` builds its answer field by field, so anything it does not name
 * is dropped on the next read however faithfully it was saved. `guideSide`
 * shipped that way on its first day: written on every press of the switch and
 * gone again by the next reload, with nothing on screen to say so except
 * Guides opening on the wrong side.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { loadPrefs, savePrefs } from './prefs.ts'

beforeEach(() => {
  window.localStorage.clear()
})

describe('which side each screen was left on', () => {
  it('survives a reload, for Builds and for Guides separately', () => {
    savePrefs({ ...loadPrefs(), buildSide: 'all', guideSide: 'mine' })
    const back = loadPrefs()
    expect(back.buildSide).toBe('all')
    expect(back.guideSide).toBe('mine')
  })

  it('is absent when nobody has chosen, so each screen can give its own answer', () => {
    const fresh = loadPrefs()
    expect(fresh.buildSide).toBeUndefined()
    expect(fresh.guideSide).toBeUndefined()
  })

  it('drops a side that is not one of the two', () => {
    window.localStorage.setItem('enodia.prefs', JSON.stringify({ ...loadPrefs(), guideSide: 'theirs' }))
    expect(loadPrefs().guideSide).toBeUndefined()
  })
})
