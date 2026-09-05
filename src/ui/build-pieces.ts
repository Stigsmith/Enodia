/**
 * A build, taken apart into things that can be drawn.
 *
 * Five layouts are about to disagree about arrangement. They must not also
 * disagree about what a build contains, what each piece is called, which art
 * it wears or which frame goes round it, or the comparison is between five
 * different datasets rather than five designs. So all of that happens once,
 * here, and a variant receives pieces and decides only where they go.
 *
 * ## The split that does the work
 *
 * A loadout is not one list. Half of it is **committed at the Crossroads**
 * before the run starts, and is therefore a decision a player makes while
 * reading something like this. The other half is **found during the run**, and
 * is a thing to hunt rather than a thing to choose.
 *
 * That is the split the owner's two questions fall along. "What fun build shall
 * I try this run" is answered entirely by the first half. "Which build covers
 * my gaps" is answered by the second. A layout that mixes them reads as an
 * inventory, and the thing being designed is not an inventory.
 *
 * ## Rarity here is a frame, not a claim
 *
 * A piece carries a `frame` because the game frames its own icons and an
 * unframed grid of 90 pixel squares reads as a spreadsheet. Duos and
 * legendaries wear their own, which is the game's own signal and is true from
 * the data. **Everything else wears Common**, because what rarity a boon turns
 * up at is not knowable in advance and pretending otherwise would put a claim
 * on the page that no file supports.
 */

import { arcanaById, familiarById, iconOf, renderOf, traits, weaponById } from '../data/app.ts'
import type { ShownBuild } from '../data/builds.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import type { Rarity, Slot, TraitId } from '../data/types.ts'

/** The game's own frames, by the rarity they mark. */
export const FRAME: Record<Rarity, string> = {
  Common: 'frames/frame-common.png',
  Rare: 'frames/frame-rare.png',
  Epic: 'frames/frame-epic.png',
  Heroic: 'frames/frame-heroic.png',
  Duo: 'frames/frame-duo.png',
  Legendary: 'frames/frame-legendary.png',
  Perfect: 'frames/frame-legendary.png',
}

/**
 * The game's backing plates, by the rarity they mark.
 *
 * The other half of `FRAME`. A frame rings an icon; a plate sits behind a whole
 * row and carries the same colour along it, which is how the game draws a list
 * of boons rather than a single one. 1280 by 320, colour on the left under the
 * icon, dissolving into fog on the right.
 */
export const PLATE: Record<Rarity, string> = {
  Common: 'frames/plate-common.png',
  Rare: 'frames/plate-rare.png',
  Epic: 'frames/plate-epic.png',
  Heroic: 'frames/plate-heroic.png',
  Duo: 'frames/plate-duo.png',
  Legendary: 'frames/plate-legendary.png',
  Perfect: 'frames/plate-unity.png',
}

/** The game's slot glyphs, for a core slot that is empty or unlabelled. */
export const SLOT_GLYPH: Partial<Record<Slot, string>> = {
  Melee: 'slots/attack.webp',
  Secondary: 'slots/special.webp',
  Ranged: 'slots/cast.webp',
  Rush: 'slots/dash.webp',
  Mana: 'slots/magick.webp',
}

export type PieceKind =
  'aspect' | 'core' | 'boon' | 'duo' | 'hex' | 'hammer' | 'keepsake' | 'familiar' | 'arcana'

export type Piece = {
  key: string
  kind: PieceKind
  /** the trait, familiar or Arcana id, for a click through */
  id: string
  name: string
  icon: string | null
  /** the game's own sentence, where there is one */
  text: string | null
  /** the core slot this occupies, and the glyph that marks it */
  slot: Slot | null
  slotName: string | null
  glyph: string | null
  frame: string
  /** the gods behind it. Two, for a duo */
  gods: string[]
  /** this is the thing the build is for */
  centrepiece: boolean
  /** an upgrade rather than part of the build */
  optional?: boolean
}

export type Group = {
  id: 'crossroads' | 'run'
  /** what a player calls this half */
  name: string
  /** one line, why these are together */
  say: string
  pieces: Piece[]
}

export type Assembled = {
  build: ShownBuild
  /** the arm's own name, "Descura", and the weapon's, "Witch's Staff" */
  arm: string
  weaponName: string
  /** the aspect, which every layout wants at a different size */
  aspect: Piece | null
  /** the aspect's large cutout, where the library has one */
  render: string | null
  centrepiece: Piece | null
  /** the five core slots in fixed order, occupied or not */
  slots: { slot: Slot; name: string; glyph: string | null; piece: Piece | null }[]
  crossroads: Group
  run: Group
  /** every piece in one list, for a layout that does not want the groups */
  all: Piece[]
  /** boons that would raise the ceiling, and what they would cost */
  optional: Piece[]
  /** the Olympians each optional boon would add, and none is free */
  optionalGods: string[]
  gods: string[]
}

const RARITY_BY_KIND: Partial<Record<string, Rarity>> = {
  duo: 'Duo',
  legendary: 'Legendary',
}

