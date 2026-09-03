/**
 * Friends, from the browser's side. `worker/friends.ts` is the rest.
 *
 * ## What it is for
 *
 * Publishing already turns a 1,588 character share link into thirty. This turns
 * "send me that one again" into a list. That is the whole feature, and keeping
 * it that small is what keeps it out of the moderation problem: you see builds
 * from people you added one at a time, and nobody else sees yours.
 *
 * ## Codes, not search
 *
 * You cannot look anybody up. A display name is not unique so it cannot address
 * anyone, and searching by email would let a stranger test whether any given
 * address has an account here. A code is something you hand to somebody you
 * already talk to. It also means there are no handles to claim, and therefore
 * no handles to moderate.
 */

const JSON_HEADERS = { 'content-type': 'application/json' }

export type Friend = { id: string; name: string; since: number }
export type FriendBuild = { id: string; name: string; by: string; createdAt: number }

export type Outcome<T> = { ok: true; value: T } | { ok: false; say: string }

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return 'You need to be signed in.'
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? 'That did not work.'
  } catch {
    return 'That did not work.'
  }
}

async function ask<T>(path: string, init?: RequestInit): Promise<Outcome<T>> {
  try {
    const response = await fetch(path, init)
    if (!response.ok) return { ok: false, say: await readError(response) }
    return { ok: true, value: (await response.json()) as T }
  } catch {
    return { ok: false, say: 'Could not reach the server.' }
  }
}

/** Yours, made on first ask rather than at sign-up. */
export const myCode = () => ask<{ code: string }>('/api/friends/code')

/** A new one. The old stops working; your friends list is untouched. */
export const rotateCode = () =>
  ask<{ code: string }>('/api/friends/code', { method: 'POST', headers: JSON_HEADERS })

export const redeemCode = (code: string) =>
  ask<{ friend: Friend }>('/api/friends/redeem', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ code: code.trim() }),
  })

export const listFriends = () => ask<{ friends: Friend[] }>('/api/friends')

export const removeFriend = (id: string) =>
  ask<{ ok: true }>(`/api/friends/${id}`, { method: 'DELETE', headers: JSON_HEADERS })

/** Everything your friends have published, newest first. */
export const friendsFeed = () => ask<{ builds: FriendBuild[] }>('/api/friends/feed')
