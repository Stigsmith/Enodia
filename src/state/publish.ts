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
import { packBuild, unpackBuild } from './transfer.ts'

export type Published = { id: string; name: string; createdAt: number }

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

export async function publishBuild(build: ShownBuild): Promise<PublishOutcome> {
  try {
    const response = await fetch('/api/builds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: await packBuild(build), name: build.name }),
    })
    if (!response.ok) return { ok: false, say: await readError(response) }
    const { id } = (await response.json()) as { id: string }
    return { ok: true, id, link: linkTo(id) }
  } catch {
    return { ok: false, say: 'Could not reach the server. Your build is untouched.' }
  }
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

export async function unpublishBuild(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/builds/${id}`, { method: 'DELETE' })
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
