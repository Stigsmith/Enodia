/**
 * Who you are, which here means a name and nothing else.
 *
 * **This is not the account name.** There is an account now, with a sign-in and
 * a password and a name of its own, and that is the one other people see: it is
 * the byline on everything you publish. This is a label you set in Settings and
 * the tool stamps onto builds you make, and it exists for one reason: a build
 * you send somebody should say who wrote it, and "somebody" is a worse answer
 * than a name you chose.
 *
 * That the two can disagree is a real problem and a known one. Sign up as one
 * name, set this to another, and your builds say one thing while the exchange
 * says another. Reconciling them is its own decision and has not been taken.
 *
 * That is worth being plain about rather than dressing up. A name stored
 * locally is not an identity anyone can verify, so nothing in the tool treats
 * it as one: it is a label on a build, in the same way the name of the build
 * is a label on the build. Two people can pick the same name and the tool will
 * not care, because it has no way to care and pretending otherwise would be
 * the lie.
 */

import { clearStamped, writeStamped } from './stamps.ts'

const KEY = 'enodia.name'

/**
 * Long enough for a name, short enough that it cannot be a paragraph shipped
 * inside every build somebody shares.
 */
export const NAME_LIMIT = 24

/** Trim, collapse the whitespace, cut to the limit. Empty means no name. */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT)
}

export function readName(): string {
  try {
    return tidyName(localStorage.getItem(KEY) ?? '')
  } catch {
    return ''
  }
}

export function writeName(raw: string): string {
  const name = tidyName(raw)
  try {
    /* Clearing the name is a change like setting it, so both are stamped.
     * Without that, emptying the field on a phone would lose to a stale name on
     * a desktop and the name would come back. */
    if (name) writeStamped(KEY, name)
    else clearStamped(KEY)
  } catch {
    // A browser that refuses storage still gets the name for this session.
  }
  return name
}

/**
 * What to call whoever wrote a build.
 *
 * A build made before anyone picked a name has no author. `Someone` is the
 * accurate word for that; inventing a name would not be.
 */
export function authorWord(author: string | undefined, mine: string): string {
  if (!author) return 'Someone'
  return author === mine ? 'You' : author
}

/** The line at the top of a build that arrived in a link. */
export function sharedLine(author: string | undefined, mine: string): string {
  if (author && author === mine) return 'You shared this build'
  if (author) return `${author} shared a build with you`
  return 'Someone shared a build with you'
}
