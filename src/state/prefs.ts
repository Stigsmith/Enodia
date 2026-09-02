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
  /**
   * Whether the "these live in this browser" warning has been read and dismissed.
   *
   * It appears once somebody HAS builds, which is the opposite of where the
   * empty state used to put it. Telling a person their work can be lost while
   * they have no work is a sentence about nothing; the same sentence over a
   * library of eleven builds is the one that gets somebody to press export.
   */
  backupWarningSeen: boolean
  /**
   * Whether the landing page has been walked through.
   *
   * A page that explains the tool is worth exactly one showing. After that it
   * is a screen between somebody and the thing they came back for, so it goes
   * and lives in the menu instead.
   */
  seenLanding: boolean
  /**
   * How much Grasp this save has.
   *
   * `MetaUpgradeCostData.StartingMetaUpgradeLimit` is 10 and it rises as you
   * spend MemPoints, so it is per-save progression this tool cannot read. The
   * Arcana page needs it to say whether a layout is affordable, so it asks
   * once and remembers. Ten is where everyone starts.
   */
  graspLimit: number
}

export const DEFAULT_PREFS: Prefs = {
  version: VERSION,
  staleAfterHours: 3,
  buildDetail: 'poster',
  graspLimit: 10,
  backupWarningSeen: false,
  seenLanding: false,
}

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
    graspLimit:
      typeof record.graspLimit === 'number' && record.graspLimit > 0
        ? record.graspLimit
        : DEFAULT_PREFS.graspLimit,
    // Same reasoning as buildDetail above: absent in anything stored before the
    // warning existed, and absent means "not seen yet", which is the default.
    // No version bump for an additive field.
    backupWarningSeen: record.backupWarningSeen === true,
    seenLanding: record.seenLanding === true,
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
