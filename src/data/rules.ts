/**
 * The rule pack, parsed once for the app.
 *
 * `data/curated/rules.json` is imported rather than fetched, the same way
 * `data/app/app-data.json` is: one bundle, no request, no loading state on a
 * surface a player opens mid run.
 *
 * **Anything that does not parse is dropped rather than shipped.** A rule with
 * no `say` cannot explain itself and the surface renders sentences, so the
 * honest failure is one fewer rule and a warning in the console, not a card
 * with a number nobody can account for. `npm run validate` fails the build on
 * the same conditions, so this should never actually drop anything: it is the
 * belt to the validator's braces.
 */

import pack from '../../data/curated/rules.json' with { type: 'json' }
import { parseRules } from '../engine/rules.ts'
import type { Rule } from '../engine/rules.ts'

const parsed = parseRules(pack)

if (parsed.problems.length && typeof console !== 'undefined') {
  console.warn(
    `${parsed.problems.length} rule${parsed.problems.length === 1 ? '' : 's'} in rules.json were dropped:`,
    parsed.problems,
  )
}

export const rules: readonly Rule[] = parsed.rules
