/**
 * The wiki as something you walk through rather than scroll.
 *
 * The owner's brief, 2 October 2026: large pictures for the sections, dim until
 * one is under the pointer, click through from the top to where you want to be,
 * and always a line at the top saying how deep you are. So the index is a tree:
 *
 *   Wiki
 *   ├── Olympians ── one tile per god, by portrait ── that god's boons
 *   ├── Other gods ── Hermes, Chaos, Artemis, Athena, Dionysus, Hades
 *   ├── Duos and legendaries ── Duos, Legendaries
 *   ├── Hexes ── Selene's, Godsent, Path of Stars
 *   ├── Arms ── one tile per arm, by weapon ── its aspects and hammers
 *   ├── Keepsakes, Arcana, Familiars
 *   ├── Along the way ── Circe, Echo, Icarus, Medea, Narcissus, shop, outfits
 *   └── Everything else
 *
 * **Every section of `wiki-index.ts` lands under exactly one node**, and
 * `wiki-tree.test.ts` holds it to that, so walking the tree finds everything
 * the old single page listed.
 *
 * **Paths are literal strings**, never built from a name. `scripts/prune.ts`
 * reads the bundle for the images it ships, and fails the build on a path made
 * from a template it cannot see through.
 */

import { traits, weapons } from '../data/app.ts'
import { wikiSections } from './wiki-index.ts'
import type { WikiSection } from './wiki-index.ts'

/** How a tile wears its picture. */
export type WikiArt =
  /** a wide picture, cut to the tile */
  | { kind: 'banner'; src: string }
  /** a face, kept near its top */
  | { kind: 'portrait'; src: string }
  /** a cut-out on transparency, drawn whole */
  | { kind: 'render'; src: string }
  /** a few of what is inside, laid edge to edge */
  | { kind: 'mosaic'; icons: string[] }

export type WikiNode = {
  slug: string
  title: string
  /** one short line under the title: how much is inside */
  sub: string
  art: WikiArt
  /** tiles one level down, drawn before any entries */
  children: WikiNode[]
  /** the entries on this node's own page */
  sections: WikiSection[]
}

/** Each top-level section's banner, cut by `scripts/banners.ts`. */
const BANNER = {
  olympians: 'banners/olympians.webp',
  gods: 'banners/gods.webp',
  duos: 'banners/duos.webp',
  hexes: 'banners/hexes.webp',
  arms: 'banners/arms.webp',
  keepsakes: 'banners/keepsakes.webp',
  arcana: 'banners/arcana.webp',
  along: 'banners/along.webp',
  everything: 'banners/everything.webp',
} as const

/** A god's Codex portrait, cut by `scripts/portraits.ts`, by the source id `sources` gives them. */
const GOD_ART: Record<string, string> = {
  Aphrodite: 'portraits/aphrodite.webp',
  Apollo: 'portraits/apollo.webp',
  Ares: 'portraits/ares.webp',
  Demeter: 'portraits/demeter.webp',
  Hephaestus: 'portraits/hephaestus.webp',
  Hera: 'portraits/hera.webp',
  Hestia: 'portraits/hestia.webp',
  Poseidon: 'portraits/poseidon.webp',
  Zeus: 'portraits/zeus.webp',
  Hermes: 'portraits/hermes.webp',
  Chaos: 'portraits/chaos.webp',
  Selene: 'portraits/selene.webp',
  NPC_Artemis: 'portraits/artemis.webp',
  NPC_Athena: 'portraits/athena.webp',
  NPC_Dionysus: 'portraits/dionysus.webp',
  NPC_Hades: 'portraits/hades.webp',
}

/** Each arm's full render, the art Setup's ring is drawn from. */
const ARM_ART: Record<string, string> = {
  WeaponStaffSwing: 'weapons/staff.png',
  WeaponDagger: 'weapons/blades.png',
  WeaponTorch: 'weapons/flames.png',
  WeaponAxe: 'weapons/axe.png',
  WeaponLob: 'weapons/skull.png',
  WeaponSuit: 'weapons/coat.png',
}

/** The people who hand things out along the way, by family. Codex portraits too. */
const FAMILY_ART: Record<string, string> = {
  circe: 'portraits/circe.webp',
  echo: 'portraits/echo.webp',
  icarus: 'portraits/icarus.webp',
  medea: 'portraits/medea.webp',
  narcissus: 'portraits/narcissus.webp',
}

const slugOf = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const countIn = (sections: WikiSection[]) => sections.reduce((n, section) => n + section.entries.length, 0)

/** The first few icons inside, for a tile with no picture of its own. */
const mosaicOf = (sections: WikiSection[], most = 8): WikiArt => ({
  kind: 'mosaic',
  icons: sections
    .flatMap((section) => section.entries)
    .map((entry) => entry.icon)
    .filter((icon): icon is string => Boolean(icon))
    .slice(0, most),
})

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** A page of entries, with no tiles under it. */
const leaf = (title: string, sections: WikiSection[], art: WikiArt, noun: [string, string]): WikiNode => ({
  slug: slugOf(title),
  title,
  sub: plural(countIn(sections), noun[0], noun[1]),
  art,
  children: [],
  sections,
})

/** A page of tiles. */
const branch = (title: string, art: WikiArt, children: WikiNode[], noun: [string, string]): WikiNode => ({
  slug: slugOf(title),
  title,
  sub: plural(children.length, noun[0], noun[1]),
  art,
  children,
  sections: [],
})

let built: WikiNode | null = null

