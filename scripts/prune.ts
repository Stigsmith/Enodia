/**
 * Ship what the app references, and nothing else.
 *
 *   npm run build      runs this last
 *   npm run prune      on its own, against an existing dist/
 *
 * `vite.config.ts` sets `publicDir: 'assets'`, which is right in development:
 * a manifest path is also a URL and nothing has to be wired up to try a new
 * image. In a build it copies the whole shelf. **55 MB and 940 files, of which
 * the app renders 508**, and the rest is Arcana card art Phase 1 never draws,
 * the owner's reference sheets, and the parts of the game's UI furniture that
 * are shelved for later.
 *
 * `ROADMAP.md` has carried "the real fix is a build step that copies only what
 * the app references, and it is not written" for a while. This is it.
 *
 * ## How it knows
 *
 * Everything the app can draw is a literal string by the time Vite is done.
 * Trait art arrives through `data/app/app-data.json`, which is imported rather
 * than fetched, so every icon path is inlined into the bundle. CSS `url()`s are
 * in the stylesheet. The frame catalogue is in the JavaScript.
 *
 * **Except when it is not**, and that is the one dangerous case. A path built
 * from a template literal, `/rarity/${rarity}.png`, leaves no literal behind
 * and a scanner will happily delete every file it would have resolved to. So
 * the scan also looks for template literals following a category, and **fails
 * the build on any it has not been told about**. A silent 404 on a deployed
 * page is exactly the kind of bug this project keeps writing down.
 */

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const ASSET = /\.(png|webp|jpg|jpeg|gif|svg)$/i

/** The shelves, which are also the first segment of every asset URL. */
const CATEGORIES = readdirSync(join(ROOT, 'assets'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

/**
 * Paths the app builds at runtime, which no scan can see.
 *
 * Each one is a category whose files are kept whole, and each needs a reason.
 * The scanner fails if it finds a template literal after a category that is
 * not in here, so this list cannot quietly fall behind the code.
 */
const DYNAMIC: { category: string; why: string }[] = [
  {
    category: 'rarity',
    why: 'Picker.tsx builds /rarity/${rarity.toLowerCase()}.png for the rarity stepper',
  },
]

/** Files that are not images and that the app does not need at runtime. */
const DROP_FILES = [
  {
    path: 'manifest.json',
    why: '933 records of build metadata, sha256 and source pages. app-data.json already carries the resolved icon paths',
  },
]

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

if (!existsSync(DIST)) {
  console.error('no dist/ to prune. Run npm run build first.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// What the bundle asks for
// ---------------------------------------------------------------------------

const cats = CATEGORIES.join('|')
const literal = new RegExp(`(?:${cats})/[A-Za-z0-9_.\\-]+\\.(?:png|webp|jpg|jpeg|gif|svg)`, 'g')
const dynamic = new RegExp(`(?:${cats})/\\$\\{`, 'g')
const categoryOf = (path: string) => path.split('/')[0] ?? ''

const bundle = walk(DIST).filter((path) => /\.(js|css|html)$/i.test(path))

const referenced = new Set<string>()
const dynamicFound = new Set<string>()

for (const file of bundle) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(literal)) referenced.add(match[0])
  for (const match of text.matchAll(dynamic)) dynamicFound.add(categoryOf(match[0]))
}

// A template literal after a category means a path this cannot see. Refusing
// is the whole point: deleting the files it would have resolved to gives a
// deployed page that 404s on something a local dev server served fine.
const declared = new Set(DYNAMIC.map((entry) => entry.category))
const undeclared = [...dynamicFound].filter((category) => !declared.has(category))

if (undeclared.length) {
  console.error('the bundle builds asset paths this cannot see, and they are not declared:')
  for (const category of undeclared) {
    console.error(`  /${category}/\${...}  in the built JavaScript or CSS`)
  }
  console.error('\nAdd each to DYNAMIC in scripts/prune.ts with the reason, or the deploy will 404.')
  process.exit(1)
}

for (const entry of DYNAMIC) {
  const dir = join(DIST, entry.category)
  if (!existsSync(dir)) continue
  for (const file of walk(dir)) {
    referenced.add(relative(DIST, file).replace(/\\/g, '/'))
  }
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

const sizeOf = (paths: string[]) => paths.reduce((sum, path) => sum + statSync(path).size, 0)
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const shipped = walk(DIST).filter((path) => ASSET.test(path))
const before = sizeOf(shipped)

const kept: string[] = []
const dropped: string[] = []

for (const path of shipped) {
  const url = relative(DIST, path).replace(/\\/g, '/')
  if (referenced.has(url)) kept.push(path)
  else dropped.push(path)
}

const droppedBytes = sizeOf(dropped)
for (const path of dropped) rmSync(path)

let extraBytes = 0
for (const entry of DROP_FILES) {
  const path = join(DIST, entry.path)
  if (!existsSync(path)) continue
  extraBytes += statSync(path).size
  rmSync(path)
}

// Empty shelves left behind read as a broken build to anyone looking.
for (const category of CATEGORIES) {
  const dir = join(DIST, category)
  if (existsSync(dir) && !walk(dir).length) rmSync(dir, { recursive: true })
}

// ---------------------------------------------------------------------------
// Proving it
// ---------------------------------------------------------------------------

const broken = [...referenced].filter((url) => !existsSync(join(DIST, url)))

const byCategory = new Map<string, number>()
for (const path of kept) {
  const category = categoryOf(relative(DIST, path).replace(/\\/g, '/'))
  byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
}

console.log(`shipping ${kept.length} images of ${shipped.length}, ${mb(before - droppedBytes)} of ${mb(before)}`)
for (const [category, count] of [...byCategory].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${category}`)
}
for (const entry of DROP_FILES) console.log(`\ndropped ${entry.path}: ${entry.why}`)
console.log(`\n${dropped.length} unreferenced images removed, ${mb(droppedBytes + extraBytes)} saved.`)

if (broken.length) {
  console.error(`\n${broken.length} references do not resolve after pruning:`)
  for (const url of broken.slice(0, 10)) console.error(`  ${url}`)
  console.error('This is a bug in the scanner, not in the app. Nothing should be missing.')
  process.exit(1)
}

console.log('every path the bundle names still resolves.')
