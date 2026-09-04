/**
 * Builds the player made, kept in the browser.
 *
 * **Three sources of builds, and they must not be confused with each other.**
 *
 *   `sample`     `src/data/builds.ts`. Eight, shipped, mechanically valid and
 *                explicitly not recommendations
 *   `owner`      here. What this player built, in this browser, and nowhere
 *                else
 *   `community`  not built yet. `data/curated/builds.json` is the owner's
 *                hand-authored file and stays theirs
 *
 * A build carries `by`, so the overview can say which it is looking at. That
 * mattered at eight and it matters more now that a player can add their own:
 * a page that mixed them would be claiming the samples are yours or that yours
 * are endorsed.
 *
 * `DESIGN.md` 9: localStorage, one key per concern, versioned with a migration.
 */

import type { SavedBuild, ShownBuild } from '../data/builds.ts'
import { readName } from './identity.ts'
import { buried } from './stamps.ts'

const KEY = 'enodia.builds'
const VERSION = 1

/**
 * The shape one build is in, carried on the build itself.
 *
 * Distinct from `VERSION` above, which versions the whole store. A build sent
 * to another install arrives on its own with no envelope around it, and has to
 * be able to say what shape it is in. That is what this is for, and it is why
 * the number lives on the record as well as around it.
 */
export const BUILD_SCHEMA = 1

type Stored = { version: number; builds: ShownBuild[] }

/**
 * What a stored build has to look like to be loaded.
 *
 * Deliberately shallow. It checks the shape rather than the contents, because
 * the contents are checked live by `engine/build-check.ts` and a build that
 * fails those is still the player's build: they may be halfway through one, or
 * a patch may have moved the ground under a build that was fine when saved.
 * **Refusing to load it would delete their work to make a number go green.**
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

/**
 * Bring stored builds up to the current shape.
 *
 * **Pure, and separate from storage on purpose.** `DESIGN.md` 11 is explicit
 * that a green build proves nothing, so the thing worth testing is this
 * function rather than a browser session. The localStorage wrapper below is
 * three lines with nothing in it to get wrong.
 *
 * `VERSION` does not go up. `prefs.ts` sets that precedent and states the
 * reason: a field missing because it did not exist yet is not a reason to throw
 * the rest of somebody's work away. An envelope this code did not write still
 * yields nothing, which is the one case where dropping everything is right.
 *
 * **An existing id is kept, never reissued.** A build that has already
 * travelled to another install keeps the identity that install knows it by.
 * Only a build with no id at all could be given one, and `looksLikeBuild`
 * already refuses those, so in practice nothing here mints an id.
 */
export function migrateBuilds(
  stored: unknown,
  now: string = new Date().toISOString(),
): { builds: SavedBuild[]; migrated: number } {
  if (typeof stored !== 'object' || stored === null) return { builds: [], migrated: 0 }
  const record = stored as Partial<Stored>
  if (record.version !== VERSION || !Array.isArray(record.builds)) return { builds: [], migrated: 0 }

  let migrated = 0
  const builds = record.builds.filter(looksLikeBuild).map((build) => {
    const created = typeof build.created === 'string' ? build.created : now
    const filled: SavedBuild = {
      ...build,
      id: build.id,
      created,
      modified: typeof build.modified === 'string' ? build.modified : created,
      schemaVersion: typeof build.schemaVersion === 'number' ? build.schemaVersion : BUILD_SCHEMA,
    }
    if (
      build.created !== filled.created ||
      build.modified !== filled.modified ||
      build.schemaVersion !== filled.schemaVersion
    ) {
      migrated += 1
    }
    return filled
  })

  return { builds, migrated }
}

export function loadBuilds(): SavedBuild[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const { builds, migrated } = migrateBuilds(JSON.parse(raw))
    // Written straight back, so the migration is paid once rather than on
    // every load for the rest of the store's life.
    if (migrated) write(builds)
    return builds
  } catch {
    return []
  }
}

