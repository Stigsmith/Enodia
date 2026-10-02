/**
 * The wiki's banners: one wide picture per top-level section.
 *
 *   npm run banners            write assets/banners/*.webp
 *   npm run banners -- --force rebuild every one
 *
 * ## Why these and why made here
 *
 * The owner asked for the wiki to be walked by picture: large tiles, dim until
 * the pointer is on one, each section a banner. The big pictures in the library
 * are the theme wallpapers, 1920 to 3840 wide and up to 1.7 MB each, and the
 * index would draw ten of them at once. So each section's banner is cut out of
 * one here, at the size a tile is drawn: 960 by 400, which covers the widest
 * tile at twice its size on a dense screen, and comes out near 50 KB.
 *
 * **Hades II art only.** Five of the wallpapers are from the first game, with
 * Zagreus and its pantheon in them, and a Hades II wiki leading with those would
 * be advertising the wrong game. None of the five is used here.
 *
 * Arcana has no wallpaper and has better: its own cards, four of them side by
 * side, each cut from the middle of its art.
 *
 * Run `npm run assets` afterwards. That is the only writer of
 * `assets/manifest.json`, and `npm run validate` fails on any image on disk the
 * manifest does not list.
 */

import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = 'assets'
const OUT = join(ROOT, 'banners')
const WIDTH = 960
const HEIGHT = 400
const QUALITY = 72

/** Each banner, the wallpaper it is cut from, and which part of it to keep. */
const BANNERS: { slug: string; from: string; keep: 'centre' | 'north' | 'south' }[] = [
  // Olympus above the cloud: the gods' own country, with nobody in it to date it.
  { slug: 'olympians', from: 'themes/olympian/lead-above-the-cloud.png', keep: 'centre' },
  // Chaos, who is a god and none of the nine, and whose face is near the top.
  { slug: 'gods', from: 'themes/cthonic/lead-chaos.jpg', keep: 'north' },
  // Two figures together, for the boons that need two gods.
  { slug: 'duos', from: 'themes/unseen/warsong.jpg', keep: 'centre' },
  // Hecate's cauldron at the Crossroads, which is where the sorcery is.
  { slug: 'hexes', from: 'themes/unseen/crossroads-cauldron.png', keep: 'centre' },
  // Melinoë with her witchfire, holding what she fights with.
  { slug: 'arms', from: 'themes/unseen/lead-melinoe-witchfire.jpg', keep: 'centre' },
  { slug: 'keepsakes', from: 'themes/cthonic/dream-poppies.png', keep: 'centre' },
  { slug: 'along', from: 'themes/unseen/tartarus.jpg', keep: 'centre' },
  { slug: 'everything', from: 'themes/cthonic/black-sun.png', keep: 'centre' },
]

/** The cards across the Arcana banner, left to right. */
const CARDS = ['sorceress', 'moon', 'death', 'queen']

const force = process.argv.includes('--force')

async function stale(sources: string[], out: string): Promise<boolean> {
  if (force) return true
  try {
    const made = (await stat(out)).mtimeMs
    for (const source of sources) if ((await stat(source)).mtimeMs > made) return true
    return false
  } catch {
    return true
  }
}

async function run() {
  await mkdir(OUT, { recursive: true })
  let made = 0

  for (const { slug, from, keep } of BANNERS) {
    const source = join(ROOT, from)
    const out = join(OUT, `${slug}.webp`)
    if (!(await stale([source], out))) continue
    await sharp(source)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: keep })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(out)
    made += 1
    console.log(`${out}  ${Math.round((await stat(out)).size / 1024)} KB, from ${from}`)
  }

  // Four cards, each cut from the middle of its own art to a quarter of the
  // banner's width.
  const sources = CARDS.map((card) => join(ROOT, 'arcana', `${card}.png`))
  const out = join(OUT, 'arcana.webp')
  if (await stale(sources, out)) {
    const slot = WIDTH / CARDS.length
    const tiles = await Promise.all(
      sources.map((source) => sharp(source).resize(slot, HEIGHT, { fit: 'cover', position: 'centre' }).toBuffer()),
    )
    await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#080d0f' } })
      .composite(tiles.map((input, at) => ({ input, left: at * slot, top: 0 })))
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(out)
    made += 1
    console.log(`${out}  ${Math.round((await stat(out)).size / 1024)} KB, from ${CARDS.join(', ')}`)
  }

  console.log(`\n${made} written.${made ? ' Run npm run assets next, or the manifest check will fail the build.' : ''}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
