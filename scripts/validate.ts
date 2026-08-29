/**
 * Enodia validator. Wired into prebuild, so a broken reference cannot ship.
 *
 *   npm run validate                     report, exit 1 on any failure
 *   npm run validate -- --verbose        print every detail line
 *   npm run validate -- --update-baseline   accept the current counts
 *
 * This file is the IO half: it reads the repo, hands scripts/validate/checks.ts
 * a plain bundle, and prints what comes back. Every rule lives in checks.ts and
 * every rule is unit tested there.
 *
 * Runs on bare node, which strips the types. No build step, no extra runtime.
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { countsOf, coverageOf, runAllChecks } from './validate/checks.ts'
import type { Manifest } from '../src/data/icons.ts'
import type { Baseline, Bundle, CuratedFile, Finding, GeneratedFile, SourceFile, SourceKind } from './validate/types.ts'

const ROOT = resolve(import.meta.dirname, '..')
const GENERATED = join(ROOT, 'data/generated')
const CURATED = join(ROOT, 'data/curated')
const BASELINE = join(ROOT, 'data/baseline.json')
const ASSETS = join(ROOT, 'assets')

const argv = process.argv.slice(2)
const verbose = argv.includes('--verbose')
const updateBaseline = argv.includes('--update-baseline')

const rel = (path: string) => relative(ROOT, path).replaceAll('\\', '/')

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function loadGenerated(): GeneratedFile[] {
  if (!existsSync(GENERATED)) return []
  return readdirSync(GENERATED)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((fileName) => {
      const raw = JSON.parse(readFileSync(join(GENERATED, fileName), 'utf8')) as Record<string, unknown>
      const data = raw.data
      const provenance =
        typeof raw._provenance === 'object' && raw._provenance !== null
          ? (raw._provenance as Record<string, unknown>)
          : null
      return {
        name: fileName.replace(/\.json$/, ''),
        provenance,
        data,
        // The extractor hashes JSON.stringify(data) as it writes. Same input,
        // same hash, so any hand edit to the payload shows up here.
        payloadSha256: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      }
    })
}

function loadCurated(): CuratedFile[] {
  if (!existsSync(CURATED)) return []
  return readdirSync(CURATED)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      path: rel(join(CURATED, fileName)),
      json: JSON.parse(readFileSync(join(CURATED, fileName), 'utf8')) as unknown,
    }))
}

const SOURCE_KINDS: Record<string, SourceKind> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.css': 'css',
  '.html': 'html',
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

function loadSources(): SourceFile[] {
  const files: SourceFile[] = []

  const add = (path: string, legacy = false) => {
    const ext = path.slice(path.lastIndexOf('.'))
    const kind = SOURCE_KINDS[ext]
    if (!kind) return
    files.push({ path: rel(path), kind, text: readFileSync(path, 'utf8'), ...(legacy ? { legacy } : {}) })
  }

  add(join(ROOT, 'index.html'))
  for (const path of walk(join(ROOT, 'src'))) {
    if (!path.includes('.test.')) add(path)
  }
  /**
   * The standalone build manager page, and its charset in particular.
   *
   * `npm run artifact` writes it and it ships two ways: as an Artifact, whose
   * wrapper injects a charset, and as `dist/builds.html` behind a plain server,
   * which injects nothing. It was written without one and every interpunct in
   * it came out as a Chinese character, invisible in the wrapper and visible on
   * the server. The charset check is exactly the check that catches that, so
   * this page is inside it now.
   */
  for (const path of walk(join(ROOT, 'artifact'))) {
    if (!path.includes('.test.')) add(path)
  }
  // The hand-authored page the app replaces. Checked, reported, never fatal.
  add(join(ROOT, 'placeholder/index.html'), true)

  return files
}

const IMAGE = /\.(webp|png|jpg|jpeg)$/i

/** assets/manifest.json. PowerShell wrote it once with a BOM, so strip one. */
function loadManifest(): Manifest | null {
  const path = join(ASSETS, 'manifest.json')
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Manifest
  return Array.isArray(raw.assets) ? raw : { ...raw, assets: [] }
}

/** Every image on disk, as a path under assets/. */
function loadAssetFiles(): string[] {
  if (!existsSync(ASSETS)) return []
  const out: string[] = []
  for (const dir of readdirSync(ASSETS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const file of readdirSync(join(ASSETS, dir.name))) {
      if (IMAGE.test(file)) out.push(`${dir.name}/${file}`)
    }
  }
  return out.sort()
}

function loadBaseline(): Baseline | null {
  if (!existsSync(BASELINE)) return null
  const raw = JSON.parse(readFileSync(BASELINE, 'utf8')) as Partial<Baseline>
  if (typeof raw.gameVersion !== 'string') return null
  return { gameVersion: raw.gameVersion, counts: raw.counts ?? {}, coverage: raw.coverage ?? {} }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const colour = process.stdout.isTTY && !process.env.NO_COLOR
const ESC = '['
const paint = (code: string, text: string) => (colour ? `${ESC}${code}m${text}${ESC}0m` : text)

const MARK: Record<Finding['severity'], string> = {
  fail: paint('31;1', 'FAIL'),
  warn: paint('33', 'warn'),
  info: paint('32', ' ok '),
}

function report(findings: Finding[]): void {
  let current = ''
  for (const finding of findings) {
    if (finding.check !== current) {
      current = finding.check
      console.log(`\n${paint('1', current)}`)
    }
    console.log(`  ${MARK[finding.severity]}  ${finding.message}`)
    const detail = finding.detail ?? []
    const shown = verbose || finding.severity !== 'info' ? detail : []
    for (const line of shown) console.log(`        ${paint('2', line)}`)
  }
}

// ---------------------------------------------------------------------------

const bundle: Bundle = {
  generated: loadGenerated(),
  curated: loadCurated(),
  sources: loadSources(),
  baseline: loadBaseline(),
  manifest: loadManifest(),
  assetFiles: loadAssetFiles(),
}

if (!bundle.generated.length) {
  console.error('data/generated is empty. Run npm run extract first.')
  process.exit(1)
}

const findings = runAllChecks(bundle)
report(findings)

if (updateBaseline) {
  const version = bundle.generated[0]?.provenance?.gameVersion
  const next: Baseline & { _note: string } = {
    _note:
      'Structural counts the validator holds the extractor to. A game patch may move these. ' +
      'Read the diff as a patch note, then re-run npm run validate -- --update-baseline. DESIGN.md 11.',
    gameVersion: typeof version === 'string' ? version : 'unknown',
    counts: countsOf(bundle),
    coverage: coverageOf(bundle),
  }
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`\nbaseline written to ${rel(BASELINE)} at game build ${next.gameVersion}`)
}

const failures = findings.filter((f) => f.severity === 'fail')
const warnings = findings.filter((f) => f.severity === 'warn')

console.log(
  `\n${failures.length} failures, ${warnings.length} warnings, across ${bundle.generated.length} generated files, ` +
    `${bundle.curated.length} curated files, ${bundle.sources.length} source files and ${bundle.assetFiles.length} images`,
)

if (failures.length) {
  console.log(paint('31;1', 'validation failed. The build stops here.'))
  process.exit(1)
}
