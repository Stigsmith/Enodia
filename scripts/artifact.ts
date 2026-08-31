/**
 * The build manager, folded into one file.
 *
 * `npm run artifact` builds `artifact/` with Vite and then inlines everything
 * the page loads: the stylesheet, the module, and every image, as data URIs.
 * The result is a single HTML file that runs from anywhere with no server, no
 * network and no asset directory beside it, which is what an Artifact needs and
 * also what makes it mailable.
 *
 * ## Why not just ship dist/
 *
 * `dist/` is 10 MB across 518 files and a third of it is Arcana card art at
 * full resolution. An Artifact has to be self contained, so every one of those
 * files would have to become a data URI, and base64 adds a third again. The
 * page would be 14 MB against a 16 MB ceiling and most of it would be art for
 * builds nobody is looking at.
 *
 * **So this inlines only what the page actually draws.** The three sample
 * builds name 46 images between them, the mark always needs the six rarity
 * frames and five slot glyphs, and the Loadout wants two pieces of tray
 * furniture. Everything else in the library stays out.
 *
 * ## The Arcana are downscaled, and nothing else is
 *
 * The card art is 900 to 1075 KB apiece and never drawn above 220 pixels tall.
 * Six of them at full size is 5.6 MB of a 6.2 MB total, so they go through
 * Pillow to 480 pixel WebP and the six become about 220 KB. **Everything else
 * ships byte for byte**: boon icons are 90 square already, and the aspect
 * renders are the one thing on the Poster that is meant to be looked at.
 *
 * Pillow rather than a Node library because the project already depends on it:
 * `scripts/reward-frame.ts` shells out to the same interpreter, and
 * `CLAUDE.md` records where it lives.
 *
 * ## What it refuses
 *
 * An image the page names and the library does not have. A silent skip would
 * publish a page with holes in it and the holes would look like a design
 * decision, so it stops and says which.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'dist-artifact')
const PAGE = join(OUT_DIR, 'enodia-builds.html')

/** Where Pillow is. CLAUDE.md: its Scripts directory is not on PATH. */
const PYTHON = join(
  process.env.LOCALAPPDATA ?? '',
  'Programs',
  'Python',
  'Python312',
  'python.exe',
)

/** Art the mark and the Loadout always draw, whatever build is on screen. */
const ALWAYS = [
  'frames/frame-common.png',
  'frames/frame-rare.png',
  'frames/frame-epic.png',
  'frames/frame-heroic.png',
  'frames/frame-duo.png',
  'frames/frame-legendary.png',
  'slots/attack.webp',
  'slots/special.webp',
  'slots/cast.webp',
  'slots/dash.webp',
  'slots/magick.webp',
  'shell/tray-header.png',
  'shell/tray-backing.png',
]

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

/**
 * Every image path the built bundle names.
 *
 * Read off the bundle rather than recomputed from the sample builds, because
 * the bundle is what the browser will ask for. A path the CSS mentions and the
 * data does not, or the other way round, is found either way.
 *
 * The bundle carries the whole trait table, so this is filtered against what
 * the page can actually reach: the sample builds' own pieces, plus ALWAYS.
 */
