/**
 * The seed guide, "How to beat the RNG", held to the game and to the editor.
 *
 * It lives as `guides/how-to-beat-the-rng.md`, written in full, until the
 * owner publishes it from the Guides editor, which is the only way a guide
 * goes up under their name. Nothing in the app reads the file, so
 * nothing on screen would say it had gone wrong: a keepsake renamed in a patch,
 * a tenth Olympian, or a section grown past what the editor accepts would sit
 * there until the owner pasted it in and it broke. This reads it the way the
 * editor will and fails first.
 *
 * **The keepsake list is the claim to watch.** The section says every Olympian
 * has a keepsake and names nine. That is true because `keepsakeForGod`, read
 * out of the game's `KeepsakeData.GiftData`, has one per Olympian, and this
 * fails if the two ever stop matching.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MAX_GUIDE_TITLE,
  MAX_HEADING,
  MAX_SECTION,
  MAX_SECTIONS,
  PROMPTS,
  enough,
  packGuide,
  unpackGuide,
} from '../state/guides.ts'
import type { GuideDoc } from '../state/guides.ts'
import { pieceOf } from '../ui/build-pieces.ts'
import { parseProse } from '../ui/mentions.ts'
import { keepsakeForGod, olympians, traits } from './app.ts'

const FILE = readFileSync(join(import.meta.dirname, '..', '..', 'guides', 'how-to-beat-the-rng.md'), 'utf8')

/**
 * The guide as the editor would receive it: each `##` heading is a field, and
 * the first `text` block under it is what gets pasted. Everything else in the
 * file is notes for the owner.
 */
function read(markdown: string): GuideDoc {
  /* A heading with no block under it is notes, like the one on what was found
     on the way, and is not a field. */
  const fields = markdown
    .replace(/\r\n/g, '\n')
    .split(/^## /m)
    .slice(1)
    .flatMap((part) => {
      const block = /```text\n([\s\S]*?)```/.exec(part)
      if (!block) return []
      return [{ heading: part.slice(0, part.indexOf('\n')).trim(), text: (block[1] ?? '').replace(/\n$/, '') }]
    })
  const [title, ...sections] = fields
  return { title: title?.heading === 'Title' ? title.text : '', sections }
}

const doc = read(FILE)
const mentions = doc.sections.flatMap((section) =>
  parseProse(section.text).flatMap((bit) => ('at' in bit ? [bit] : [])),
)

describe('the seed guide, as the editor will receive it', () => {
  it('has a title and opens with the owner’s four prompts, in order', () => {
    expect(doc.title).toBe('How to beat the RNG')
    expect(doc.sections.slice(0, PROMPTS.length).map((one) => one.heading)).toEqual(
      PROMPTS.map((one) => one.heading),
    )
  })

  it('fits what the editor accepts', () => {
    expect(doc.sections.length).toBeLessThanOrEqual(MAX_SECTIONS)
    expect(doc.title.length).toBeLessThanOrEqual(MAX_GUIDE_TITLE)
    for (const section of doc.sections) {
      expect(section.text.length, section.heading).toBeLessThanOrEqual(MAX_SECTION)
    }
    for (const section of doc.sections.slice(PROMPTS.length)) {
      expect(section.heading.length, section.heading).toBeLessThanOrEqual(MAX_HEADING)
    }
  })

  it('goes there and back as a guide, and is enough of one to publish', async () => {
    expect(await unpackGuide(await packGuide(doc))).toEqual(doc)
    expect(enough(doc)).toBe(true)
  })
})

describe('what it names', () => {
  it('names only things the wiki has a record for, and no published build', () => {
    expect(mentions.length).toBeGreaterThan(0)
    for (const one of mentions) {
      expect(one.at.kind, one.name).not.toBe('build')
      if (one.at.kind === 'build') continue
      expect(pieceOf(one.at), `${one.at.kind}:${one.at.id}`).not.toBeNull()
    }
  })

  it('is written with each thing’s current name, so the file reads right before it is pasted', () => {
    for (const one of mentions) {
      expect(traits.get(one.at.id)?.name, one.at.id).toBe(one.name)
    }
  })

  /**
   * "Every Olympian has one", followed by nine names. True only while the
   * game gives each of the nine a keepsake and the section names exactly
   * those, so both halves are checked, in the section that makes the claim.
   */
  it('names every Olympian’s keepsake where it says every Olympian has one, and nothing else there', () => {
    expect(olympians).toHaveLength(9)
    const keepsakes = olympians.map((god) => keepsakeForGod.get(god))
    expect(keepsakes.every(Boolean)).toBe(true)
    const claim = doc.sections.find((one) => one.text.includes('Every Olympian has one'))
    expect(claim).toBeDefined()
    const named = parseProse(claim?.text ?? '').flatMap((bit) => ('at' in bit ? [bit.at.id] : []))
    expect(new Set(named)).toEqual(new Set(keepsakes))
  })
})

describe('as a finished guide', () => {
  /**
   * The owner asked for it written in full on 25 September 2026, so nothing
   * in it is waiting on anybody. A placeholder published by accident would
   * read as a guide somebody forgot to finish.
   */
  it('has something in every section, and no placeholder left', () => {
    for (const section of doc.sections) {
      expect(section.text.trim(), section.heading).not.toBe('')
    }
    expect(FILE).not.toMatch(/Yours to write/)
  })

  it('has the two sections past the prompts, under the game’s own names', () => {
    expect(doc.sections.slice(PROMPTS.length).map((one) => one.heading)).toEqual([
      'Pom of Power',
      'Shrine of Hermes',
    ])
  })
})

describe('the file', () => {
  it('has no em dash in it, notes included', () => {
    expect(FILE).not.toContain(String.fromCharCode(0x2014))
  })
})
