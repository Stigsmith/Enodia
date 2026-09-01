/**
 * Every filter option has art, and the art is the right shape for its size.
 *
 * The dropdown draws an icon beside each option at about 22 pixels. Two ways
 * that goes wrong and neither one throws: an option resolves to no icon and the
 * row silently loses its column, or it resolves to art drawn for a poster and
 * the row shows a thin unreadable sliver. The second is what happened to the
 * arms, whose `Weapon.icon` is the full transparent render.
 */

import { describe, expect, it } from 'vitest'

import { weapons } from '../data/app.ts'
import { SAMPLE_BUILDS } from '../data/builds.fixture.ts'
import { EMPTY_SELECTION, facets } from './build-filter.ts'

const bar = facets(SAMPLE_BUILDS, EMPTY_SELECTION)

describe('the icons beside filter options', () => {
  it.each(bar.map((facet) => [facet.id, facet] as const))('%s gives every option art', (_id, facet) => {
    for (const option of facet.options) {
      expect(option.icon, `${facet.id}: ${option.label}`).toBeTruthy()
    }
  })

  it('draws an arm as its base aspect, not as the poster render', () => {
    const arms = bar.find((facet) => facet.id === 'weapon')
    expect(arms?.options.length).toBe(new Set(SAMPLE_BUILDS.map((build) => build.weapon)).size)
    for (const option of arms?.options ?? []) {
      // A -render is the large transparent cutout. Legible on a poster, a
      // sliver in a 22 pixel row.
      expect(option.icon, option.label).not.toMatch(/-render\./)
    }
  })

  it('has a base aspect to draw for every arm in the game, not just the sampled ones', () => {
    // The map is built by name match on "Melinoe". If a patch renames those,
    // this fails here rather than showing six blank rows.
    const everyArm = facets(
      weapons.map(
        (weapon) =>
          ({
            ...SAMPLE_BUILDS[0],
            id: `probe-${weapon.id}`,
            weapon: weapon.id,
          }) as never,
      ),
      EMPTY_SELECTION,
    ).find((facet) => facet.id === 'weapon')

    expect(everyArm?.options).toHaveLength(weapons.length)
    for (const option of everyArm?.options ?? []) {
      expect(option.icon, option.label).toBeTruthy()
      expect(option.icon, option.label).not.toMatch(/-render\./)
    }
  })
})