function pathsIn(text: string): Set<string> {
  const found = new Set<string>()
  // Both shapes the code produces: `src={`/${icon}`}` compiles to "/"+e, and
  // the CSS writes url('/shell/tray-header.png').
  for (const match of text.matchAll(/["'(](?:\/)?([a-z0-9-]+\/[a-z0-9._-]+\.(?:png|webp|jpe?g|svg))["')]/gi)) {
    if (match[1]) found.add(match[1])
  }
  return found
}

/**
 * What the sample builds resolve to.
 *
 * **Read off the source text rather than by importing it.** `src/data/app.ts`
 * imports `app-data.json` the way Vite wants, and Node 24 refuses that without
 * an import attribute, so pulling `assemble` in here fails before it runs. The
 * ids in `builds.ts` are all plain quoted strings, so every one of them is
 * found by looking, and the resolution happens against the same bundle the app
 * reads.
 *
 * The regex is deliberately loose. Over-inclusive costs a few kilobytes of art
 * nobody looks at; under-inclusive publishes a page with holes. Every path is
 * checked to exist before it is inlined, so a wrong guess stops the build
 * rather than shipping.
 */
function reachable(): Set<string> {
  type Row = { id: string; icon?: string; render?: string }
  const bundle = JSON.parse(readFileSync(join(ROOT, 'data/app/app-data.json'), 'utf8')) as {
    traits: (Row & { kind?: string; name?: string })[]
    arcana: Row[]
    familiars: Row[]
    weapons: Row[]
    sources: (Row & { kind?: string })[]
  }

  const art = new Map<string, string[]>()
  for (const group of [bundle.traits, bundle.arcana, bundle.familiars, bundle.weapons]) {
    for (const row of group) {
      const have = art.get(row.id) ?? []
      if (row.icon) have.push(row.icon)
      if (row.render) have.push(row.render)
      if (have.length) art.set(row.id, have)
    }
  }

  const source = readFileSync(join(ROOT, 'src/data/builds.ts'), 'utf8')
  const want = new Set(ALWAYS)

  /**
   * The filter's own art, which no build necessarily names.
   *
   * `build-filter.ts` draws an icon beside every dropdown option, and those
   * come from three places the sample builds do not mention: an arm is drawn as
   * its **base aspect**, a god as its **reward source** portrait, and a familiar
   * is offered whether or not a sample uses it. Five of the six arm icons were
   * missing because no sample names `BaseStaffAspect` and friends.
   *
   * **It failed silently in exactly the way that matters.** Served from `dist/`
   * the icons resolved, because the image library sits beside the page there.
   * In the Artifact, which has no server and no library, they would have 404ed.
   * Caught by counting non-data URIs in the rendered page, which is the only
   * check that actually proves self-containment.
   */
  const facetArt = () => {
    const out: string[] = []
    for (const row of bundle.traits) {
      // An arm's mark is its Aspect of Melinoe, the one square icon per weapon.
      if (row.kind === 'aspect' && /Melino/.test(row.name ?? '') && row.icon) out.push(row.icon)
    }
    for (const row of bundle.sources) if (row.kind === 'olympian' && row.icon) out.push(row.icon)
    for (const row of bundle.familiars) if (row.icon) out.push(row.icon)
    return out
  }
  for (const rel of facetArt()) want.add(rel)

  let matched = 0
  for (const match of source.matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)) {
    const found = match[1] ? art.get(match[1]) : undefined
    if (!found) continue
    matched += 1
    for (const rel of found) want.add(rel)
  }

  // Three builds name an aspect, a Hex, a keepsake, a familiar, five Arcana and
  // six to eight boons apiece. Far fewer than that means the ids stopped being
  // plain quoted strings and this went quietly blind.
  if (matched < 40) throw new Error(`only ${matched} ids resolved out of src/data/builds.ts`)
  console.log(`  ${matched} ids in src/data/builds.ts resolve to art`)
  return want
}

/**
 * One image as a data URI, downscaled when it is far larger than it is drawn.
 *
 * `maxHeight` is the tallest this is ever rendered, doubled for a retina panel
 * and rounded up. Absent means ship it as it is.
 */
function dataUri(rel: string, maxHeight?: number): { uri: string; bytes: number; from: number } {
  const file = join(ROOT, 'assets', rel)
  if (!existsSync(file)) throw new Error(`no such image: assets/${rel}`)
  const original = statSync(file).size

  if (maxHeight) {
    const script = [
      'import io, sys',
      'from PIL import Image',
      'im = Image.open(sys.argv[1]).convert("RGBA")',
      'h = int(sys.argv[2])',
      'if im.height > h:',
      '    im = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)',
      'buf = io.BytesIO()',
      'im.save(buf, "WEBP", quality=86, method=6)',
      'sys.stdout.buffer.write(buf.getvalue())',
    ].join('\n')
    const run = spawnSync(PYTHON, ['-c', script, file, String(maxHeight)], {
      maxBuffer: 64 * 1024 * 1024,
    })
    if (run.status !== 0) {
      throw new Error(`Pillow failed on ${rel}: ${run.stderr?.toString().trim()}`)
    }
    const out = run.stdout
    // Only keep the shrink if it actually shrank. A 90 square PNG re-encoded
    // as WebP is sometimes bigger, and then the original is the right answer.
    if (out.length < original) {
      return { uri: `data:image/webp;base64,${out.toString('base64')}`, bytes: out.length, from: original }
    }
  }

  const buffer = readFileSync(file)
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase()
  const mime = MIME[ext]
  if (!mime) throw new Error(`no MIME type for ${rel}`)
  return { uri: `data:${mime};base64,${buffer.toString('base64')}`, bytes: buffer.length, from: original }
}

/** Only the Arcana are far larger than they are drawn. */
const shrinkTo = (rel: string): number | undefined => (rel.startsWith('arcana/') ? 480 : undefined)

console.log('building artifact/ ...')
execFileSync('npx', ['vite', 'build', '--config', 'vite.artifact.config.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

const built = join(ROOT, 'dist-artifact', 'build')
const assetDir = join(built, 'assets')
const files = readdirSync(assetDir)
const jsName = files.find((name) => name.endsWith('.js'))
const cssName = files.find((name) => name.endsWith('.css'))
if (!jsName || !cssName) throw new Error(`expected one .js and one .css in ${assetDir}`)

const js = readFileSync(join(assetDir, jsName), 'utf8')
let css = readFileSync(join(assetDir, cssName), 'utf8')

const named = new Set([...pathsIn(js), ...pathsIn(css)])
const want = reachable()
const inline = [...want].sort()

// A path the page draws and the bundle never names would silently never load.
const unnamed = inline.filter((rel) => !named.has(rel))
if (unnamed.length) {
  console.log(`  note: ${unnamed.length} paths come from data rather than from source text`)
}

console.log(`inlining ${inline.length} images ...`)
let before = 0
let after = 0
const uris = new Map<string, string>()
for (const rel of inline) {
  const { uri, bytes, from } = dataUri(rel, shrinkTo(rel))
  uris.set(rel, uri)
  before += from
  after += bytes
}
console.log(`  ${mb(before)} of art becomes ${mb(after)}, ${kb(after - before)} difference`)

/**
 * Point every path at its data URI.
 *
 * ## The CSS is easy and the JavaScript is not
 *
 * A stylesheet writes `url('/shell/tray-header.png')`, a literal, and swapping
 * the literal is the whole job.
 *
 * **The module never contains a finished path.** `app-data.json` holds bare
 * paths like `arcana/death.png`, the components build `` src={`/${icon}`} ``,
 * and the slash is prepended at render time. So replacing the bare path in the
 * data produced `src="/data:image/webp;base64,..."` and every image 404ed while
 * the build reported sixty successful substitutions. It looked like it worked.
 *
 * So the twelve build sites are rewritten instead. Every one of them is
 * `` src:`/${EXPR}` `` after minification, which becomes `src:__art(EXPR)`, and
 * `__art` looks the bare path up in a map at the top of the module. The data
 * keeps its bare paths and stays the map's keys.
 *
 * **It asserts both ways.** If the rewrite count is zero the shape changed and
 * this went blind; if any `` `/${ `` survives, something builds a path this did
 * not catch, and it fails rather than shipping a page with holes.
 */
const ART = /src:`\/\$\{([^`]+?)\}`/g

let rewrites = 0
const patchedJs = js.replace(ART, (_match, expression: string) => {
  rewrites += 1
  return `src:__art(${expression})`
})

if (rewrites === 0) {
  throw new Error('no `src:`/${...}`` sites found. The build output shape changed.')
}

const stillBuilding = [...patchedJs.matchAll(/`[^`]{0,60}\/\$\{/g)]
if (stillBuilding.length) {
  throw new Error(
    `${stillBuilding.length} paths are still built at runtime and would 404: ` +
      stillBuilding.slice(0, 3).map((one) => one[0]).join(' | '),
  )
}

/**
 * The lookup, in front of the module.
 *
 * A path the map does not know falls back to the ordinary URL rather than to
 * nothing, so an image this script failed to collect shows up as a broken image
 * in the console rather than silently as an empty box.
 */
const preamble = `const __ART = ${JSON.stringify(Object.fromEntries(uris))};
const __art = (path) => __ART[path] ?? ('/' + path);
`

let inlinedCss = css
let cssHits = 0
for (const [rel, uri] of [...uris].sort((a, b) => b[0].length - a[0].length)) {
  for (const shape of [`/${rel}`, rel]) {
    const parts = inlinedCss.split(shape)
    if (parts.length > 1) {
      cssHits += parts.length - 1
      inlinedCss = parts.join(uri)
    }
  }
}
css = inlinedCss

console.log(`  ${rewrites} image sites rewritten in the module, ${cssHits} literals in the stylesheet`)

const finalJs = preamble + patchedJs

/**
 * The charset meta is FIRST, and it is not optional.
 *
 * It was left out on the grounds that the Artifact wrapper injects one, which
 * is true and is exactly the trap `CLAUDE.md` already records: **the same file
 * also ships as `dist/builds.html` behind a plain server, where nothing injects
 * anything.** Served that way, with no declaration, the browser guessed GBK,
 * and every `·` separator in the page came out as a Chinese character.
 * "Descura 路 Poseidon + Zeus".
 *
 * Third time this project has been bitten by a missing charset, and the second
 * time it was invisible in a wrapper that supplies its own.
 */
const page = `<meta charset="utf-8">
<title>Enodia Build Manager</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Spectral:ital,wght@0,300;0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* The page is its own ground. The wrapper paints behind it, so a transparent
 * body would borrow the host's theme, and this design is dark either way. */
html, body { background: #080d0f; margin: 0; }
${css}
</style>
<div id="root"></div>
<script type="module">
${finalJs}
</script>
`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(PAGE, page, 'utf8')

const size = statSync(PAGE).size
console.log(`\n${PAGE.replace(ROOT + '\\', '')}  ${mb(size)}`)
console.log(`  ${inline.length} images, ${kb(css.length)} of CSS, ${kb(finalJs.length)} of module`)
if (size > 16 * 1024 * 1024) {
  throw new Error(`over the 16 MB ceiling by ${mb(size - 16 * 1024 * 1024)}`)
}
console.log(`  ${mb(16 * 1024 * 1024 - size)} under the 16 MB ceiling`)
