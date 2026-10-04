/**
 * A guide's body: rich text, as a tree.
 *
 * The owner asked on 4 October 2026 for one rich field in place of the guide's
 * plain sections, "full ham" on formatting, `/` for a menu of blocks and `@` to
 * tag things. This file is the format that writing is stored in, and it is
 * deliberately not the editor's: nothing here imports Tiptap, so reading a
 * guide never downloads the editor that wrote it.
 *
 * ## Why a tree and not HTML
 *
 * The shape is ProseMirror's JSON, which is what the editor hands over, so
 * nothing converts between the two. And a tree can be checked node by node:
 * `clean` keeps the node types, marks and attributes listed below and drops
 * everything else, so whatever a stranger's browser sends, a reader is drawn
 * only things this file names. HTML would have to be sanitised as a language;
 * this is sanitised as data. `RichView.tsx` draws it with React, which
 * escapes every character of text.
 *
 * **A link is the one way out of the page**, and the one thing a moderator
 * might ever need to act on. Only `http` and `https` survive `clean`, and a
 * reader's link goes out `rel="nofollow ugc noopener noreferrer"`.
 *
 * ## Mentions are nodes
 *
 * `{ type: 'mention', attrs: { kind, id, label } }`, the same three facts as
 * the `@[label](k:id)` token plain text carries. The id is the meaning and the
 * label only the fallback, exactly as `ui/mentions.ts` says for the token.
 *
 * ## Guides written before this
 *
 * Were a list of sections, each a heading and plain text with tokens in it.
 * `fromSections` turns one into a tree when it is read, so the guide already
 * published reads as it always did, and is saved as a tree the next time its
 * author publishes it.
 */

import { MENTION_KINDS, parseProse } from '../ui/mentions.ts'
import type { MentionAt, MentionKind } from '../ui/mentions.ts'

export type RichMark = { type: string; attrs?: Record<string, unknown> }

export type RichNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: RichNode[]
  text?: string
  marks?: RichMark[]
}

/** The tones a callout can take, each its own colour. */
export const CALLOUT_TONES = ['note', 'tip', 'warn'] as const
export type CalloutTone = (typeof CALLOUT_TONES)[number]

/**
 * Every node a guide may hold, and the attributes each may carry. Anything not
 * here is dropped by `clean`, its text kept where it had any.
 */
const NODES: Record<string, (attrs: Record<string, unknown>) => Record<string, unknown> | undefined> = {
  doc: () => undefined,
  paragraph: () => undefined,
  text: () => undefined,
  hardBreak: () => undefined,
  heading: (a) => ({ level: a.level === 3 ? 3 : 2 }),
  bulletList: () => undefined,
  orderedList: (a) => ({ start: clampInt(a.start, 1, 1, 999) }),
  listItem: () => undefined,
  blockquote: () => undefined,
  horizontalRule: () => undefined,
  codeBlock: () => undefined,
  spoiler: (a) => ({ title: short(a.title, 80) || 'Spoiler' }),
  callout: (a) => ({ tone: CALLOUT_TONES.includes(a.tone as CalloutTone) ? a.tone : 'note' }),
  table: () => undefined,
  tableRow: () => undefined,
  tableHeader: (a) => cell(a),
  tableCell: (a) => cell(a),
  mention: () => undefined,
}

const MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'link'])

/** Deep enough for a list in a quote in a spoiler in a table, and no deeper. */
const MAX_DEPTH = 12

/** As many nodes as a long guide needs, and a ceiling for one that is not a guide. */
const MAX_NODES = 6000

/**
 * The words a guide may hold, counted as a reader sees them. About ten pages,
 * and the figure the payload cap in `worker/guides.ts` was sized against, with
 * room for the tree around the words.
 */
export const MAX_RICH_TEXT = 20000

function clampInt(value: unknown, fallback: number, low: number, high: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(high, Math.max(low, n))
}

function short(value: unknown, most: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, most) : ''
}

function cell(a: Record<string, unknown>) {
  return { colspan: clampInt(a.colspan, 1, 1, 12), rowspan: clampInt(a.rowspan, 1, 1, 50) }
}

/** A link's address, or null for anything that is not plainly a web page. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function cleanMarks(marks: unknown): RichMark[] | undefined {
  if (!Array.isArray(marks)) return undefined
  const out: RichMark[] = []
  for (const mark of marks) {
    const type = (mark as RichMark)?.type
    if (typeof type !== 'string' || !MARKS.has(type) || out.some((one) => one.type === type)) continue
    if (type === 'link') {
      const href = safeHref((mark as RichMark).attrs?.href)
      if (href) out.push({ type, attrs: { href } })
      continue
    }
    out.push({ type })
  }
  return out.length ? out : undefined
}

function cleanMention(attrs: Record<string, unknown>): RichNode | null {
  const kind = attrs.kind as MentionKind
  const id = typeof attrs.id === 'string' ? attrs.id : ''
  if (!MENTION_KINDS.includes(kind) || !/^[A-Za-z0-9_/-]{1,80}$/.test(id)) return null
  return { type: 'mention', attrs: { kind, id, label: short(attrs.label, 80) || id } }
}

/**
 * The tree with nothing in it this file did not list. Null for something that
 * is not a tree at all.
 *
 * An unknown node is replaced by its children rather than dropped with them,
 * so text written inside something a newer editor added is still read.
 */
