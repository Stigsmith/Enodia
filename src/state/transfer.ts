/**
 * Getting your things out, and getting somebody else's things in.
 *
 * Two jobs that share a format:
 *
 *   **The whole install.** Everything under `enodia.` in one file, so a tester
 *   can hand their work to somebody else, or keep it before clearing a browser.
 *   Nothing about this tool is on a server, which is the point and is also the
 *   risk: a cleared browser is the whole library gone.
 *
 *   **One build, as a link.** `DESIGN.md` 9: a URL fragment, compressed, no
 *   server. A fragment never reaches a server even in the request, so a build
 *   shared in a chat is between the two people in it.
 *
 * ## The play record does not travel
 *
 * `PlayRecord` is how a build has gone *here*: this install's runs, clears and
 * rating. Sending it would have the receiver's copy claiming twelve runs it has
 * never had. `data/builds.ts` nests it under one key so this is one `delete`,
 * which is the whole reason it is nested.
 *
 * ## Why the payload is compressed
 *
 * A build is mostly trait ids, and trait ids are long words that repeat:
 * `PoseidonWeaponBoon`, `PoseidonSprintBoon`. That is the case deflate is best
 * at. `CompressionStream` is native and needs no dependency; where it is
 * missing the payload goes out uncompressed under a different marker, so a
 * reader always knows which it is holding rather than guessing.
 */

import type { SavedBuild, ShownBuild } from '../data/builds.ts'

/** Everything this tool keeps, and the only prefix it may keep it under. */
const PREFIX = 'enodia.'

/** When the last export was taken, so the settings screen can say how long. */
export const EXPORTED_KEY = 'enodia.exportedAt'

export const FILE_VERSION = 1

export type Bundle = {
  app: 'enodia'
  version: number
  exportedAt: string
  /** every `enodia.` key, exactly as stored */
  data: Record<string, string>
}

// ---------------------------------------------------------------------------
// The whole install
// ---------------------------------------------------------------------------

/**
 * Everything, as it sits in storage.
 *
 * Values are kept as their stored strings rather than parsed and re-emitted.
 * A round trip through `JSON.parse` would quietly drop anything this version
 * does not know about, which is exactly what an export must not do: the file
 * has to survive being written by a newer build of the tool than the one
 * reading it back.
 */
export function collect(store: Storage = window.localStorage): Bundle {
  const data: Record<string, string> = {}
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    const value = store.getItem(key)
    if (value !== null) data[key] = value
  }
  return { app: 'enodia', version: FILE_VERSION, exportedAt: new Date().toISOString(), data }
}

/** What a file says it holds, for the screen to show before anything is written. */
export type Manifest = {
  builds: number
  runs: number
  exportedAt: string | null
  keys: number
}

export function describe(bundle: Bundle): Manifest {
  const count = (key: string, field: string) => {
    try {
      const raw = bundle.data[key]
      if (!raw) return 0
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const list = parsed[field]
      return Array.isArray(list) ? list.length : 0
    } catch {
      return 0
    }
  }
  return {
    builds: count('enodia.builds', 'builds'),
    runs: count('enodia.runs', 'runs'),
    exportedAt: typeof bundle.exportedAt === 'string' ? bundle.exportedAt : null,
    keys: Object.keys(bundle.data).length,
  }
}

/** Is this a file this tool wrote? Says why not, so the screen can say it too. */
export function readBundle(text: string): { bundle: Bundle } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'That file is not readable as JSON.' }
  }
  if (typeof parsed !== 'object' || parsed === null) return { error: 'That file is empty.' }
  const candidate = parsed as Partial<Bundle>
  if (candidate.app !== 'enodia') return { error: 'That file was not written by Enodia.' }
  if (typeof candidate.data !== 'object' || candidate.data === null) {
    return { error: 'That file has nothing in it.' }
  }
  const data: Record<string, string> = {}
  for (const [key, value] of Object.entries(candidate.data)) {
    // A file that names a key outside this tool's own prefix is either broken
    // or hostile, and writing it would let a file reach storage it does not own.
    if (!key.startsWith(PREFIX) || typeof value !== 'string') continue
    data[key] = value
  }
  if (!Object.keys(data).length) return { error: 'That file holds nothing this tool can read.' }
  return {
    bundle: {
      app: 'enodia',
      version: typeof candidate.version === 'number' ? candidate.version : FILE_VERSION,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      data,
    },
  }
}

/**
 * Write a bundle into storage, replacing what is there.
 *
 * **It clears this tool's own keys first.** A merge would leave a build the
 * file does not have sitting next to the ones it does, which is neither the
 * state that was exported nor the state that was here, and nobody could say
 * which. Replacing is the only outcome that can be described in one sentence,
 * which is what the screen has to do before anyone presses it.
 */
export function restore(bundle: Bundle, store: Storage = window.localStorage): number {
  const mine: string[] = []
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (key && key.startsWith(PREFIX)) mine.push(key)
  }
  for (const key of mine) store.removeItem(key)
  for (const [key, value] of Object.entries(bundle.data)) store.setItem(key, value)
  return Object.keys(bundle.data).length
}

