/**
 * Rule health. The measurement that gets rules cut.
 *
 *   npm run health            300 runs
 *   npm run health -- 1000    more, when a number looks marginal
 *
 * `DESIGN.md` 5.1. For each rule, the share of its eligible pool it fires on.
 * **Anything at 60 percent or above is flagged**, because a rule that fires on
 * most of the pool is not advice, it is a constant, and a constant dressed as
 * advice is worse than silence.
 *
 * Two things about the method, and both are the point:
 *
 * **Measured against random legal runs, never against the builds we ship.**
 * `DESIGN.md` records what happens otherwise: in D.D.S. two rules looked
 * healthy against 39 curated builds and fired on 86 and 45 percent of 300
 * random ones, and both were cut. A curated build is a case somebody chose;
 * the pool is what a player actually meets.
 *
 * **It imports the real engine.** `DESIGN.md` 2 puts the engines in pure
 * modules for exactly this: the code measured here is the code that ships, so
 * the numbers cannot drift from the product by a refactor.
 *
 * The runs come from `engine/runsim.ts`, which draws Exits, respects god pools
 * and respects slot conflicts, so a boon it offers is a boon a player could
 * really have been offered at that moment.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { buildTraitIndex, godPoolsFrom, olympiansFrom } from '../src/data/load.ts'
import { eligibleGods, offerFor, seededRng, simulateRun } from '../src/engine/runsim.ts'
import { fire, parseRules, ruleContext, subjectRules } from '../src/engine/rules.ts'
import type { Subject } from '../src/engine/rules.ts'
import type { Rarity, TraitIndex } from '../src/data/types.ts'

const ROOT = resolve(import.meta.dirname, '..')

/** At or above this share of its eligible pool, a rule is not saying anything. */
const NOISY = 0.6

/** Below this, a rule may be dead weight rather than quiet. Reported, not failed. */
const SILENT = 0.005

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
const generated = (name: string) => {
  const file = readJson(join(ROOT, `data/generated/${name}.json`)) as { data?: unknown }
  return (file.data ?? file) as Record<string, unknown>
}

const runs = Number(process.argv.find((arg) => /^\d+$/.test(arg)) ?? 300)

// ---------------------------------------------------------------------------
// The rules, and whether they can be trusted at all
// ---------------------------------------------------------------------------

const raw = readJson(join(ROOT, 'data/curated/rules.json'))
const { rules, problems } = parseRules(raw)

