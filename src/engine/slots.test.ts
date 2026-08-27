import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CORE_SLOTS,
  SLOTS,
  canBeOffered,
  occupiedSlots,
  slotLabel,
  slotStates,
  slotSummary,
  upgradedRarity,
} from './slots.ts'
import type { Held, Slot, Trait, TraitIndex } from '../data/types.ts'

// ---------------------------------------------------------------------------
// A hand-built index. Two gods, one Cast boon each, plus a boon with no slot.
// ---------------------------------------------------------------------------

const trait = (id: string, name: string, slot: Slot | null, gods: string[] = []): Trait => ({
  id,
  name,
  kind: 'boon',
  slot,
  altSlot: null,
  gods,
  requiredWeapon: null,
  requires: null,
})

const index: TraitIndex = new Map([
  ['ZeusCastBoon', trait('ZeusCastBoon', 'Storm Ring', 'Ranged', ['Zeus'])],
  ['PoseidonCastBoon', trait('PoseidonCastBoon', 'Tidal Ring', 'Ranged', ['Poseidon'])],
  ['ZeusWeaponBoon', trait('ZeusWeaponBoon', 'Heaven Strike', 'Melee', ['Zeus'])],
  ['StormRingBoon', trait('StormRingBoon', 'Thunder Flourish', null, ['Zeus'])],
])

const holding = (id: string, rarity: Held[number]['rarity'] = 'Common'): Held => [{ id, rarity }]

describe('the rarity ladder', () => {
  it('climbs Common to Heroic and stops', () => {
    expect(upgradedRarity('Common')).toBe('Rare')
    expect(upgradedRarity('Epic')).toBe('Heroic')
    expect(upgradedRarity('Heroic')).toBeNull()
  })

  it('has no rung for a duo, which is what a duo always is', () => {
    expect(upgradedRarity('Duo')).toBeNull()
    expect(upgradedRarity('Legendary')).toBeNull()
  })
})

describe('slot occupancy', () => {
  it('reports an empty board when nothing is held', () => {
    expect(occupiedSlots([], index).size).toBe(0)
    expect(slotSummary([], index).every((state) => state.occupant === null)).toBe(true)
  })

  it('marks the slot a held boon sits in', () => {
    expect([...occupiedSlots(holding('ZeusCastBoon'), index)]).toEqual(['Ranged'])
  })

  it('keeps the highest rarity in a slot, since that is what a swap must beat', () => {
    const held: Held = [
      { id: 'ZeusCastBoon', rarity: 'Common' },
      { id: 'PoseidonCastBoon', rarity: 'Epic' },
    ]
    const state = slotStates(held, index).get('Ranged')
    expect(state?.occupant).toBe('ZeusCastBoon')
    expect(state?.rarity).toBe('Epic')
  })

  it('ignores a held id the index does not know', () => {
    expect(occupiedSlots(holding('SomethingFromAPatch'), index).size).toBe(0)
  })
})

describe('the Cast lockout, which is the reason this project exists', () => {
  it('offers a Cast boon while the Cast slot is open', () => {
    const verdict = canBeOffered('PoseidonCastBoon', holding('ZeusWeaponBoon'), index)
    expect(verdict.offerable).toBe(true)
    expect(verdict.route).toBe('offer')
    expect(verdict.why).toContain('Cast is open')
  })

  it('blocks the other god once the Cast slot is filled', () => {
    const verdict = canBeOffered('PoseidonCastBoon', holding('ZeusCastBoon'), index)
    expect(verdict.offerable).toBe(false)
    expect(verdict.blockedBy).toBe('ZeusCastBoon')
    expect(verdict.route).toBe('swap')
    expect(verdict.why).toContain('Storm Ring holds your Cast')
  })

  // The correction that matters: a filled slot is not proof of impossible.
  // GetReplacementTraits can still offer a swap, at ReplaceChance 0.1.
  it('calls it a swap while the occupant can still be upgraded', () => {
    for (const rarity of ['Common', 'Rare', 'Epic'] as const) {
      expect(canBeOffered('PoseidonCastBoon', holding('ZeusCastBoon', rarity), index).route).toBe('swap')
    }
  })

  it('calls it locked only when the occupant is Heroic, the top of the ladder', () => {
    const verdict = canBeOffered('PoseidonCastBoon', holding('ZeusCastBoon', 'Heroic'), index)
    expect(verdict.route).toBe('locked')
    expect(verdict.why).toContain('cannot arrive at all')
  })

  it('never blocks a boon that occupies no slot', () => {
    const verdict = canBeOffered('StormRingBoon', holding('ZeusCastBoon'), index)
    expect(verdict.offerable).toBe(true)
    expect(verdict.why).toContain('occupies no slot')
  })

  it('says so when the trait is already held', () => {
    expect(canBeOffered('ZeusCastBoon', holding('ZeusCastBoon'), index).route).toBe('held')
  })
})

describe('the vocabulary', () => {
  it('says the words the game publishes, never the internal ones', () => {
    expect(slotLabel('Ranged')).toBe('Cast')
    expect(slotLabel('Rush')).toBe('Sprint')
    expect(slotLabel('Mana')).toBe('Magick')
    expect(slotLabel('Melee')).toBe('Attack')
    expect(slotLabel('Secondary')).toBe('Special')
    expect(slotLabel('Spell')).toBe('Hex')
  })
})

// ---------------------------------------------------------------------------
// Against the real extraction. These are the tests that catch a patch.
// ---------------------------------------------------------------------------

describe('against data/generated', () => {
  const resolved = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../data/generated/traits-resolved.json'), 'utf8'),
  ).data as Record<string, { Slot?: string; AltSlot?: string }>

  it('uses no slot the type layer has not heard of', () => {
    const seen = new Set<string>()
    for (const record of Object.values(resolved)) {
      if (record.Slot) seen.add(record.Slot)
      if (record.AltSlot) seen.add(record.AltSlot)
    }
    expect([...seen].sort()).toEqual([...SLOTS].sort())
  })

  it('has exactly nine traits in each core slot, one per Olympian', () => {
    for (const slot of CORE_SLOTS) {
      const count = Object.values(resolved).filter((record) => record.Slot === slot).length
      expect(`${slot}: ${count}`).toBe(`${slot}: 9`)
    }
  })

  it('resolves a slot for a trait that never states one', () => {
    // 73 of the 122 traits that end up with a Slot inherit it. Aspect of
    // Charon takes hers from WeaponEnchantmentTrait, so the whole engine is
    // blind to every weapon aspect until inheritance has run.
    const raw = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../data/generated/traits.json'), 'utf8'),
    ).data as Record<string, { Slot?: string }>
    expect(raw.AxeArmCastAspect?.Slot).toBeUndefined()
    expect(resolved.AxeArmCastAspect?.Slot).toBe('Aspect')

    const inherited = Object.keys(resolved).filter((id) => resolved[id]?.Slot && !raw[id]?.Slot)
    expect(inherited.length).toBe(73)
  })
})
