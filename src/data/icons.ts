/**
 * The asset join. Slug in, image out.
 *
 * `assets/README.md` fixes the rule: the slug is the join key, and it is derived
 * from the display name. `assets/boons/lightning-strike.webp` is the art for the
 * boon the game calls "Lightning Strike".
 *
 * This module is the only implementation of that rule. The validator uses it to
 * report the gap count, `scripts/assets.ts` uses it to fill gaps from the game
 * extraction, and the UI will use it to find an image. One rule, one place: a
 * second copy is how the previous tool ended up printing numbers from a formula
 * two versions out of date.
 *
 * Pure. No fs, no fetch, no React. The manifest arrives as an argument.
 */

export type ManifestEntry = {
  /** the slug, and the join key */
  id: string
  category: string
  /** path under assets/, for example "boons/back-burner.png" */
  file: string
  bytes?: number
  sha256?: string
  /** where the image came from. "wiki" images carry sourceFile and sourcePage */
  source?: 'wiki' | 'game'
  sourceFile?: string
  sourcePage?: string
  [key: string]: unknown
}

export type Manifest = {
  generated?: string
  count?: number
  assets: ManifestEntry[]
  [key: string]: unknown
}

/**
 * Display name to slug.
 *
 * Lowercase, accents folded, apostrophes and periods dropped, everything else
 * that is not a letter or a digit becomes a single hyphen. "Queen's Ransom"
 * becomes queens-ransom, "Melinoë" becomes melinoe. This matches the rule
 * assets/build-lib.ps1 applies to wiki filenames, so both ends of the join
 * agree without either side knowing about the other.
 */
export function slugify(displayName: string): string {
  return displayName
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // combining marks, so an e with a diaeresis folds to e
    .replace(/\{[^}]*\}/g, '') // the game's inline formatting codes
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type IconIndex = Map<string, ManifestEntry>

/** Slug to entry. The first entry wins, so category order decides collisions. */
export function buildIconIndex(manifest: Manifest): IconIndex {
  const index: IconIndex = new Map()
  for (const entry of manifest.assets ?? []) {
    if (typeof entry?.id !== 'string') continue
    if (!index.has(entry.id)) index.set(entry.id, entry)
  }
  return index
}

/**
 * An override moves one record onto a named file, for the case the slug rule
 * cannot reach: a boon the wiki filed under an older name, or two boons whose
 * display names collide. Keyed by trait id, not by slug.
 */
export type IconOverrides = Map<string, string>

export type IconResolution =
  | { found: true; file: string; slug: string; via: 'slug' | 'override' }
  | { found: false; slug: string | null; why: 'no display name' | 'no asset' }

export function resolveIcon(
  traitId: string,
  displayName: string | null | undefined,
  index: IconIndex,
  overrides: IconOverrides = new Map(),
): IconResolution {
  const override = overrides.get(traitId)
  if (override) return { found: true, file: override, slug: slugify(displayName ?? traitId), via: 'override' }

  if (!displayName) return { found: false, slug: null, why: 'no display name' }

  const slug = slugify(displayName)
  const entry = index.get(slug)
  if (entry) return { found: true, file: entry.file, slug, via: 'slug' }

  return { found: false, slug, why: 'no asset' }
}