if (problems.length) {
  console.error('rules.json does not parse cleanly:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

if (!rules.length) {
  console.log('no rules to measure.')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// The pool: real offers out of real runs
// ---------------------------------------------------------------------------

const loot = generated('loot')
const traits: TraitIndex = buildTraitIndex({
  traits: generated('traits-resolved'),
  requirements: generated('requirements'),
  loot,
  text: generated('text-traits'),
})
const olympians = olympiansFrom(loot)
const godPools = godPoolsFrom(loot)
const offerRules = generated('offer-rules') as { maxGodsPerRun?: number }

const RARITIES: Rarity[] = ['Common', 'Rare', 'Epic', 'Heroic']

/**
 * One sample: a run mid-flight, and one legal offer inside it.
 *
 * Sampled at a random point rather than always at the start, because a rule
 * keyed on the god cap or on Exits running out can only be measured where
 * those states exist.
 */
type Sample = { ctx: ReturnType<typeof ruleContext>; offer: Subject[] }

function sample(seed: number): Sample | null {
  const weapons = ['WeaponStaffSwing', 'WeaponDagger', 'WeaponTorch', 'WeaponAxe', 'WeaponLob', 'WeaponSuit']
  const exits = 12

  // Stop somewhere inside a run rather than at either end, or a rule keyed on
  // the god cap or on Exits running out has nowhere to be measured.
  const taken = 1 + (seed % (exits - 1))
  const run = simulateRun(traits, godPools, olympians, {
    seed,
    exits: taken,
    weapon: weapons[seed % weapons.length],
    maxOlympians: Number(offerRules.maxGodsPerRun ?? 4),
    rollRarity: true,
  })

  /**
   * `simulateRun` runs every Exit it is given, so a run of `taken` Exits ends
   * with none left. That is the end of a run, not the middle of one, and it
   * silently starved every rule keyed on Exits remaining: two of them read 0.0
   * percent and looked dead when they had simply never been offered a context
   * they could hold in. The run is `taken` Exits in, so it has the rest to go.
   */
  const context = { ...run.context, exitsLeft: exits - taken }

  const rng = seededRng(seed * 7919 + 13)
  const gods = eligibleGods(context, traits, godPools)
  const god = gods[Math.floor(rng() * gods.length)]
  if (!god) return null

  const offered = offerFor(god, context, traits, godPools, rng)
  if (!offered.length) return null

  return {
    ctx: ruleContext(context, traits),
    offer: offered.map((id, index) => ({
      id,
      rarity: RARITIES[(seed + index) % RARITIES.length] ?? 'Common',
      god,
    })),
  }
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

type Tally = {
  /** offers this rule could in principle have fired on */
  eligible: number
  /** offers it did fire on */
  fired: number
  /** runs in which it fired at least once */
  runsFired: number
}

const subjectOnly = subjectRules(rules)
const runOnly = rules.filter((rule) => !rule.match)
const tally = new Map<string, Tally>(rules.map((rule) => [rule.id, { eligible: 0, fired: 0, runsFired: 0 }]))

let sampled = 0
let offers = 0

for (let seed = 1; seed <= runs; seed += 1) {
  const drawn = sample(seed)
  if (!drawn) continue
  sampled += 1

  const firedThisRun = new Set<string>()

  // A run-level rule's pool is the run, not the offer.
  for (const rule of runOnly) {
    const entry = tally.get(rule.id)
    if (!entry) continue
    entry.eligible += 1
    if (fire([rule], { id: '', rarity: 'Common', god: null }, drawn.ctx).length) {
      entry.fired += 1
      firedThisRun.add(rule.id)
    }
  }

  for (const subject of drawn.offer) {
    offers += 1
    for (const rule of subjectOnly) {
      const entry = tally.get(rule.id)
      if (!entry) continue
      entry.eligible += 1
      if (fire([rule], subject, drawn.ctx).length) {
        entry.fired += 1
        firedThisRun.add(rule.id)
      }
    }
  }

  for (const id of firedThisRun) {
    const entry = tally.get(id)
    if (entry) entry.runsFired += 1
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0)
const bar = (share: number) => {
  const filled = Math.round(share * 24)
  return `${'#'.repeat(filled)}${'.'.repeat(Math.max(0, 24 - filled))}`
}

console.log(`rule health, over ${sampled} runs and ${offers} offers\n`)
console.log(`  ${'rule'.padEnd(28)} ${'fires on'.padStart(9)}  ${'of runs'.padStart(8)}  shape`)

let flagged = 0
let silent = 0
let unseen = 0

/**
 * Why the harness cannot see a rule, if it cannot.
 *
 * **A rule the simulator never puts in a position to fire is not a rule that
 * never fires**, and reporting the two the same way would get a good rule cut.
 * `runsim` draws Olympian Exits only: `eligibleGods` filters to
 * `ctx.olympians`, so Hermes, Selene and Chaos are never the god behind an
 * offer here even though they are four of the eighteen reward slots in
 * `RewardStoreData.RunProgress`.
 */
function unmeasurable(rule: (typeof rules)[number]): string | null {
  const gods = rule.match?.god
  if (gods?.length && !gods.some((god) => olympians.includes(god))) {
    return 'runsim draws Olympian Exits only'
  }
  return null
}

for (const rule of rules) {
  const entry = tally.get(rule.id)
  if (!entry) continue
  const share = entry.eligible ? entry.fired / entry.eligible : 0
  const inRuns = pct(entry.runsFired, sampled)
  const blind = unmeasurable(rule)
  const mark = blind
    ? ` <- not measurable here: ${blind}`
    : share >= NOISY
      ? ' <- fires on most of its pool'
      : share <= SILENT
        ? ' <- never fires'
        : ''
  if (!blind && share >= NOISY) flagged += 1
  if (!blind && share <= SILENT) silent += 1
  if (blind) unseen += 1
  console.log(
    `  ${rule.id.padEnd(28)} ${pct(entry.fired, entry.eligible).toFixed(1).padStart(8)}% ${inRuns
      .toFixed(0)
      .padStart(7)}%  ${bar(share)}${mark}`,
  )
}

console.log()
if (flagged) {
  console.log(
    `${flagged} ${flagged === 1 ? 'rule fires' : 'rules fire'} on ${NOISY * 100}% or more of the pool. ` +
      'A rule that fires on most of what it sees is a constant, not advice. Narrow it or cut it.',
  )
}
if (silent) {
  console.log(
    `${silent} never fired. That may be right, if the condition is rare, but check it is not ` +
      'naming something that cannot happen.',
  )
}
if (unseen) {
  console.log(
    `${unseen} could not be measured at all. runsim models Olympian Exits, so a rule about ` +
      'Hermes, Selene or Chaos has no pool here. Extend the simulator before trusting one.',
  )
}
if (!flagged && !silent && !unseen) {
  console.log('every rule is somewhere between saying nothing and saying it always.')
}

// The health report reports. It is a measurement, and a measurement that fails
// the build is a measurement people stop running.
process.exit(0)
