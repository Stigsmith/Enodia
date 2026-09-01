/**
 * The sample builds, held to being real.
 *
 * They exist to judge a layout by, and a layout judged against nonsense is
 * judged against nothing. So every id has to resolve, every duo's
 * prerequisites have to actually be present, and no two boons may contend for
 * the same core slot. Those are mechanical claims and this checks all of them.
 *
 * It deliberately does **not** check whether a build is any good. That is the
 * owner's, it is not in any file, and no test could ask it.
 */

import { describe, expect, it } from 'vitest'

import { arcana, arcanaById, familiars, olympians, traits, weapons } from './app.ts'
import { SAMPLE_BUILDS } from './builds.ts'
import { CORE_SLOTS } from '../engine/slots.ts'
import { satisfiesRequirement } from '../engine/reachability.ts'

describe('the sample builds', () => {
  const arcanaIds = new Set(arcana.map((card) => card.id))
  const familiarIds = new Set(familiars.map((one) => one.id))
  const weaponIds = new Set(weapons.map((one) => one.id))

  it.each(SAMPLE_BUILDS)('$name names only things that exist', (build) => {
    expect(weaponIds.has(build.weapon), `weapon ${build.weapon}`).toBe(true)
    expect(traits.get(build.aspect)?.kind, `aspect ${build.aspect}`).toBe('aspect')
    expect(traits.has(build.centrepiece), `centrepiece ${build.centrepiece}`).toBe(true)
    for (const id of build.boons) expect(traits.has(id), `boon ${id}`).toBe(true)
    if (build.hex) expect(traits.get(build.hex)?.kind, `hex ${build.hex}`).toBe('hex')
    if (build.keepsake) expect(traits.get(build.keepsake)?.kind, `keepsake ${build.keepsake}`).toBe('keepsake')
    if (build.familiar) expect(familiarIds.has(build.familiar), `familiar ${build.familiar}`).toBe(true)
    for (const id of build.arcana) expect(arcanaIds.has(id), `arcana ${id}`).toBe(true)
  })

  it.each(SAMPLE_BUILDS)('$name has the aspect on the weapon it belongs to', (build) => {
    expect(traits.get(build.aspect)?.requiredWeapon).toBe(build.weapon)
  })

  it.each(SAMPLE_BUILDS)('$name actually holds what its centrepiece needs', (build) => {
    const held = new Set(build.boons)
    const requires = traits.get(build.centrepiece)?.requires
    if (!requires) return
    expect(satisfiesRequirement(requires, held), `${build.centrepiece} prerequisites`).toBe(true)
  })

  it.each(SAMPLE_BUILDS)('$name never puts two boons in one core slot', (build) => {
    const taken = new Map<string, string>()
    for (const id of build.boons) {
      const slot = traits.get(id)?.slot
      if (!slot || !CORE_SLOTS.includes(slot)) continue
      expect(taken.has(slot), `${slot}: ${taken.get(slot)} and ${id}`).toBe(false)
      taken.set(slot, id)
    }
  })

  it.each(SAMPLE_BUILDS)('$name stays inside the four Olympian slots', (build) => {
    // The roster on a run is the nine that carry GodLoot, which the bundle
    // states. Naming the ones that do not count meant writing god names as
    // literals, which is what DESIGN.md 3.1 forbids.
    const roster = new Set<string>(olympians)
    const olympian = new Set<string>()
    for (const id of build.boons) {
      for (const god of traits.get(id)?.gods ?? []) {
        if (roster.has(god)) olympian.add(god)
      }
    }
    expect(olympian.size, `gods: ${[...olympian].join(', ')}`).toBeLessThanOrEqual(4)
  })

  it.each(SAMPLE_BUILDS)('$name draws Arcana it could afford, all different', (build) => {
    // The board is limited by Grasp rather than by how many cards you take:
    // eighteen paid cards cost between 1 and 5, and a save tops out at 30.
    const grasp = build.arcana.reduce((total, id) => total + (arcanaById.get(id)?.cost ?? 0), 0)
    expect(grasp, `${build.arcana.length} cards`).toBeLessThanOrEqual(30)
    expect(new Set(build.arcana).size).toBe(build.arcana.length)
  })

  it('gives every sample a distinct id', () => {
    expect(new Set(SAMPLE_BUILDS.map((b) => b.id)).size).toBe(SAMPLE_BUILDS.length)
  })
})
