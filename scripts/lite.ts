/**
 * Lightweight copies of art that is being served far larger than it is drawn.
 *
 * ## Why this exists
 *
 * `assets/arcana/` was **39.2 MB of a 64 MB site**: 52 cards at 689 by 1071,
 * averaging 770 KB, every one a PNG while the rest of the library is webp. The
 * board draws them five across inside `max-width: min(100%, 52dvh)`, so a card
 * renders at roughly 94 px wide on a laptop and about 150 px on a tall desktop.
 * That is some seven times the resolution in each dimension, or fifty times the
 * pixels, and it made one screen a 39 MB visit.
 *
 * Measured rather than assumed, on `divinity.png` at 1074 KB:
 *
 * | width | q60 | q75 | q85 |
 * |---|---|---|---|
 * | 320 | 41 KB | 46 KB | 58 KB |
 * | **420** | 62 KB | **69 KB** | 89 KB |
 * | 480 | 75 KB | 84 KB | 108 KB |
 * | 560 | 93 KB | 104 KB | 136 KB |
 *
 * ## What it writes, and why not in place
 *
 * A `-lite.webp` beside each original rather than over it. **Both versions are
 * wanted**: the owner's plan is an account-level quality choice, so the full art
 * has to survive for the day the toggle lands. Until then only the lite set is
 * referenced, and `prune.ts` drops the originals from `dist/` because nothing
 * names them.
 *
 * `-lite` follows the suffix convention `build-app-data.ts` already uses for
 * `-inactive`, so the join needs no new rule and `src/data/icons.ts` is
 * untouched. That matters: `CLAUDE.md` puts the asset join in one place and
 * keeps it there.
 *
 * ## Safe to re-run
 *
 * Skips a file whose lite copy is newer than its source, so running it again
 * costs nothing. `--force` rebuilds regardless.
 *
 * Run `npm run assets` afterwards. That is the only writer of
 * `assets/manifest.json`, and `npm run validate` fails on any image on disk the
 * manifest does not list.
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

/**
 * The categories worth shrinking, and the width each is drawn at.
 *
 * A width is the largest the art is ever rendered, times two for a dense
 * screen, rounded up. Arcana is the only entry today: the board tops out near
 * 150 px a card and the hover peek at `max-width: 13rem`, so 208 px, and 420
 * covers the larger of those at 2x with room over.
 *
 * **Nothing else is in here yet on purpose.** The boon and keepsake icons are
 * already webp and already small; adding categories to this list without
 * measuring them first would be the same mistake in the other direction.
 */
const CATEGORIES: { dir: string; width: number; quality: number }[] = [
  { dir: 'arcana', width: 420, quality: 78 },
]

const ROOT = 'assets'

/**
 * Below this, leave it alone.
 *
 * `arcana/` holds two chrome frames at 8 KB and 4 KB beside the cards, and the
 * first run dutifully made lite copies of both. Shrinking 12 KB buys nothing
 * and leaves files nothing will ever reference. The point is art being served
 * far larger than it is drawn, and that art is never small to begin with.
 */
const FLOOR = 200 * 1024

const force = process.argv.includes('--force')

/** Is the lite copy already newer than what it was made from? */
async function fresh(source: string, lite: string): Promise<boolean> {
  if (force) return false
  try {
    const [a, b] = await Promise.all([stat(source), stat(lite)])
    return b.mtimeMs >= a.mtimeMs
  } catch {
    return false
  }
}

async function run() {
  let made = 0
  let skipped = 0
  let tiny = 0
  let before = 0
  let after = 0

  for (const { dir, width, quality } of CATEGORIES) {
    const here = join(ROOT, dir)
    const files = (await readdir(here)).filter(
      (name) => /\.(png|jpe?g)$/i.test(name) && !name.includes('-lite.'),
    )

    console.log(`\n${dir}: ${files.length} originals, target ${width}px at q${quality}`)

    for (const name of files.sort()) {
      const source = join(here, name)
      const lite = join(here, name.replace(/\.(png|jpe?g)$/i, '-lite.webp'))

      const source_bytes = (await stat(source)).size
      if (source_bytes < FLOOR) {
        tiny += 1
        continue
      }
      before += source_bytes

      if (await fresh(source, lite)) {
        after += (await stat(lite)).size
        skipped += 1
        continue
      }

      await sharp(source)
        // Never upscale: a source already smaller than the target stays as it is.
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toFile(lite)

      after += (await stat(lite)).size
      made += 1
    }
  }

  const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`
  console.log(
    `\n${made} written, ${skipped} already current, ${tiny} left alone as too small.` +
      `\n${mb(before)} of originals becomes ${mb(after)} of lite art, ` +
      `${(before / after).toFixed(1)} times smaller.` +
      `\n\nRun npm run assets next, or the manifest check will fail the build.`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
