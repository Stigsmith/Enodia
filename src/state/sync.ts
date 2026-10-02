/**
 * Carrying an account's things between a phone and a desktop.
 *
 * `worker/sync.ts` is the other half and holds the merge. This side has the
 * harder job, because the server deals in one uniform kind of thing and the
 * browser deals in seven different shapes that all predate this feature.
 *
 * ## What travels, and how it is identified
 *
 * | kind | one item per | id | when it changed |
 * |---|---|---|---|
 * | `build` | build in the library | `build.id` | `modified`, already on it |
 * | `bin` | build in the bin | `build.id` | `binnedAt`, already on it |
 * | `run` | finished run | its `at` | the same `at` |
 * | `setting` | whole `localStorage` key | the key | `state/stamps.ts` |
 *
 * A finished run has no id of its own, so its `at` is both. Two runs ending in
 * the same millisecond would collide, which is not a real event.
 *
 * Settings are whole keys rather than fields. The theme, the wallpaper map, the
 * menu mode, your name, the preferences, the live run and its snapshot are all
 * one value each as far as this is concerned, and the whole value is what wins
 * or loses. Splitting them into fields would buy finer merges of things nobody
 * edits on two devices at once.
 *
 * ## Applying is not the same as editing
 *
 * `apply` writes other people's changes into local storage **without stamping
 * them**, and that is load bearing. A stamp means "this device changed this",
 * and stamping an arriving change would make it look like a local edit, so it
 * would be sent back on the next sync as though it were news. Two devices would
 * then keep handing the same item to each other forever.
 *
 * ## It is not a backup, and it is not the record either
 *
 * Everything still lives in the browser and still works with no account at all.
 * This copies, it does not move: sign out and your builds are exactly where
 * they were. What the account buys is that the copy is waiting on the other
 * device, which is the thing the owner actually asked for.
 */

import {
  type Kind,
  buried,
  caughtUpTo,
  nowCaughtUpTo,
  stamp,
  stampOf,
  tombstones,
} from './stamps.ts'

/** One thing in flight. The same shape `worker/sync.ts` reads. */
export type Item = {
  kind: Kind
  id: string
  payload: string
  modified: number
  deleted?: boolean
}

/**
 * The `localStorage` keys that travel whole.
 *
 * Listed rather than discovered, because `localStorage` is shared with anything
 * else on the origin and a wildcard would sync whatever happened to be there.
 *
 * `enodia.stamps`, `enodia.tombstones` and `enodia.sync.since` are deliberately
 * absent: they are this device's account of the conversation, not content, and
 * syncing them would have each device overwrite the other's idea of what it had
 * already said.
 */
const SETTINGS = [
  'enodia.name',
  'enodia.theme',
  'enodia.wallpaper',
  'enodia.nav',
  'enodia.frame',
  'enodia.skin',
  'enodia.prefs',
  'enodia.exported',
  'enodia.run.active',
  'enodia.run.snapshot',
] as const

const raw = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const put = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage full or blocked. The sync is lost, not the data.
  }
}

const asMillis = (iso: string | undefined): number => {
  const at = iso ? Date.parse(iso) : Number.NaN
  return Number.isFinite(at) ? at : 0
}

type Envelope = { version?: number; builds?: unknown }

/** Read one of the two build stores without going through their loaders, which
 * migrate and would rewrite storage as a side effect of a read. */
function storedBuilds(key: string): Record<string, unknown>[] {
  try {
    const text = raw(key)
    if (!text) return []
    const record = JSON.parse(text) as Envelope
    return Array.isArray(record.builds) ? (record.builds as Record<string, unknown>[]) : []
  } catch {
    return []
  }
}

function storedRuns(): Record<string, unknown>[] {
  try {
    const text = raw('enodia.runs')
    if (!text) return []
    const record = JSON.parse(text) as { runs?: unknown }
    return Array.isArray(record.runs) ? (record.runs as Record<string, unknown>[]) : []
  } catch {
    return []
  }
}

/**
 * Give a date to settings that were here before dates existed.
 *
 * Everybody already using the tool has a theme, a name and preferences written
 * by a version that stamped nothing. Those are real choices and they have to be
 * able to travel, but `gather` will not offer anything unstamped, so without
 * this they would sit on one device forever while the account stayed empty.
 *
 * **Once, ever, and guarded.** If it ran again later it would stamp values that
 * `apply` had just written, which is precisely the thing `apply` avoids doing:
 * they would then be offered back to the server as this device's own news.
 *
 * The date used is now rather than a guess at the real one, so between two
 * long-standing devices the one signed in second wins. That is arbitrary, and
 * it is at least a rule somebody can be told.
 */
const BACKFILLED = 'enodia.sync.backfilled'

export function backfillStamps(at: number = Date.now()): void {
  try {
    if (window.localStorage.getItem(BACKFILLED)) return
    for (const key of SETTINGS) {
      if (raw(key) !== null && stampOf(key) === 0) stamp(key, at)
    }
    window.localStorage.setItem(BACKFILLED, '1')
  } catch {
    // A browser refusing storage syncs as a new device, which loses nothing.
  }
}

