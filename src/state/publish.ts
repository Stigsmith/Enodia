/**
 * Publishing a build, from the browser's side. `worker/publish.ts` is the rest.
 *
 * ## What this is for, in one number
 *
 * `linkFor` packs a whole build into a URL fragment, which is why sharing has
 * never needed a server. It also makes the link **1,588 characters**. Discord
 * renders that as a wall, Reddit mangles it, and no QR code will hold it.
 *
 * A published link is `enodia.me/b/aB3xK9pQmR`, about thirty. That is the whole
 * of what an account buys, and the reason the gate sits here rather than at the
 * door.
 *
 * ## Publishing is a copy, not a move
 *
 * The build stays in this browser. It stays the record, stays the thing being
 * edited, and stays what the export writes. Publishing takes a snapshot; editing
 * afterwards changes yours and not the published one until you publish again.
 *
 * That is worth being plain about, because the obvious assumption is the other
 * one, and the loss warning in the build manager deliberately does not point
 * here for exactly this reason.
 */

import type { ShownBuild } from '../data/builds.ts'
import { saveBuild } from './builds.ts'
import { fingerprint, shapeOf } from './exchange.ts'
import { packBuild, unpackBuild } from './transfer.ts'

/**
 * One of your listings, as `worker/publish.ts listMine` returns it.
 *
 * `revision` and `updatedAt` were being returned by the worker and thrown away
 * here before anything on this side could act on them. They are what an author
 * needs to see: which version people are reading, and when it last moved.
 */
export type Published = {
  id: string
  name: string
  createdAt: number
  revision: number
  /** null when it has never been republished. */
  updatedAt: number | null
}

export type PublishOutcome = { ok: true; id: string; link: string } | { ok: false; say: string }

/** The short link, and the only place its shape is written. */
export const linkTo = (id: string): string => `${window.location.origin}/b/${id}`

/**
 * The id in the address, or null.
 *
 * A path rather than a fragment. Both would work and both are short, but a path
 * survives being pasted into places that strip fragments, and reads as an
 * address rather than as an address with something bolted on.
 */
export function publishedInUrl(pathname: string): string | null {
  const found = /^\/b\/([A-Za-z0-9]{1,32})\/?$/.exec(pathname)
  return found ? (found[1] as string) : null
}

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return 'You need to be signed in to publish.'
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? 'That did not work.'
  } catch {
    return 'That did not work.'
  }
}

/**
 * Publish, and **stamp the local build with what came back**.
 *
 * The stamp is the whole reason this function writes to the library at all. Two
 * things need it and neither can get it from the server: the author cannot be
 * offered "update the published copy" for a listing nothing connects to a
 * build, and the exchange cannot refuse to let you follow your own build,
 * because `/api/b/:id` takes no session and will happily hand you your own.
 *
 * This module is the only writer of both fields, the way `reportRun` is the
 * only sender of a run. A second writer forgets one of them, and the pair
 * coming apart is a failure this codebase has already had once.
 */
export async function publishBuild(build: ShownBuild): Promise<PublishOutcome> {
  try {
    const response = await fetch('/api/builds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: await packBuild(build), name: build.name }),
    })
    if (!response.ok) return { ok: false, say: await readError(response) }
    const { id } = (await response.json()) as { id: string }
    stamp(build, id)
    return { ok: true, id, link: linkTo(id) }
  } catch {
    return { ok: false, say: 'Could not reach the server. Your build is untouched.' }
  }
}

/**
 * Record on the build which listing it is behind, and what shape it went up as.
 *
 * Deliberately after the request rather than optimistically before it: a build
 * that thinks it is published when it is not would offer to update a listing
 * that does not exist.
 */
function stamp(build: ShownBuild, id: string): void {
  saveBuild({ ...build, publishedAs: id, publishedHash: fingerprint(shapeOf(build)) })
}

export async function myPublished(): Promise<Published[]> {
  try {
    const response = await fetch('/api/builds')
    if (!response.ok) return []
    const body = (await response.json()) as { builds?: Published[] }
    return body.builds ?? []
  } catch {
    return []
  }
}

/**
 * Replace what people are reading, and restamp the shape it now has.
 *
 * The shape goes up with it as an opaque token, which is how the server splits
 * a listing's counts across versions without ever reading the payload. See
 * `worker/publish.ts`.
 */
export async function republishBuild(build: ShownBuild): Promise<PublishOutcome> {
  if (!build.publishedAs) return { ok: false, say: 'That build is not published.' }
  try {
    const response = await fetch(`/api/builds/${build.publishedAs}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payload: await packBuild(build),
        name: build.name,
        shape: fingerprint(shapeOf(build)),
      }),
    })
    if (!response.ok) return { ok: false, say: await readError(response) }
    stamp(build, build.publishedAs)
    return { ok: true, id: build.publishedAs, link: linkTo(build.publishedAs) }
  } catch {
    return { ok: false, say: 'Could not reach the server. Your build is untouched.' }
  }
}

/**
 * Take a listing off the shelves. **Not a delete**, on purpose.
 *
 * The row stays and the link keeps working for anybody who already has it,
 * marked as taken down. Destroying it would take every run anybody logged
 * against it, every rating, and the curator's note with it, and it would empty
 * the build out of the library of everyone following it. `worker/publish.ts`
 * carries the rest of the argument.
 */
export async function takeDownBuild(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/builds/${id}`, { method: 'DELETE' })
    return response.ok
  } catch {
    return false
  }
}

/** The other half of taking one down, and a separate verb rather than a toggle. */
export async function putBackBuild(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/builds/${id}/restore`, { method: 'POST' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Fetch a published build and unpack it, exactly as a share link is unpacked.
 *
 * Returns null for anything that does not resolve, and does not distinguish a
 * missing id from a corrupt payload: both mean the same thing to whoever
 * followed the link, which is that there is nothing on the other end of it.
 */
export async function openPublished(id: string): Promise<ShownBuild | null> {
  try {
    const response = await fetch(`/api/b/${id}`)
    if (!response.ok) return null
    const { payload } = (await response.json()) as { payload: string }
    return await unpackBuild(payload)
  } catch {
    return null
  }
}
