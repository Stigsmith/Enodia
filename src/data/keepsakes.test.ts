/**
 * The two joins the build detail's suggestions rest on.
 *
 * Both are derived from the game files and both would fail silently. A keepsake
 * map that lost a god renders one fewer suggestion and looks like a build that
 * happens to need fewer gods; a playstyle with no sentence renders nothing at
 * all and looks like a playstyle nobody set. Neither breaks a type or a build,
 * which is the shape of every extractor bug this project has had.
 */

import { describe, expect, it } from 'vitest'

import { keepsakeForGod, olympians, traits } from './app.ts'
import { PLAYSTYLES } from './builds.ts'

describe('the keepsake that makes a god likely', () => {
  /**
   * **Nine, one each.** `CLAUDE.md` records that all nine Olympians have such a
   * keepsake, which is why a fifth god is a keepsake away and the tool must not
   * block one. If this drops to eight, a build wanting that god silently stops
   * being told which keepsake helps.
   */
  it('covers every Olympian and nobody else', () => {
    expect([...keepsakeForGod.keys()].sort()).toEqual([...olympians].sort())
  })

  /* The value has to be a trait this app can name, or the suggestion renders a
     raw id at somebody. Read out of GiftData, so a game patch that renames one
     shows up here rather than on screen. */
  it('names a keepsake the app can render', () => {
    for (const [god, id] of keepsakeForGod) {
      const trait = traits.get(id)
      expect(trait, `${god} -> ${id}`).toBeDefined()
      expect(trait?.kind, `${god} -> ${id}`).toBe('keepsake')
      expect(trait?.name, `${god} -> ${id}`).toBeTruthy()
    }
  })

  /* Two gods sharing a keepsake would mean the join had collapsed onto
     something that is not the god. */
  it('gives each god its own', () => {
    const ids = [...keepsakeForGod.values()]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('what a playstyle means', () => {
  it('explains every one of them', () => {
    for (const one of PLAYSTYLES) {
      expect(one.say, one.id).toBeTruthy()
      expect(one.say.length, one.id).toBeGreaterThan(20)
    }
  })

  /**
   * The game's words, not ours, for the terms themselves.
   *
   * `CLAUDE.md` fixes the vocabulary: Hex rather than spell, Magick rather than
   * mana, Sprint rather than rush. `scripts/validate.ts` scans UI strings for
   * the banned side of that table, and these sentences are UI strings, so this
   * is belt and braces on the one file most likely to reach for the internal
   * word while describing a mechanic.
   */
  it('uses the game’s vocabulary', () => {
    for (const one of PLAYSTYLES) {
      expect(one.say.toLowerCase(), one.id).not.toContain('spell')
      expect(one.say.toLowerCase(), one.id).not.toContain('mana')
      expect(one.say.toLowerCase(), one.id).not.toContain('secondary')
    }
  })
})
