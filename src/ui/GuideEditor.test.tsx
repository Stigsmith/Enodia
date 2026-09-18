// @vitest-environment jsdom

/**
 * Writing a guide.
 *
 * The shape the owner chose, held to: four prompts nobody has to answer, four
 * more sections of the author's own, eight in all. And the two failures that
 * cost somebody their writing rather than their time: a draft that does not
 * survive a reload, and an edit that publishes a second guide instead of
 * replacing the first.
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_SECTIONS,
  PROMPTS,
  blankGuide,
  loadDraft,
  unpackGuide,
} from '../state/guides.ts'
import { forgetMentioned } from '../state/mentioned.ts'
import { GuideEditor } from './GuideEditor.tsx'

const asked: { path: string; init: RequestInit }[] = []

const aServer = (answer = new Response('{"id":"NewGuide1"}', { status: 201 })) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      asked.push({ path, init })
      return answer.clone()
    }),
  )

const fields = () => [...document.querySelectorAll<HTMLTextAreaElement>('.guide-field textarea')]
const headings = () => [...document.querySelectorAll('.guide-field h3')].map((one) => one.textContent)
const button = (label: string) =>
  [...document.querySelectorAll('button')].find((one) => one.textContent === label)
const press = async (label: string) => {
  const found = button(label)
  await act(async () => found?.click())
}
const type = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } })

/**
 * Wait for the request the press set off.
 *
 * Publishing packs the guide first, and packing goes through a
 * `CompressionStream`, which settles over several turns rather than one. A
 * press that is only `act`ed on returns before the request is made, and the
 * request then lands in the next test: three of these were failing on each
 * other's requests before this existed.
 */
const sent = () => vi.waitFor(() => expect(asked.length).toBeGreaterThan(0))

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
  asked.length = 0
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the prompts', () => {
  it('opens as the owner’s four, each with the rest of its prompt beside it', () => {
    aServer()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    expect(headings()).toEqual(PROMPTS.map((one) => one.heading))
    expect([...document.querySelectorAll('.guide-field .guide-hint')].map((one) => one.textContent)).toEqual(
      PROMPTS.map((one) => one.hint),
    )
    /* Nothing is required, so no field is marked as though it were. */
    expect(document.querySelectorAll('textarea[required]')).toHaveLength(0)
  })

  it('is a heading the author writes for anything past the four, up to eight in all', async () => {
    aServer()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    for (let at = PROMPTS.length; at < MAX_SECTIONS; at += 1) await press('Add a section')

    expect(fields()).toHaveLength(MAX_SECTIONS)
    expect(document.querySelectorAll('.guide-heading-field input')).toHaveLength(MAX_SECTIONS - PROMPTS.length)
    expect(button('Add a section')).toBeUndefined()
    expect(document.body.textContent).toContain(`${MAX_SECTIONS} sections is as many as a guide gets.`)
  })

  it('takes one of the author’s back out, and never one of the prompts', async () => {
    aServer()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    await press('Add a section')
    expect([...document.querySelectorAll('button')].filter((one) => one.textContent === 'Remove this section')).toHaveLength(1)
    await press('Remove this section')
    expect(fields()).toHaveLength(PROMPTS.length)
    expect(headings()).toEqual(PROMPTS.map((one) => one.heading))
  })
})

describe('publishing', () => {
  it('is off until there is a title and something written, and says which is missing', async () => {
    aServer()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    expect(button('Publish it')?.disabled).toBe(true)
    expect(document.body.textContent).toContain('A guide needs a title and something written in it.')

    type(document.querySelector('input[data-field="title"]')!, 'How to beat the RNG')
    expect(button('Publish it')?.disabled).toBe(true)

    type(fields()[2]!, 'Take the Hermes reward every time.')
    expect(button('Publish it')?.disabled).toBe(false)
  })

  it('sends the guide as written, and clears the draft once it is up', async () => {
    aServer()
    const done = vi.fn()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={done} onDrop={() => {}} />)
    type(document.querySelector('input[data-field="title"]')!, 'How to beat the RNG')
    type(fields()[0]!, 'For anybody on the Staff.')
    await press('Publish it')
    await sent()

    expect(asked).toHaveLength(1)
    expect(asked[0]?.path).toBe('/api/guides')
    expect(asked[0]?.init.method).toBe('POST')
    const body = JSON.parse(String(asked[0]?.init.body)) as { title: string; payload: string }
    expect(body.title).toBe('How to beat the RNG')
    expect((await unpackGuide(body.payload))?.sections[0]?.text).toBe('For anybody on the Staff.')
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith('NewGuide1'))
    expect(loadDraft()).toBeNull()
  })

  it('replaces the one it is an edit of, rather than minting a second', async () => {
    aServer(new Response('{"id":"Guide12345","revision":2}', { status: 200 }))
    const start = { of: 'Guide12345', doc: { ...blankGuide(), title: 'How to beat the RNG' } }
    start.doc.sections[0] = { heading: 'What this is', text: 'Rewritten.' }
    render(<GuideEditor start={start} onDone={() => {}} onDrop={() => {}} />)
    expect(document.querySelector('h2')?.textContent).toBe('Edit your guide')

    await press('Replace what people are reading')
    await sent()
    expect(asked[0]?.path).toBe('/api/guides/Guide12345')
    expect(asked[0]?.init.method).toBe('PUT')
  })

  it('keeps the writing on screen when the server refuses, and says why', async () => {
    aServer(new Response('{"error":"You have 50 guides up, which is the limit."}', { status: 409 }))
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    type(document.querySelector('input[data-field="title"]')!, 'One more')
    type(fields()[0]!, 'Words worth keeping.')
    await press('Publish it')
    await sent()

    await vi.waitFor(() => expect(document.body.textContent).toContain('50 guides up'))
    expect(fields()[0]?.value).toBe('Words worth keeping.')
    expect(loadDraft()?.doc.sections[0]?.text).toBe('Words worth keeping.')
  })
})

describe('the draft', () => {
  it('is written on every change, so a reload costs nothing', async () => {
    aServer()
    const view = render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={() => {}} />)
    type(document.querySelector('input[data-field="title"]')!, 'Half a title')
    type(fields()[1]!, 'Two unlocks and the Staff.')

    const held = loadDraft()
    expect(held?.of).toBeNull()
    expect(held?.doc.title).toBe('Half a title')
    expect(held?.doc.sections[1]?.text).toBe('Two unlocks and the Staff.')

    /* What a reload is: the page again, from what was stored. */
    view.unmount()
    render(<GuideEditor start={held!} onDone={() => {}} onDrop={() => {}} />)
    expect(document.querySelector<HTMLInputElement>('input[data-field="title"]')?.value).toBe('Half a title')
  })

  it('is gone when it is thrown away, and nothing was published', async () => {
    aServer()
    const drop = vi.fn()
    render(<GuideEditor start={{ of: null, doc: blankGuide() }} onDone={() => {}} onDrop={drop} />)
    type(document.querySelector('input[data-field="title"]')!, 'Never mind')
    await press('Throw it away')
    expect(loadDraft()).toBeNull()
    expect(drop).toHaveBeenCalled()
    expect(asked).toEqual([])
  })
})
