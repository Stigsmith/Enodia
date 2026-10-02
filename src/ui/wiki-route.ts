/**
 * The wiki's addresses.
 *
 * `/wiki` is the index and `/wiki/<kind>/<id>` a record. The id is the game's
 * internal name, `ZeusWeaponBoon`, never the display name: display names
 * change between patches and six aspects share one, so a link keyed on a name
 * would break on a patch or open the wrong aspect. `CLAUDE.md` records the six.
 *
 * Nothing on the server knows about these. `wrangler.jsonc` serves the app for
 * any path it has no file for (`not_found_handling: "single-page-application"`),
 * so a record's address loads the app and the app reads the path.
 */

export type WikiKind = 'trait' | 'arcana' | 'familiar'

/**
 * A record, a section of the index, or null for the top of it.
 *
 * A section is `node`, and its id is its path through `wiki-tree.ts`,
 * `olympians/zeus`, so `/wiki/c/olympians/zeus` reopens Zeus's page the way a
 * record's address reopens the record.
 */
export type WikiAt = { kind: WikiKind; id: string } | { kind: 'node'; id: string } | null

const SEGMENTS: Record<WikiKind, string> = { trait: 't', arcana: 'arcana', familiar: 'familiar' }

const KINDS: ReadonlyMap<string, WikiKind> = new Map(
  (Object.entries(SEGMENTS) as [WikiKind, string][]).map(([kind, segment]) => [segment, kind]),
)

const decoded = (part: string): string | null => {
  try {
    return decodeURIComponent(part)
  } catch {
    return null
  }
}

/**
 * The wiki address a path names, or null when the path is not the wiki's.
 *
 * A path under `/wiki` that names no record it can read, a kind it does not
 * know or an id that will not decode, is the index rather than nothing: the
 * reader asked for the wiki, and the index is the honest answer to a record
 * that is not there.
 */
export function wikiInUrl(pathname: string): { at: WikiAt } | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'wiki') return null
  if (parts[1] === NODE) {
    const path = parts.slice(2).map(decoded)
    return { at: path.length && path.every(Boolean) ? { kind: 'node', id: path.join('/') } : null }
  }
  const kind = parts[1] ? KINDS.get(parts[1]) : undefined
  const id = parts[2] ? decoded(parts[2]) : null
  return { at: kind && id ? { kind, id } : null }
}

/** The path for a record, a section, or the index. */
export function wikiPath(at: WikiAt): string {
  if (!at) return '/wiki'
  if (at.kind === 'node') return `/wiki/${NODE}/${at.id.split('/').map(encodeURIComponent).join('/')}`
  return `/wiki/${SEGMENTS[at.kind]}/${encodeURIComponent(at.id)}`
}

/** The segment a section's address goes under, beside the records' kinds. */
const NODE = 'c'
