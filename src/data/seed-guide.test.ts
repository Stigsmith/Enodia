/**
 * The seed guide, "How to beat the RNG", held to the game and to the editor.
 *
 * It lives as `guides/how-to-beat-the-rng.md`, written in full, and was
 * published from it on 25 September 2026 as sections of plain text, which is
 * how guides were written then. Since 4 October a guide is one rich body and
 * the old sections are converted when they are read, so this reads the file
 * as sections, converts it the way the reader does, and holds the result to
 * the game: a keepsake renamed in a patch or a tenth Olympian fails here
 * before anybody reads a stale guide.
 *
 * **The keepsake list is the claim to watch.** The section says every Olympian
 * has a keepsake and names nine. That is true because `keepsakeForGod`, read
 * out of the game's `KeepsakeData.GiftData`, has one per Olympian, and this
 * fails if the two ever stop matching.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MAX_GUIDE_TITLE, asGuide, enough, packGuide, unpackGuide } from '../state/guides.ts'
import type { GuideSection } from '../state/guides.ts'
import { MAX_RICH_TEXT, mentionsIn, textLength } from '../state/rich.ts'
import { pieceOf } from '../ui/build-pieces.ts'
import { parseProse } from '../ui/mentions.ts'
import { keepsakeForGod, olympians, traits } from './app.ts'

const FILE = readFileSync(join(import.meta.dirname, '..', '..', 'guides', 'how-to-beat-the-rng.md'), 'utf8')

/**
 * The guide as the editor would receive it: each `##` heading is a field, and
 * the first `text` block under it is what gets pasted. Everything else in the
 * file is notes for the owner.
 */
function read(markdown: string): { title: string; sections: GuideSection[] } {
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

const written = read(FILE)
const sections = written.sections
const doc = asGuide(written)!
const mentions = mentionsIn(doc.body)

describe('the seed guide, as a reader receives it', () => {
  it('has a title and its sections, in the order it was published', () => {
    expect(doc.title).toBe('How to beat the RNG')
    expect(sections.map((one) => one.heading)).toEqual([
      'What this is',
      'What you need',
      'How it goes',
      'What to watch for',
      'Pom of Power',
      'Shrine of Hermes',
    ])
  })

  it('reads as a heading for every section, in the same order', () => {
    const headings = (doc.body.content ?? [])
      .filter((one) => one.type === 'heading')
      .map((one) => one.content?.[0]?.text)
    expect(headings).toEqual(sections.map((one) => one.heading))
  })

  it('fits what a guide may hold', () => {
    expect(doc.title.length).toBeLessThanOrEqual(MAX_GUIDE_TITLE)
    expect(textLength(doc.body)).toBeLessThanOrEqual(MAX_RICH_TEXT)
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
      if (one.at.kind === 'build' || one.at.kind === 'place') continue
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
    const claim = sections.find((one) => one.text.includes('Every Olympian has one'))
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
    for (const section of sections) {
      expect(section.text.trim(), section.heading).not.toBe('')
    }
    expect(FILE).not.toMatch(/Yours to write/)
  })
})

describe('the file', () => {
  it('has no em dash in it, notes included', () => {
    expect(FILE).not.toContain(String.fromCharCode(0x2014))
  })
})
