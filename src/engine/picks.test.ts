/**
 * Where a pick goes, tested where it can be.
 *
 * The editor used to decide this inside a component, and there are no component
 * tests in this repo: jsdom is a per-file opt-in and nothing opts in. So the
 * routing came out into `picks.ts` in order to be provable, and this is the
 * reason that was worth doing.
 *
 * Two of these were written against the old `moveBoon` first and seen to fail.
 * They are marked.
 */

import { describe, expect, it } from 'vitest'

import { godPools, sources, traits } from '../data/app.ts'
import { SAMPLE_BUILDS } from '../data/builds.fixture.ts'
import { coreAt, coreSlotOf, hammerArm, hammerOptions, isHammer, movePick, reorderOptional, trayOf } from './picks.ts'
import type { ShownBuild } from '../data/builds.ts'
import type { TraitId } from '../data/types.ts'

const first = SAMPLE_BUILDS[0]
if (!first) throw new Error('no samples')

const bend = (over: Partial<ShownBuild>): ShownBuild => ({ ...first, ...over })

/** A hammer that really is one, taken from the data rather than typed in. */
const A_HAMMER = (() => {
  const entry = sources.find((one) => one.kind === 'hammer')
  const id = entry?.traits[0]
  if (!id) throw new Error('no hammer sources')
  return id
})()

/** A boon that occupies a core slot, and another for the same slot. */
const ATTACKS = [...traits.values()].filter((t) => t.slot === 'Melee').map((t) => t.id)
const [ATTACK_A, ATTACK_B] = ATTACKS as [TraitId, TraitId]

describe('what the data says a hammer is', () => {
  /**
   * All 92, and nothing else in the whole index.
   *
   * **The first version of this only checked the god pools and it was not
   * discriminating.** Measured: `id.endsWith('Trait')` catches all 92 hammers
   * and none of the 176 ids in any god pool, so a naming rule would have sailed
   * through a test written to catch naming rules. Against the full index of 651
   * it fails, because **33 traits end in `Trait` and are not hammers**: Breath
   * of Eros, Word of Greater Girth, Lapis Lazuli Insight and thirty more.
   *
   * That is the whole lesson `CLAUDE.md` closes on. Match against the data, and
   * check the match against the data rather than against a convenient corner of
   * it.
   */
  it('matches every id in the six hammer sources and nothing else in the index', () => {
    const hammers = new Set(
      sources.filter((one) => one.kind === 'hammer').flatMap((one) => one.traits),
    )
    expect(hammers.size).toBe(92)
    for (const id of hammers) expect(isHammer(id), id).toBe(true)

    for (const trait of traits.values()) {
      if (hammers.has(trait.id)) continue
      expect(isHammer(trait.id), `${trait.id} is not a hammer`).toBe(false)
    }
  })

  /** The rule that would have passed the weaker test, kept as the counterexample. */
  it('is not what a name ending in Trait would give', () => {
    const byName = [...traits.values()].filter((t) => /Trait$/.test(t.id))
    const wrong = byName.filter((t) => !isHammer(t.id))
    expect(wrong.length).toBe(33)

    // And no god pool holds one of those, which is why the narrow test passed.
    const pooled = new Set([...godPools.values()].flatMap((p) => [...p.priority, ...p.pool]))
    expect(wrong.filter((t) => pooled.has(t.id))).toEqual([])
  })

  it('knows which arm each one belongs to, since the trait does not', () => {
    expect(hammerArm(A_HAMMER)).toBeTruthy()
    expect(hammerArm(ATTACK_A)).toBeUndefined()
  })

  it('gates the options by arm and by aspect', () => {
    const staff = hammerOptions('WeaponStaffSwing', 'BaseStaffAspect')
    expect(staff.length).toBeGreaterThan(0)
    for (const id of staff) expect(hammerArm(id)).toBe('WeaponStaffSwing')

    // 20 upgrades are locked to one aspect, so two aspects of one arm differ.
    const gated = [...traits.values()].filter((t) => t.needsAspect?.length)
    expect(gated.length).toBeGreaterThan(0)
  })
})