function fromTrait(id: TraitId, kind: PieceKind, centrepiece: boolean): Piece | null {
  const trait = traits.get(id)
  if (!trait) return null
  const slot = trait.slot && CORE_SLOTS.includes(trait.slot) ? trait.slot : null
  // A duo declares itself in the data, so the frame follows the trait's own
  // kind rather than the caller's guess about where it belongs.
  const rarity = RARITY_BY_KIND[trait.kind] ?? 'Common'

  /**
   * A boon in a core slot wears the game's primary frame.
   *
   * `frame-primary.png` has been in the library and in `FRAME` since the
   * beginning as a value nothing ever selected, so every core boon was drawn in
   * the Common frame like everything else. The five slots are the thing this
   * whole tool is about and they now look like it.
   *
   * A duo or legendary keeps its own frame even in a slot: what it is outranks
   * where it sits, and those two are the rarer fact.
   */
  const frame =
    slot && rarity === 'Common' ? 'frames/frame-primary.png' : FRAME[rarity]
  return {
    key: `${kind}:${id}`,
    kind: trait.kind === 'duo' || trait.kind === 'legendary' ? 'duo' : kind,
    id,
    name: trait.name ?? id,
    icon: iconOf.get(id) ?? null,
    text: trait.text ?? null,
    slot,
    slotName: slot ? slotLabel(slot) : null,
    glyph: slot ? (SLOT_GLYPH[slot] ?? null) : null,
    frame,
    gods: trait.gods ?? [],
    centrepiece,
  }
}

/**
 * A build, ready to draw.
 *
 * Everything a layout could want, computed once. Layouts take what they need
 * and ignore the rest, which is cheaper than five near-identical resolvers and
 * is the only way the comparison stays honest.
 */
export function assemble(build: ShownBuild): Assembled {
  const weapon = weaponById.get(build.weapon)
  const is = (id: string) => id === build.centrepiece

  const aspect = fromTrait(build.aspect, 'aspect', false)

  const boons = build.boons.flatMap((id) => {
    const piece = fromTrait(id, 'boon', is(id))
    return piece ? [piece] : []
  })

  /**
   * Boons that raise the ceiling without being the build.
   *
   * Kept out of `boons` on purpose, so nothing downstream counts them as part
   * of it: not the slot map, not the Olympian tally, not the god filter. A
   * build that lists Hestia's Slow Cooker as an upgrade is not a Hestia build.
   */
  const optional = (build.optional ?? []).flatMap((id) => {
    const piece = fromTrait(id, 'boon', false)
    return piece ? [{ ...piece, key: `optional:${id}`, optional: true }] : []
  })

  const hex = build.hex ? fromTrait(build.hex, 'hex', is(build.hex)) : null
  const hammers = build.hammers.flatMap((id) => {
    const piece = fromTrait(id, 'hammer', is(id))
    return piece ? [piece] : []
  })
  const keepsake = build.keepsake ? fromTrait(build.keepsake, 'keepsake', false) : null

  const familiar = build.familiar ? familiarById.get(build.familiar) : null
  const familiarPiece: Piece | null = familiar
    ? {
        key: `familiar:${familiar.id}`,
        kind: 'familiar',
        id: familiar.id,
        name: familiar.name,
        icon: familiar.icon,
        text: familiar.text,
        slot: null,
        slotName: null,
        glyph: null,
        frame: FRAME.Common,
        gods: [],
        centrepiece: false,
      }
    : null

  const arcana = build.arcana.flatMap((id): Piece[] => {
    const card = arcanaById.get(id)
    if (!card) return []
    return [
      {
        key: `arcana:${id}`,
        kind: 'arcana',
        id,
        name: card.name,
        icon: card.icon,
        text: card.text,
        slot: null,
        slotName: null,
        glyph: null,
        frame: FRAME.Common,
        gods: [],
        centrepiece: false,
      },
    ]
  })

  // The five core slots in fixed order, whether or not the build fills them.
  // An empty one is information: it is where a player's own pick still goes.
  const slots = CORE_SLOTS.map((slot) => ({
    slot,
    name: slotLabel(slot),
    glyph: SLOT_GLYPH[slot] ?? null,
    piece: boons.find((piece) => piece.slot === slot) ?? null,
  }))

  const core = slots.flatMap((entry) => (entry.piece ? [{ ...entry.piece, kind: 'core' as const }] : []))
  const rest = boons.filter((piece) => !piece.slot)

  const crossroads: Group = {
    id: 'crossroads',
    name: 'Before you go',
    say: 'Chosen at the Crossroads, and fixed for the run.',
    pieces: [
      ...(aspect ? [aspect] : []),
      ...arcana,
      ...(familiarPiece ? [familiarPiece] : []),
      ...(keepsake ? [keepsake] : []),
    ],
  }

  const inRun: Group = {
    id: 'run',
    name: 'What to look for',
    say: 'Found on the way, in whatever order the Exits offer it.',
    pieces: [...core, ...rest, ...(hex ? [hex] : []), ...hammers],
  }

  const gods = [...new Set(boons.flatMap((piece) => piece.gods))]
  const optionalGods = [
    ...new Set(optional.flatMap((piece) => piece.gods).filter((god) => !gods.includes(god))),
  ]

  return {
    build,
    arm: weapon?.arm ?? build.weapon,
    weaponName: weapon?.name ?? '',
    aspect,
    render: renderOf.get(build.aspect) ?? weapon?.icon ?? null,
    centrepiece: [...boons, ...(hex ? [hex] : [])].find((piece) => piece.centrepiece) ?? null,
    slots,
    crossroads,
    run: inRun,
    all: [...crossroads.pieces, ...inRun.pieces],
    optional,
    optionalGods,
    gods,
  }
}
