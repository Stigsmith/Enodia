/**
 * Which builds a run can still finish, against the real builds and real traits.
 *
 * A hand-built world would prove the plumbing and nothing else. The claim worth
 * checking is about the eight builds a player actually sees, so those are what
 * these ask about.
 */

import { describe, expect, it } from 'vitest'

import { SAMPLE_BUILDS, FIRST_BUILD } from '../data/builds.fixture.ts'
import { olympians, traits } from '../data/app.ts'
import type { RunContext } from '../data/types.ts'
import { buildStanding, buildTally, sayOf, targetOf, verdictForShown } from './build-run.ts'

const context = (over: Partial<RunContext> = {}): RunContext => ({
  weapon: null,
  aspect: null,
  path: null,
  exitsLeft: 12,
  held: [],
  godsTaken: [],
  godsSeen: [],
  maxOlympians: 4,
  olympians,
  ...over,
})

describe('a build as the engine\'s question', () => {
  it('asks for every boon rather than one of them', () => {
    const target = targetOf(FIRST_BUILD)
    expect(target.requires).toHaveLength(FIRST_BUILD.boons.length)
    for (const set of target.requires) expect(set).toHaveLength(1)
  })

  it('leaves the optional boons out', () => {
    // They raise the ceiling and they are not the build. A run that never
    // offers one has not failed the build, and requiring them would report
    // builds dead that are not. The fixture is local because whether the
    // shipped build happens to carry any is not what is under test.
    const withOptional = { ...FIRST_BUILD, optional: ['ZeusWeaponBoon', 'HeraWeaponBoon'] }
    const flat = targetOf(withOptional).requires.flat()
    for (const id of withOptional.optional) expect(flat).not.toContain(id)
    expect(flat).toEqual(expect.arrayContaining(FIRST_BUILD.boons))
  })

  it('carries the aspect and the hammers as sets of their own', () => {
    const target = targetOf(FIRST_BUILD)
    expect(target.aspect).toBe(FIRST_BUILD.aspect)
    expect(target.hammers).toEqual(FIRST_BUILD.hammers)
  })
})

describe('the aspect is chosen once and never offered', () => {
  it('kills a build on another aspect, and names both', () => {
    const other = 'StaffRaiseDeadAspect'
    expect(other).not.toBe(FIRST_BUILD.aspect)
    const verdict = verdictForShown(FIRST_BUILD, context({ aspect: other }), traits)
    expect(verdict.state).toBe('DEAD')
    expect(verdict.why).toContain(traits.get(other)?.name?.replace(/^Aspect of /, '') ?? '')
    expect(verdict.why).toContain(traits.get(FIRST_BUILD.aspect)?.name?.replace(/^Aspect of /, '') ?? '')
  })

  it('leaves a build on the run\'s own aspect alive', () => {
    const verdict = verdictForShown(FIRST_BUILD, context({ aspect: FIRST_BUILD.aspect }), traits)
    expect(verdict.state).not.toBe('DEAD')
  })

  it('judges nothing on aspect when the run recorded none', () => {
    // The tool lets a run start without an aspect. Inventing a verdict from a
    // blank is worse than not having one.
    for (const one of SAMPLE_BUILDS) {
      expect(verdictForShown(one, context(), traits).why).not.toContain('this run is')
    }
  })
})

describe('the sentence under the name', () => {
  it('drops the subject when the verdict opens with it', () => {
    const one = { build: FIRST_BUILD, verdict: { ...verdictForShown(FIRST_BUILD, context(), traits), why: `${FIRST_BUILD.name} needs two more picks.` } }
    expect(sayOf(one)).toBe('needs two more picks.')
  })

  it('keeps every word of a sentence that only mentions it', () => {
    const why = `Nothing is left for ${FIRST_BUILD.name}.`
    const one = { build: FIRST_BUILD, verdict: { ...verdictForShown(FIRST_BUILD, context(), traits), why } }
    expect(sayOf(one)).toBe(why)
  })
})

describe('the standing', () => {
  /**
   * The library is passed in rather than defaulted.
   *
   * `buildStanding` falls back to what ships, and what ships is now nothing: an
   * empty shelf is the honest state until real builds are written. A test of
   * the standing has no business depending on that, so it brings its own
   * library and keeps testing the function.
   */
  it('accounts for every build exactly once', () => {
    const standing = buildStanding(context(), traits, SAMPLE_BUILDS)
    expect(standing).toHaveLength(SAMPLE_BUILDS.length)
    expect(new Set(standing.map((one) => one.build.id)).size).toBe(SAMPLE_BUILDS.length)
  })

  it('puts the dead first, because that is the news', () => {
    const standing = buildStanding(context({ aspect: FIRST_BUILD.aspect }), traits, SAMPLE_BUILDS)
    const states = standing.map((one) => one.verdict.state)
    const rank = { DEAD: 0, AT_RISK: 1, REACHABLE: 2, ON_TRACK: 3 }
    for (let i = 1; i < states.length; i += 1) {
      expect(rank[states[i - 1]!]).toBeLessThanOrEqual(rank[states[i]!])
    }
  })

  it('adds up', () => {
    const tally = buildTally(buildStanding(context({ aspect: FIRST_BUILD.aspect }), traits, SAMPLE_BUILDS))
    expect(tally.done + tally.open + tally.closed).toBe(tally.total)
    expect(tally.total).toBe(SAMPLE_BUILDS.length)
  })

  it('closes a build the moment another aspect is chosen', () => {
    // An aspect settles the field at setup, before a single Exit.
    const onIt = buildTally(buildStanding(context({ aspect: FIRST_BUILD.aspect }), traits, SAMPLE_BUILDS))
    const offIt = buildTally(buildStanding(context({ aspect: 'StaffRaiseDeadAspect' }), traits, SAMPLE_BUILDS))
    expect(onIt.closed).toBe(0)
    expect(offIt.closed).toBe(SAMPLE_BUILDS.length)
  })
})
