/**
 * A build, drawn to a PNG you can paste into a chat.
 *
 * ## Why this exists, and what it is not
 *
 * The owner asked whether a shared build could carry a picture of the card.
 * **Not the way it sounds.** A link preview in WhatsApp or Discord comes from
 * OpenGraph tags on the page the link points at. That needs a server rendering
 * per-build tags, and Enodia is a static site whose shared build lives in a
 * `#fragment` that never reaches a server at all. There is no version of this
 * architecture where pasting a link produces a picture.
 *
 * So the picture goes on the clipboard beside the link, and you paste both.
 *
 * ## Why it is drawn rather than screenshotted
 *
 * Turning the real `Card` into an image means either a DOM-to-canvas library,
 * which this project has no dependencies for and would not survive the CSP, or
 * an SVG `foreignObject`, which needs every style and image inlined and breaks
 * the first time a rule moves.
 *
 * Drawn on a canvas instead, at a size chosen for a chat window rather than for
 * a grid. It is not a copy of the card and does not pretend to be: same
 * information, same art, laid out for the medium it is going into.
 */

import { arcanaById, iconOf, olympians, traits, weaponById } from '../data/app.ts'
import { CORE_SLOTS } from '../engine/slots.ts'
import { readRepeat, reachName } from '../engine/repeat.ts'
import { FRAME, SLOT_GLYPH } from './build-pieces.ts'
import type { ShownBuild } from '../data/builds.ts'

const W = 620
/**
 * Room to draw into, not the height of the result.
 *
 * A build can be three boons or twenty-one, and a fixed canvas gave the small
 * ones six hundred pixels of empty floor. Drawn tall, then cropped to what was
 * used, so the image is the size of the build.
 */
const MAX_H = 1100
const PAD = 34

/**
 * Loaded once per image rather than per mark.
 *
 * A build draws the same frame up to twenty times, and twenty `Image` objects
 * for one file is twenty decodes.
 */
function loader() {
  const cache = new Map<string, Promise<HTMLImageElement | null>>()
  return (src: string) => {
    const had = cache.get(src)
    if (had) return had
    const job = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      // Same origin, so this only matters if the art ever moves to a CDN.
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      // A missing icon is a gap in the picture, never a rejected promise: one
      // absent file must not cost somebody the whole image.
      img.onerror = () => resolve(null)
      img.src = src
    })
    cache.set(src, job)
    return job
  }
}

/** Read a CSS custom property off the live page, so the image wears the theme. */
const token = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

export async function cardImage(build: ShownBuild): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  // Twice the layout size, so it is not soft when a chat client scales it up.
  canvas.width = W * 2
  canvas.height = MAX_H * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(2, 2)

  const load = loader()
  const ink = token('--ink-950', '#0b0f10')
  const bone = token('--bone', '#ede7da')
  const dim = token('--bone-dim', '#a8b3ae')
  const faint = token('--bone-faint', '#6b7a76')
  const lit = token('--lit-hot', '#8fd4c4')

  ctx.fillStyle = ink
  ctx.fillRect(0, 0, W, MAX_H)

  let y = PAD

  // --- the name and the arm ------------------------------------------------
  ctx.fillStyle = bone
  ctx.font = '600 30px Georgia, serif'
  y += 28
  ctx.fillText(clip(ctx, build.name || 'Untitled build', W - PAD * 2), PAD, y)

  const weapon = weaponById.get(build.weapon)
  const aspect = traits.get(build.aspect)
  ctx.fillStyle = faint
  ctx.font = '13px ui-monospace, monospace'
  y += 22
  ctx.fillText(
    [weapon?.arm, aspect?.name?.replace(/^Aspect of /, '')].filter(Boolean).join('  ·  '),
    PAD,
    y,
  )

  // --- the reading, which is the reason for sending a picture at all -------
  const read = readRepeat(build, traits, olympians)
  ctx.fillStyle = lit
  ctx.font = '600 13px ui-monospace, monospace'
  y += 22
  ctx.fillText(reachName(read.reach).toUpperCase(), PAD, y)

  // --- the one line --------------------------------------------------------
  if (build.say) {
    ctx.fillStyle = dim
    ctx.font = '15px Georgia, serif'
    y = wrap(ctx, build.say, PAD, y + 26, W - PAD * 2, 21)
  }

  // --- the five slots, in fixed positions ----------------------------------
  y = await band(ctx, load, 'The five slots', y + 26, await slotMarks(build, load))

  // --- everything beyond them ---------------------------------------------
  const beyond = build.boons.filter((id) => {
    const slot = traits.get(id)?.slot
    return !slot || !CORE_SLOTS.includes(slot)
  })
  if (beyond.length) {
    y = await band(ctx, load, 'Beyond the slots', y + 18, await marks(beyond, load))
  }

  // --- the kit -------------------------------------------------------------
  const kit = [build.hex, ...build.hammers, build.keepsake].filter((id): id is string => !!id)
  if (kit.length) y = await band(ctx, load, 'Before you go', y + 18, await marks(kit, load))

  // --- the Arcana, which are tall cards rather than square marks -----------
  if (build.arcana.length) {
    ctx.fillStyle = faint
    ctx.font = '11px ui-monospace, monospace'
    y += 18
    ctx.fillText('ARCANA', PAD, y)
    y += 10
    let x = PAD
    for (const id of build.arcana) {
      const icon = arcanaById.get(id)?.icon
      if (!icon) continue
      const img = await load(`/${icon}`)
      if (!img) continue
      const h = 74
      const w = (img.width / img.height) * h
      ctx.drawImage(img, x, y, w, h)
      x += w + 8
    }
    y += 74
  }

  // --- the footer, right under whatever the build turned out to be --------
  const foot = Math.min(y + 40, MAX_H - PAD)
  ctx.fillStyle = faint
  ctx.font = '12px ui-monospace, monospace'
  ctx.fillText('Enodia', PAD, foot)
  const gods = [...new Set(build.boons.flatMap((id) => traits.get(id)?.gods ?? []))]
    .filter((god) => olympians.includes(god))
    .sort()
  if (gods.length) {
    const label = gods.join(' + ')
    ctx.fillText(label, W - PAD - ctx.measureText(label).width, foot)
  }

  /**
   * Cropped to what was drawn.
   *
   * The canvas is tall enough for the largest build there is; a three-boon one
   * used a quarter of it and the rest was floor. Copying the used region into a
   * second canvas is cheaper than measuring twice and draws nothing again.
   */
  const height = foot + PAD
  const out = document.createElement('canvas')
  out.width = W * 2
  out.height = height * 2
  const cut = out.getContext('2d')
  if (!cut) return null
  cut.drawImage(canvas, 0, 0, W * 2, height * 2, 0, 0, W * 2, height * 2)

  return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
}

