/**
 * The wiki's portrait tiles: the game's own Codex portrait of each god and
 * each person met along the way.
 *
 *   npm run portraits            write assets/portraits/*.webp
 *   npm run portraits -- --force rebuild every one
 *
 * ## Why these
 *
 * The tiles were drawn from `gods/` and `characters/`, which are the wiki's
 * 214 pixel squares, stretched to a tile near 190 by 300 and soft at any
 * density. The game ships a Codex portrait of every character in `GUI.pkg`,
 * 369 by 492, which is the tile's own shape and twice its size. Each is cut
 * here just inside its torn paper edge, because the tile draws its own frame,
 * and comes out between 20 and 40 KB.
 *
 * **It reads `extracted/`**, which git ignores, so a clean clone cannot run
 * it and does not need to: the output is committed. Extract `GUI.pkg` first,
 * with the commands in `assets/README.md`.
 *
 * Run `npm run assets` afterwards. That is the only writer of
 * `assets/manifest.json`, and `npm run validate` fails on any image on disk the
 * manifest does not list.
 */

import { existsSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const FROM = join('extracted', 'gui', 'textures', 'Portraits', 'Codex')
const OUT = join('assets', 'portraits')
const QUALITY = 78

/** Each portrait, by the name the game files it under. Slug is the lower case. */
const NAMES = [
  // the nine Olympians
  'Aphrodite', 'Apollo', 'Ares', 'Demeter', 'Hephaestus', 'Hera', 'Hestia', 'Poseidon', 'Zeus',
  // the other gods
  'Hermes', 'Chaos', 'Selene', 'Artemis', 'Athena', 'Dionysus', 'Hades',
  // along the way
  'Circe', 'Echo', 'Icarus', 'Medea', 'Narcissus',
]

/**
 * How much of the edge to leave behind, in source pixels. The torn border runs
 * up to sixteen pixels in at its deepest tear, measured on Zeus, and is the same frame
 * on every portrait.
 */
const INSET = { left: 18, top: 14, right: 18, bottom: 18 }

const force = process.argv.includes('--force')

async function run() {
  if (!existsSync(FROM)) {
    console.error(`${FROM} is not there. Extract GUI.pkg first, see assets/README.md.`)
    process.exitCode = 1
    return
  }
  await mkdir(OUT, { recursive: true })
  let made = 0
  for (const name of NAMES) {
    const source = join(FROM, `CodexPortrait_${name}.png`)
    const out = join(OUT, `${name.toLowerCase()}.webp`)
    if (!force && existsSync(out) && (await stat(out)).mtimeMs > (await stat(source)).mtimeMs) continue
    const { width = 0, height = 0 } = await sharp(source).metadata()
    await sharp(source)
      .extract({
        left: INSET.left,
        top: INSET.top,
        width: width - INSET.left - INSET.right,
        height: height - INSET.top - INSET.bottom,
      })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(out)
    made += 1
    console.log(`${out}  ${Math.round((await stat(out)).size / 1024)} KB`)
  }
  console.log(`\n${made} written.${made ? ' Run npm run assets next, or the manifest check will fail the build.' : ''}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
