/**
 * The leaderboards, from the browser's side.
 *
 * Thinner than `state/exchange.ts` on purpose: a board is already finished when
 * it arrives. There is no payload to unpack, no build to assemble and no filter
 * to run, because `worker/boards.ts` did the counting and the ordering and this
 * only draws it. So there is one type, one fetch, and nothing else.
 *
 * **Failure is an empty page, never an error.** A board is a nice thing to look
 * at and nothing depends on it, so a request that does not come back leaves the
 * screen saying there is nothing yet rather than putting a red sentence in front
 * of somebody who came to look at a list. The shelves already answer this way.
 */

/** Whose listings the boards are built from. */
export type Scope = 'global' | 'friends'

export type BoardRow = {
  /** The listing, when the row is a build. Absent otherwise. */
  id?: string
  /** The build's name, the person's display name, or the thing counted. */
  name: string
  /** Who published it. Only on a build board. */
  by?: string
  count: number
}

export type Board = {
  id: string
  title: string
  /**
   * What `count` counts, singular.
   *
   * The screen pluralises rather than the server, because "1 follower" and "2
   * followers" is a rendering decision and the worker has no business holding
   * English. `Fear` is deliberately not pluralised anywhere: it is a level.
   */
  unit: string
  kind: 'build' | 'person' | 'facet'
  rows: BoardRow[]
}

/**
 * The boards, or `null` when the answer needs an account you do not have.
 *
 * **Only a 401 gives back null**, and it is the one refusal worth telling apart
 * from an empty result. The friends scope answered [] for a signed-out reader
 * to begin with, so the screen said "nothing counted yet among the people you
 * have swapped codes with" to somebody who has neither codes nor an account.
 * Every other failure still folds into an empty list: a board is a nice thing
 * to look at and nothing depends on it, so a request that does not come back
 * leaves the page saying there is nothing yet rather than putting a red
 * sentence in front of somebody who came to read a list.
 */
export async function loadBoards(scope: Scope): Promise<Board[] | null> {
  try {
    const response = await fetch(`/api/exchange/boards?scope=${scope}`)
    if (response.status === 401) return null
    if (!response.ok) return []
    const body = (await response.json()) as { boards?: Board[] }
    return body.boards ?? []
  } catch {
    return []
  }
}

/**
 * "2 followers", "1 follower", "Fear 45".
 *
 * Fear reads the other way round because it is a level rather than a tally:
 * "45 Fear" is a quantity of something and Fear is not a quantity of anything.
 * `MAX_FEAR` is 67 and a run is at a Fear, so the game's own phrasing is used.
 */
export function counted(count: number, unit: string): string {
  if (unit === 'Fear') return `Fear ${count}`
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}
