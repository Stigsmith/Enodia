/**
 * The guide editor's one field: rich text, with `/` for blocks and `@` to tag.
 *
 * The owner, 4 October 2026: a rich editor rather than a stack of plain boxes,
 * "full ham" on formatting, `/` for the menu and `@` for tagging items, gods
 * and the rest, and Dora writing the placeholder.
 *
 * **Loaded only when somebody writes a guide.** `GuideEditor` reaches this
 * through `React.lazy`, so Tiptap and ProseMirror are their own chunk and
 * nobody who only reads pays for them. What it writes is the tree in
 * `state/rich.ts`, which is read without any of this.
 *
 * ## What it can hold
 *
 * StarterKit's paragraphs, two levels of heading, bold, italic, underline,
 * strike, inline code, code blocks, links, both kinds of list, quotes and
 * dividers; highlight; tables; and two blocks of our own, a **spoiler** a
 * reader opens on purpose and a **callout** in three tones. `rich.ts` lists
 * the same set, and anything the editor could make that it does not list is
 * dropped on the way out.
 *
 * ## `@` and `/`
 *
 * `@` lists what `ui/mentions.ts` can name: every wiki record, every section
 * of the wiki (which is how a god, an arm or a person is named), and the
 * published builds this browser knows. `/` lists blocks. Both are Tiptap's
 * suggestion plugin, drawn by `Suggestions` below in the same rows the plain
 * mention field uses.
 */

import { Extension, Node, mergeAttributes } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Mention from '@tiptap/extension-mention'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { PluginKey } from '@tiptap/pm/state'
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  ReactRenderer,
  useEditor,
  useEditorState,
} from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'

import { loadBuilds } from '../state/builds.ts'
import { fetchMentioned, fromLibrary } from '../state/mentioned.ts'
import { CALLOUT_TONES, MAX_RICH_TEXT, plainText, safeHref } from '../state/rich.ts'
import type { CalloutTone, RichNode } from '../state/rich.ts'
import { pieceOf } from './build-pieces.ts'
import { buildMentionables, linkedBuild, placeOf, rankMentions } from './mentions.ts'
import type { MentionAt, Mentionable } from './mentions.ts'

// ---------------------------------------------------------------------------
// Our two blocks
// ---------------------------------------------------------------------------

function SpoilerView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="rich-spoiler is-editing" data-spoiler="">
      <label className="rich-spoiler-title" contentEditable={false}>
        <span aria-hidden="true">Spoiler</span>
        <input
          type="text"
          value={String(node.attrs.title ?? '')}
          maxLength={80}
          placeholder="What it hides, said without saying it"
          aria-label="What the spoiler is called"
          onChange={(event) => updateAttributes({ title: event.target.value })}
        />
      </label>
      <NodeViewContent className="rich-spoiler-body" />
    </NodeViewWrapper>
  )
}

const TONE_SAYS: Record<CalloutTone, string> = { note: 'Note', tip: 'Tip', warn: 'Watch out' }

function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const tone = (CALLOUT_TONES as readonly string[]).includes(node.attrs.tone) ? (node.attrs.tone as CalloutTone) : 'note'
  const next = CALLOUT_TONES[(CALLOUT_TONES.indexOf(tone) + 1) % CALLOUT_TONES.length]
  return (
    <NodeViewWrapper className={`rich-callout is-${tone} is-editing`}>
      <button
        type="button"
        className="rich-callout-says"
        contentEditable={false}
        title={`Make it ${TONE_SAYS[next ?? 'note']}`}
        onClick={() => updateAttributes({ tone: next })}
      >
        {TONE_SAYS[tone]}
      </button>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

const Spoiler = Node.create({
  name: 'spoiler',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { title: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-spoiler]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-spoiler': '' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(SpoilerView)
  },
})

const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { tone: { default: 'note' } }
  },
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})

// ---------------------------------------------------------------------------
// The list both `@` and `/` open
// ---------------------------------------------------------------------------

type Row = { key: string; name: string; icon: string | null; sub: string | null }

type ListHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean }

type ListProps<T> = {
  items: T[]
  rowOf: (item: T) => Row
  command: (item: T) => void
  label: string
  empty: string
  ref?: Ref<ListHandle>
}