function write(builds: ShownBuild[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, builds } satisfies Stored))
  } catch {
    // A browser refusing storage still gets to look at the library.
  }
}

/**
 * Add or replace, keyed on id, newest first.
 *
 * **`id` and `created` are never touched here.** An edit is the same build, and
 * if saving changed either of them every install already holding it would see a
 * stranger. `modified` moves on every save, and it is the only thing separating
 * an edit from the original write.
 */
export function saveBuild(build: ShownBuild, now: string = new Date().toISOString()): SavedBuild[] {
  const held = loadBuilds()
  const existing = held.find((one) => one.id === build.id)
  const saved: SavedBuild = {
    ...build,
    id: build.id,
    created: existing?.created ?? build.created ?? now,
    modified: now,
    schemaVersion: build.schemaVersion ?? BUILD_SCHEMA,
  }
  const next = [saved, ...held.filter((one) => one.id !== build.id)]
  write(next)
  return next
}

/**
 * Fork a build, including one of the samples.
 *
 * The samples were read-only dead ends: you could look at Killer Current and
 * not start from it. A fork is an ordinary owner build, which is the cheapest
 * way for a second player to get going.
 *
 * **`play` is dropped.** A fork has not been played, and inheriting somebody
 * else's twelve runs would have the record lying on its first day.
 * `derivedFrom` keeps the trail instead.
 */
export function duplicateBuild(
  source: ShownBuild,
  now: string = new Date().toISOString(),
  /**
   * Where this really came from, when it came from the exchange.
   *
   * A build taken off a shelf carries the **published** id rather than the
   * build's own, because that is what runs are reported against, and a hash of
   * what it looked like at the time so the reporting can stop once the copy
   * stops being that build. `src/state/exchange.ts` holds both halves.
   */
  origin?: { id: string; hash: string },
): { builds: SavedBuild[]; copy: SavedBuild } {
  const { play: _play, author: _author, ...rest } = source
  const mine = readName()
  const copy: SavedBuild = {
    ...rest,
    id: newBuildId(),
    by: 'owner',
    /**
     * A fork is your work built on theirs, so it carries your name and
     * `derivedFrom` keeps the trail back to whoever wrote the original.
     *
     * **The source's author is dropped rather than kept when you have no name
     * of your own.** Inheriting it would have your fork claiming somebody else
     * wrote it, which is the one thing this field must never say.
     */
    ...(mine ? { author: mine } : {}),
    // The name field caps at 60, and two identical names in a list help nobody.
    name: `${source.name} copy`.slice(0, 60),
    derivedFrom: origin?.id ?? source.id,
    ...(origin ? { derivedHash: origin.hash } : {}),
    created: now,
    modified: now,
    schemaVersion: BUILD_SCHEMA,
  }
  const next = [copy, ...loadBuilds()]
  write(next)
  return { builds: next, copy }
}

/**
 * Delete moves a build to the bin rather than destroying it.
 *
 * **Nothing here has ever been recoverable.** A build is somebody's own work,
 * kept in one browser with no server behind it, and a mis-click was the end of
 * it. The confirm step helps and does not help enough: it stops the accident
 * and not the change of mind an hour later.
 *
 * Same store, a second list, so the export carries the bin with everything
 * else and a restored install still has it.
 */
export function deleteBuild(id: string): SavedBuild[] {
  const all = loadBuilds()
  const going = all.find((one) => one.id === id)
  const next = all.filter((one) => one.id !== id)
  if (going) writeBin([{ ...going, binnedAt: new Date().toISOString() }, ...loadBin()])
  /* Gone from the library, so the library's copy has to travel as gone. The bin
   * gains it separately and syncs as a `bin` item of its own, which is how the
   * undo survives the trip to another device. */
  buried('build', id)
  write(next)
  return next
}

