/**
 * Vendor the four typefaces, so the page loads nothing from anybody else.
 *
 *   npm run fonts     re-fetch from Google, rewrite assets/fonts/ and src/ui/fonts.css
 *
 * **This is a one-time job you re-run when a face changes, not a build step.**
 * Nothing in `npm run build` calls it. The site does not depend on Google at
 * build time or at run time, which is the entire point.
 *
 * ## Why this exists
 *
 * `index.html` used to carry two preconnects and a stylesheet link to Google
 * Fonts, while the site's own Content-Security-Policy said
 * `style-src 'self' 'unsafe-inline'` and declared no `font-src` at all. The page
 * forbade the thing the page was doing. Nobody noticed because the CSP was never
 * applied: the deploy never picked `netlify.toml` up, so the live site ran on
 * Netlify's defaults and the rule was decoration.
 *
 * Cloudflare's `_headers` does apply. So the choice was to weaken the policy to
 * match the mistake, or remove the third party. Removing it is better on every
 * axis: the policy ships byte for byte unchanged, first paint stops waiting on a
 * cross-origin round trip, and Google stops seeing every visitor.
 *
 * ## The trap, which is why this is a script and not a hand copy
 *
 * **Take every subset Google returns. Do not hand-pick `latin`.**
 *
 * The UI renders U+03A9 eight times, because the game's own glossary calls them
 * Omega Moves, and U+00EB for Melinoe. Whether a given family even ships a greek
 * slice varies per family, so a hand-picked subset list would silently drop a
 * glyph on some faces and not others. Copying Google's answer verbatim, with
 * every `unicode-range` intact, is the only way to keep the coverage the site
 * has today. The browser still downloads only the slices it needs: that is what
 * `unicode-range` is for, so the greek slice costs nothing until something
 * renders one.
 *
 * Google's filenames are content hashes, so `_headers` caches them immutable.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const FONTS = join(ROOT, 'assets/fonts')
const OUT = join(ROOT, 'src/ui/fonts.css')

/**
 * The exact request `index.html` used to make, kept here as the record of what
 * was taken. The weights are not guesses: `base.css` notes that Caesar Dressing
 * ships one weight and that asking for a heavier one loaded nothing.
 */
const CSS2 =
  'https://fonts.googleapis.com/css2' +
  '?family=Caesar+Dressing' +
  '&family=Inconsolata:wght@400;500;700' +
  '&family=Lato:ital,wght@0,300;0,400;0,700;1,400' +
  '&family=Spectral+SC:wght@300;400;500;600' +
  '&display=swap'

/**
 * Google serves woff2 only to a browser it recognises. Under node's own
 * user-agent it answers with truetype, which is roughly twice the bytes.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const slug = (name: string) =>
  name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`

// ---------------------------------------------------------------------------
// Fetch and parse
// ---------------------------------------------------------------------------

const response = await fetch(CSS2, { headers: { 'User-Agent': UA } })
if (!response.ok) {
  console.error(`Google Fonts answered ${response.status}. Nothing written.`)
  process.exit(1)
}
const css = await response.text()

if (!css.includes('woff2')) {
  console.error('the response names no woff2. The user-agent is probably no longer recognised.')
  process.exit(1)
}

type Face = {
  family: string
  weight: string
  style: string
  subset: string
  url: string
  body: string
}

const faces: Face[] = []
let cursor = 0

for (const match of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
  const body = match[0]
  const at = match.index ?? 0
  // The subset name arrives as a comment immediately above its block. Reading
  // backwards from the block is more robust than assuming one is there.
  const comments = [...css.slice(cursor, at).matchAll(/\/\*\s*([\w-]+)\s*\*\//g)]
  cursor = at + body.length

  const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(body)?.[1]
  const family = /font-family:\s*['"]([^'"]+)['"]/.exec(body)?.[1]
  if (!url || !family) continue

  faces.push({
    family,
    weight: /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? '400',
    style: /font-style:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? 'normal',
    subset: comments.at(-1)?.[1] ?? 'unnamed',
    url,
    body,
  })
}

if (!faces.length) {
  console.error('parsed no @font-face blocks out of the response. Nothing written.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

// Cleared rather than merged, so a face Google stops serving does not linger on
// disk and in the stylesheet forever.
if (existsSync(FONTS)) {
  for (const file of readdirSync(FONTS)) {
    if (file.endsWith('.woff2')) rmSync(join(FONTS, file))
  }
}
mkdirSync(FONTS, { recursive: true })

const named = new Map<string, string>()
let bytes = 0

for (const face of faces) {
  // Google's basename is already a content hash. The family prefix is for
  // whoever opens the directory, and it makes a collision impossible rather
  // than merely unlikely.
  const base = face.url.split('/').pop() ?? ''
  const file = `${slug(face.family)}-${base}`
  const path = join(FONTS, file)

  const seen = named.get(file)
  if (seen && seen !== face.url) {
    console.error(`two faces both want ${file}. Refusing to overwrite one with the other.`)
    process.exit(1)
  }
  named.set(file, face.url)

  if (!existsSync(path)) {
    const font = await fetch(face.url, { headers: { 'User-Agent': UA } })
    if (!font.ok) {
      console.error(`${face.url} answered ${font.status}. Nothing further written.`)
      process.exit(1)
    }
    const buffer = Buffer.from(await font.arrayBuffer())
    writeFileSync(path, buffer)
    bytes += buffer.byteLength
  }

  face.body = face.body.replace(face.url, `/fonts/${file}`)
}

// ---------------------------------------------------------------------------
// The stylesheet
// ---------------------------------------------------------------------------

const families = [...new Set(faces.map((face) => face.family))]

const header = `/* The four typefaces, served from this origin.
 *
 * GENERATED by scripts/fonts.ts. Do not hand edit, run npm run fonts.
 *
 * ${faces.length} faces across ${families.length} families, taken from Google's
 * css2 response verbatim with every unicode-range intact. The browser downloads
 * only the slices a page needs, so the ones it never touches cost nothing.
 *
 * Vendored rather than linked so the page loads nothing from a third party and
 * the CSP can stay as strict as it reads. The reasoning is in the script.
 */

`

const blocks = faces
  .map((face) => `/* ${face.family} ${face.weight} ${face.style}, ${face.subset} */\n${face.body}`)
  .join('\n\n')

writeFileSync(OUT, `${header}${blocks}\n`, 'utf8')

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`${faces.length} faces, ${named.size} files, ${kb(bytes)} downloaded`)

for (const family of families) {
  const mine = faces.filter((face) => face.family === family)
  const subsets = [...new Set(mine.map((face) => face.subset))].sort()
  const weights = [
    ...new Set(mine.map((face) => `${face.weight}${face.style === 'italic' ? 'i' : ''}`)),
  ]
  console.log(`  ${family.padEnd(16)} ${String(mine.length).padStart(2)} faces  ${weights.join(' ')}`)
  console.log(`  ${' '.repeat(16)}    ${subsets.join(' ')}`)
}

const greek = [...new Set(faces.filter((face) => face.subset === 'greek').map((f) => f.family))]
console.log(
  greek.length
    ? `\ngreek slice present for ${greek.join(', ')}, so the game's Omega renders from the face`
    : '\nno family ships a greek slice, so the Omega falls to the system stack, as it does today',
)