// ---------------------------------------------------------------------------
// One build, as a link
// ---------------------------------------------------------------------------

/** The marker in front of a payload, so a reader knows how it was packed. */
const PACKED = 'z'
const PLAIN = 'p'

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  // Built on an explicit ArrayBuffer, because `Blob` will not take a view over
  // a SharedArrayBuffer and `Uint8Array.from` alone does not promise it is not.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * What actually goes in the link: the build, minus what is personal to here.
 *
 * `play` is your record of playing it and means nothing in somebody else's
 * library. `publishedAs` and `publishedHash` are stronger than that: they are a
 * claim on a listing, and a link carrying them would hand the person who opened
 * it a build that offers to replace what your followers are reading. This
 * function is also what `packBuild` sends to the server, so stripping here is
 * what keeps them off the wire entirely.
 */
export function shareable(build: ShownBuild): ShownBuild {
  const { play: _play, publishedAs: _publishedAs, publishedHash: _publishedHash, ...rest } = build
  return rest
}

/**
 * Push bytes through a transform and collect what comes out.
 *
 * Built from a `ReadableStream` rather than `new Blob(...).stream()`, and
 * drained by hand rather than through `new Response(...)`. Both of those are
 * conveniences over the same primitive, and depending on either put this on
 * two APIs it does not need: jsdom ships `Blob` without `stream`, so the tests
 * could not exercise the one path that matters.
 */
async function through(bytes: Uint8Array, transform: TransformStream): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const reader = (source.pipeThrough(transform) as ReadableStream<Uint8Array>).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

export async function packBuild(build: ShownBuild): Promise<string> {
  const json = JSON.stringify(shareable(build))
  const bytes = new TextEncoder().encode(json)
  const Compression = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (!Compression) return PLAIN + toBase64Url(bytes)
  return PACKED + toBase64Url(await through(bytes, new Compression('deflate-raw')))
}

export async function unpackBuild(payload: string): Promise<ShownBuild | null> {
  try {
    const marker = payload[0]
    const body = payload.slice(1)
    let json: string
    if (marker === PLAIN) {
      json = new TextDecoder().decode(fromBase64Url(body))
    } else if (marker === PACKED) {
      const Decompression = (globalThis as { DecompressionStream?: typeof DecompressionStream })
        .DecompressionStream
      if (!Decompression) return null
      json = new TextDecoder().decode(
        await through(fromBase64Url(body), new Decompression('deflate-raw')),
      )
    } else {
      return null
    }
    const parsed: unknown = JSON.parse(json)
    return looksLikeBuild(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * The same shallow shape check `state/builds.ts` uses, and for the same reason.
 *
 * A build that fails `engine/build-check.ts` is still a build: somebody may be
 * halfway through one, or a patch may have moved the ground under it. Refusing
 * to receive it would be this tool telling two people they play wrong.
 */
function looksLikeBuild(value: unknown): value is ShownBuild {
  if (typeof value !== 'object' || value === null) return false
  const build = value as Partial<ShownBuild>
  return (
    typeof build.id === 'string' &&
    typeof build.name === 'string' &&
    typeof build.weapon === 'string' &&
    typeof build.aspect === 'string' &&
    Array.isArray(build.boons) &&
    Array.isArray(build.arcana) &&
    Array.isArray(build.hammers)
  )
}

/** The whole link, ready to paste into a chat. */
export async function linkFor(build: ShownBuild, origin: string): Promise<string> {
  return `${origin.replace(/[#?].*$/, '').replace(/\/$/, '')}/#build=${await packBuild(build)}`
}

/** The payload in a URL, or null. Reads the fragment, which never leaves the browser. */
export function buildInUrl(hash: string): string | null {
  const at = hash.indexOf('build=')
  if (at < 0) return null
  const payload = hash.slice(at + 'build='.length).split('&')[0]
  return payload ? decodeURIComponent(payload) : null
}

/**
 * How long since the last export, in whole days, or null if there has not been
 * one. The settings screen turns this into words.
 */
export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((now - then) / 86_400_000))
}

export function readExportedAt(store: Storage = window.localStorage): string | null {
  try {
    return store.getItem(EXPORTED_KEY)
  } catch {
    return null
  }
}

export function markExported(store: Storage = window.localStorage, when = new Date()): string {
  const iso = when.toISOString()
  try {
    store.setItem(EXPORTED_KEY, iso)
  } catch {
    // A browser refusing storage still gets the file.
  }
  return iso
}

/** A build a link brought in, ready for storage. `SavedBuild` needs the four. */
export function received(build: ShownBuild, now = new Date().toISOString()): SavedBuild {
  return {
    ...shareable(build),
    id: build.id,
    created: build.created ?? now,
    // It arrived here now, whatever the sender's clock said.
    modified: now,
    schemaVersion: build.schemaVersion ?? 1,
  }
}
