// @vitest-environment jsdom

/**
 * Writing a guide.
 *
 * The shape the owner chose on 4 October 2026, held to: a title and one rich
 * field with no outline, Dora in it until somebody writes, and Publish off
 * until there is a title and a word. And the two failures that cost somebody
 * their writing rather than their time: a draft that does not survive a
 * reload, and an edit that publishes a second guide instead of replacing the
 * first.
 *
 * The field is the real editor, lazily loaded as it is in the app. Typing goes
 * through Tiptap's own `insertContent`, which is what a keystroke ends in, so
 * what is checked is what the editor hands back rather than what a test wished
 * it would.
 */

import type { Editor } from '@tiptap/core'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { blankGuide, loadDraft, unpackGuide } from '../state/guides.ts'
import { forgetMentioned } from '../state/mentioned.ts'
import { plainText } from '../state/rich.ts'
import { GuideEditor } from './GuideEditor.tsx'
import { DORA_SAYS } from './RichEditor.tsx'

const asked: { path: string; init: RequestInit }[] = []

const aServer = (answer = new Response('{"id":"NewGuide1"}', { status: 201 })) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      asked.push({ path, init })
      return answer.clone()
    }),
  )

const button = (label: string) =>
  [...document.querySelectorAll('button')].find((one) => one.textContent === label)
const press = async (label: string) => {
  const found = button(label)
  await act(async () => found?.click())
}
const title = (value: string) =>
  fireEvent.change(document.querySelector('input[data-field="title"]')!, { target: { value } })

/** The editor, once its chunk has loaded. */
async function editor(): Promise<Editor> {
  let found: Editor | undefined
  await vi.waitFor(() => {
    found = (document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null)?.editor
    expect(found).toBeDefined()
  })
  return found!
}

/** Writing, as the editor receives a keystroke. */
async function write(text: string) {
  const field = await editor()
  await act(async () => {
    field.chain().focus('end').insertContent(text).run()
  })
}

/** See `GuidesScreen.test.tsx`: packing settles over several turns. */
const sent = () => vi.waitFor(() => expect(asked.length).toBeGreaterThan(0))

/**
 * jsdom lays nothing out, so a Range has no rectangles. ProseMirror asks a
 * range for them when it scrolls the caret into view; an empty answer is what
 * a browser gives for a collapsed one off screen, and is all it needs.
 */
const nothing = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
Range.prototype.getClientRects ??= nothing
Range.prototype.getBoundingClientRect ??= () => new DOMRect()

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
  asked.length = 0
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the field', () => {
  it('is one field with no outline, and Dora in it until somebody writes', async () => {
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    await editor()
    expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1)
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    expect(document.querySelector('.ProseMirror p')?.getAttribute('data-placeholder')).toBe(DORA_SAYS)
    expect(button('Add a section')).toBeUndefined()
  })

  it('has the formatting along the top', async () => {
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    await editor()
    const tools = [...document.querySelectorAll('.rich-tool')].map((one) => one.getAttribute('aria-label'))
    for (const tool of ['Heading', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Highlight', 'Link', 'Bulleted list', 'Numbered list', 'Quote', 'Divider', 'Table']) {
      expect(tools, tool).toContain(tool)
    }
  })
})

