/**
 * `enodia.prefs`. The player's settings, such as there are yet.
 *
 * `DESIGN.md` 9 lists theme, spoiler level, display names and the staleness
 * threshold. Only the last of those has anything to read it, so only the last
 * is here. A preferences object full of fields nothing honours is a promise
 * the settings screen then has to break.
 *
 * `DESIGN.md` 6.3 is explicit that staleness is a preference rather than a
 * constant, because how long counts as "away" is a habit and not a fact.
 */

const KEY = 'enodia.prefs'
const VERSION = 1

/**
 * Which layout the build manager opens a single build in.
 *
 * Two of the five survived the design review as detail views. They are a
 * setting rather than a control on the page because a reader wants one of them
 * and keeps wanting it, and a switcher on every build asks the question again
 * every time.
 */
export type BuildDetail = 'poster' | 'constellation'

export type Prefs = {
  version: number
  /**
   * How long since the last pick before the run counts as stale.
   *
   * Three hours. A run is forty minutes, so an hour is still the same sitting
   * and a day is plainly not. Three puts the line after lunch, which is where a
   * returning player starts having to reconstruct what they were doing.
   */
  staleAfterHours: number
  /** Poster or Constellation, for a single build. */
  buildDetail: BuildDetail
}

export const DEFAULT_PREFS: Prefs = { version: VERSION, staleAfterHours: 3, buildDetail: 'poster' }

function migrate(stored: unknown): Prefs | null {
  if (typeof stored !== 'object' || stored === null) return null
  const record = stored as Partial<Prefs>
  if (record.version !== VERSION) return null
  return {
    version: VERSION,
    staleAfterHours:
      typeof record.staleAfterHours === 'number' && record.staleAfterHours >= 0
        ? record.staleAfterHours
        : DEFAULT_PREFS.staleAfterHours,
    // Absent in anything stored before the build manager existed, and a missing
    // field is not a reason to throw the rest of somebody's settings away.
    // That is why the version did not go up for this.
    buildDetail:
      record.buildDetail === 'poster' || record.buildDetail === 'constellation'
        ? record.buildDetail
        : DEFAULT_PREFS.buildDetail,
  }
}

export function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY)
    return (raw ? migrate(JSON.parse(raw)) : null) ?? DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Defaults are not a failure state.
  }
}
