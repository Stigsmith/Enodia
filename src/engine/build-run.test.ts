/**
 * Which builds a run can still finish, against the real builds and real traits.
 *
 * A hand-built world would prove the plumbing and nothing else. The claim worth
 * checking is about the eight builds a player actually sees, so those are what
 * these ask about.
 */

import { describe, expect, it } from 'vitest'

import { SAMPLE_BUILDS, FIRST_BUILD } from '../data/builds.ts'
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
    // builds dead that are not.
    const withOptional = SAMPLE_BUILDS.find((one) => (one.optional ?? []).length > 0)
    expect(withOptional, 'no sample build carries optional boons any more').toBeTruthy()
    const flat = targetOf(withOptional!).requires.flat()
    for (const id of withOptional!.optional ?? []) expect(flat).not.toContain(id)
  })

  it('carries the aspect and the hammers as sets of their own', () => {
    const target = targetOf(FIRST_BUILD)
    expect(target.aspect).toBe(FIRST_BUILD.aspect)
    expect(target.hammers).toEqual(FIRST_BUILD.hammers)
  })
})

describe('the aspect is chosen once and never offered', () => {
  it('kills a build on another aspect, and names both', () => {
    const other = SAMPLE_BUILDS.find((one) => one.aspect !== FIRST_BUILD.aspect)
    expect(other).toBeTruthy()
    const verdict = verdictForShown(FIRST_BUILD, context({ aspect: other!.aspect }), traits)
    expect(verdict.state).toBe('DEAD')
    const runAspect = traits.get(other!.aspect)?.name?.replace(/^Aspect of /, '') ?? ''
    expect(verdict.why).toContain(runAspect)
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
  it('accounts for every build exactly once', () => {
    const standing = buildStanding(context(), traits)
    expect(standing).toHaveLength(SAMPLE_BUILDS.length)
    expect(new Set(standing.map((one) => one.build.id)).size).toBe(SAMPLE_BUILDS.length)
  })

  it('puts the dead first, because that is the news', () => {
    const standing = buildStanding(context({ aspect: FIRST_BUILD.aspect }), traits)
    const states = standing.map((one) => one.verdict.state)
    const rank = { DEAD: 0, AT_RISK: 1, REACHABLE: 2, ON_TRACK: 3 }
    for (let i = 1; i < states.length; i += 1) {
      expect(rank[states[i - 1]!]).toBeLessThanOrEqual(rank[states[i]!])
    }
  })

  it('adds up', () => {
    const tally = buildTally(buildStanding(context({ aspect: FIRST_BUILD.aspect }), traits))
    expect(tally.done + tally.open + tally.closed).toBe(tally.total)
    expect(tally.total).toBe(SAMPLE_BUILDS.length)
  })

  it('closes the builds on other aspects the moment one is chosen', () => {
    // The point of the number: an aspect settles most of the field at setup,
    // before a single Exit. Nothing else in the tool says that out loud.
    const chosen = buildStanding(context({ aspect: FIRST_BUILD.aspect }), traits)
    const others = SAMPLE_BUILDS.filter((one) => one.aspect !== FIRST_BUILD.aspect).length
    expect(buildTally(chosen).closed).toBeGreaterThanOrEqual(others)
  })
})