function Suggestions<T>({ items, rowOf, command, label, empty, ref }: ListProps<T>) {
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') {
        setActive((was) => (was + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setActive((was) => (was - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  if (!items.length) return <p className="mention-list rich-suggest is-empty">{empty}</p>
  return (
    <ul className="mention-list rich-suggest" role="listbox" aria-label={label}>
      {items.map((item, index) => {
        const row = rowOf(item)
        return (
          <li
            key={row.key}
            role="option"
            aria-selected={index === active}
            className={`mention-row${index === active ? ' is-active' : ''}`}
            onPointerDown={(event) => {
              event.preventDefault()
              command(item)
            }}
            onPointerEnter={() => setActive(index)}
          >
            <span className="mention-row-art">{row.icon ? <img src={`/${row.icon}`} alt="" loading="lazy" /> : null}</span>
            <span className="mention-row-name">{row.name}</span>
            {row.sub ? <span className="mention-row-sub">{row.sub}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Tiptap's suggestion render hooks, drawing `Suggestions` in a box fixed under
 * the caret. Shared by `@` and `/`, which differ only in what a row says.
 */
function popup<T>(rowOf: (item: T) => Row, label: string, empty: string): SuggestionOptions<T>['render'] {
  return () => {
    let renderer: ReactRenderer<ListHandle, ListProps<T>> | null = null
    const place = (props: SuggestionProps<T>) => {
      const rect = props.clientRect?.()
      const element = renderer?.element as HTMLElement | undefined
      if (!rect || !element) return
      element.style.position = 'fixed'
      element.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`
      element.style.top = `${rect.bottom + 6}px`
      element.style.zIndex = '60'
      element.style.width = '20rem'
    }
    const propsOf = (props: SuggestionProps<T>): ListProps<T> => ({
      items: props.items,
      rowOf,
      command: (item: T) => props.command(item),
      label,
      empty,
    })
    return {
      onStart: (props) => {
        renderer = new ReactRenderer(Suggestions<T>, { props: propsOf(props), editor: props.editor })
        document.body.appendChild(renderer.element)
        place(props)
      },
      onUpdate: (props) => {
        renderer?.updateProps(propsOf(props))
        place(props)
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          renderer?.destroy()
          renderer?.element.remove()
          renderer = null
          return true
        }
        return renderer?.ref?.onKeyDown(props) ?? false
      },
      onExit: () => {
        renderer?.destroy()
        renderer?.element.remove()
        renderer = null
      },
    }
  }
}

// ---------------------------------------------------------------------------
// `@`
// ---------------------------------------------------------------------------

/** The art a mention is drawn with inside the editor. */
function iconOfMention(kind: string, id: string): string | null {
  if (kind === 'build') return null
  if (kind === 'place') return placeOf(id)?.icon ?? null
  return pieceOf({ kind, id } as Extract<MentionAt, { kind: 'trait' | 'arcana' | 'familiar' }>)?.icon ?? null
}

function Tagging(builds: Mentionable[]) {
  return Mention.extend({
    addAttributes() {
      return { ...this.parent?.(), kind: { default: 'trait' } }
    },
  }).configure({
    renderHTML({ node }) {
      const icon = iconOfMention(String(node.attrs.kind), String(node.attrs.id))
      return [
        'span',
        { class: 'mention rich-mention', 'data-kind': node.attrs.kind },
        ...(icon ? [['img', { class: 'mention-art', src: `/${icon}`, alt: '' }]] : []),
        ['span', { class: 'mention-name' }, String(node.attrs.label ?? node.attrs.id)],
      ]
    },
    renderText({ node }) {
      return String(node.attrs.label ?? node.attrs.id)
    },
    suggestion: {
      char: '@',
      allowSpaces: true,
      items: ({ query }) => rankMentions(query, null, 8, builds),
      command: ({ editor, range, props }) => {
        const one = props as unknown as Mentionable
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: 'mention', attrs: { kind: one.kind, id: one.id, label: one.name } },
            { type: 'text', text: ' ' },
          ])
          .run()
      },
      render: popup<Mentionable>(
        (one) => ({ key: `${one.kind}:${one.id}`, name: one.name, icon: one.icon, sub: one.sub }),
        'Tag something from the game',
        'Nothing by that name.',
      ) as unknown as SuggestionOptions['render'],
    },
  })
}

// ---------------------------------------------------------------------------
// `/`
// ---------------------------------------------------------------------------

type Command = { name: string; sub: string; icon: string | null; words: string; run: (editor: Editor, range: Range) => void }

const at = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

/** The blocks `/` offers, in the order a writer reaches for them. */
const COMMANDS: Command[] = [
  { name: 'Heading', sub: 'A section of the guide', icon: null, words: 'heading title h2 section', run: (e, r) => at(e, r).setNode('heading', { level: 2 }).run() },
  { name: 'Subheading', sub: 'A smaller heading inside one', icon: null, words: 'subheading h3 small', run: (e, r) => at(e, r).setNode('heading', { level: 3 }).run() },
  { name: 'Bulleted list', sub: 'Points, in no order', icon: null, words: 'bullet list unordered points', run: (e, r) => at(e, r).toggleBulletList().run() },
  { name: 'Numbered list', sub: 'Steps, in order', icon: null, words: 'numbered ordered list steps', run: (e, r) => at(e, r).toggleOrderedList().run() },
  { name: 'Tip', sub: 'A callout in the theme’s light', icon: null, words: 'tip callout hint', run: (e, r) => at(e, r).insertContent({ type: 'callout', attrs: { tone: 'tip' }, content: [{ type: 'paragraph' }] }).run() },
  { name: 'Watch out', sub: 'A warning callout', icon: null, words: 'warning watch out careful callout danger', run: (e, r) => at(e, r).insertContent({ type: 'callout', attrs: { tone: 'warn' }, content: [{ type: 'paragraph' }] }).run() },
  { name: 'Note', sub: 'A quiet callout', icon: null, words: 'note callout aside', run: (e, r) => at(e, r).insertContent({ type: 'callout', attrs: { tone: 'note' }, content: [{ type: 'paragraph' }] }).run() },
  { name: 'Spoiler', sub: 'Hidden until a reader opens it', icon: null, words: 'spoiler hide hidden reveal', run: (e, r) => at(e, r).insertContent({ type: 'spoiler', attrs: { title: '' }, content: [{ type: 'paragraph' }] }).run() },
  { name: 'Table', sub: 'Three by three, with a header row', icon: null, words: 'table grid compare columns', run: (e, r) => at(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { name: 'Quote', sub: 'Somebody else’s words', icon: null, words: 'quote blockquote', run: (e, r) => at(e, r).toggleBlockquote().run() },
  { name: 'Divider', sub: 'A line across the page', icon: null, words: 'divider rule line hr separator', run: (e, r) => at(e, r).setHorizontalRule().run() },
  { name: 'Code block', sub: 'Text exactly as typed', icon: null, words: 'code block monospace pre', run: (e, r) => at(e, r).toggleCodeBlock().run() },
  { name: 'Tag something', sub: 'A boon, a god, a card, a build', icon: null, words: 'tag mention name boon god build @', run: (e, r) => at(e, r).insertContent('@').run() },
]

const SlashMenu = Extension.create({
  name: 'slashMenu',
  addProseMirrorPlugins() {
    return [
      Suggestion<Command>({
        editor: this.editor,
        pluginKey: new PluginKey('slashMenu'),
        char: '/',
        items: ({ query }) => {
          const wanted = query.toLowerCase().trim()
          return COMMANDS.filter((one) => !wanted || one.name.toLowerCase().includes(wanted) || one.words.includes(wanted))
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: popup<Command>(
          (one) => ({ key: one.name, name: one.name, icon: one.icon, sub: one.sub }),
          'Add a block',
          'No block by that name.',
        ),
      }),
    ]
  },
})

// ---------------------------------------------------------------------------
// Dora's placeholder
// ---------------------------------------------------------------------------

/**
 * What the empty field says, in Dora's voice. The owner's call, 4 October
 * 2026, in place of the four prompts: no outline, just somebody reading over
 * your shoulder.
 */
export const DORA_SAYS =
  'Dora here. Write it however you like, I am only reading. Type / for headings, lists, tables, tips and spoilers, and @ to tag a boon, a god, a card or a build. Nobody is marking this.'

// ---------------------------------------------------------------------------
// The toolbar
// ---------------------------------------------------------------------------

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      table: e.isActive('table'),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  })
  const [linking, setLinking] = useState<string | null>(null)

  const tool = (label: string, glyph: string, on: boolean, run: () => void, disabled = false) => (
    <button
      key={label}
      type="button"
      className={`rich-tool${on ? ' is-on' : ''}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )
  const chain = () => editor.chain().focus()

  const applyLink = () => {
    const href = safeHref(linking ?? '')
    if (href) chain().extendMarkRange('link').setLink({ href }).run()
    setLinking(null)
  }

  return (
    <div className="rich-toolbar" role="toolbar" aria-label="Formatting">
      <div className="rich-tools">
        {tool('Heading', 'H', state.h2, () => chain().toggleHeading({ level: 2 }).run())}
        {tool('Subheading', 'h', state.h3, () => chain().toggleHeading({ level: 3 }).run())}
        <span className="rich-tool-gap" />
        {tool('Bold', 'B', state.bold, () => chain().toggleBold().run())}
        {tool('Italic', 'I', state.italic, () => chain().toggleItalic().run())}
        {tool('Underline', 'U', state.underline, () => chain().toggleUnderline().run())}
        {tool('Strikethrough', 'S', state.strike, () => chain().toggleStrike().run())}
        {tool('Highlight', '▮', state.highlight, () => chain().toggleHighlight().run())}
        {tool('Inline code', '<>', state.code, () => chain().toggleCode().run())}
        {tool('Link', '🔗', state.link, () =>
          state.link ? chain().unsetLink().run() : setLinking(String(editor.getAttributes('link').href ?? 'https://')),
        )}
        <span className="rich-tool-gap" />
        {tool('Bulleted list', '•', state.bullet, () => chain().toggleBulletList().run())}
        {tool('Numbered list', '1.', state.ordered, () => chain().toggleOrderedList().run())}
        {tool('Quote', '❝', state.quote, () => chain().toggleBlockquote().run())}
        {tool('Divider', '┈', false, () => chain().setHorizontalRule().run())}
        {tool('Table', '▦', state.table, () =>
          state.table ? chain().deleteTable().run() : chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        )}
        <span className="rich-tool-gap" />
        {tool('Undo', '↶', false, () => chain().undo().run(), !state.undo)}
        {tool('Redo', '↷', false, () => chain().redo().run(), !state.redo)}
      </div>

      {state.table ? (
        <div className="rich-tools is-table">
          {tool('Add a row', '+ row', false, () => chain().addRowAfter().run())}
          {tool('Add a column', '+ col', false, () => chain().addColumnAfter().run())}
          {tool('Remove the row', '− row', false, () => chain().deleteRow().run())}
          {tool('Remove the column', '− col', false, () => chain().deleteColumn().run())}
        </div>
      ) : null}

      {linking !== null ? (
        <form
          className="rich-link-form"
          onSubmit={(event) => {
            event.preventDefault()
            applyLink()
          }}
        >
          <input
            type="url"
            value={linking}
            autoFocus
            aria-label="Where the link goes"
            onChange={(event) => setLinking(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setLinking(null)
              }
            }}
          />
          <button type="submit" className="quiet">
            Link it
          </button>
          <button type="button" className="quiet" onClick={() => setLinking(null)}>
            Never mind
          </button>
        </form>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

export default function RichEditor({
  value,
  onChange,
}: {
  value: RichNode
  onChange: (doc: RichNode) => void
}) {
  /* Read once when the editor opens, as `MentionField` does: a build published
     while it is open joins the list the next time it opens. */
  const [builds] = useState(() => buildMentionables(loadBuilds()))
  const latest = useRef(onChange)
  latest.current = onChange
  const [length, setLength] = useState(() => plainText(value).length)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https'], defaultProtocol: 'https' },
      }),
      Highlight,
      TableKit.configure({ table: { resizable: false } }),
      Spoiler,
      Callout,
      Tagging(builds),
      SlashMenu,
      Placeholder.configure({
        placeholder: ({ editor: e, pos }) => (pos === 0 && e.isEmpty ? DORA_SAYS : ''),
      }),
    ],
    content: value,
    editorProps: {
      attributes: { class: 'rich rich-editable', 'aria-label': 'The guide', 'aria-multiline': 'true' },
      /**
       * A short link to a build pasted on its own becomes a mention of the
       * build, the way it does in the plain field. Anything else is pasted
       * as it came.
       */
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain') ?? ''
        const published = linkedBuild(text, window.location.origin)
        if (!published) return false
        const known = fromLibrary(published)
        const label = known?.state === 'found' ? known.build.name : published
        const node = view.state.schema.nodes.mention?.create({ kind: 'build', id: published, label })
        if (!node) return false
        view.dispatch(view.state.tr.replaceSelectionWith(node).insertText(' '))
        if (known?.state !== 'found') {
          void fetchMentioned(published).then((answer) => {
            if (answer.state !== 'found') return
            const { state } = view
            state.doc.descendants((one, pos) => {
              if (one.type.name === 'mention' && one.attrs.id === published && one.attrs.label === published) {
                view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...one.attrs, label: answer.build.name }))
                return false
              }
              return true
            })
          })
        }
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as RichNode
      setLength(plainText(doc).length)
      latest.current(doc)
    },
  })

  if (!editor) return <div className="rich-editor is-loading" />

  return (
    <div className="rich-editor" data-tour="guide-body">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <p className="guide-field-foot">
        <span>
          Type <kbd>/</kbd> for blocks, <kbd>@</kbd> to tag something.
        </span>
        {/* Only near the end. A counter on an empty field is a limit announced
          * before anybody has written anything. */}
        <span className={length > MAX_RICH_TEXT ? 'is-over' : ''}>
          {length > MAX_RICH_TEXT * 0.8 ? `${(MAX_RICH_TEXT - length).toLocaleString()} characters left` : ''}
        </span>
      </p>
    </div>
  )
}
