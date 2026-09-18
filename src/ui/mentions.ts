/**
 * Naming a game thing inside a build's write-up.
 *
 * A mention is stored as text, `@[Freezer Burn](t:BurnConsumeBoon)`, inside the
 * same plain fields as everything else. The id is what it means and the name is
 * only what it falls back to. Drawn, it is the thing's art and its current name,
 * with the game's tooltip on hover and its wiki record one click away.
 *
 * **Why the id and not the name.** Eight display names collide among the traits
 * the app ships, six of them Aspect of Melinoë, so matching names when the text
 * is drawn would point at the wrong thing, and a name can change in a patch
 * where an id does not. `CLAUDE.md` warns against the display-name join for the
 * same reason.
 *
 * **Why plain text and not markup.** Everything around a mention stays text, so
 * there is nothing to clean before a stranger reads it, and a mention whose id
 * stops resolving is drawn as the name it was written with.
 *
 * The letter in front of the id says which kind of record it names: the three
 * kinds the wiki has, `t` for a trait, `a` for an Arcana card and `f` for a
 * familiar, and `b` for a published build.
 *
 * **A build is the one kind with no wiki record.** Its id is the short id it
 * was published under, `@[Killer Current](b:aB3xK9pQmR)`, because that is the
 * only name a build has that means the same thing in everybody's browser. A
 * build that was never published has no such name and cannot be mentioned,
 * and neither can one carried whole inside a long link, which has no id at
 * all. `state/mentioned.ts` finds the build an id names.
 */

import { iconOf, traits } from '../data/app.ts'
import { picksOf } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'
import { isPublishedId, publishedInUrl } from '../state/publish.ts'
import { wikiSections } from './wiki-index.ts'
import type { WikiKind } from './wiki-route.ts'

/** What a mention can name: a wiki record, or a published build. */
export type MentionKind = WikiKind | 'build'

/**
 * A mention's meaning. A union rather than one type with a wider `kind`, so a
 * check for `'build'` leaves the rest typed as what the wiki can open.
 */
export type MentionAt = { kind: WikiKind; id: string } | { kind: 'build'; id: string }

const CODE: Record<MentionKind, string> = { trait: 't', arcana: 'a', familiar: 'f', build: 'b' }
const KIND: Record<string, MentionKind> = { t: 'trait', a: 'arcana', f: 'familiar', b: 'build' }

/** One mention as stored. Global, so `parseProse` walks every one. */
const TOKEN = /@\[([^\]\n]{1,80})\]\(([tafb]):([A-Za-z0-9_]{1,80})\)/g

/** A name without the four characters the token is made of, or a line break. */
const clean = (name: string) => name.replace(/[[\]()\n]/g, '').trim().slice(0, 80)

/** The text a mention is stored as. */
export function mentionToken(at: MentionAt, name: string): string {
  return `@[${clean(name) || at.id}](${CODE[at.kind]}:${at.id})`
}

/**
 * The published build a pasted short link names, or null.
 *
 * **Only a link to this site.** The id means something only to the server the
 * page talks to, so a link to enodia.me pasted into a local copy names a build
 * that copy has never heard of. Anything other than one bare link, words
 * around it included, is left as what was pasted.
 */
export function linkedBuild(text: string, origin: string): string | null {
  const bare = text.trim()
  if (!bare || /\s/.test(bare)) return null
  try {
    const url = new URL(bare)
    return url.origin === origin ? publishedInUrl(url.pathname) : null
  } catch {
    return null
  }
}

/** A write-up in pieces: runs of text, and the mentions between them. */
export type ProseBit = { text: string } | { at: MentionAt; name: string }

export function parseProse(text: string): ProseBit[] {
  const out: ProseBit[] = []
  let from = 0
  for (const found of text.matchAll(TOKEN)) {
    const at = found.index
    if (at > from) out.push({ text: text.slice(from, at) })
    out.push({ at: { kind: KIND[found[2] ?? ''] ?? 'trait', id: found[3] ?? '' }, name: found[1] ?? '' })
    from = at + found[0].length
  }
  if (from < text.length) out.push({ text: text.slice(from) })
  return out
}

