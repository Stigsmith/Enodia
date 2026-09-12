/**
 * The facet vocabulary, which is the only thing that understands these tokens.
 *
 * The server stores them and groups by them and has no idea what one says, so
 * there is nothing on that side that can catch a token going out in one shape
 * and being read back in another. These are the check that the round trip
 * holds, and that it holds against the real game data rather than a fixture:
 * every id below comes out of `builds.fixture.ts`, which is a build the app
 * actually ships.
 */

import { describe, expect, it } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import type { ShownBuild } from '../data/builds.ts'
import { facetsOf, render } from './facets.ts'

const kinds = (build: ShownBuild) =>
  new Set(facetsOf(build).map((one) => one.slice(0, one.indexOf(':'))))

describe('what a build is made of', () => {
  it('names the arm and the aspect it was built on', () => {
    const found = facetsOf(FIRST_BUILD)
    expect(found).toContain(`arm:${FIRST_BUILD.weapon}`)
    expect(found).toContain(`aspect:${FIRST_BUILD.aspect}`)
  })

  /**
   * **Olympians only, and from the data.** The build below draws on Hestia,
   * Aphrodite, Demeter and Apollo, and `godsOf` intersects with the nine that
   * carry `GodLoot` rather than filtering three names out by hand. A god board
   * listing Selene beside Zeus would imply they cost the same thing.
   */
  it('names the gods its boons come from', () => {
    const gods = facetsOf(FIRST_BUILD).filter((one) => one.startsWith('god:'))
    expect(gods).toEqual(
      expect.arrayContaining(['god:Hestia', 'god:Aphrodite', 'god:Demeter', 'god:Apollo']),
    )
  })

  /* The counts are per build, so a build cannot vote twice for its own arm.
     A `Set` does that; this is the check that it stays one. */
  it('says each thing once', () => {
    const found = facetsOf(FIRST_BUILD)
    expect(new Set(found).size).toBe(found.length)
  })

  it('gives the same list every time, in the same order', () => {
    expect(facetsOf(FIRST_BUILD)).toEqual(facetsOf({ ...FIRST_BUILD }))
    expect(facetsOf(FIRST_BUILD)).toEqual([...facetsOf(FIRST_BUILD)].sort())
  })

  it('names every keepsake the run carries, the swaps as well', () => {
    const found = facetsOf({ ...FIRST_BUILD, swaps: [null, 'ForceZeusBoonKeepsake', null] })
    expect(found).toContain(`keepsake:${FIRST_BUILD.keepsake}`)
    expect(found).toContain('keepsake:ForceZeusBoonKeepsake')
  })

  /* Sending nothing is better than sending an empty value: `keepsake:` would
     become a board row counting builds that carry no keepsake. */
  it('leaves out what a build has not chosen', () => {
    const bare: ShownBuild = { ...FIRST_BUILD, keepsake: null, familiar: null, hex: null, arcana: [] }
    const found = kinds(bare)
    expect(found.has('keepsake')).toBe(false)
    expect(found.has('familiar')).toBe(false)
    expect(found.has('hex')).toBe(false)
    expect(found.has('arcana')).toBe(false)
    expect(found.has('arm')).toBe(true)
  })

  /**
   * **Nothing about how it played.** Runs, clears, Fear and vows are the
   * player's own record, and the exchange already counts what happened to a
   * listing through a route that asks first. A facet carrying them would be a
   * second, quieter copy of the thing `prefs.reportRuns` exists to switch off.
   */
  it('carries nothing from the play record', () => {
    const played: ShownBuild = {
      ...FIRST_BUILD,
      play: { rating: 5, runs: 30, clears: 29, assembles: 'reliably', fear: 55, vows: {} },
    }
    expect(facetsOf(played)).toEqual(facetsOf({ ...FIRST_BUILD, play: undefined }))
  })

  /* Both ends of the bound are on the server too, and this is the client side
     of the same promise: never send more than the server will keep. */
  it('never sends more than the server stores', () => {
    expect(facetsOf(FIRST_BUILD).length).toBeLessThanOrEqual(40)
    expect(facetsOf(FIRST_BUILD).every((one) => one.length <= 40)).toBe(true)
  })
})

describe('reading a token back', () => {
  it('names every token a real build produces', () => {
    for (const token of facetsOf(FIRST_BUILD)) {
      const found = render(token)
      expect(found, token).not.toBeNull()
      expect(found?.name, token).toBeTruthy()
      /* An id leaking through as a label means the join failed. */
      expect(found?.name, token).not.toContain(':')
    }
  })

  /**
   * Six aspects are called "Aspect of Melinoë", one per arm, which `CLAUDE.md`
   * records as a join hazard. It is a labelling hazard for the same reason: a
   * board would otherwise show the same row six times over.
   */
  it('tells the six Melinoë aspects apart by their arm', () => {
    /* The real ids, checked against the data rather than guessed. An earlier
       version of this test used made-up ones, which `render` fell back to
       echoing, so it passed while proving nothing. */
    const six = [
      'BaseStaffAspect',
      'BaseSuitAspect',
      'AxeRecoveryAspect',
      'DaggerBackstabAspect',
      'LobAmmoBoostAspect',
      'TorchSpecialDurationAspect',
    ]
    const names = six.map((id) => render(`aspect:${id}`)?.name)

    expect(names.every((one) => typeof one === 'string' && one.endsWith(', Melinoë'))).toBe(true)
    expect(new Set(names).size).toBe(six.length)
  })

  it('gives back nothing for a kind it does not know', () => {
    expect(render('banana:split')).toBeNull()
    expect(render('nocolon')).toBeNull()
    expect(render(':leading')).toBeNull()
  })

  /* A real count of a real thing, from a client that knows something this one
     does not. The id beats a blank. */
  it('falls back to the id for a value it does not know', () => {
    expect(render('god:Nyx')).toEqual({ kind: 'God', name: 'Nyx' })
    expect(render('keepsake:SomethingNew')?.name).toBe('SomethingNew')
  })
})
