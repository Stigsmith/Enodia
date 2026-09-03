/**
 * Why the validator still walks `InheritFrom` itself, checked against the real
 * data rather than argued.
 *
 * `ROADMAP.md` carried this under "Carried over, not done":
 *
 * > The validator still walks `InheritFrom` itself for classification and
 * > `GodLoot`, which is now a redundant second implementation and should read
 * > the resolved file instead
 *
 * **It is not redundant, and the swap would silently change the numbers.** Two
 * separate reasons, one per use, and this file is both of them so nobody has to
 * take it on trust or rediscover it.
 *
 * The other tests here run on small hand-built fixtures, which is right for
 * testing logic. These run on `data/generated/*.json`, because the claim is
 * about what resolution does to the real 651 traits and 13 loot sets, and no
 * fixture can say anything about that.
 *
 * ## One thing this file deliberately does not claim
 *
 * That the walk needs to be *transitive*. It does not, today: every marker sits
 * at depth 1. That was assumed at first, and the assumption did not survive
 * being tested, so it is pinned below as the fact it is rather than left as the
 * belief it was. The recursion is insurance against a patch nesting something,
 * and insurance is worth keeping, but it is not what makes the walk necessary.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { classifyTraits, rosterFromLoot } from './checks.ts'

/** Local, because `checks.ts` keeps this type to itself. */
type Dict = Record<string, unknown>

const ROOT = join(import.meta.dirname, '../..')

const generated = (name: string): Dict =>
  JSON.parse(readFileSync(join(ROOT, 'data/generated', `${name}.json`), 'utf8')).data as Dict

const raw = generated('traits')
const resolved = generated('traits-resolved')
const loot = generated('loot')

const found = classifyTraits(raw, generated('requirements'))

const field = (record: unknown, key: string): unknown =>
  (record as Record<string, unknown> | undefined)?.[key]

const parentsOf = (record: unknown): string[] => {
  const value = field(record, 'InheritFrom')
  if (typeof value === 'string') return [value]
  return Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []
}

// ---------------------------------------------------------------------------
// 1. Classifying traits. The resolved file has the flag but not its provenance.
// ---------------------------------------------------------------------------

describe('classifying duos, and why the resolved file cannot do it', () => {
  it('produces the split the project is held to', () => {
    expect(found.duos).toHaveLength(37)
    expect(found.legendaries).toHaveLength(10)
    expect(found.hexDuos).toHaveLength(9)
  })

  /**
   * The heart of it.
   *
   * A duo is a duo because it inherits `SynergyTrait`, which carries
   * `IsDuoBoon`. A Hex duo states `IsDuoBoon` on its own record and is gated by
   * `GameStateRequirements` with `SeleneDuosUnlocked` instead. Resolution copies
   * the parent's value down, so afterwards **both kinds carry the same flag and
   * nothing records where it came from**.
   *
   * Classifying on the resolved flag reports 46 duos and 0 Hex duos, and looks
   * entirely reasonable doing it.
   */
  it('would report 46 duos and no Hex duos if it read the resolved flag', () => {
    const flagged = Object.keys(resolved).filter(
      (id) => field(resolved[id], 'IsDuoBoon') === true && field(raw[id], 'DebugOnly') !== true,
    )

    expect(flagged).toHaveLength(46)
    expect(flagged).toHaveLength(found.duos.length + found.hexDuos.length)
    for (const id of found.hexDuos) expect(flagged).toContain(id)
  })

  /**
   * And there is no shortcut hiding in the file either. Resolution copies parent
   * *values* down; it does not flatten `InheritFrom` into a transitive list, so
   * a resolved record still names only its direct parents.
   *
   * If this ever fails, the extractor has started flattening, and the roadmap
   * item becomes worth revisiting.
   */
  it('gains nothing from the resolved file, which leaves InheritFrom untouched', () => {
    const differing = Object.keys(raw).filter(
      (id) => JSON.stringify(parentsOf(raw[id])) !== JSON.stringify(parentsOf(resolved[id])),
    )
    expect(differing).toEqual([])
  })

  /**
   * Pinned because it was assumed and then found to be false in the other
   * direction: the markers are all at depth 1, so a direct-parents-only walk
   * would produce the same 37 and 10 today. If a patch ever nests one, this
   * fails and the recursion stops being insurance and starts being load bearing.
   */
  it('finds every marker at depth 1 today, which is why the recursion is insurance', () => {
    const direct = (id: string, marker: string) => parentsOf(raw[id]).includes(marker)
    expect(found.duos.every((id) => direct(id, 'SynergyTrait'))).toBe(true)
    expect(found.legendaries.every((id) => direct(id, 'LegendaryTrait'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. GodLoot. The walk is load bearing, and there is no resolved file at all.
// ---------------------------------------------------------------------------

describe('the roster, where dropping the walk costs two Olympians', () => {
  it('counts nine Olympians', () => {
    expect(rosterFromLoot(loot).olympians).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Demeter',
      'Hephaestus',
      'Hera',
      'Hestia',
      'Poseidon',
      'Zeus',
    ])
  })

  /**
   * `CLAUDE.md`'s worst recorded error lives here, and this is the shape of it.
   *
   * Poseidon and Zeus never state `GodLoot` and pick up `true` from `BaseLoot`.
   * Reading the flag off the record, which is the obvious thing to write, gives
   * seven Olympians and looks correct. The cap is on Olympians, so the whole
   * reachability model would be wrong by two gods, quietly.
   */
  it('drops Poseidon and Zeus if the flag is read without following InheritFrom', () => {
    const records = new Map<string, unknown>()
    const owner = new Map<string, string>()
    for (const [setName, set] of Object.entries(loot)) {
      for (const [name, record] of Object.entries((set ?? {}) as Dict)) {
        if (record && typeof record === 'object' && !Array.isArray(record)) {
          records.set(name, record)
          owner.set(name, setName)
        }
      }
    }

    const naive = new Set<string>()
    for (const [name, record] of records) {
      if (typeof field(record, 'Speaker') !== 'string') continue
      if (field(record, 'GodLoot') === true) naive.add(owner.get(name) ?? name)
    }

    expect([...naive]).toHaveLength(7)
    const real = rosterFromLoot(loot).olympians
    expect(real.filter((god) => !naive.has(god))).toEqual(['Poseidon', 'Zeus'])
  })

  /**
   * And the swap the roadmap proposes is not merely wrong here, it is
   * impossible: the extractor resolves inheritance for traits only. If a
   * `loot-resolved.json` ever appears, this fails and the question reopens.
   */
  it('has no resolved loot file to read instead', () => {
    const exists = (name: string) => {
      try {
        readFileSync(join(ROOT, 'data/generated', `${name}.json`))
        return true
      } catch {
        return false
      }
    }
    expect(exists('traits-resolved')).toBe(true)
    expect(exists('loot-resolved')).toBe(false)
  })
})
