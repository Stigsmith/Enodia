/**
 * What the validator is handed, and what it hands back.
 *
 * The checks are pure: they take this bundle and return findings. All disk
 * reading, hashing and printing lives in scripts/validate.ts, which is what
 * lets every check below be unit tested against a hand-built fixture.
 */

import type { Manifest } from '../../src/data/icons.ts'

export type Severity = 'fail' | 'warn' | 'info'

export type Finding = {
  /** the check that produced it, used to group the report */
  check: string
  severity: Severity
  message: string
  /** supporting lines, printed indented under the message */
  detail?: string[]
}

export type GeneratedFile = {
  /** file name without the .json */
  name: string
  provenance: Record<string, unknown> | null
  data: unknown
  /** sha256 of JSON.stringify(data), computed by the loader */
  payloadSha256: string
}

export type CuratedFile = {
  /** path relative to the repo root, for the report */
  path: string
  json: unknown
}

export type SourceKind = 'ts' | 'tsx' | 'css' | 'html'

export type SourceFile = {
  path: string
  kind: SourceKind
  text: string
}

export type Baseline = {
  gameVersion: string
  counts: Record<string, number>
  coverage: Record<string, number>
}

/**
 * A hand-written source file, read for its bytes rather than its words.
 *
 * `SourceFile` is what a reader can end up seeing, and every UI check reads it:
 * the vocabulary, the retired claims, the roster. Build scripts and the worker
 * are not UI, and putting them in that list would have those checks reading
 * extractor code as copy. This is the wider list, for checks about encoding
 * faults, which land in whatever file a generator happened to write.
 */
export type CodeFile = {
  path: string
  text: string
}

/**
 * An image on disk, measured by scripts/validate.ts.
 *
 * The size and hash are here so the manifest's can be held to them. Nothing
 * compared the two until 17 September 2026, and the manifest row for
 * `characters/charon-coins.png` had described the image's previous version for
 * the ten days before that.
 */
export type AssetFile = {
  /** path under assets/, the same string as a manifest entry's `file` */
  file: string
  bytes: number
  sha256: string
}

export type Bundle = {
  generated: GeneratedFile[]
  curated: CuratedFile[]
  sources: SourceFile[]
  /** Every hand-written source file, tests and scripts included. See `CodeFile`. */
  code: CodeFile[]
  baseline: Baseline | null
  /** assets/manifest.json, written by scripts/assets.ts */
  manifest: Manifest | null
  /** every image actually on disk, with its size and sha256 */
  assetFiles: AssetFile[]
  /**
   * The images in `assetFiles` that git ignores, so no clone has them. `null`
   * when git could not be asked, which is a check not run rather than a pass.
   */
  ignoredAssetFiles: string[] | null
}
