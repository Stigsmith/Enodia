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
 * **Every piece ships pre-warped, and the warp has to be measured rather than
 * guessed.** These are world objects, so the art is drawn already squashed for
 * the plane it lies on, and there is no plain 2D copy of it anywhere.
 *
 * The disc is the key that unlocks the rest. It is a circle in truth, so
 * whatever ellipse it ships as *is* the transform. Second moments of its own
 * alpha put the major axis at 61.7 degrees with a minor at 0.631 of it, and
 * undoing that, R(t) diag(1, r) R(-t), takes the disc from 0.631 to 0.999.
 * That is a circle to three places, and it is the check that the transform is
 * right rather than merely plausible.
 *
 * The wings then take the same inverse, because they lie on the same plane,
 * and that is what fixes the shape of each crescent rather than just the angle
 * between them. It leaves the pair on a 12.7 degree axis, so one rotation lays
 * them flat and they come out as the mirrored pair a real Exit shows.
 *
 * Nothing here is hardcoded. Both numbers are measured off the shipped alpha
 * on every run, so a patch that redraws the marker is followed, not fought.
 *
 * That is why this is its own script rather than a line in `scripts/chrome.ts`:
 * the shelf takes files as they are, and this one has to be un-warped, punched
 * through and recomposed first.
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
import glob, math, os, json

FX = ${JSON.stringify(FX)}
OUT = ${JSON.stringify(OUT)}
SIZE = 512
report = []

def moments(im):
    """Centroid and second moments of an image's alpha, weighted by it."""
    a = im.getchannel("A")
    w, h = im.size
    px = a.load()
    n = sx = sy = 0.0
    for y in range(h):
        for x in range(w):
            v = px[x, y]
            if v > 30:
                n += v; sx += x * v; sy += y * v
    if n == 0:
        return 0.0, 0.0, 0.0, 0.0, 0.0
    cx, cy = sx / n, sy / n
    mxx = myy = mxy = 0.0
    for y in range(h):
        for x in range(w):
            v = px[x, y]
            if v > 30:
                dx, dy = x - cx, y - cy
                mxx += v * dx * dx; myy += v * dy * dy; mxy += v * dx * dy
    return cx, cy, mxx / n, myy / n, mxy / n

def ellipse_of(im):
    """The axis angle and minor/major ratio of an image's alpha.

    Closed form for a symmetric 2x2, so this needs no linear algebra library.
    """
    _, _, mxx, myy, mxy = moments(im)
    theta = 0.5 * math.atan2(2 * mxy, mxx - myy)
    half = (mxx + myy) / 2
    root = math.sqrt(((mxx - myy) / 2) ** 2 + mxy * mxy)
    major = math.sqrt(max(half + root, 1e-9))
    minor = math.sqrt(max(half - root, 1e-9))
    return theta, minor / major

def unwarp(im, theta, r, pad=2.0):
    """Undo the isometric squash. Forward is R(t) diag(1, r) R(-t).

    PIL's AFFINE maps output back to input, which is the forward transform, so
    the matrix goes in as it stands rather than inverted.
    """
    ct, st = math.cos(theta), math.sin(theta)
    a = ct * ct + r * st * st
    b = ct * st - r * ct * st
    d = b
    e = st * st + r * ct * ct
    W, H = round(im.width * pad), round(im.height * pad)
    c = im.width / 2 - (a * W / 2 + b * H / 2)
    f = im.height / 2 - (d * W / 2 + e * H / 2)
    return im.transform((W, H), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)

def pair_axis(im):
    """The angle between the two crescents, from each half's alpha centroid."""
    half = im.width // 2
    left = moments(im.crop((0, 0, half, im.height)))
    right = moments(im.crop((half, 0, im.width, im.height)))
    return math.degrees(math.atan2(right[1] - left[1], (right[0] + half) - left[0]))

def disc_ring(frame_path, theta, r, punch=0.90):
    """The shimmering disc, un-warped and punched through.

    The interior is a dark fill meant to sit over game world art. It would
    cover a portrait, so it goes.
    """
    im = Image.open(frame_path).convert("RGBA")
    im = unwarp(im, theta, r)
    im = im.crop(im.getchannel("A").getbbox()).resize((SIZE, SIZE), Image.LANCZOS)
    if punch <= 0:
        return im
    hole = Image.new("L", (SIZE, SIZE), 255)
    ImageDraw.Draw(hole).ellipse(
        (SIZE * (1 - punch) / 2, SIZE * (1 - punch) / 2,
         SIZE * (1 + punch) / 2, SIZE * (1 + punch) / 2), fill=0)
    im.putalpha(Image.composite(im.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), hole))
    return im

def wings(path, theta, r, width):
    """The two crescents, un-warped and then laid flat."""
    im = Image.open(path).convert("RGBA")
    im = unwarp(im, theta, r)
    im = im.rotate(pair_axis(im), resample=Image.BICUBIC, expand=True)
    im = im.crop(im.getchannel("A").getbbox())
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)

frames = sorted(glob.glob(os.path.join(FX, "RoomRewardAvailable-Front", "*.png")))
if not frames:
    print(json.dumps([{"error": "no RoomRewardAvailable-Front frames"}]))
    raise SystemExit(0)

# Frame 21 of 60, which is where the shimmer is brightest and most even. A
# still has to stand for the whole loop, so it should not be caught mid dip.
still = frames[min(20, len(frames) - 1)]

# The disc is a circle in truth, so the ellipse it ships as is the transform.
THETA, RATIO = ellipse_of(Image.open(still).convert("RGBA"))
report.append({
    "name": "measured",
    "theta": round(math.degrees(THETA), 1),
    "ratio": round(RATIO, 3),
    "check": round(ellipse_of(disc_ring(still, THETA, RATIO, punch=0))[1], 3),
})

for name, wing_src in [("run", "RoomRewardFrame-Run.png"), ("meta", "RoomRewardFrame-Meta.png")]:
    wing_path = os.path.join(FX, "RoomRewardAvailable-Back", wing_src)
    if not os.path.exists(wing_path):
        report.append({"name": name, "error": "no " + wing_src})
        continue

    canvas = round(SIZE * 1.34)
    marker = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    marker.alpha_composite(disc_ring(still, THETA, RATIO), ((canvas - SIZE)//2, (canvas - SIZE)//2))
    # Wide enough that the crescents sit outside the disc, which is where the
    # game puts them. At 1.14 they crossed the portrait inside it.
    w = wings(wing_path, THETA, RATIO, round(SIZE * 1.30))
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
  /** the 'measured' row: the transform this run read off the shipped art */
  theta?: number
  ratio?: number
  check?: number
}[]

console.log("the game's own Exit reward marker:")
for (const entry of report) {
  if (entry.name === 'measured') {
    console.log(
      `  squash measured off the disc: ${entry.theta} degrees, ratio ${entry.ratio}. ` +
        `It reads ${entry.check} after, and 1.0 is a circle`,
    )
    continue
  }
  if (entry.error) console.log(`  ${entry.name}: ${entry.error}`)
  else
    console.log(
      `  ${entry.name.padEnd(34)} ${entry.size?.[0]}x${entry.size?.[1]}  ${Math.round((entry.bytes ?? 0) / 1024)} KB`,
    )
}
console.log('\nRun npm run assets to describe them in assets/manifest.json.')