describe('routing a pick', () => {
  /**
   * **Proven to fail first.** Against the old `moveBoon` a hammer landed in
   * `boons`, where it corrupts the slot map, the Olympian tally and the
   * exchange's shape hash at once, and nothing anywhere says so.
   */
  it('sends a hammer to hammers and not to boons', () => {
    const after = movePick(bend({ boons: [], hammers: [], optional: undefined }), A_HAMMER, 'build')
    expect(after.hammers).toEqual([A_HAMMER])
    expect(after.boons).not.toContain(A_HAMMER)
  })

  it('sends a boon to boons and not to hammers', () => {
    const after = movePick(bend({ boons: [], hammers: [] }), ATTACK_A, 'build')
    expect(after.boons).toContain(ATTACK_A)
    expect(after.hammers).toEqual([])
  })

  it('sends a hammer to optional, and out of hammers', () => {
    const held = bend({ boons: [], hammers: [A_HAMMER], optional: undefined })
    const after = movePick(held, A_HAMMER, 'optional')
    expect(after.hammers).toEqual([])
    expect(after.optional).toEqual([A_HAMMER])
  })

  it('takes a pick out of the build entirely', () => {
    const held = bend({ boons: [ATTACK_A], hammers: [A_HAMMER], optional: undefined })
    expect(movePick(held, ATTACK_A, null).boons).not.toContain(ATTACK_A)
    expect(movePick(held, A_HAMMER, null).hammers).toEqual([])
  })

  /**
   * The property that makes "in the build and also worth adding" impossible
   * rather than merely discouraged. Every transition, both kinds of pick.
   */
  it.each([
    ['build', 'optional'],
    ['optional', 'build'],
    ['build', null],
    ['optional', null],
  ] as const)('leaves every list before joining one: %s to %s', (from, to) => {
    for (const id of [ATTACK_A, A_HAMMER]) {
      const held = movePick(bend({ boons: [], hammers: [], optional: undefined }), id, from)
      const after = movePick(held, id, to)
      const times =
        after.boons.filter((one) => one === id).length +
        after.hammers.filter((one) => one === id).length +
        (after.optional ?? []).filter((one) => one === id).length
      expect(times, `${id} ${from} to ${to}`).toBe(to === null ? 0 : 1)
      expect(trayOf(after, id)).toBe(to)
    }
  })

  /**
   * A build written before `optional` existed has no key at all, and one whose
   * last optional pick was removed must look exactly the same. `shapeOf` and
   * the migration both read it that way.
   */
  it('collapses optional to undefined when the last one leaves', () => {
    const held = bend({ boons: [], hammers: [], optional: [ATTACK_A] })
    expect(movePick(held, ATTACK_A, null).optional).toBeUndefined()
  })
})

describe('ranking Worth adding', () => {
  const three = (over: Partial<ShownBuild> = {}) =>
    bend({ boons: [], hammers: [], optional: ['a', 'b', 'c'], ...over })

  it('moves a pick to sit before another', () => {
    expect(reorderOptional(three(), 'c', 'a').optional).toEqual(['c', 'a', 'b'])
    expect(reorderOptional(three(), 'a', 'c').optional).toEqual(['b', 'a', 'c'])
  })

  it('sends it to the end when there is nothing to sit before', () => {
    expect(reorderOptional(three(), 'a', null).optional).toEqual(['b', 'c', 'a'])
  })

  it('leaves the list alone for a pick it does not hold', () => {
    expect(reorderOptional(three(), 'z', 'a').optional).toEqual(['a', 'b', 'c'])
  })

  it('leaves the list alone when a pick is dropped on itself', () => {
    expect(reorderOptional(three(), 'b', 'b').optional).toEqual(['a', 'b', 'c'])
  })

  it('keeps every member, because a reorder is not a removal', () => {
    const after = reorderOptional(three(), 'c', 'a').optional ?? []
    expect([...after].sort()).toEqual(['a', 'b', 'c'])
  })

  /** It is a preference list, not the build, so nothing else may move. */
  it('touches neither boons nor hammers', () => {
    const held = three({ boons: [ATTACK_A], hammers: [A_HAMMER] })
    const after = reorderOptional(held, 'c', 'a')
    expect(after.boons).toEqual([ATTACK_A])
    expect(after.hammers).toEqual([A_HAMMER])
  })
})

describe('one pick per core slot', () => {
  it('displaces the boon already in that slot', () => {
    const held = bend({ boons: [ATTACK_A], hammers: [], optional: undefined })
    const after = movePick(held, ATTACK_B, 'build')
    expect(after.boons).toContain(ATTACK_B)
    expect(after.boons).not.toContain(ATTACK_A)
  })

  /** Across both lists, or the tile would have two answers and no rule. */
  it('displaces one sitting in optional too', () => {
    const held = bend({ boons: [], hammers: [], optional: [ATTACK_A] })
    const after = movePick(held, ATTACK_B, 'build')
    expect(after.optional ?? []).not.toContain(ATTACK_A)
    expect(after.boons).toContain(ATTACK_B)
  })

  it('lets a core boon be optional, which is the whole point', () => {
    const after = movePick(bend({ boons: [], hammers: [], optional: undefined }), ATTACK_A, 'optional')
    expect(after.optional).toEqual([ATTACK_A])
    expect(coreAt(after, 'Melee')).toEqual({ id: ATTACK_A, tray: 'optional' })
  })

  it('does not displace anything when the pick holds no core slot', () => {
    expect(coreSlotOf(A_HAMMER)).toBeNull()
    const held = bend({ boons: [ATTACK_A], hammers: [], optional: undefined })
    expect(movePick(held, A_HAMMER, 'build').boons).toContain(ATTACK_A)
  })

  it('reads the required occupant first when a build somehow holds both', () => {
    // Not reachable through movePick. It is reachable through an import.
    const odd = bend({ boons: [ATTACK_A], hammers: [], optional: [ATTACK_B] })
    expect(coreAt(odd, 'Melee')).toEqual({ id: ATTACK_A, tray: 'build' })
  })
})
