/**
 * The wiki as a tree: nothing the old single page listed may be lost by
 * walking it, every tile goes somewhere, and every record knows where it is.
 */

import { describe, expect, it } from 'vitest'

import { wikiSections } from './wiki-index.ts'
import { pathOf, placeOf, trailTo, wikiTree } from './wiki-tree.ts'
import type { WikiNode } from './wiki-tree.ts'
import { wikiInUrl, wikiPath } from './wiki-route.ts'

/** Every node, with the path that reaches it. */
function everyNode(node: WikiNode = wikiTree(), path = ''): { node: WikiNode; path: string }[] {
  return [
    { node, path },
    ...node.children.flatMap((child) => everyNode(child, path ? `${path}/${child.slug}` : child.slug)),
  ]
}

describe('the tree', () => {
  /**
   * The old index was one page of every section. Each entry it listed has to be
   * on some page of the tree, once, or a tile has swallowed something.
   */
  it('holds every entry the index lists, each exactly once', () => {
    const listed = wikiSections().flatMap((section) => section.entries.map((entry) => `${entry.at.kind}:${entry.at.id}`))
    const held = everyNode().flatMap(({ node }) =>
      node.sections.flatMap((section) => section.entries.map((entry) => `${entry.at.kind}:${entry.at.id}`)),
    )
    expect(held.sort()).toEqual(listed.sort())
  })

  it('reaches every node by its own path, and no two siblings share a slug', () => {
    for (const { node, path } of everyNode()) {
      expect(trailTo(path)?.at(-1)).toBe(node)
      const slugs = node.children.map((child) => child.slug)
      expect(new Set(slugs).size, path || 'the top').toBe(slugs.length)
    }
  })

  it('has nothing empty on it: every tile leads to tiles or to entries', () => {
    for (const { node, path } of everyNode().slice(1)) {
      expect(node.children.length + node.sections.length, path).toBeGreaterThan(0)
    }
  })

  it('gives every tile something to show', () => {
    for (const { node, path } of everyNode().slice(1)) {
      if (node.art.kind === 'mosaic') expect(node.art.icons.length, path).toBeGreaterThan(0)
      else expect(node.art.src, path).toMatch(/^[a-z]+\/[a-z0-9-]+\.(webp|png)$/)
    }
  })

  it('files a god’s boons under that god, and an arm’s hammers under that arm', () => {
    expect(placeOf({ kind: 'trait', id: 'ZeusWeaponBoon' })).toBe('olympians/zeus')
    const arms = trailTo('arms')?.at(-1)
    expect(arms?.children.length).toBe(6)
    for (const arm of arms?.children ?? []) {
      expect(arm.sections.map((section) => section.title)).toContain('Daedalus Hammers')
    }
  })

  it('names an unknown path as nothing rather than as the nearest thing', () => {
    expect(trailTo('olympians/nobody')).toBeNull()
    expect(pathOf(trailTo('olympians/zeus') ?? [])).toBe('olympians/zeus')
  })
})

describe('a section’s address', () => {
  it('round-trips, so a link to a section reopens it', () => {
    const at = { kind: 'node' as const, id: 'along-the-way/circe' }
    expect(wikiPath(at)).toBe('/wiki/c/along-the-way/circe')
    expect(wikiInUrl(wikiPath(at))?.at).toEqual(at)
  })

  it('leaves a record’s address as it was, so links already shared still work', () => {
    expect(wikiPath({ kind: 'trait', id: 'ZeusWeaponBoon' })).toBe('/wiki/t/ZeusWeaponBoon')
    expect(wikiInUrl('/wiki/c')?.at).toBeNull()
  })
})