export function clean(value: unknown): RichNode | null {
  let budget = MAX_NODES
  const walk = (raw: unknown, depth: number): RichNode[] => {
    if (budget <= 0 || typeof raw !== 'object' || raw === null) return []
    budget -= 1
    const node = raw as RichNode
    const attrs = typeof node.attrs === 'object' && node.attrs !== null ? node.attrs : {}
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text) return []
      const marks = cleanMarks(node.marks)
      return [{ type: 'text', text: node.text.slice(0, MAX_RICH_TEXT), ...(marks ? { marks } : {}) }]
    }
    if (node.type === 'mention') {
      const mention = cleanMention(attrs)
      return mention ? [mention] : []
    }
    const children =
      depth < MAX_DEPTH && Array.isArray(node.content) ? node.content.flatMap((one) => walk(one, depth + 1)) : []
    const allowed = typeof node.type === 'string' ? NODES[node.type] : undefined
    if (!allowed) return children
    const kept = allowed(attrs)
    return [{ type: node.type, ...(kept ? { attrs: kept } : {}), ...(children.length ? { content: children } : {}) }]
  }
  const [root] = walk(value, 0)
  if (!root) return null
  return root.type === 'doc' ? root : { type: 'doc', content: [root] }
}

/** A guide with nothing written in it yet. */
export const emptyDoc = (): RichNode => ({ type: 'doc', content: [{ type: 'paragraph' }] })

/** One run of plain text with tokens in it, as inline nodes. */
function inline(text: string): RichNode[] {
  const out: RichNode[] = []
  for (const bit of parseProse(text)) {
    if ('at' in bit) {
      out.push({ type: 'mention', attrs: { kind: bit.at.kind, id: bit.at.id, label: bit.name } })
      continue
    }
    bit.text.split('\n').forEach((line, at) => {
      if (at > 0) out.push({ type: 'hardBreak' })
      if (line) out.push({ type: 'text', text: line })
    })
  }
  return out
}

/**
 * A guide written as sections, as a tree: each section with anything in it is
 * a heading and its paragraphs, a blank line between paragraphs, a single line
 * break kept as one.
 */
export function fromSections(sections: readonly { heading: string; text: string }[]): RichNode {
  const content: RichNode[] = []
  for (const section of sections) {
    if (!section.text.trim()) continue
    if (section.heading.trim()) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: section.heading.trim() }] })
    }
    for (const paragraph of section.text.split(/\n\s*\n/)) {
      if (!paragraph.trim()) continue
      content.push({ type: 'paragraph', content: inline(paragraph.trim()) })
    }
  }
  return content.length ? { type: 'doc', content } : emptyDoc()
}

/** Every mention in the tree, in the order it was written. */
export function mentionsIn(doc: RichNode): { at: MentionAt; name: string }[] {
  const out: { at: MentionAt; name: string }[] = []
  const walk = (node: RichNode) => {
    if (node.type === 'mention' && node.attrs) {
      out.push({
        at: { kind: node.attrs.kind, id: node.attrs.id } as MentionAt,
        name: String(node.attrs.label ?? node.attrs.id ?? ''),
      })
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return out
}

/** Blocks that end a line when the tree is read as plain text. */
const BLOCKS = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'codeBlock',
  'tableRow',
  'spoiler',
  'callout',
  'horizontalRule',
])

/**
 * The tree as plain text: mentions by the name `name` gives them, a space or a
 * line break between blocks. For a card's first line and for counting.
 *
 * `spoilers` false leaves out what is inside a spoiler, so a card never gives
 * away what its author folded away. `headings` false leaves out the headings,
 * so a card's first line is the writing rather than its outline.
 */
export function plainText(
  doc: RichNode,
  name: (at: MentionAt, written: string) => string = (_, written) => written,
  spoilers = true,
  headings = true,
): string {
  let out = ''
  const walk = (node: RichNode) => {
    if (node.type === 'text') out += node.text ?? ''
    else if (node.type === 'hardBreak') out += '\n'
    else if (node.type === 'mention' && node.attrs) {
      out += name({ kind: node.attrs.kind, id: node.attrs.id } as MentionAt, String(node.attrs.label ?? ''))
    } else if ((node.type === 'spoiler' && !spoilers) || (node.type === 'heading' && !headings)) {
      out += '\n'
      return
    }
    node.content?.forEach(walk)
    if (BLOCKS.has(node.type)) out += '\n'
  }
  walk(doc)
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

/** Whether anything has been written: a word, or a mention, or a divider. */
export function hasWriting(doc: RichNode): boolean {
  let found = false
  const walk = (node: RichNode) => {
    if (found) return
    if ((node.type === 'text' && node.text?.trim()) || node.type === 'mention' || node.type === 'horizontalRule') {
      found = true
      return
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return found
}

/** How much a reader would read, in characters. */
export const textLength = (doc: RichNode): number => plainText(doc).length
