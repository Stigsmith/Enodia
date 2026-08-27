/**
 * What the validator is handed, and what it hands back.
 *
 * The checks are pure: they take this bundle and return findings. All disk
 * reading, hashing and printing lives in scripts/validate.ts, which is what
 * lets every check below be unit tested against a hand-built fixture.
 */

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
  /**
   * The hand-authored page in placeholder/ is being replaced by the app, so
   * its findings are reported rather than fatal. Everything under src/ and the
   * app's own index.html is not legacy and fails the build.
   */
  legacy?: boolean
}

export type Baseline = {
  gameVersion: string
  counts: Record<string, number>
  coverage: Record<string, number>
}

export type Bundle = {
  generated: GeneratedFile[]
  curated: CuratedFile[]
  sources: SourceFile[]
  baseline: Baseline | null
}
