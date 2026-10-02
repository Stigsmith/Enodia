/**
 * The wiki's index: every named thing the tool knows, under the heading a
 * player would look for it under.
 *
 * **Who hands a thing out comes from `sources`**, the same table the builder
 * and the picker read, so a boon is filed under the god whose pool holds it and
 * nowhere else decides that a second time. Duos, legendaries and the Godsent
 * Hexes are claimed first, because they sit in a god's pool as well and belong
 * in a section of their own.
 *
 * **Everything no god hands out is filed by its template**, the `group` that
 * `scripts/build-app-data.ts` reads off each record, and only where the
 * template's owner is a matter of record. Whatever is left goes under
 * Everything else rather than under a heading somebody guessed.
 *
 * Every named trait lands in exactly one section, and `wiki-index.test.ts`
 * holds it to that.
 */

import { arcana, familiars, iconOf, keepsakeForGod, sources, traits, weaponById, weapons } from '../data/app.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import type { Trait, TraitId } from '../data/types.ts'
import type { WikiKind } from './wiki-route.ts'

export type WikiEntry = {
  at: { kind: WikiKind; id: string }
  name: string
  icon: string | null
  /** one short line beside the name: a slot, a pair of gods, an arm */
  sub: string | null
}

export type WikiSection = {
  id: string
  /** the heading over a run of sections, "Boons" */
  part: string
  title: string
  entries: WikiEntry[]
  /**
   * Which family this section is, for `wiki-tree.ts` to hang it under the
   * right tile: `olympian`, `god`, `duos`, `legendaries`, `hexes`, `godsent`,
   * `stars`, `aspects`, `hammers`, `keepsakes`, `arcana`, `familiars`, `along`
   * or `else`.
   */
  group: string
  /** whose it is, where that matters: a god's source id, a weapon, a family */
  owner?: string
}

/** The families `build-app-data.ts` assigns, and what each is called here. */
const FAMILIES: { group: string; title: string }[] = [
  { group: 'circe', title: 'From Circe' },
  { group: 'echo', title: 'From Echo' },
  { group: 'icarus', title: 'From Icarus' },
  { group: 'medea', title: 'From Medea' },
  { group: 'narcissus', title: 'From Narcissus' },
  { group: 'shop', title: 'Shop items' },
  { group: 'outfit', title: 'Outfits' },
]

const byName = (a: WikiEntry, b: WikiEntry) => a.name.localeCompare(b.name)

/** Core slots first, in the game's order, then everything else by name. */
function bySlotThenName(entries: WikiEntry[], slots: Map<string, number>): WikiEntry[] {
  return [...entries].sort((a, b) => {
    const at = slots.get(a.at.id) ?? 99
    const bt = slots.get(b.at.id) ?? 99
    return at - bt || byName(a, b)
  })
}

