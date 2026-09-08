/**
 * What a build is made of, as tokens the server stores and never reads.
 *
 * **This module is the whole vocabulary, in both directions.** It derives the
 * tokens from a build on the way up and turns one back into a label on the way
 * down, and nothing in `worker/` knows what any of them mean. That is the same
 * bargain `shape` already strikes: the browser computes, the server compares and
 * groups, and the build format can change without a migration.
 *
 * It exists because the leaderboards want to say which arm people publish most,
 * and `worker/publish.ts` refuses to parse a payload to find out. There was no
 * third option that kept both.
 *
 * ## The rules for a token
 *
 * - **A prefix, a colon, and an id from the data.** Never a display name: names
 *   change with a game patch and six aspects are called "Aspect of Melinoë",
 *   so a name is neither stable nor unique. `render` does the joining.
 * - **Short and few.** `MAX_FACETS` and `MAX_FACET` are enforced on the server
 *   too, because a column that accepts anything is somewhere to put a payload.
 * - **A token nobody recognises renders as itself.** A board built from a build
 *   published by a newer client should show a row it cannot name rather than
 *   drop a count, the same way an unreadable payload is skipped rather than
 *   fatal.
 *
 * ## What is deliberately not in here
 *
 * Nothing from `play`. Runs, clears, Fear and vows are the player's own record
 * and the exchange already has its own counts for what happened to a listing.
 * Sending them here would be a second, quieter copy of the thing `prefs.reportRuns`
 * exists to let somebody switch off.
 */

import { arcanaById, familiarById, godsOf, traits, weaponById } from '../data/app.ts'
import { PLAYSTYLES } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'

/** Matches `MAX_FACETS` in `worker/publish.ts`. */
const MAX_FACETS = 40

/**
 * One build's facets.
 *
 * Boons are **not** one token each. A build names up to a dozen and the boards
 * that would come out of them are "which boon is in the most builds", which the
 * god and arm boards already answer at a scale somebody can read. What is here
 * is the handful of choices a build is actually described by.
 */
export function facetsOf(build: ShownBuild): string[] {
  const out = new Set<string>()

  out.add(`arm:${build.weapon}`)
  out.add(`aspect:${build.aspect}`)
  for (const god of godsOf(build)) out.add(`god:${god}`)
  if (build.playstyle) out.add(`play:${build.playstyle}`)
  if (build.keepsake) out.add(`keepsake:${build.keepsake}`)
  if (build.familiar) out.add(`familiar:${build.familiar}`)
  if (build.hex) out.add(`hex:${build.hex}`)
  for (const card of build.arcana) out.add(`arcana:${card}`)

  /* Sorted so the same build produces the same list every time. Nothing depends
     on the order, and a stable one makes two publishes of one build comparable
     by eye when something looks wrong. */
  return [...out].sort().slice(0, MAX_FACETS)
}

/**
 * A token, as something to read.
 *
 * Returns null for a token whose kind this client does not know, which the
 * board draws as nothing rather than as a row labelled `arm:witch-staff`.
 * An unknown *value* inside a known kind still renders, as the raw id: it is a
 * real count of a real thing and the id is closer to useful than a blank.
 */
export function render(token: string): { kind: string; name: string } | null {
  const at = token.indexOf(':')
  if (at < 1) return null
  const kind = token.slice(0, at)
  const value = token.slice(at + 1)

  switch (kind) {
    case 'arm': {
      const weapon = weaponById.get(value)
      return { kind: 'Arm', name: weapon ? weapon.arm : value }
    }
    case 'aspect': {
      const trait = traits.get(value)
      if (!trait) return { kind: 'Aspect', name: value }
      /* Six aspects share the name "Aspect of Melinoë", so the arm has to lead
         or the board shows the same row six times. `CLAUDE.md` records this as
         a join hazard and it is a labelling one for the same reason. */
      const bare = (trait.name ?? value).replace(/^Aspect of /, '')
      const arm = trait.requiredWeapon ? weaponById.get(trait.requiredWeapon)?.arm : null
      return { kind: 'Aspect', name: arm ? `${arm}, ${bare}` : bare }
    }
    case 'god':
      return { kind: 'God', name: value }
    case 'play':
      return { kind: 'Playstyle', name: PLAYSTYLES.find((one) => one.id === value)?.name ?? value }
    case 'keepsake':
      return { kind: 'Keepsake', name: traits.get(value)?.name ?? value }
    case 'familiar':
      return { kind: 'Familiar', name: familiarById.get(value)?.name ?? value }
    case 'hex':
      return { kind: 'Hex', name: traits.get(value)?.name ?? value }
    case 'arcana':
      return { kind: 'Arcana', name: arcanaById.get(value)?.name ?? value }
    default:
      return null
  }
}
