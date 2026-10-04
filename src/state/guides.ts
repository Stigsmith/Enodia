/**
 * Guides, from the browser's side. `worker/guides.ts` is the rest.
 *
 * ## What a guide is
 *
 * A title and one body of rich text, `state/rich.ts`, with builds named inside
 * it as mentions of kind `build`. Nothing else. The builds a guide is about
 * are whatever it names, in the order it names them, so there is no second
 * list for anybody to keep in step with the writing.
 *
 * **It does not have to be about a run.** The owner's list: how to play a
 * weapon, how to beat one boss, how to unlock an achievement, how to build the
 * stupidest thing that still works, how to run at maximum Fear. So the
 * editor offers no outline and assumes no shape.
 *
 * ## Guides from before the rich body
 *
 * Were four prompted sections and up to four more, `GuideSection`. The owner
 * asked on 4 October 2026 for one field instead, headings of the author's own
 * and a line from Dora in it until they start. Old guides are read as they
 * always were: `asGuide` turns the sections into a body on the way in, from a
 * payload or from a draft, and nothing else in the app sees the old shape.
 *
 * ## The payload is opaque to the server
 *
 * Packed with `packText`, exactly as a build is, and stored as text. What
 * travels beside it is the list of build ids the text names, with the shape
 * token this browser holds for each, which is how the server can say later
 * that a named build's picks have changed. It reads neither.
 */

import { fingerprint, shapeOf } from './exchange.ts'
import { fetchMentioned, fromLibrary } from './mentioned.ts'
import { packText, unpackText } from './transfer.ts'
import { nameOfMention } from '../ui/mentions.ts'
import type { MentionAt } from '../ui/mentions.ts'
import { MAX_RICH_TEXT, clean, emptyDoc, fromSections, hasWriting, mentionsIn, plainText, textLength } from './rich.ts'
import type { RichNode } from './rich.ts'

/** One section of a guide written before the rich body: a heading and plain text. */
export type GuideSection = { heading: string; text: string }

export type GuideDoc = { title: string; body: RichNode }

/** As the worker's, so the field stops where the route would refuse. */
export const MAX_GUIDE_TITLE = 120

/** As `MAX_GUIDE_BUILDS` in the worker. Anything past it is dropped there too. */
const MAX_NAMED = 40

export const blankGuide = (): GuideDoc => ({ title: '', body: emptyDoc() })

/** Whether a body is past what a guide may hold. */
export const tooLong = (doc: GuideDoc): boolean => textLength(doc.body) > MAX_RICH_TEXT

/** Whether there is enough of a guide to publish: a title, and a word somewhere. */
export const enough = (doc: GuideDoc): boolean =>
  doc.title.trim() !== '' && hasWriting(doc.body) && !tooLong(doc)

// ---------------------------------------------------------------------------
// What the text names
// ---------------------------------------------------------------------------

/** Every mention in the guide, in the order they were written. */
const mentions = (doc: GuideDoc): { at: MentionAt; name: string }[] => mentionsIn(doc.body)

/** The published builds a guide names, each once, in the order it names them. */
export function namedBuilds(doc: GuideDoc): string[] {
  const out: string[] = []
  for (const one of mentions(doc)) {
    if (one.at.kind !== 'build' || out.includes(one.at.id)) continue
    out.push(one.at.id)
    if (out.length >= MAX_NAMED) break
  }
  return out
}

/** A thing the guide names, and how often. Nobody types these. */
export type Counted = { at: MentionAt; name: string; times: number }

/**
 * What a guide talks about most, counted from its own text.
 *
 * The card shows the first few. **Typed by nobody**, which is the owner's call:
 * a tag list is a second thing to maintain and the first thing to go stale, and
 * what a guide is about is already in what it keeps naming.
 *
 * Ties keep the order they were written in, so the answer does not move about
 * between one render and the next.
 */
export function counted(doc: GuideDoc, limit = 3): Counted[] {
  const out: Counted[] = []
  for (const one of mentions(doc)) {
    const held = out.find((was) => was.at.kind === one.at.kind && was.at.id === one.at.id)
    if (held) held.times += 1
    else out.push({ at: one.at, name: one.name, times: 1 })
  }
  return [...out].sort((a, b) => b.times - a.times).slice(0, limit)
}

/**
 * The opening of a guide, for a card.
 *
 * The writing from the top, without its headings, with its mentions flattened
 * to their current names. A card is a summary and a mention drawn inside one
 * would be a link inside a link, but the name still has to be the thing's
 * own: see `nameOfMention`. What a spoiler hides stays hidden.
 */