export function wikiSections(): WikiSection[] {
  const named = new Map<TraitId, Trait>()
  for (const trait of traits.values()) if (trait.name) named.set(trait.id, trait)
  const placed = new Set<TraitId>()
  const slotOrder = new Map<TraitId, number>()

  const entry = (trait: Trait, sub: string | null): WikiEntry => ({
    at: { kind: 'trait', id: trait.id },
    name: trait.name ?? trait.id,
    icon: iconOf.get(trait.id) ?? null,
    sub,
  })

  /** Take the named traits among `ids` that no earlier section has taken. */
  const claim = (ids: Iterable<TraitId>, sub: (trait: Trait) => string | null): WikiEntry[] => {
    const out: WikiEntry[] = []
    for (const id of ids) {
      const trait = named.get(id)
      if (!trait || placed.has(id)) continue
      placed.add(id)
      out.push(entry(trait, sub(trait)))
    }
    return out
  }

  const all = [...named.values()]
  const coreSlot = (trait: Trait): string | null => {
    if (!trait.slot || !CORE_SLOTS.includes(trait.slot)) return null
    slotOrder.set(trait.id, CORE_SLOTS.indexOf(trait.slot))
    return slotLabel(trait.slot)
  }

  // Claimed first: each sits in a god's pool too, and belongs in its own.
  const duos = claim(all.filter((one) => one.kind === 'duo').map((one) => one.id), (one) => one.gods.join(' + ') || null)
  const legendaries = claim(
    all.filter((one) => one.kind === 'legendary').map((one) => one.id),
    (one) => one.gods.join(' + ') || null,
  )
  const godsent = claim(all.filter((one) => one.kind === 'hex').map((one) => one.id), () => null)

  const bySource = (kind: string) => sources.filter((source) => source.kind === kind)
  const pools = (list: typeof sources) =>
    list.map((source) => ({ source, entries: bySlotThenName(claim(source.traits, coreSlot), slotOrder) }))

  const olympian = pools(bySource('olympian'))
  const hermes = pools(bySource('other').filter((source) => source.id !== 'Chaos'))
  const encounter = pools(bySource('encounter'))
  const chaos = pools(bySource('other').filter((source) => source.id === 'Chaos'))
  const hexes = claim(bySource('hex').flatMap((source) => source.traits), () => null)
  const talents = claim(all.filter((one) => one.group === 'talent').map((one) => one.id), () => null)

  const armOrder = new Map(weapons.map((weapon, at) => [weapon.id, at]))
  const aspects = claim(
    all
      .filter((one) => one.kind === 'aspect')
      .sort(
        (a, b) =>
          (armOrder.get(a.requiredWeapon ?? '') ?? 99) - (armOrder.get(b.requiredWeapon ?? '') ?? 99) ||
          (a.name ?? '').localeCompare(b.name ?? ''),
      )
      .map((one) => one.id),
    (one) => (one.requiredWeapon ? (weaponById.get(one.requiredWeapon)?.arm ?? null) : null),
  )
  const hammers = bySource('hammer').map((source) => ({
    source,
    entries: claim(source.traits, () => null).sort(byName),
  }))

  const favours = new Map<TraitId, string>()
  for (const [god, id] of keepsakeForGod) favours.set(id, god)
  const keepsakes = claim(
    all.filter((one) => one.kind === 'keepsake').map((one) => one.id),
    (one) => favours.get(one.id) ?? null,
  ).sort(byName)

  const families = FAMILIES.map((family) => ({
    family,
    entries: claim(all.filter((one) => one.group === family.group).map((one) => one.id), () => null).sort(byName),
  }))

  const rest = claim(
    all.map((one) => one.id),
    () => null,
  ).sort(byName)

  const cards: WikiEntry[] = arcana.map((card) => ({
    at: { kind: 'arcana', id: card.id },
    name: card.name,
    icon: card.icon,
    sub: card.cost ? `${card.cost} Grasp` : 'Switches itself on',
  }))
  const pets: WikiEntry[] = familiars.map((one) => ({
    at: { kind: 'familiar', id: one.id },
    name: one.name,
    icon: one.icon,
    sub: null,
  }))

  const out: WikiSection[] = []
  const add = (part: string, id: string, title: string, entries: WikiEntry[], group: string, owner?: string) => {
    if (entries.length) out.push({ part, id, title, entries, group, ...(owner ? { owner } : {}) })
  }

  for (const { source, entries } of olympian) add('Boons', `god-${source.id}`, source.name, entries, 'olympian', source.id)
  for (const { source, entries } of [...hermes, ...encounter, ...chaos]) {
    add('Boons', `god-${source.id}`, source.name, entries, 'god', source.id)
  }
  add('Duos and legendaries', 'duos', 'Duos', duos.sort(byName), 'duos')
  add('Duos and legendaries', 'legendaries', 'Legendaries', legendaries.sort(byName), 'legendaries')
  add('Hexes', 'hexes', 'Hexes', hexes.sort(byName), 'hexes')
  add('Hexes', 'godsent', 'Godsent Hexes', godsent.sort(byName), 'godsent')
  add('Hexes', 'path-of-stars', 'Path of Stars', talents.sort(byName), 'stars')
  add('Arms', 'aspects', 'Aspects', aspects, 'aspects')
  for (const { source, entries } of hammers) {
    const arm = source.weapon ? (weaponById.get(source.weapon)?.arm ?? source.weapon) : source.name
    add('Arms', `hammers-${source.weapon ?? source.id}`, `Daedalus Hammers for ${arm}`, entries, 'hammers', source.weapon)
  }
  add('Before a run', 'keepsakes', 'Keepsakes', keepsakes, 'keepsakes')
  add('Before a run', 'arcana', 'Arcana', cards, 'arcana')
  add('Before a run', 'familiars', 'Familiars', pets, 'familiars')
  for (const { family, entries } of families) {
    add('Along the way', family.group, family.title, entries, 'along', family.group)
  }
  add('Everything else', 'everything-else', 'Everything else', rest, 'else')
  return out
}

/**
 * What each trait is a prerequisite for, read backwards off every
 * `TraitRequirements` the game states. Built once.
 */
let opened: ReadonlyMap<TraitId, TraitId[]> | null = null

export function prerequisiteFor(id: TraitId): TraitId[] {
  if (!opened) {
    const map = new Map<TraitId, TraitId[]>()
    for (const trait of traits.values()) {
      const rule = trait.requires
      if (!rule) continue
      const ids = 'oneOf' in rule ? rule.oneOf : rule.oneFromEachSet.flat()
      for (const need of new Set(ids)) {
        const list = map.get(need) ?? []
        list.push(trait.id)
        map.set(need, list)
      }
    }
    opened = map
  }
  return opened.get(id) ?? []
}