describe('publishing', () => {
  it('is off until there is a title and something written, and says which is missing', async () => {
    aServer()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    await editor()
    expect(button('Publish it')?.disabled).toBe(true)
    expect(document.body.textContent).toContain('A guide needs a title.')

    title('How to beat the RNG')
    expect(button('Publish it')?.disabled).toBe(true)
    expect(document.body.textContent).toContain('And something written in it.')

    await write('Take the Hermes reward every time.')
    expect(button('Publish it')?.disabled).toBe(false)
  })

  it('sends the guide as written, and clears the draft once it is up', async () => {
    aServer()
    const done = vi.fn()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={done} onDrop={() => {}} />)
    title('How to beat the RNG')
    await write('<h2>Who it is for</h2><p>For anybody on the <strong>Staff</strong>.</p>')
    await press('Publish it')
    await sent()

    expect(asked).toHaveLength(1)
    expect(asked[0]?.path).toBe('/api/guides')
    expect(asked[0]?.init.method).toBe('POST')
    const body = JSON.parse(String(asked[0]?.init.body)) as { title: string; payload: string }
    expect(body.title).toBe('How to beat the RNG')
    const back = await unpackGuide(body.payload)
    expect(back?.body.content?.map((one) => one.type)).toEqual(['heading', 'paragraph'])
    expect(plainText(back!.body)).toBe('Who it is for\nFor anybody on the Staff.')
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith('NewGuide1'))
    expect(loadDraft()).toBeNull()
  })

  it('sends a mention as a mention, and the builds it names alongside', async () => {
    aServer()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    title('Builds')
    const field = await editor()
    await act(async () => {
      field
        .chain()
        .focus('end')
        .insertContent([
          { type: 'text', text: 'Try ' },
          { type: 'mention', attrs: { kind: 'build', id: 'aB3xK9pQmR', label: 'Killer Current' } },
          { type: 'text', text: ' with ' },
          { type: 'mention', attrs: { kind: 'place', id: 'olympians/zeus', label: 'Zeus' } },
        ])
        .run()
    })
    await press('Publish it')
    /* A build named in it is looked up first, for its shape, then the guide goes. */
    await vi.waitFor(() => expect(asked.some((one) => one.path === '/api/guides')).toBe(true))
    const post = asked.find((one) => one.path === '/api/guides')
    const body = JSON.parse(String(post?.init.body)) as { payload: string; builds: { id: string }[] }
    expect(body.builds.map((one) => one.id)).toEqual(['aB3xK9pQmR'])
    const back = await unpackGuide(body.payload)
    expect(back?.body.content?.[0]?.content?.filter((one) => one.type === 'mention')).toEqual([
      { type: 'mention', attrs: { kind: 'build', id: 'aB3xK9pQmR', label: 'Killer Current' } },
      { type: 'mention', attrs: { kind: 'place', id: 'olympians/zeus', label: 'Zeus' } },
    ])
  })

  it('replaces the one it is an edit of, rather than minting a second', async () => {
    aServer(new Response('{"id":"Guide12345","revision":2}', { status: 200 }))
    const start = {
      of: 'Guide12345',
      doc: {
        title: 'How to beat the RNG',
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rewritten.' }] }] },
      },
    }
    render(<GuideEditor start={start} onDone={() => {}} onDrop={() => {}} />)
    expect(document.querySelector('h2')?.textContent).toBe('Edit your guide')
    await editor()

    await press('Replace what people are reading')
    await sent()
    expect(asked[0]?.path).toBe('/api/guides/Guide12345')
    expect(asked[0]?.init.method).toBe('PUT')
  })

  it('keeps the writing on screen when the server refuses, and says why', async () => {
    aServer(new Response('{"error":"You have 50 guides up, which is the limit."}', { status: 409 }))
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    title('One more')
    await write('Words worth keeping.')
    await press('Publish it')
    await sent()

    await vi.waitFor(() => expect(document.body.textContent).toContain('50 guides up'))
    expect(document.querySelector('.ProseMirror')?.textContent).toBe('Words worth keeping.')
    expect(plainText(loadDraft()!.doc.body)).toBe('Words worth keeping.')
  })
})

describe('the draft', () => {
  it('is written on every change, so a reload costs nothing', async () => {
    aServer()
    const view = render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    title('Half a title')
    await write('Two unlocks and the Staff.')

    const held = loadDraft()
    expect(held?.of).toBeNull()
    expect(held?.doc.title).toBe('Half a title')
    expect(plainText(held!.doc.body)).toBe('Two unlocks and the Staff.')

    /* What a reload is: the page again, from what was stored. */
    view.unmount()
    render(<GuideEditor start={held!} onDone={() => {}} onDrop={() => {}} />)
    expect(document.querySelector<HTMLInputElement>('input[data-field="title"]')?.value).toBe('Half a title')
    await vi.waitFor(() => expect(document.querySelector('.ProseMirror')?.textContent).toBe('Two unlocks and the Staff.'))
  })

  it('opens a draft written before the rich field as one, sections and all', async () => {
    window.localStorage.setItem(
      'enodia.guide.draft',
      JSON.stringify({ of: null, doc: { title: 'Old', sections: [{ heading: 'How it goes', text: 'Kept.' }] } }),
    )
    const held = loadDraft()
    render(<GuideEditor start={held!} onDone={() => {}} onDrop={() => {}} />)
    await vi.waitFor(() => expect(document.querySelector('.ProseMirror h2')?.textContent).toBe('How it goes'))
    expect(document.querySelector('.ProseMirror p')?.textContent).toBe('Kept.')
  })

  it('is gone when it is thrown away, and nothing was published', async () => {
    aServer()
    const drop = vi.fn()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={drop} />)
    title('Never mind')
    await press('Throw it away')
    expect(loadDraft()).toBeNull()
    expect(drop).toHaveBeenCalled()
    expect(asked).toEqual([])
  })
})
