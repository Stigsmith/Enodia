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

import type { ShownBuild } from '../data/builds.ts'

const KEY = 'enodia.builds'
const VERSION = 1

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

export function loadBuilds(): ShownBuild[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const stored = JSON.parse(raw) as Stored
    if (stored.version !== VERSION || !Array.isArray(stored.builds)) return []
    return stored.builds.filter(looksLikeBuild)
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

/** Add or replace, keyed on id, newest first. */
export function saveBuild(build: ShownBuild): ShownBuild[] {
  const rest = loadBuilds().filter((one) => one.id !== build.id)
  const next = [build, ...rest]
  write(next)
  return next
}

export function deleteBuild(id: string): ShownBuild[] {
  const next = loadBuilds().filter((one) => one.id !== id)
  write(next)
  return next
}

/**
 * An id that will not collide with a sample or with another of these.
 *
 * `crypto.randomUUID` where it exists, and a timestamp plus randomness where it
 * does not, which is older Safari over plain http. The `mine-` prefix is what
 * keeps it clear of `sample-`.
 */
export function newBuildId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `mine-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}`
}

/** An empty build, ready to be filled in. */
export function blankBuild(weapon: string, aspect: string): ShownBuild {
  return {
    id: newBuildId(),
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
