/**
 * The guide body's format, and the one promise it makes a reader: whatever a
 * stranger's browser sends, `clean` hands on only what `rich.ts` lists.
 */

import { describe, expect, it } from 'vitest'

import { rankMentions } from '../ui/mentions.ts'
import { MAX_RICH_TEXT, clean, fromSections, hasWriting, mentionsIn, plainText, safeHref } from './rich.ts'
import type { RichNode } from './rich.ts'

const text = (value: string, marks?: RichNode['marks']): RichNode => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const para = (...content: RichNode[]): RichNode => ({ type: 'paragraph', content })
const doc = (...content: RichNode[]): RichNode => ({ type: 'doc', content })

describe('clean', () => {
  it('keeps everything it lists, as it was', () => {
    const tree = doc(
      { type: 'heading', attrs: { level: 3 }, content: [text('Sub')] },
      para(text('b', [{ type: 'bold' }, { type: 'italic' }]), { type: 'hardBreak' }, text('c', [{ type: 'highlight' }])),
      { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('one'))] }] },
      { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [para(text('three'))] }] },
      { type: 'blockquote', content: [para(text('q'))] },
      { type: 'horizontalRule' },
      { type: 'callout', attrs: { tone: 'tip' }, content: [para(text('t'))] },
      { type: 'spoiler', attrs: { title: 'End' }, content: [para(text('s'))] },
      para({ type: 'mention', attrs: { kind: 'place', id: 'olympians/zeus', label: 'Zeus' } }),
    )
    expect(clean(tree)).toEqual(tree)
  })

  it('drops a node it does not list and keeps the words inside it', () => {
    expect(clean(doc({ type: 'iframe', attrs: { src: 'https://x' }, content: [para(text('kept'))] }))).toEqual(doc(para(text('kept'))))
  })

  it('drops attributes it does not list, and clamps the ones it does', () => {
    expect(clean(doc({ type: 'heading', attrs: { level: 1, onclick: 'x' }, content: [text('H')] }))).toEqual(
      doc({ type: 'heading', attrs: { level: 2 }, content: [text('H')] }),
    )
    expect(clean(doc({ type: 'callout', attrs: { tone: 'evil' }, content: [para(text('x'))] }))).toEqual(
      doc({ type: 'callout', attrs: { tone: 'note' }, content: [para(text('x'))] }),
    )
  })

  it('keeps a link only to a web page', () => {
    const linked = (href: string) => clean(doc(para(text('x', [{ type: 'link', attrs: { href } }]))))
    expect(linked('https://example.com/a')).toEqual(doc(para(text('x', [{ type: 'link', attrs: { href: 'https://example.com/a' } }]))))
    expect(linked('javascript:alert(1)')).toEqual(doc(para(text('x'))))
    expect(linked('data:text/html,hi')).toEqual(doc(para(text('x'))))
    expect(safeHref(' http://example.com ')).toBe('http://example.com/')
  })

  it('drops a mention of a kind there is not, or with an id that is not one', () => {
    const tagged = (attrs: Record<string, unknown>) => clean(doc(para({ type: 'mention', attrs })))
    expect(tagged({ kind: 'script', id: 'x', label: 'x' })).toEqual(doc({ type: 'paragraph' }))
    expect(tagged({ kind: 'trait', id: '"><img>', label: 'x' })).toEqual(doc({ type: 'paragraph' }))
  })

  it('is nothing for something that is not a tree', () => {
    expect(clean(null)).toBeNull()
    expect(clean('words')).toBeNull()
  })
})

describe('sections, from before the rich body', () => {
  it('become a heading each and their paragraphs, skipping the empty ones', () => {
    const tree = fromSections([
      { heading: 'One', text: 'First.' },
      { heading: 'Two', text: '  ' },
      { heading: 'Three', text: 'A @[Flame Strike](t:HestiaWeaponBoon).' },
    ])
    expect(tree.content?.map((one) => one.type)).toEqual(['heading', 'paragraph', 'heading', 'paragraph'])
    expect(mentionsIn(tree)).toEqual([{ at: { kind: 'trait', id: 'HestiaWeaponBoon' }, name: 'Flame Strike' }])
  })
})

describe('reading it as text', () => {
  it('puts a line between blocks and nothing inside a line', () => {
    expect(plainText(doc({ type: 'heading', attrs: { level: 2 }, content: [text('H')] }, para(text('a'), text('b'))))).toBe('H\nab')
  })

  it('can leave out what a spoiler hides', () => {
    const tree = doc(para(text('open')), { type: 'spoiler', attrs: { title: 'x' }, content: [para(text('secret'))] })
    expect(plainText(tree)).toContain('secret')
    expect(plainText(tree, undefined, false)).not.toContain('secret')
  })

  it('says whether anything is written at all', () => {
    expect(hasWriting(doc(para()))).toBe(false)
    expect(hasWriting(doc(para(text('   '))))).toBe(false)
    expect(hasWriting(doc(para({ type: 'mention', attrs: { kind: 'trait', id: 'ZeusWeaponBoon', label: 'x' } })))).toBe(true)
  })

  it('holds a guide to about ten pages', () => {
    expect(MAX_RICH_TEXT).toBe(20000)
  })
})

describe('tagging a god', () => {
  /**
   * The owner asked for `@` to tag gods as well as items. A god is a section
   * of the wiki, so the god comes first for the god's name, before the boons
   * that only carry it.
   */
  it('finds the god by name, as a section of the wiki', () => {
    const [first] = rankMentions('zeus', null)
    expect(first).toMatchObject({ kind: 'place', id: 'olympians/zeus', name: 'Zeus' })
  })

  it('finds an arm and a person along the way the same way', () => {
    expect(rankMentions('descura', null)[0]).toMatchObject({ kind: 'place', name: 'Descura' })
    expect(rankMentions('circe', null).some((one) => one.kind === 'place' && one.name === 'Circe')).toBe(true)
  })
})