/** Everything this device could tell the server about. */
export function gather(): Item[] {
  const items: Item[] = []

  for (const build of storedBuilds('enodia.builds')) {
    const id = typeof build.id === 'string' ? build.id : null
    if (!id) continue
    items.push({
      kind: 'build',
      id,
      payload: JSON.stringify(build),
      modified: asMillis(build.modified as string) || asMillis(build.created as string),
    })
  }

  for (const build of storedBuilds('enodia.bin')) {
    const id = typeof build.id === 'string' ? build.id : null
    if (!id) continue
    items.push({
      kind: 'bin',
      id,
      payload: JSON.stringify(build),
      modified: asMillis(build.binnedAt as string),
    })
  }

  for (const run of storedRuns()) {
    const at = typeof run.at === 'string' ? run.at : null
    if (!at) continue
    items.push({ kind: 'run', id: at, payload: JSON.stringify(run), modified: asMillis(at) })
  }

  for (const key of SETTINGS) {
    const at = stampOf(key)
    /**
     * **No stamp, nothing to say.** Two different situations reach this line
     * and neither is something to offer.
     *
     * A key this device has never had is not a delete, it is an absence, and
     * offering it as one would let a fresh phone propose wiping an account's
     * settings.
     *
     * A key that is present but unstamped is one this device was *told* about
     * by `apply`, which deliberately does not stamp. Offering it back would
     * return the server's own news to it as though it were new.
     *
     * Settings that predate stamps entirely are handled once by
     * `backfillStamps`, not here, so that a read stays a read.
     */
    if (at === 0) continue
    const value = raw(key)
    items.push({
      kind: 'setting',
      id: key,
      payload: value ?? '',
      modified: at,
      deleted: value === null,
    })
  }

  for (const gone of tombstones()) {
    items.push({ kind: gone.kind, id: gone.id, payload: '', modified: gone.at, deleted: true })
  }

  return items
}

/** Write one collection back, replacing what is there. */
function writeCollection(key: string, builds: unknown[], wrapper: 'builds' | 'runs'): void {
  put(key, JSON.stringify(wrapper === 'builds' ? { version: 1, builds } : { version: 1, runs: builds }))
}

/**
 * Put what the server sent into local storage.
 *
 * **Nothing here stamps.** See the note at the top: a stamp means this device
 * changed something, and an arriving change is not that. Tombstones are the
 * exception and are recorded locally, because a delete that is applied without
 * being remembered would be re-offered on the next sync forever.
 */
export function apply(items: Item[]): void {
  if (items.length === 0) return

  const builds = new Map(
    storedBuilds('enodia.builds').map((one) => [one.id as string, one] as const),
  )
  const bin = new Map(storedBuilds('enodia.bin').map((one) => [one.id as string, one] as const))
  const runs = new Map(storedRuns().map((one) => [one.at as string, one] as const))

  let touchedBuilds = false
  let touchedBin = false
  let touchedRuns = false

  for (const item of items) {
    if (item.kind === 'setting') {
      put(item.id, item.deleted ? null : item.payload)
      continue
    }

    const into =
      item.kind === 'build' ? builds : item.kind === 'bin' ? bin : item.kind === 'run' ? runs : null
    if (!into) continue

    if (item.deleted) {
      into.delete(item.id)
      // Remembered, or this device offers it back on every future sync.
      buried(item.kind, item.id, item.modified)
    } else {
      try {
        into.set(item.id, JSON.parse(item.payload) as Record<string, unknown>)
      } catch {
        // A payload this browser cannot parse is skipped rather than fatal. It
        // stays on the server and a newer client may understand it.
        continue
      }
    }

    if (item.kind === 'build') touchedBuilds = true
    else if (item.kind === 'bin') touchedBin = true
    else touchedRuns = true
  }

  if (touchedBuilds) writeCollection('enodia.builds', [...builds.values()], 'builds')
  if (touchedBin) writeCollection('enodia.bin', [...bin.values()], 'builds')
  if (touchedRuns) writeCollection('enodia.runs', [...runs.values()], 'runs')
}

export type SyncResult =
  | { ok: true; changed: number }
  | { ok: false; say: string; signedOut?: boolean }

/**
 * One exchange with the server, and the only function anything else calls.
 *
 * Returns how many items arrived, so a caller can decide whether the screen
 * needs redrawing. Failure is reported rather than thrown: a sync that does not
 * happen is not an error a person needs to see, it is a thing to try again.
 */
export async function syncNow(): Promise<SyncResult> {
  const since = caughtUpTo()

  let response: Response
  try {
    response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ since, items: gather() }),
    })
  } catch {
    return { ok: false, say: 'Could not reach the server. Nothing here has changed.' }
  }

  // Not signed in is not a failure worth showing. It is the normal state of
  // most people using this, and the caller decides whether it means anything.
  if (response.status === 401) return { ok: false, say: 'Not signed in.', signedOut: true }

  if (!response.ok) {
    try {
      const body = (await response.json()) as { error?: string }
      return { ok: false, say: body.error ?? 'That did not work.' }
    } catch {
      return { ok: false, say: 'That did not work.' }
    }
  }

  try {
    const body = (await response.json()) as { now: number; items: Item[] }
    apply(body.items)
    /**
     * Only after applying. A high water mark saved before the write would skip
     * everything in that answer if the write then failed, and those items would
     * never be offered again.
     */
    nowCaughtUpTo(body.now)
    return { ok: true, changed: body.items.length }
  } catch {
    return { ok: false, say: 'The server said something this version does not understand.' }
  }
}