export function opening(doc: GuideDoc, max = 180): string {
  const words = plainText(doc.body, nameOfMention, false, false).replace(/\s+/g, ' ').trim()
  if (!words) return ''
  if (words.length <= max) return words
  const cut = words.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}...`
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

/** Packed with the body cleaned first, so nothing goes up that a reader would drop. */
export const packGuide = (doc: GuideDoc): Promise<string> =>
  packText(JSON.stringify({ title: doc.title, body: clean(doc.body) ?? emptyDoc() }))

export async function unpackGuide(payload: string): Promise<GuideDoc | null> {
  const json = await unpackText(payload)
  if (json === null) return null
  try {
    return asGuide(JSON.parse(json))
  } catch {
    return null
  }
}

/**
 * A guide out of whatever was stored, or null for something that is not one.
 *
 * A body is cleaned on the way in, so a reader is only ever handed what
 * `rich.ts` lists. A guide from before the body, sections and all, becomes
 * one here. Anything else on the record is ignored rather than refused: a
 * guide written by a newer version of the tool is still a guide.
 */
export function asGuide(value: unknown): GuideDoc | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { title?: unknown; body?: unknown; sections?: unknown }
  if (typeof raw.title !== 'string') return null
  if (raw.body !== undefined) return { title: raw.title, body: clean(raw.body) ?? emptyDoc() }
  if (
    Array.isArray(raw.sections) &&
    raw.sections.every(
      (one: { heading?: unknown; text?: unknown }) => typeof one?.heading === 'string' && typeof one?.text === 'string',
    )
  ) {
    return { title: raw.title, body: fromSections(raw.sections as GuideSection[]) }
  }
  return null
}

/**
 * The builds a guide names, with the shape token this browser holds for each.
 *
 * The library answers for free. Anything else is read through the same public
 * route a mention uses, so writing about a stranger's build costs one request
 * for it and the answer is cached for the page. A build nothing can find goes
 * up with an empty token, which the worker reads as "no version" and never as
 * "changed".
 */
export async function shapesFor(ids: readonly string[]): Promise<{ id: string; shape: string }[]> {
  return Promise.all(
    ids.map(async (id) => {
      const found = fromLibrary(id) ?? (await fetchMentioned(id))
      return { id, shape: found.state === 'found' ? fingerprint(shapeOf(found.build)) : '' }
    }),
  )
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** A guide as a list hands it over, exactly as `worker/guides.ts` states it. */
export type GuideListing = {
  id: string
  title: string
  payload: string
  by: string
  createdAt: number
  updatedAt: number | null
  revision: number
  mine?: boolean
  takenDown?: boolean
  hidden?: boolean
  stats: { saves: number; likes: number }
  saved?: boolean
  liked?: boolean
  builds: string[]
}

/** A build a guide names, as reading the guide hands it over. */
export type NamedBuild =
  | { id: string; state: 'live'; name: string; payload: string; revision: number; changed: boolean }
  | { id: string; state: 'withdrawn' }
  | { id: string; state: 'gone' }

export type GuideRead = GuideListing & { takenDown: boolean; named: NamedBuild[] }

export type GuideOutcome = { ok: true; id: string } | { ok: false; say: string }

async function refusal(response: Response): Promise<string> {
  if (response.status === 401) return 'You need to be signed in to publish a guide.'
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? 'That did not work.'
  } catch {
    return 'That did not work.'
  }
}

/** What both writes send: the packed guide, its title, and the builds it names. */
async function sent(doc: GuideDoc): Promise<string> {
  return JSON.stringify({
    payload: await packGuide(doc),
    title: doc.title.trim(),
    builds: await shapesFor(namedBuilds(doc)),
  })
}

export async function publishGuide(doc: GuideDoc): Promise<GuideOutcome> {
  try {
    const response = await fetch('/api/guides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await sent(doc),
    })
    if (!response.ok) return { ok: false, say: await refusal(response) }
    const { id } = (await response.json()) as { id: string }
    return { ok: true, id }
  } catch {
    return { ok: false, say: 'Could not reach the server. Nothing was published.' }
  }
}

/** Replace what people are reading. The id stays, so every link to it holds. */
export async function replaceGuide(id: string, doc: GuideDoc): Promise<GuideOutcome> {
  try {
    const response = await fetch(`/api/guides/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: await sent(doc),
    })
    if (!response.ok) return { ok: false, say: await refusal(response) }
    return { ok: true, id }
  } catch {
    return { ok: false, say: 'Could not reach the server. Nothing was changed.' }
  }
}

