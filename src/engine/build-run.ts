/**
 * Which builds can this run still finish?
 *
 * "47 open" counted duos and legendaries. That is the engine's unit and not the
 * player's: nobody sits at an Exit chasing Ripple Effect, they chase a build
 * that happens to want it, and the number worth reading is how many of the
 * builds they might have played are still on the table.
 *
 * **The judgement is not new.** `verdictForBuild` already answers it, because a
 * build is a set of sets exactly like a duo's prerequisites, with the aspect
 * and each hammer upgrade as sets of their own. This turns a `ShownBuild` into
 * that question and adds the one thing the engine cannot see.
 *
 * ## The aspect is chosen once and never offered
 *
 * `obtainability` calls an unheld aspect of the right arm `offer`, because in
 * the trait data an aspect is a trait like any other. It is not one here: an
 * aspect is picked at the Crossroads and the run is that aspect until it ends.
 * So a build on a different aspect is dead, said plainly, rather than left to
 * an engine that has no way of knowing.
 *
 * A run with no aspect recorded is not judged on aspect at all. The tool lets
 * you start without one, and inventing a verdict from a blank is worse than
 * having none.
 *
 * ## `optional` is left out on purpose
 *
 * `ShownBuild.optional` is boons that raise the ceiling without being the
 * build. A run that never offers one has not failed the build, so requiring
 * them would report builds dead that are not.
 */

import type { Build, RunContext, TraitId, TraitIndex } from '../data/types.ts'
import { SAMPLE_BUILDS } from '../data/builds.ts'
import type { ShownBuild } from '../data/builds.ts'
import { verdictForBuild } from './reachability.ts'
import type { Verdict } from './reachability.ts'

export type BuildStanding = {
  build: ShownBuild
  verdict: Verdict
}

/**
 * A shown build as the question the engine already knows how to answer.
 *
 * Each boon is its own set, because a build wants all of them rather than one
 * of them. That is the difference between a build and a duo, and it is the only
 * difference.
 */
export function targetOf(build: ShownBuild): Build {
  return {
    id: build.id,
    name: build.name,
    say: build.say,
    requires: build.boons.map((one) => [one]),
    aspect: build.aspect,
    hammers: build.hammers,
  }
}

export function verdictForShown(build: ShownBuild, ctx: RunContext, traits: TraitIndex): Verdict {
  const runAspect = ctx.aspect
  if (runAspect && build.aspect && runAspect !== build.aspect) {
    const name = (id: TraitId) => traits.get(id)?.name?.replace(/^Aspect of /, '') ?? id
    return {
      target: build.id,
      state: 'DEAD',
      band: null,
      needs: [],
      minPicks: 0,
      blockedBy: [build.aspect],
      why: `${build.name} is built on ${name(build.aspect)}, and this run is ${name(runAspect)}.`,
    }
  }
  return verdictForBuild(targetOf(build), ctx, traits)
}

/**
 * Every build, most urgent first, in the same order the target list uses:
 * dead, then at risk, then the rest.
 */
export function buildStanding(
  ctx: RunContext,
  traits: TraitIndex,
  builds: readonly ShownBuild[] = SAMPLE_BUILDS,
): BuildStanding[] {
  const order = { DEAD: 0, AT_RISK: 1, REACHABLE: 2, ON_TRACK: 3 }
  return builds
    .map((build) => ({ build, verdict: verdictForShown(build, ctx, traits) }))
    .sort(
      (a, b) =>
        order[a.verdict.state] - order[b.verdict.state] ||
        a.verdict.minPicks - b.verdict.minPicks ||
        a.build.name.localeCompare(b.build.name),
    )
}

/**
 * The verdict's sentence, with its subject trimmed off the front.
 *
 * `verdictFor` writes "Killer Current needs 11 more picks", which reads well on
 * its own and stutters the moment it is put under the name in bold. Exact
 * prefix only, so a sentence that merely mentions the build keeps every word.
 */
export function sayOf(one: BuildStanding): string {
  const prefix = `${one.build.name} `
  return one.verdict.why.startsWith(prefix) ? one.verdict.why.slice(prefix.length) : one.verdict.why
}

/**
 * The tally the run header reads.
 *
 * `done` is a build every part of which is in hand, which is worth separating
 * from `open`: "two still open" reads as bad news when one of the others is
 * finished.
 */
export function buildTally(standing: readonly BuildStanding[]) {
  let done = 0
  let open = 0
  let closed = 0
  for (const one of standing) {
    if (one.verdict.state === 'ON_TRACK') done += 1
    else if (one.verdict.state === 'DEAD') closed += 1
    else open += 1
  }
  return { done, open, closed, total: standing.length }
}