/**
 * The `@` being typed at the caret, if there is one: where it is, and what has
 * been typed after it. Null when the caret is not in one.
 *
 * An `@` counts only at the start of the text or after a space, a line break,
 * an opening bracket or a quote, so an address like a@b does not open a list.
 * What follows may hold spaces, because names do. It stops at a line break,
 * at 30 characters, and at any of the characters a stored mention is made of,
 * which is also what keeps a finished mention from opening the list again.
 */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !/[\s([{"']/.test(before[at - 1] ?? '')) return null
  const query = before.slice(at + 1)
  if (query.length > 30 || /[\n[\]()@]/.test(query)) return null
  return { start: at, query }
}

/** Lower case, with accents off, so "melinoe" finds Melinoë. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Anything that can be mentioned, with what the list shows beside its name. */
export type Mentionable = MentionAt & {
  name: string
  icon: string | null
  /** a slot, a pair of gods, an arm, or the heading it is filed under */
  sub: string | null
  folded: string
}

let every: Mentionable[] | null = null

/**
 * Everything the wiki has a record for, which is what a mention can lead to.
 *
 * Read off the wiki's own index rather than listed a second time, so the two
 * cannot disagree about what exists, and `wiki.test.ts` already holds the index
 * to every named trait, card and familiar exactly once.
 */
function mentionables(): Mentionable[] {
  every ??= wikiSections().flatMap((section) =>
    section.entries.map((entry) => ({
      ...entry.at,
      name: entry.name,
      icon: entry.icon,
      sub: entry.sub ?? section.title,
      folded: fold(entry.name),
    })),
  )
  return every
}

/**
 * The name a mention should be drawn with: the thing's current one, falling
 * back to the one it was written with.
 *
 * **The id is the meaning and the stored name is only a fallback**, which is
 * the rule this file opens with, so anywhere a mention is flattened back to
 * plain text has to apply it too. A guide's card does exactly that for its
 * opening line, and drawing the stored name there while the subjects beside it
 * drew the current one was the two halves of one card disagreeing.
 *
 * A build is the one kind with no record to look in, so its written name is
 * the answer here. `state/mentioned.ts` is what finds the current one, and it
 * is asynchronous, which a card's first line is not.
 */
export function nameOfMention(at: MentionAt, written: string): string {
  if (at.kind === 'build') return written
  return mentionables().find((one) => one.kind === at.kind && one.id === at.id)?.name ?? written
}

/**
 * The builds a mention can name, out of a library: your own that are
 * published, and the ones you follow.
 *
 * Nothing else, on purpose. There is no route that searches the exchange, so
 * a build you neither wrote nor follow gets in by pasting its short link, and
 * this list tells nobody about a build they could not already open. Each id
 * once, because a build you follow and a copy of it can both carry it.
 */
export function buildMentionables(library: readonly ShownBuild[]): Mentionable[] {
  const out: Mentionable[] = []
  for (const one of library) {
    const id = one.publishedAs ?? (one.by === 'community' ? one.derivedFrom : undefined)
    if (!id || !isPublishedId(id) || out.some((was) => was.id === id)) continue
    out.push({
      kind: 'build',
      id,
      name: one.name,
      icon: iconOf.get(one.aspect) ?? null,
      sub: one.by === 'community' ? 'Build you follow' : 'Your build',
      folded: fold(one.name),
    })
  }
  return out
}

/**
 * What the list offers for what was typed, best first.
 *
 * **The build's own picks first**, then whatever else the same gods give, then
 * everything. Text in a build is nearly always about that build, so the thing
 * meant is usually already in it. Inside each of those, a name that starts
 * with what was typed comes before one with a word that does, which comes
 * before one that merely contains it.
 *
 * An empty query lists the picks, which is what typing a bare `@` should show.
 *
 * **Builds are the picks of text that belongs to no build.** A guide is
 * written about builds, so with no build to rank by, the ones in `builds` come
 * first and a bare `@` lists them. Inside a build's own text they rank with
 * everything else, and the build itself is left out.
 */
export function rankMentions(
  query: string,
  build: ShownBuild | null,
  limit = 8,
  builds: readonly Mentionable[] = [],
): Mentionable[] {
  const wanted = fold(query.trim())
  const held = new Set(build ? picksOf(build) : [])
  const gods = new Set(
    build ? [...build.boons, ...(build.optional ?? [])].flatMap((id) => traits.get(id)?.gods ?? []) : [],
  )
  const others = builds.filter((one) => one.kind === 'build' && one.id !== build?.publishedAs)

  const tier = (one: Mentionable) => {
    if (one.kind === 'build') return build ? 2 : 0
    if (held.has(one.id)) return 0
    if (one.kind === 'trait' && (traits.get(one.id)?.gods ?? []).some((god) => gods.has(god))) return 1
    return 2
  }
  const match = (one: Mentionable) => {
    if (!wanted) return 0
    if (one.folded.startsWith(wanted)) return 0
    if (one.folded.includes(` ${wanted}`)) return 1
    return one.folded.includes(wanted) ? 2 : -1
  }

  return [...mentionables(), ...others]
    .flatMap((one) => {
      const how = match(one)
      if (how < 0) return []
      if (!wanted && tier(one) > 0) return []
      return [{ one, how, tier: tier(one) }]
    })
    .sort((a, b) => a.tier - b.tier || a.how - b.how || a.one.name.localeCompare(b.one.name))
    .slice(0, limit)
    .map((row) => row.one)
}