export type Said = { ok: boolean; say: string }

const asked = async (path: string, init: RequestInit): Promise<Said> => {
  try {
    const response = await fetch(path, init)
    return response.ok ? { ok: true, say: '' } : { ok: false, say: await refusal(response) }
  } catch {
    return { ok: false, say: 'Could not reach the server.' }
  }
}

/** Off every list, and the link keeps working. The author's own lever. */
export const takeDownGuide = (id: string): Promise<Said> =>
  asked(`/api/guides/${id}`, { method: 'DELETE' })

export const putBackGuide = (id: string): Promise<Said> =>
  asked(`/api/guides/${id}/restore`, { method: 'POST' })

/** Saving and liking are two questions, so they are two calls and two counts. */
export const markGuide = (id: string, what: 'save' | 'like', on: boolean): Promise<Said> =>
  asked(`/api/guides/${id}/${what}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on }),
  })

/** Stored for a moderator and returned to nobody. `worker/guides.ts` says why. */
export const reportGuide = (id: string, reason: string): Promise<Said> =>
  asked(`/api/guides/${id}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  })

/**
 * A guide's own address, and the only place its shape is written.
 *
 * `/g/<id>`, beside a build's `/g`-shaped sibling `/b/<id>`, and for the same
 * reason: a path survives being pasted into places that strip fragments, and a
 * guide is a page strangers are meant to find. The wiki is still the only
 * screen whose address stays in the bar; this one is read once on arrival and
 * cleared, exactly as a short link to a build is.
 */
export const guideLink = (id: string): string => `${window.location.origin}/g/${id}`

/** The guide id in the address, or null. */
export function guideInUrl(pathname: string): string | null {
  const found = /^\/g\/([A-Za-z0-9]{1,32})\/?$/.exec(pathname)
  return found ? (found[1] as string) : null
}

/** Everybody's. Public, so this answers signed out, and an empty list is an answer. */
export async function everyGuide(): Promise<GuideListing[]> {
  try {
    const response = await fetch('/api/guides')
    if (!response.ok) return []
    const parsed = (await response.json()) as { guides?: GuideListing[] }
    return parsed.guides ?? []
  } catch {
    return []
  }
}

/** Yours: what you wrote, and what you saved. Null when nobody could be asked. */
export async function myGuides(): Promise<{ written: GuideListing[]; saved: GuideListing[] } | null> {
  try {
    const response = await fetch('/api/guides/mine')
    if (!response.ok) return null
    return (await response.json()) as { written: GuideListing[]; saved: GuideListing[] }
  } catch {
    return null
  }
}

/** One guide, with every build it names. Public. Null for anything not there. */
export async function openGuide(id: string): Promise<GuideRead | null> {
  try {
    const response = await fetch(`/api/g/${id}`)
    if (!response.ok) return null
    return (await response.json()) as GuideRead
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

/**
 * What is being written, kept in this browser until it is published.
 *
 * One draft, not a shelf of them. A guide is a thing you sit down and finish,
 * and a list of half-written ones is a second library to look after. What this
 * is really for is the reload: a screen of writing lost to a stray refresh is
 * the failure worth spending a storage key on.
 *
 * `of` is the published guide being edited, or null for one never published.
 * Publishing it, or dropping it, clears the draft.
 *
 * **Not in `state/sync.ts`'s list of settings**, deliberately, and not stamped.
 * A half-written paragraph racing itself between two browsers on "newest wins"
 * is a way to lose writing, and the published guide is the copy that travels.
 */
const DRAFT = 'enodia.guide.draft'

export type Draft = { of: string | null; doc: GuideDoc }

export function loadDraft(): Draft | null {
  try {
    const raw = globalThis.localStorage.getItem(DRAFT)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const draft = parsed as { of?: unknown; doc?: unknown }
    const doc = asGuide(draft.doc)
    if (!doc) return null
    return { of: typeof draft.of === 'string' ? draft.of : null, doc }
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft): void {
  try {
    globalThis.localStorage.setItem(DRAFT, JSON.stringify(draft))
  } catch {
    // A browser refusing storage still lets somebody write one and publish it.
  }
}

export function clearDraft(): void {
  try {
    globalThis.localStorage.removeItem(DRAFT)
  } catch {
    // Nothing to clear where nothing could be written.
  }
}