/** The whole tree, built once. */
export function wikiTree(): WikiNode {
  if (built) return built
  const sections = wikiSections()
  const of = (group: string) => sections.filter((section) => section.group === group)

  const godTile = (section: WikiSection): WikiNode =>
    leaf(
      section.title,
      [section],
      GOD_ART[section.owner ?? ''] ? { kind: 'portrait', src: GOD_ART[section.owner ?? '']! } : mosaicOf([section]),
      ['boon', 'boons'],
    )

  const aspects = of('aspects')[0]
  const arms = weapons.map((weapon) => {
    const own = aspects
      ? [
          {
            ...aspects,
            id: `aspects-${weapon.id}`,
            title: 'Aspects',
            entries: aspects.entries.filter((entry) => traits.get(entry.at.id)?.requiredWeapon === weapon.id),
          },
        ]
      : []
    const hammers = of('hammers')
      .filter((section) => section.owner === weapon.id)
      .map((section) => ({ ...section, title: 'Daedalus Hammers' }))
    const inside = [...own, ...hammers].filter((section) => section.entries.length)
    return {
      ...leaf(
        weapon.arm,
        inside,
        ARM_ART[weapon.id] ? { kind: 'render', src: ARM_ART[weapon.id]! } : mosaicOf(inside),
        ['thing', 'things'],
      ),
      sub: `${weapon.name}`,
    }
  })

  const along = of('along').map((section) =>
    leaf(
      section.title.replace(/^From /, ''),
      [section],
      FAMILY_ART[section.owner ?? ''] ? { kind: 'portrait', src: FAMILY_ART[section.owner ?? '']! } : mosaicOf([section]),
      ['thing', 'things'],
    ),
  )

  const hexKinds = [
    ...of('hexes').map((section) =>
      leaf(section.title, [section], GOD_ART.Selene ? { kind: 'portrait', src: GOD_ART.Selene } : mosaicOf([section]), [
        'Hex',
        'Hexes',
      ]),
    ),
    ...of('godsent').map((section) => leaf(section.title, [section], mosaicOf([section]), ['Hex', 'Hexes'])),
    /* The talents carry no icons of their own, so the tile wears the game's
     * Path of Stars itself rather than standing empty. */
    ...of('stars').map((section) =>
      leaf(section.title, [section], { kind: 'mosaic', icons: ['artifacts/path-of-stars.webp'] }, ['star', 'stars']),
    ),
  ]

  const top: WikiNode[] = [
    branch('Olympians', { kind: 'banner', src: BANNER.olympians }, of('olympian').map(godTile), ['god', 'gods']),
    branch('Other gods', { kind: 'banner', src: BANNER.gods }, of('god').map(godTile), ['god', 'gods']),
    branch(
      'Duos and legendaries',
      { kind: 'banner', src: BANNER.duos },
      [
        ...of('duos').map((section) => leaf(section.title, [section], mosaicOf([section]), ['duo', 'duos'])),
        ...of('legendaries').map((section) =>
          leaf(section.title, [section], mosaicOf([section]), ['legendary', 'legendaries']),
        ),
      ],
      ['kind', 'kinds'],
    ),
    branch('Hexes', { kind: 'banner', src: BANNER.hexes }, hexKinds, ['kind', 'kinds']),
    branch('Arms', { kind: 'banner', src: BANNER.arms }, arms, ['arm', 'arms']),
    leaf('Keepsakes', of('keepsakes'), { kind: 'banner', src: BANNER.keepsakes }, ['keepsake', 'keepsakes']),
    leaf('Arcana', of('arcana'), { kind: 'banner', src: BANNER.arcana }, ['card', 'cards']),
    leaf('Familiars', of('familiars'), mosaicOf(of('familiars')), ['familiar', 'familiars']),
    branch('Along the way', { kind: 'banner', src: BANNER.along }, along, ['source', 'sources']),
    leaf('Everything else', of('else'), { kind: 'banner', src: BANNER.everything }, ['thing', 'things']),
  ].filter((node) => node.children.length || node.sections.length)

  built = {
    slug: '',
    title: 'Wiki',
    sub: plural(countIn(sections), 'record', 'records'),
    art: { kind: 'mosaic', icons: [] },
    children: top,
    sections: [],
  }
  return built
}

/** The nodes from the root down to the one a path names, or null. */
export function trailTo(path: string): WikiNode[] | null {
  const trail: WikiNode[] = [wikiTree()]
  for (const slug of path.split('/').filter(Boolean)) {
    const next = trail[trail.length - 1]?.children.find((child) => child.slug === slug)
    if (!next) return null
    trail.push(next)
  }
  return trail
}

/** The path of a trail, without the root. */
export const pathOf = (trail: WikiNode[]) =>
  trail
    .slice(1)
    .map((node) => node.slug)
    .join('/')

let places: Map<string, string> | null = null

/**
 * Where a record lives in the tree, as a path, so its page can say how deep it
 * is. The first node to list it wins, which for a thing filed once is the only
 * one.
 */
export function placeOf(at: { kind: string; id: string }): string | null {
  if (!places) {
    places = new Map()
    const walk = (node: WikiNode, path: string) => {
      for (const section of node.sections) {
        for (const entry of section.entries) {
          const key = `${entry.at.kind}:${entry.at.id}`
          if (!places!.has(key)) places!.set(key, path)
        }
      }
      for (const child of node.children) walk(child, path ? `${path}/${child.slug}` : child.slug)
    }
    walk(wikiTree(), '')
  }
  return places.get(`${at.kind}:${at.id}`) ?? null
}
