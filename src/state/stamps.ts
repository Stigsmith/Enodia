/**
 * When each local thing last changed, and what has been thrown away.
 *
 * Sync merges on "newest wins", and until this file existed there was nothing
 * to compare. A build carries `modified` and an archived run carries `at`, but
 * the theme, the wallpaper, the menu mode, your name and the preferences are
 * bare values written straight into `localStorage` with no record of when. A
 * merge over those would not be resolving a conflict, it would be guessing.
 *
 * Two records are kept here, and they are different problems.
 *
 * **Stamps** say when a key was last written. One number per `localStorage`
 * key, kept beside the data rather than inside it, because the alternative is
 * changing the stored shape of seven different things and migrating each one.
 *
 * **Tombstones** say what was thrown away and when. A delete has to travel, and
 * a thing that is simply absent is indistinguishable from a thing that never
 * existed: without this, deleting on a phone and syncing a desktop that still
 * holds the item would put it back. `worker/schema-app.ts` explains the same
 * problem from the server's side, and this is the half that feeds it.
 *
 * Both are written on every change and read only by `state/sync.ts`. A browser
 * that refuses storage loses them and syncs as though it were new, which is the
 * right failure: nothing is destroyed, some things are merely re-sent.
 */

const STAMPS = 'enodia.stamps'
const TOMBS = 'enodia.tombstones'

/** What sync can carry. `setting` is a whole key; the rest are collections. */
export type Kind = 'build' | 'run' | 'bin' | 'setting'

export type Tombstone = { kind: Kind; id: string; at: number }

/**
 * `globalThis` rather than `window`, and it is not stylistic.
 *
 * These are the same object in a browser. They are not in a test that swaps in
 * a storage shim: `src/ui/theme.test.ts` redefines `globalThis.localStorage` to
 * prove a wallpaper survives a reload, and a helper reaching for
 * `window.localStorage` would quietly write past the shim and read back
 * nothing. Whatever the caller's own bare `localStorage` resolves to is what
 * this has to use too.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A browser refusing storage still works for this session. Sync will treat
    // this device as new next time, which re-sends rather than loses.
  }
}

/**
 * Record that `key` changed just now.
 *
 * Called by whoever did the writing rather than by a wrapper around
 * `localStorage`, because a wrapper would stamp every incidental write
 * including the ones `apply` makes while putting somebody else's changes in,
 * and those must not look like local edits or the two devices would argue
 * forever about which of them changed a thing neither of them touched.
 */
export function stamp(key: string, at: number = Date.now()): void {
  const all = read<Record<string, number>>(STAMPS, {})
  all[key] = at
  write(STAMPS, all)
}

/** When `key` last changed here, or 0 if it never has. */
export function stampOf(key: string): number {
  return read<Record<string, number>>(STAMPS, {})[key] ?? 0
}

/**
 * Write a setting, and stamp it **only if the value actually changed**.
 *
 * This is what stops two devices passing a setting back and forth forever.
 * `sync.ts` applies an arriving theme without stamping it, exactly so it is not
 * mistaken for a local edit, but applying it also puts it into React state, and
 * the effect that persists that state then writes it straight back out. Without
 * the comparison here, that write stamps, the theme is offered to the server as
 * this device's news, the other device applies it, persists it, stamps it, and
 * the two keep handing the same setting to each other with a newer date every
 * minute.
 *
 * A write of the value already stored is not a change. Saying so once, here, is
 * cheaper and harder to get wrong than making every writer remember it.
 */
export function writeStamped(key: string, value: string): boolean {
  try {
    if (globalThis.localStorage.getItem(key) === value) return false
    globalThis.localStorage.setItem(key, value)
    stamp(key)
    return true
  } catch {
    return false
  }
}

/** The same, for clearing one. Absent already means nothing changed. */
export function clearStamped(key: string): boolean {
  try {
    if (globalThis.localStorage.getItem(key) === null) return false
    globalThis.localStorage.removeItem(key)
    stamp(key)
    return true
  } catch {
    return false
  }
}

/**
 * Record that something is gone.
 *
 * Kept forever, deliberately, and they are tiny. A tombstone has to outlive any
 * device still carrying the thing it buries, and there is no way to know when
 * that is: a tablet in a drawer for a year is exactly the case that breaks if
 * these are pruned on a timer.
 */
export function buried(kind: Kind, id: string, at: number = Date.now()): void {
  const all = read<Tombstone[]>(TOMBS, []).filter(
    (one) => !(one.kind === kind && one.id === id),
  )
  all.push({ kind, id, at })
  write(TOMBS, all)
}

/** Everything thrown away here, for sync to pass on. */
export function tombstones(): Tombstone[] {
  return read<Tombstone[]>(TOMBS, [])
}


/** How far this device has caught up. The server's high water mark, not a clock. */
const CAUGHT_UP = 'enodia.sync.since'

export function caughtUpTo(): number {
  return read<number>(CAUGHT_UP, 0)
}

export function nowCaughtUpTo(mark: number): void {
  write(CAUGHT_UP, mark)
}

/**
 * Forget everything about syncing, without touching the data itself.
 *
 * Signing out leaves your builds where they are: they were yours before the
 * account and they stay yours after it. What goes is the record of what this
 * device had told the server, so signing back in reconciles from scratch rather
 * than assuming a conversation that may have continued elsewhere.
 */
export function forgetSyncState(): void {
  try {
    globalThis.localStorage.removeItem(CAUGHT_UP)
  } catch {
    // Nothing to do. Worst case is one redundant full sync.
  }
}
