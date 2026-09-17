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

import { MAX_GRASP } from '../engine/arcana.ts'
import { writeStamped } from './stamps.ts'

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

/**
 * How closely builds are packed on a shelf.
 *
 * `cards` is the plate: the game's own `SaveProfileSlot` art, 2:3, with the
 * boons on it. `list` is a row each.
 *
 * **This exists because of scale.** Measured at 1600x950 with eighteen builds:
 * five columns, cards 285 by 422, and **five fully on screen** with 2.38 screens
 * of scroll. A shelf that is expected to hold hundreds cannot open like that.
 * The owner asked for at least twelve visible and a list is how a list of
 * hundreds is read.
 */
export type BuildDensity = 'cards' | 'list'

/**
 * Which side of Builds is showing: yours, or everybody's.
 *
 * The build manager and the exchange were two screens drawing the same cards
 * with a different list behind them. They are one screen now with a switch in
 * its heading, and this is where the switch was left.
 */
export type BuildSide = 'mine' | 'all'

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
   * Cards or a list, **or absent, which is the point.**
   *
   * Absent means nobody has chosen, and the two screens then answer differently:
   * the library opens as cards because it holds your own handful, and the
   * exchange opens as a list once it has more than a screenful, because it is
   * expected to hold hundreds. The moment anybody presses the control this holds
   * their answer and both screens obey it.
   */
  buildDensity?: BuildDensity
  /**
   * The side Builds opens on, which is the side it was last left on.
   *
   * Absent means yours. Builds is where the app opens, and somebody's first
   * sight of it should be their own shelf, even while that shelf is empty.
   */
  buildSide?: BuildSide
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
   * Arcana page needs it to say whether a layout is affordable, so it asks once
   * and remembers.
   *
   * **It defaults to the ceiling rather than the floor, which is a change.** It
   * was 10, on the reasoning that ten is where everyone starts. True, and
   * nobody stays there: the owner's point is that a save reaches 30 early and
   * spends the rest of its life at it, so starting at 10 means the board refuses
   * most real layouts until somebody finds this and raises it. The lower number
   * is still assignable on the Arcana page for a save that has not got there.
   */
  graspLimit: number
  /**
   * Whether a run logged against a build you took is counted toward that build.
   *
   * **On by default, and that is a decision rather than an oversight.** The
   * exchange's counts are the whole reason it is not a wall of strangers'
   * builds with nothing to go on, and they only exist if the ordinary case
   * reports. What is sent is one row: cleared or not, and the Fear if you
   * cleared. Who sent it is used to stop one person counting a build a thousand
   * times and is never shown to anybody.
   *
   * Off means the tool sends nothing about your runs, and everything else keeps
   * working: you can still take builds, still log runs, still see the counts.
   * Rating goes with it, because a rating with no run behind it is the thing
   * `worker/exchange.ts` refuses on purpose.
   *
   * It syncs like every other preference, so turning it off on one device turns
   * it off on all of them.
   */
  reportRuns: boolean
}

export const DEFAULT_PREFS: Prefs = {
  version: VERSION,
  staleAfterHours: 3,
  buildDetail: 'poster',
  graspLimit: MAX_GRASP,
  backupWarningSeen: false,
  seenLanding: false,
  reportRuns: true,
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
    /* Absent stays absent: it is the "nobody has chosen" state and each screen
       has its own answer for it. */
    ...(record.buildDensity === 'cards' || record.buildDensity === 'list'
      ? { buildDensity: record.buildDensity }
      : {}),
    ...(record.buildSide === 'mine' || record.buildSide === 'all' ? { buildSide: record.buildSide } : {}),
    // Same reasoning as buildDetail above: absent in anything stored before the
    // warning existed, and absent means "not seen yet", which is the default.
    // No version bump for an additive field.
    backupWarningSeen: record.backupWarningSeen === true,
    seenLanding: record.seenLanding === true,
    /**
     * The one field here that is not `=== true`, and it has to be.
     *
     * Absent means stored before the switch existed, and the default is on, so
     * reading a missing field as false would silently turn reporting off for
     * every install that already exists. Only an explicit `false` is off.
     */
    reportRuns: record.reportRuns !== false,
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
    writeStamped(KEY, JSON.stringify(prefs))
  } catch {
    // Defaults are not a failure state.
  }
}