/** A build in the bin, with when it went there. */
export type BinnedBuild = SavedBuild & { binnedAt: string }

const BIN_KEY = 'enodia.bin'

/**
 * What is in the bin, newest first.
 *
 * Read defensively for the same reason `loadBuilds` is: this is a text file a
 * person can edit and a file that can arrive from another install. A bin that
 * cannot be parsed is an empty bin, never a crash on the way to the library.
 */
export function loadBin(): BinnedBuild[] {
  try {
    const raw = window.localStorage.getItem(BIN_KEY)
    if (!raw) return []
    const record = JSON.parse(raw) as { version?: number; builds?: unknown }
    if (!Array.isArray(record.builds)) return []
    return record.builds as BinnedBuild[]
  } catch {
    return []
  }
}

function writeBin(builds: BinnedBuild[]): void {
  try {
    window.localStorage.setItem(BIN_KEY, JSON.stringify({ version: VERSION, builds }))
  } catch {
    // Storage full or blocked. The delete still happened; the undo is what is
    // lost, and failing the delete over it would be the worse trade.
  }
}

/** Put one back, and take it out of the bin. */
export function restoreBuild(id: string): { builds: SavedBuild[]; bin: BinnedBuild[] } {
  const bin = loadBin()
  const found = bin.find((one) => one.id === id)
  const rest = bin.filter((one) => one.id !== id)
  writeBin(rest)
  if (!found) return { builds: loadBuilds(), bin: rest }

  const { binnedAt: _binnedAt, ...build } = found
  /* Out of the bin, so the bin's copy is gone. The build itself carries a fresh
   * `modified` below, which is what beats the tombstone `deleteBuild` left. */
  buried('bin', id)
  const builds = [...loadBuilds(), { ...build, modified: new Date().toISOString() }]
  write(builds)
  return { builds, bin: rest }
}

/** Empty the bin, or one of it. This is the one that really is the end. */
export function emptyBin(id?: string): BinnedBuild[] {
  const going = id ? [id] : loadBin().map((one) => one.id)
  const next = id ? loadBin().filter((one) => one.id !== id) : []
  writeBin(next)
  // Every one of these has to travel, or another device puts them all back.
  for (const gone of going) buried('bin', gone)
  return next
}

/**
 * An id that will not collide with a sample or with another of these.
 *
 * `crypto.randomUUID` where it exists. It needs a secure context, so it is
 * absent over plain http, which is exactly how somebody opens this on a phone
 * against a laptop's LAN address. That fallback matters more than it looks:
 * several installs across two people generate builds independently and swap
 * files days apart, with nothing anywhere to arbitrate a collision.
 *
 * So the fallback takes real randomness from `getRandomValues` when the rest of
 * the crypto object is there, and only reaches `Math.random` when there is no
 * crypto at all. A timestamp leads in both, which keeps two ids minted in the
 * same session apart even in the worst case.
 *
 * The `mine-` prefix is what keeps these clear of `sample-`. It is already in
 * storage on every build anyone has made, and ids never change, so it stays.
 */
export function newBuildId(): string {
  const crypto = globalThis.crypto
  const uuid = crypto?.randomUUID?.()
  if (uuid) return `mine-${uuid}`

  const stamp = Date.now().toString(36)
  if (crypto?.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(9))
    return `mine-${stamp}-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
  }
  return `mine-${stamp}-${Math.random().toString(36).slice(2, 10)}`
}

/** An empty build, ready to be filled in. */
export function blankBuild(weapon: string, aspect: string): ShownBuild {
  return {
    id: newBuildId(),
    schemaVersion: BUILD_SCHEMA,
    ...(readName() ? { author: readName() } : {}),
    name: '',
    say: '',
    how: '',
    by: 'owner',
    weapon,
    aspect,
    centrepiece: '',
    boons: [],
    hex: null,
    hammers: [],
    keepsake: null,
    familiar: null,
    arcana: [],
  }
}