// ---------------------------------------------------------------------------

type Drawable = { icon: string | null; frame: string; glyph: string | null }

async function slotMarks(build: ShownBuild, _load: ReturnType<typeof loader>): Promise<Drawable[]> {
  return CORE_SLOTS.map((slot) => {
    const id = build.boons.find((one) => traits.get(one)?.slot === slot)
    const trait = id ? traits.get(id) : null
    const rarity = trait?.kind === 'duo' ? 'Duo' : trait?.kind === 'legendary' ? 'Legendary' : 'Common'
    return {
      icon: id ? (iconOf.get(id) ?? null) : null,
      // An empty slot still occupies its place, which is the whole reason the
      // five are drawn in a fixed order.
      frame: id && rarity === 'Common' ? 'frames/frame-primary.png' : FRAME[rarity],
      glyph: SLOT_GLYPH[slot] ?? null,
    }
  })
}

async function marks(ids: readonly string[], _load: ReturnType<typeof loader>): Promise<Drawable[]> {
  return ids.map((id) => {
    const trait = traits.get(id)
    const rarity = trait?.kind === 'duo' ? 'Duo' : trait?.kind === 'legendary' ? 'Legendary' : 'Common'
    return { icon: iconOf.get(id) ?? null, frame: FRAME[rarity], glyph: null }
  })
}

/** One labelled row of marks, wrapping, returning the y it finished at. */
async function band(
  ctx: CanvasRenderingContext2D,
  load: ReturnType<typeof loader>,
  label: string,
  top: number,
  list: Drawable[],
): Promise<number> {
  ctx.fillStyle = token('--bone-faint', '#6b7a76')
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText(label.toUpperCase(), PAD, top)

  const size = 46
  const gap = 8
  const perRow = Math.floor((W - PAD * 2 + gap) / (size + gap))
  let y = top + 12

  for (const [index, one] of list.entries()) {
    const column = index % perRow
    if (column === 0 && index) y += size + gap
    const x = PAD + column * (size + gap)

    if (one.icon) {
      const art = await load(`/${one.icon}`)
      if (art) ctx.drawImage(art, x, y, size, size)
    } else if (one.glyph) {
      // An open slot draws its glyph, held back, exactly as the tray does.
      const glyph = await load(`/${one.glyph}`)
      if (glyph) {
        ctx.globalAlpha = 0.4
        ctx.drawImage(glyph, x, y, size, size)
        ctx.globalAlpha = 1
      }
    }

    const frame = await load(`/${one.frame}`)
    // The frame overhangs the art by the same 9 percent it does on the page.
    if (frame) ctx.drawImage(frame, x - size * 0.09, y - size * 0.09, size * 1.18, size * 1.18)
  }

  return y + size
}

/** Cut a line to fit, with an ellipsis rather than an overflow. */
function clip(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
  return `${cut}…`
}

/** Wrap a paragraph, returning the y it finished at. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  top: number,
  width: number,
  line: number,
): number {
  let y = top
  let held = ''
  for (const word of text.split(/\s+/)) {
    const next = held ? `${held} ${word}` : word
    if (ctx.measureText(next).width > width && held) {
      ctx.fillText(held, x, y)
      y += line
      held = word
    } else {
      held = next
    }
  }
  if (held) ctx.fillText(held, x, y)
  return y
}
