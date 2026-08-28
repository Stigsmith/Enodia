/**
 * The game's own Exit reward marker, composed into something a page can use.
 *
 *   npm run reward-frame
 *
 * **What the game actually draws on an Exit**, traced from `RewardPresentation.
 * CreateDoorRewardPreview`. It spawns a backing and sets one of two animations
 * on it, and those chain:
 *
 * ```
 * RoomRewardAvailable_Back_Run          Fx\RoomRewardAvailable-Back\RoomRewardGlow
 *   -> RoomRewardAvailable_Front_Run    Fx\RoomRewardAvailable-Front\...0001..0060
 *        -> RoomRewardFrame_Run         Fx\RoomRewardAvailable-Back\RoomRewardFrame-Run
 * ```
 *
 * So the marker is three layers: a warm bloom behind, a shimmering disc of 60
 * frames at 30fps over it, and two silver wings on top. `_Meta` is the same
 * thing for the MetaProgress store, with a green jewel on each wing.
 *
 * All three live in **`ScriptsBase.pkg`**, not `GUI.pkg`, which is why nothing
 * in `assets/` had them: every extraction this project had done was of the GUI
 * package. `deppth2`'s `-e` filter does not match these entries by any name
 * tried, so the package is extracted whole into `extracted/scriptsbase/`.
 *
 * **Both pieces are drawn in isometric and both have to be undone.** The disc
 * is an ellipse, 122 by 162, so it is a circle seen at an angle; squaring the
 * crop makes it round. The wings sit on an axis 25.7 degrees below horizontal,
 * measured from their own alpha rather than hardcoded, and on a real Exit they
 * read as left and right of the disc. Laying them flat is what makes the
 * composed marker look like the thing in the game.
 *
 * That is why this is its own script rather than a line in `scripts/chrome.ts`:
 * the shelf takes files as they are, and this one has to be undistorted,
 * punched through and recomposed first.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
const FX = join(ROOT, 'extracted/scriptsbase/textures/Fx')
const OUT = join(ROOT, 'assets')

const PYTHON = join(process.env.LOCALAPPDATA ?? '', 'Programs/Python/Python312/python.exe')

if (!existsSync(FX)) {
  console.log('extracted/scriptsbase is missing, so there is nothing to compose from.')
  console.log('Extract it first:')
  console.log('  deppth2 ex -s -t extracted/scriptsbase ".../Packages/1080p/ScriptsBase.pkg"')
  process.exit(0)
}

const script = `
from PIL import Image, ImageDraw
import glob, os, json

FX = ${JSON.stringify(FX)}
OUT = ${JSON.stringify(OUT)}
SIZE = 512
report = []

def disc_ring(frame_path, punch=0.90):
    """The shimmering disc, squared up and punched through.

    Cropping to the alpha bbox and resizing that crop to a square is what
    undoes the isometric squash: the bbox is the ellipse, so forcing it to
    1:1 makes the ellipse a circle. The interior is a dark fill meant to sit
    over game world art, and it would cover a portrait, so it goes.
    """
    im = Image.open(frame_path).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox()).resize((SIZE, SIZE), Image.LANCZOS)
    hole = Image.new("L", (SIZE, SIZE), 255)
    ImageDraw.Draw(hole).ellipse(
        (SIZE*(1-punch)/2, SIZE*(1-punch)/2, SIZE*(1+punch)/2, SIZE*(1+punch)/2), fill=0)
    im.putalpha(Image.composite(im.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), hole))
    return im

def wing_axis(im):
    """The angle the two crescents sit at, from their own alpha.

    They are drawn diagonally because the game renders them on the same
    isometric plane as the disc; on a door they read horizontal. Splitting the
    sprite down the middle and taking each half's alpha-weighted centroid gives
    the axis without hardcoding a number that a patch could move.
    """
    a = im.getchannel("A")
    w, h = im.size
    px = a.load()
    def centroid(x0, x1):
        sx = sy = n = 0
        for y in range(h):
            for x in range(x0, x1):
                v = px[x, y]
                if v > 30:
                    sx += x*v; sy += y*v; n += v
        return (sx/n, sy/n) if n else None
    left, right = centroid(0, w//2), centroid(w//2, w)
    if not left or not right:
        return 0.0
    import math
    return math.degrees(math.atan2(right[1]-left[1], right[0]-left[0]))

def wings(path, width):
    im = Image.open(path).convert("RGBA")
    # Lay them flat first, then crop, or the crop keeps the diagonal's slack.
    im = im.rotate(wing_axis(im), resample=Image.BICUBIC, expand=True)
    im = im.crop(im.getchannel("A").getbbox())
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)

frames = sorted(glob.glob(os.path.join(FX, "RoomRewardAvailable-Front", "*.png")))
if not frames:
    print(json.dumps([{"error": "no RoomRewardAvailable-Front frames"}]))
    raise SystemExit(0)

# Frame 21 of 60, which is where the shimmer is brightest and most even. A
# still has to stand for the whole loop, so it should not be caught mid dip.
still = frames[min(20, len(frames) - 1)]

for name, wing_src in [("run", "RoomRewardFrame-Run.png"), ("meta", "RoomRewardFrame-Meta.png")]:
    wing_path = os.path.join(FX, "RoomRewardAvailable-Back", wing_src)
    if not os.path.exists(wing_path):
        report.append({"name": name, "error": "no " + wing_src})
        continue

    canvas = round(SIZE * 1.34)
    marker = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    marker.alpha_composite(disc_ring(still), ((canvas - SIZE)//2, (canvas - SIZE)//2))
    # Wide enough that the crescents sit outside the disc, which is where the
    # game puts them. At 1.14 they crossed the portrait inside it.
    w = wings(wing_path, round(SIZE * 1.30))
    marker.alpha_composite(w, ((canvas - w.width)//2, (canvas - w.height)//2))

    suffix = "" if name == "run" else "-meta"
    for label, img in [("reward-marker" + suffix, marker), ("reward-wings" + suffix, w)]:
        path = os.path.join(OUT, "frames", label + ".png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.save(path, optimize=True)
        report.append({"name": "frames/" + label + ".png", "size": img.size, "bytes": os.path.getsize(path)})

glow = os.path.join(FX, "RoomRewardAvailable-Back", "RoomRewardGlow.png")
if os.path.exists(glow):
    path = os.path.join(OUT, "chrome", "reward-glow.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.open(glow).convert("RGBA").save(path, optimize=True)
    report.append({"name": "chrome/reward-glow.png", "size": Image.open(path).size,
                   "bytes": os.path.getsize(path)})

print(json.dumps(report))
`

mkdirSync(join(OUT, 'frames'), { recursive: true })
const scratch = join(ROOT, 'extracted', '.reward-frame.py')
writeFileSync(scratch, script)

const run = spawnSync(PYTHON, [scratch], { encoding: 'utf8' })
if (run.status !== 0) {
  console.error(run.stderr || 'python failed')
  process.exit(1)
}

const report = JSON.parse(run.stdout.trim().split('\n').at(-1) ?? '[]') as {
  name: string
  size?: [number, number]
  bytes?: number
  error?: string
}[]

console.log("the game's own Exit reward marker:")
for (const entry of report) {
  if (entry.error) console.log(`  ${entry.name}: ${entry.error}`)
  else
    console.log(
      `  ${entry.name.padEnd(34)} ${entry.size?.[0]}x${entry.size?.[1]}  ${Math.round((entry.bytes ?? 0) / 1024)} KB`,
    )
}
console.log('\nRun npm run assets to describe them in assets/manifest.json.')
