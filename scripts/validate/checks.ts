/**
 * Every check the validator runs, as pure functions over a Bundle.
 *
 * Nothing here reads a file, hashes anything or prints. That is what makes each
 * one testable against a fixture, and it is the same purity rule DESIGN.md 1
 * puts on engine/. scripts/validate.ts does the IO and the report.
 *
 * A `fail` finding fails the build. A `warn` is printed and does not.
 */

import { ROADMAP } from '../../src/data/roadmap.ts'
import { aspectIconKeys, buildIconIndex, resolveIcon } from '../../src/data/icons.ts'
import type { IconOverrides } from '../../src/data/icons.ts'
import type { Bundle, Finding, SourceFile } from './types.ts'

type Dict = Record<string, unknown>

// ---------------------------------------------------------------------------
// Small readers. The generated JSON is the game's own shape, so everything
// arrives as unknown and gets narrowed here rather than cast at the call site.
// ---------------------------------------------------------------------------

export function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function dictOf(value: unknown): Dict {
  return isDict(value) ? value : {}
}

/** Members of a Lua array that are strings. Anything else is ignored. */
export function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function generatedData(bundle: Bundle, name: string): Dict {
  const file = bundle.generated.find((f) => f.name === name)
  return dictOf(file?.data)
}

function fail(check: string, message: string, detail?: string[]): Finding {
  return { check, severity: 'fail', message, ...(detail ? { detail } : {}) }
}

function warn(check: string, message: string, detail?: string[]): Finding {
  return { check, severity: 'warn', message, ...(detail ? { detail } : {}) }
}

function info(check: string, message: string, detail?: string[]): Finding {
  return { check, severity: 'info', message, ...(detail ? { detail } : {}) }
}

/** Keep a report readable. The full list is one --verbose away. */
function cap(lines: string[], limit = 12): string[] {
  if (lines.length <= limit) return lines
  return [...lines.slice(0, limit), `...and ${lines.length - limit} more`]
}

// ---------------------------------------------------------------------------
// 1. Provenance. DESIGN.md 2.1: the validator rejects a generated file whose
//    checksum does not match its recorded provenance.
// ---------------------------------------------------------------------------

const REQUIRED_PROVENANCE = ['extractedOn', 'gameVersion', 'source', 'generatedBy', 'sha256']

export function checkProvenance(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  const versions = new Map<string, string[]>()

  for (const file of bundle.generated) {
    const p = file.provenance
    if (!p) {
      out.push(fail('provenance', `${file.name}.json has no _provenance block`))
      continue
    }

    const missing = REQUIRED_PROVENANCE.filter((key) => typeof p[key] !== 'string' || p[key] === '')
    if (missing.length) {
      out.push(
        fail('provenance', `${file.name}.json provenance is missing ${missing.join(', ')}`, [
          'Generated files are written by scripts/extract.mjs, never by hand. Re-run npm run extract.',
        ]),
      )
    }

    const recorded = p.sha256
    if (typeof recorded === 'string' && recorded !== file.payloadSha256) {
      out.push(
        fail('provenance', `${file.name}.json payload does not match its recorded checksum`, [
          `recorded ${recorded.slice(0, 16)}`,
          `actual   ${file.payloadSha256.slice(0, 16)}`,
          'Either the file was hand edited or it predates the current extractor. Re-run npm run extract.',
        ]),
      )
    }

    const version = typeof p.gameVersion === 'string' ? p.gameVersion : '(none)'
    const named = versions.get(version) ?? []
    named.push(file.name)
    versions.set(version, named)
  }

  if (versions.size > 1) {
    out.push(
      fail(
        'provenance',
        `data/generated holds ${versions.size} different game versions, so it is only half re-extracted`,
        [...versions.entries()].map(([v, names]) => `${v}: ${names.join(', ')}`),
      ),
    )
  }

  if (!out.length && bundle.generated.length) {
    const version = [...versions.keys()][0] ?? '(none)'
    out.push(
      info(
        'provenance',
        `${bundle.generated.length} generated files, all from game build ${version}, every checksum matches`,
      ),
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// 2. References. Build order step 2: a broken reference fails the build.
// ---------------------------------------------------------------------------

export type Reference = { where: string; id: string }

/** Every trait id referenced anywhere in the generated data, with its site. */
export function collectTraitReferences(bundle: Bundle): Reference[] {
  const out: Reference[] = []
  const push = (where: string, ids: string[]) => {
    for (const id of ids) out.push({ where, id })
  }

  // Requirements, both forms. The key counts too: a prerequisite table entry
  // for a trait that does not exist is as broken as a dangling member.
  for (const [traitId, requirement] of Object.entries(generatedData(bundle, 'requirements'))) {
    out.push({ where: 'requirements.json key', id: traitId })
    const req = dictOf(requirement)
    push(`requirements.json ${traitId}.OneOf`, stringsOf(req.OneOf))
    if (Array.isArray(req.OneFromEachSet)) {
      req.OneFromEachSet.forEach((set, i) => {
        push(`requirements.json ${traitId}.OneFromEachSet[${i}]`, stringsOf(set))
      })
    }
  }

  // The named sets the requirements are built out of.
  for (const [setName, members] of Object.entries(generatedData(bundle, 'linked-trait-sets'))) {
    push(`linked-trait-sets.json ${setName}`, stringsOf(members))
  }

  // Which god offers what. Two levels: the loot set, then the loot record.
  // Chaos names its pool in three fields of its own rather than in Traits.
  const TRAIT_FIELDS = [
    'Traits',
    'PriorityUpgrades',
    'WeaponUpgrades',
    'PermanentTraits',
    'TemporaryTraits',
    'TraitSortOrder',
  ]
  for (const [setName, set] of Object.entries(generatedData(bundle, 'loot'))) {
    for (const [recordName, record] of Object.entries(dictOf(set))) {
      const rec = dictOf(record)
      for (const field of TRAIT_FIELDS) {
        push(`loot.json ${setName}.${recordName}.${field}`, stringsOf(rec[field]))
      }
    }
  }

  // Inheritance inside the trait data itself.
  for (const [traitId, trait] of Object.entries(generatedData(bundle, 'traits'))) {
    push(`traits.json ${traitId}.InheritFrom`, stringsOf(dictOf(trait).InheritFrom))
  }

  // Stacking curves are keyed by trait id.
  for (const traitId of Object.keys(generatedData(bundle, 'stacking'))) {
    out.push({ where: 'stacking.json key', id: traitId })
  }

  // Arcana cards grant a trait.
  for (const [cardId, card] of Object.entries(generatedData(bundle, 'arcana-cards'))) {
    const traitName = dictOf(card).TraitName
    if (typeof traitName === 'string') {
      out.push({ where: `arcana-cards.json ${cardId}.TraitName`, id: traitName })
    }
  }

  return out
}

export function checkReferences(bundle: Bundle): Finding[] {
  const traits = generatedData(bundle, 'traits')
  if (!Object.keys(traits).length) {
    return [fail('references', 'traits.json is empty or missing, so nothing can be resolved')]
  }

  const known = new Set(Object.keys(traits))
  const references = collectTraitReferences(bundle)
  const unresolved = references.filter((r) => !known.has(r.id))

  const out: Finding[] = []
  if (unresolved.length) {
    out.push(
      fail(
        'references',
        `${unresolved.length} trait references do not resolve to a record in traits.json`,
        cap(unresolved.map((r) => `${r.id}  <-  ${r.where}`)),
      ),
    )
  } else {
    out.push(
      info('references', `${references.length} trait references across the generated data, all resolve`),
    )
  }

  // Arcana are their own id space: the layout grid and card inheritance point
  // at card ids, not trait ids.
  const cards = generatedData(bundle, 'arcana-cards')
  const cardIds = new Set(Object.keys(cards))
  const cardRefs: Reference[] = []
  const layout = bundle.generated.find((f) => f.name === 'arcana-layout')?.data
  if (Array.isArray(layout)) {
    layout.forEach((row, i) => {
      for (const id of stringsOf(row)) cardRefs.push({ where: `arcana-layout.json row ${i}`, id })
    })
  }
  for (const [cardId, card] of Object.entries(cards)) {
    for (const parent of stringsOf(dictOf(card).InheritFrom)) {
      cardRefs.push({ where: `arcana-cards.json ${cardId}.InheritFrom`, id: parent })
    }
  }
  const badCards = cardRefs.filter((r) => !cardIds.has(r.id))
  if (badCards.length) {
    out.push(
      fail(
        'references',
        `${badCards.length} Arcana references do not resolve to a card`,
        cap(badCards.map((r) => `${r.id}  <-  ${r.where}`)),
      ),
    )
  } else if (cardRefs.length) {
    out.push(info('references', `${cardRefs.length} Arcana references resolve to ${cardIds.size} cards`))
  }

  return out
}

// ---------------------------------------------------------------------------
// 3. Classification. The extractor's step 1 criteria, kept as a standing check.
//
//    Classify by the marker the game itself uses, not by counting prerequisite
//    sets. A trait is a duo because it inherits SynergyTrait, which carries
//    IsDuoBoon = true and Frame = "Duo". Counting OneFromEachSet blocks with
//    two sets misses the four duos that state three.
// ---------------------------------------------------------------------------

/** Transitive InheritFrom closure for one trait. */
export function ancestorsOf(traits: Dict, id: string): Set<string> {
  const seen = new Set<string>()
  const walk = (current: string) => {
    for (const parent of stringsOf(dictOf(traits[current]).InheritFrom)) {
      if (seen.has(parent)) continue
      seen.add(parent)
      walk(parent)
    }
  }
  walk(id)
  return seen
}

export type Classification = {
  /** inherit SynergyTrait: the Olympian duo boons */
  duos: string[]
  /** inherit LegendaryTrait: three prerequisite sets inside one god */
  legendaries: string[]
  /** IsDuoBoon on the record itself: Selene's Hex duos, gated by game state */
  hexDuos: string[]
  /** a requirement of the OneOf form */
  gated: string[]
}

export function classifyTraits(traits: Dict, requirements: Dict): Classification {
  const duos: string[] = []
  const legendaries: string[] = []
  const hexDuos: string[] = []

  for (const [id, record] of Object.entries(traits)) {
    const rec = dictOf(record)
    // A base template is not a boon. SynergyTrait and LegendaryTrait are both
    // DebugOnly, which is how the game marks something never granted directly.
    if (rec.DebugOnly === true) continue

    const ancestors = ancestorsOf(traits, id)
    if (ancestors.has('SynergyTrait')) duos.push(id)
    else if (ancestors.has('LegendaryTrait')) legendaries.push(id)
    else if (rec.IsDuoBoon === true) hexDuos.push(id)
  }

  const gated = Object.entries(requirements)
    .filter(([, req]) => Array.isArray(dictOf(req).OneOf))
    .map(([id]) => id)

  return {
    duos: duos.sort(),
    legendaries: legendaries.sort(),
    hexDuos: hexDuos.sort(),
    gated: gated.sort(),
  }
}

/**
 * Every trait a run can actually put in front of a player.
 *
 * The loot pools, plus the three kinds that are never listed in a pool because
 * they arrive by prerequisite: duos, legendaries and Selene's Hex duos. This is
 * the set that needs art, and the set the run surface renders.
 */
export function offerableTraits(traits: Dict, loot: Dict): string[] {
  const out = new Set<string>()

  const POOL_FIELDS = ['Traits', 'PermanentTraits', 'TemporaryTraits', 'WeaponUpgrades']
  for (const set of Object.values(loot)) {
    for (const record of Object.values(dictOf(set))) {
      const rec = dictOf(record)
      for (const field of POOL_FIELDS) {
        for (const id of stringsOf(rec[field])) out.add(id)
      }
    }
  }

  const found = classifyTraits(traits, {})
  for (const id of [...found.duos, ...found.legendaries, ...found.hexDuos]) out.add(id)

  // A pool can name a trait the trait data does not define. That is the
  // references check's problem, not this one.
  return [...out].filter((id) => traits[id] !== undefined).sort()
}

/**
 * The weapon aspects. Equipped before a run rather than offered inside one, so
 * they are not in the offerable set, but the rail renders them and they need
 * art all the same. RequiredWeapon is the marker, and every aspect carries it.
 */
export function aspectTraits(traits: Dict): string[] {
  return Object.entries(traits)
    .filter(([, trait]) => typeof dictOf(trait).RequiredWeapon === 'string' && dictOf(trait).DebugOnly !== true)
    .map(([id]) => id)
    .sort()
}

/** Which loot sets offer a given trait. Used to check a duo spans two gods. */
export function offeredBy(loot: Dict): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [setName, set] of Object.entries(loot)) {
    for (const record of Object.values(dictOf(set))) {
      for (const traitId of stringsOf(dictOf(record).Traits)) {
        const gods = out.get(traitId) ?? []
        if (!gods.includes(setName)) gods.push(setName)
        out.set(traitId, gods)
      }
    }
  }
  return out
}

export function checkClassification(bundle: Bundle): Finding[] {
  const traits = generatedData(bundle, 'traits')
  const requirements = generatedData(bundle, 'requirements')
  if (!Object.keys(traits).length) return []

  const found = classifyTraits(traits, requirements)
  const out: Finding[] = []

  out.push(
    info(
      'classification',
      `${found.duos.length} duos, ${found.legendaries.length} legendaries, ${found.hexDuos.length} Hex duos, ${found.gated.length} gated boons`,
      [
        'duo: inherits SynergyTrait, which carries IsDuoBoon and Frame "Duo"',
        'legendary: inherits LegendaryTrait',
        'Hex duo: IsDuoBoon on the record, gated by GameStateRequirements rather than TraitRequirements',
        'gated: a TraitRequirements entry of the OneOf form',
      ],
    ),
  )

  // The game's HasTraitRequirements (RunLogic.lua:57) reads three forms: OneOf,
  // TwoOf and OneFromEachSet. No trait in build 138174 uses TwoOf, and the
  // engine does not evaluate it, so a patch introducing one would be read as
  // satisfied and every verdict resting on it would be wrong.
  const HANDLED_FORMS = ['OneOf', 'OneFromEachSet', 'PriorityChance']
  const unknownForms: string[] = []
  for (const [traitId, requirement] of Object.entries(requirements)) {
    for (const form of Object.keys(dictOf(requirement))) {
      if (!HANDLED_FORMS.includes(form)) unknownForms.push(`${traitId}.${form}`)
    }
  }
  if (unknownForms.length) {
    out.push(
      fail('classification', `${unknownForms.length} requirements use a form the engine does not evaluate`, [
        ...cap(unknownForms),
        `Handled: ${HANDLED_FORMS.join(', ')}. Teach engine/reachability.ts the new one before shipping.`,
      ]),
    )
  }

  // Every duo and legendary should state its prerequisites in TraitRequirements.
  // The Hex duos deliberately do not: theirs are GameStateRequirements.
  const missing = [...found.duos, ...found.legendaries].filter((id) => !requirements[id])
  if (missing.length) {
    out.push(
      fail(
        'classification',
        `${missing.length} duo or legendary boons have no entry in requirements.json`,
        cap(missing),
      ),
    )
  }

  // A duo spans two gods. The two Ransom boons are the known exception: each is
  // offered by one god only, so they are reported rather than treated as broken.
  const offers = offeredBy(generatedData(bundle, 'loot'))
  const oddSpans = found.duos
    .map((id) => ({ id, gods: offers.get(id) ?? [] }))
    .filter((d) => d.gods.length !== 2)
  if (oddSpans.length) {
    out.push(
      warn(
        'classification',
        `${oddSpans.length} duo boons are not offered by exactly two gods`,
        oddSpans.map((d) => `${d.id}: ${d.gods.length ? d.gods.join(', ') : 'offered by nobody'}`),
      ),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// 4. Counts against the baseline. DESIGN.md 11: a diff is a patch note, and is
//    reviewed rather than accepted. So drift fails, and clearing it is a
//    deliberate act: npm run validate -- --update-baseline.
// ---------------------------------------------------------------------------

export function countsOf(bundle: Bundle): Record<string, number> {
  const traits = generatedData(bundle, 'traits')
  const requirements = generatedData(bundle, 'requirements')
  const found = classifyTraits(traits, requirements)
  return {
    traits: Object.keys(traits).length,
    requirements: Object.keys(requirements).length,
    duos: found.duos.length,
    legendaries: found.legendaries.length,
    hexDuos: found.hexDuos.length,
    gated: found.gated.length,
    linkedSets: Object.keys(generatedData(bundle, 'linked-trait-sets')).length,
    arcanaCards: Object.keys(generatedData(bundle, 'arcana-cards')).length,
    stackingCurves: Object.keys(generatedData(bundle, 'stacking')).length,
  }
}

export function coverageOf(bundle: Bundle): Record<string, number> {
  const traits = generatedData(bundle, 'traits')
  const names = generatedData(bundle, 'text-traits')
  let named = 0
  let iconed = 0
  for (const [id, record] of Object.entries(traits)) {
    if (typeof dictOf(names[id]).name === 'string') named += 1
    if (typeof dictOf(record).Icon === 'string') iconed += 1
  }
  return { traitsWithDisplayName: named, traitsWithIcon: iconed }
}

export function checkCounts(bundle: Bundle): Finding[] {
  const counts = countsOf(bundle)
  const coverage = coverageOf(bundle)
  const total = counts.traits ?? 0

  const out: Finding[] = [
    info(
      'counts',
      `${coverage.traitsWithDisplayName} of ${total} traits have a display name, ${coverage.traitsWithIcon} have an icon`,
    ),
  ]

  const baseline = bundle.baseline
  if (!baseline) {
    out.push(
      warn('counts', 'no data/baseline.json, so nothing holds the extractor to its last known output', [
        'Write one with npm run validate -- --update-baseline',
      ]),
    )
    return out
  }

  const version = bundle.generated[0]?.provenance?.gameVersion
  const versionChanged = typeof version === 'string' && version !== baseline.gameVersion

  const drift: string[] = []
  const unrecorded: string[] = []
  for (const [key, value] of Object.entries({ ...counts, ...coverage })) {
    const expected = { ...baseline.counts, ...baseline.coverage }[key]
    if (expected === undefined) unrecorded.push(`${key}: ${value}`)
    else if (expected !== value) drift.push(`${key}: ${expected} -> ${value}`)
  }

  // A count the baseline has never seen is the validator learning to measure
  // something new, not the data moving. Say so, do not stop the build.
  if (unrecorded.length) {
    out.push(
      warn('counts', `${unrecorded.length} counts are not in the baseline yet`, [
        ...unrecorded,
        'Record them with npm run validate -- --update-baseline',
      ]),
    )
  }

  if (drift.length) {
    out.push(
      fail('counts', `${drift.length} structural counts moved since the baseline`, [
        ...drift,
        versionChanged
          ? `Game build changed, ${baseline.gameVersion} to ${version}. Read the diff as a patch note, then npm run validate -- --update-baseline`
          : `Game build is unchanged at ${baseline.gameVersion}, so this is the extractor changing shape, not the game. Find out why before updating the baseline.`,
      ]),
    )
  } else if (versionChanged) {
    out.push(
      warn('counts', `game build changed, ${baseline.gameVersion} to ${version}, and no count moved`, [
        'Update the baseline stamp with npm run validate -- --update-baseline',
      ]),
    )
  }

  return out
}

// ---------------------------------------------------------------------------
// 5. Vocabulary. DESIGN.md 2.4: the build fails on any UI string containing
//    "door", "room" or "biome", because the game publishes a player-facing word
//    for all three. Code identifiers may use the internal word, so this reads
//    strings and text nodes rather than grepping the file.
// ---------------------------------------------------------------------------

export const BANNED_WORDS: { pattern: RegExp; internal: string; use: string }[] = [
  { pattern: /\b\bdoors?\b\b/i, internal: 'Door', use: 'Exit' },
  { pattern: /\b\brooms?\b\b/i, internal: 'Room', use: 'Location' },
  { pattern: /\b\bbiomes?\b\b/i, internal: 'Biome', use: 'Region' },
]

/** A line that says so opts out, for the rare place the internal word is right. */
export const VOCAB_ESCAPE = 'enodia-vocab-ok'

export type UiString = {
  /** where the copy starts, which is what a report points at */
  line: number
  /**
   * Opening tag to closing tag, for a paragraph the formatter wrapped.
   *
   * Absent for anything read off a single line, where it would be `[line,
   * line]` anyway. It is wider than `line` on purpose: `line` points at the
   * copy so the report is useful, and this is where an escape comment is
   * allowed to sit, which for a wrapped paragraph is the closing tag.
   */
  span?: [number, number]
  text: string
}

/** Every line a string covers, so an escape anywhere across it counts. */
function escaped(lines: string[], found: UiString, marker: string): boolean {
  const [first, last] = found.span ?? [found.line, found.line]
  for (let at = first; at <= last; at++) {
    if ((lines[at - 1] ?? '').includes(marker)) return true
  }
  return false
}

/**
 * JSX text nodes, read across the whole file rather than one line at a time.
 *
 * **This is the hole that made both guards decorative.** They read text nodes
 * off single raw lines, and a formatter wraps a paragraph at eighty columns, so
 * the middle lines of every wrapped sentence in the app carried no `<` and no
 * `>` and produced nothing at all. Almost all of this tool's copy is written
 * that way. Measured before it was fixed: a paragraph reading "This tool needs
 * no account and there is nothing to install. Every exit is a door into the
 * next room, and nothing is tracked about you" passed the validator with zero
 * failures, hitting four retired claims and two banned words on the way past.
 *
 * Whitespace is collapsed to single spaces because that is what JSX does when
 * it renders, so what is matched is the sentence a reader actually sees rather
 * than the shape the formatter left it in.
 *
 * `masked` has comments and every quoted literal blanked out already, which is
 * what stops a `>` inside a comment opening a run and a `<` inside a string
 * closing one. Braces end a run, so a JSX expression is a boundary and most
 * code cannot produce a long match.
 */
function textNodes(masked: string): UiString[] {
  const out: UiString[] = []
  for (const found of masked.matchAll(/>([^<>{}]+)</g)) {
    const raw = found[1] ?? ''
    const text = raw.replace(/\s+/g, ' ').trim()
    if (!text) continue

    /* Two different lines, for two different jobs. `line` counts to the first
     * word, so the report points at the copy rather than at an opening tag a
     * couple of lines above it. The span runs tag to tag, because that is where
     * somebody writing an escape comment will actually put it. */
    const opened = found.index ?? 0
    const lead = raw.length - raw.trimStart().length
    const at = (upto: number) => masked.slice(0, upto).split('\n').length
    out.push({
      line: at(opened + 1 + lead),
      span: [at(opened), at(opened + 1 + raw.length)],
      text,
    })
  }
  return out
}

/**
 * Strings a reader could end up seeing. Deliberately generous: a false positive
 * costs one escape comment, a false negative ships "door" to a player.
 *
 * **TSX and HTML take the same route through `textNodes`**, and HTML did not at
 * first. The gap was argued for on the grounds that the only HTML here is the
 * app shell and the legacy page, so nothing fatal could hide in it. That is an
 * argument from what happens to be true today about which files exist, which is
 * the same shape as concluding an absence from a naming assumption. Both kinds
 * wrap their paragraphs and both are now read whole.
 *
 * The per-line pass survives for what genuinely does not wrap: quoted literals
 * and template literals in TS, `content:` in CSS, and the handful of HTML
 * attributes a reader sees.
 */
export function extractUiStrings(file: SourceFile): UiString[] {
  const out: UiString[] = []
  const lines = file.text.split(/\r?\n/)

  let inBlockComment = false
  let inScriptOrStyle = false
  let inTemplate = false

  /**
   * The file with comments and quoted literals blanked, one entry per line.
   *
   * Built by the same walk that reads the literals, because that walk already
   * knows which quote is inside a comment and which slash is inside a string.
   * Only the newlines have to survive: line numbers are counted off them, and
   * nothing reads a column.
   */
  const masked: string[] = []

  lines.forEach((raw, i) => {
    const line = raw
    const at = i + 1
    const add = (text: string) => {
      const trimmed = text.trim()
      if (trimmed) out.push({ line: at, text: trimmed })
    }

    if (file.kind === 'html') {
      let rest = line

      /* A script or style block, or a comment, carries across lines. Pick up
       * again after the closing tag, since text after it is copy again.
       *
       * **A skipped line still pushes an empty string.** `textNodes` counts
       * line numbers off the newlines in `masked`, so a line that contributes
       * nothing has to contribute a blank one: dropping it entirely reported
       * the two findings in the legacy page at lines 101 and 232 instead of
       * 1106 and 1362, which is a report that sends somebody to the wrong
       * place while looking exactly as confident. */
      if (inScriptOrStyle) {
        const close = rest.match(/<\/(script|style)>/i)
        if (!close) {
          masked.push('')
          return
        }
        inScriptOrStyle = false
        rest = rest.slice((close.index ?? 0) + close[0].length)
      }
      if (inBlockComment) {
        const close = rest.indexOf('-->')
        if (close === -1) {
          masked.push('')
          return
        }
        inBlockComment = false
        rest = rest.slice(close + 3)
      }

      // Blocks that open and close on this line drop out whole.
      rest = rest.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')

      // Anything still open runs on to a later line.
      const opening = rest.match(/<(script|style)\b[^>]*>/i)
      if (opening) {
        inScriptOrStyle = true
        rest = rest.slice(0, opening.index ?? 0)
      }
      const commentAt = rest.indexOf('<!--')
      if (commentAt !== -1) {
        inBlockComment = true
        rest = rest.slice(0, commentAt)
      }

      // Attributes a reader sees, read per line because an attribute does not
      // wrap. The text between the tags goes to `textNodes` over the whole file
      // instead: a hand-authored page wraps its paragraphs exactly like a
      // formatted one, and reading them a line at a time had the same blind
      // spot it had in TSX.
      for (const m of rest.matchAll(/\b(?:title|alt|aria-label|placeholder|content)\s*=\s*"([^"]*)"/gi)) {
        add(m[1] ?? '')
      }
      masked.push(rest)
      return
    }

    if (file.kind === 'css') {
      for (const m of line.matchAll(/content\s*:\s*["']([^"']*)["']/g)) add(m[1] ?? '')
      return
    }

    // TypeScript and TSX. Walk the line so a quote inside a comment, and a
    // slash inside a string, both behave. Everything the walk swallows is
    // blanked out of `keep`, which is what `textNodes` reads afterwards.
    let text = ''
    let keep = ''
    for (let c = 0; c < line.length; c += 1) {
      const ch = line[c]
      const next = line[c + 1]

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false
          c += 1
        }
        continue
      }
      if (inTemplate) {
        if (ch === '\\') {
          c += 1
          continue
        }
        if (ch === '`') {
          inTemplate = false
          add(text)
          text = ''
          continue
        }
        text += ch
        continue
      }
      if (ch === '/' && next === '/') break
      if (ch === '/' && next === '*') {
        inBlockComment = true
        c += 1
        continue
      }
      if (ch === '`') {
        inTemplate = true
        text = ''
        continue
      }
      if (ch === '"' || ch === "'") {
        const quote = ch
        let literal = ''
        c += 1
        while (c < line.length && line[c] !== quote) {
          if (line[c] === '\\') c += 1
          else literal += line[c]
          c += 1
        }
        add(literal)
        continue
      }
      keep += ch
    }
    masked.push(keep)
  })

  /* Text nodes, over the whole file at once rather than line by line. A
   * wrapped paragraph is one sentence to a reader, so it has to be one string
   * here. `textNodes` explains what that cost before it was fixed. CSS pushes
   * nothing into `masked`, so this is a no-op there. */
  out.push(...textNodes(masked.join('\n')))

  return out
}

export function checkVocabulary(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  const hits: { file: SourceFile; line: number; text: string; use: string; internal: string }[] = []

  for (const file of bundle.sources) {
    const lines = file.text.split(/\r?\n/)
    for (const found of extractUiStrings(file)) {
      if (escaped(lines, found, VOCAB_ESCAPE)) continue
      for (const banned of BANNED_WORDS) {
        if (banned.pattern.test(found.text)) {
          hits.push({ file, line: found.line, text: found.text, use: banned.use, internal: banned.internal })
          break
        }
      }
    }
  }

  const describe = (h: (typeof hits)[number]) =>
    `${h.file.path}:${h.line}  say "${h.use}", not "${h.internal}"  ${h.text.slice(0, 70)}`

  if (hits.length) {
    out.push(fail('vocabulary', `${hits.length} UI strings use an internal word`, cap(hits.map(describe))))
  }
  if (!hits.length && bundle.sources.length) {
    out.push(info('vocabulary', `${bundle.sources.length} source files carry no internal word in a UI string`))
  }
  return out
}

// ---------------------------------------------------------------------------
// 5b. Retired claims. Sentences the tool used to make and no longer may.
// ---------------------------------------------------------------------------

/**
 * The mistake this exists to stop, which has now happened five times.
 *
 * A sentence that is true about the architecture gets written into copy. The
 * architecture changes. **The sentence stays**, because nothing connects the two
 * and the person writing the next screen has no reason to go looking. "There is
 * no account and no server" outlived the server by weeks and was found by hand
 * five separate times: on the About page, in Settings, in the Builds empty
 * state, in a changelog entry, and finally on the landing page, where it was the
 * headline under the way in.
 *
 * Prose in `CLAUDE.md` did not prevent any of those, because nobody is reading
 * `CLAUDE.md` at the moment they write a sentence. A build failure is read at
 * exactly that moment, which is the whole argument for this being here rather
 * than in a document.
 *
 * **Adding to this list is part of retiring a claim.** When a promise stops
 * being true, it goes here in the same commit that makes it false, and the build
 * then refuses to ship until every copy of it is gone.
 */
export const RETIRED_CLAIMS: {
  pattern: RegExp
  claim: string
  since: string
  instead: string
}[] = [
  {
    pattern: /\bno account\b/i,
    claim: 'no account',
    since: '4 September 2026',
    instead: 'an account is how the tool is meant to be used, and it is free',
  },
  {
    pattern: /\bnothing to install\b/i,
    claim: 'nothing to install',
    since: '4 September 2026',
    instead: 'true, and it travelled with the line above, so it went too',
  },
  {
    pattern: /\bno server\b/i,
    claim: 'no server',
    since: '2 September 2026',
    instead: 'there is a Worker and a D1 behind /api/*',
  },
  {
    pattern: /\bdoes not sync\b/i,
    claim: 'does not sync',
    since: '4 September 2026',
    instead: 'state/sync.ts carries everything between devices',
  },
  {
    pattern: /\b(is )?not a backup\b/i,
    claim: 'not a backup',
    since: '4 September 2026',
    instead: 'an account holds a copy of your library',
  },
  {
    pattern: /\bnothing is tracked\b/i,
    claim: 'nothing is tracked',
    since: '4 September 2026',
    instead: 'runs against a build you took are counted toward that build',
  },
  {
    /* The other half of the same sentence, which was "Nothing is tracked and
     * nothing is measured about you". Listed separately because either half
     * stands on its own and somebody rewriting the paragraph will keep one. */
    pattern: /\bnothing is measured\b/i,
    claim: 'nothing is measured',
    since: '4 September 2026',
    instead: 'a run against a build you took is counted, and Settings can stop it',
  },
]

/**
 * A reprieve, for the case where the phrase is genuinely right.
 *
 * On the line, for a string literal. For a JSX paragraph the formatter wrapped,
 * anywhere from the opening tag to the closing one, which in practice means a
 * JSX comment after the closing tag. Not before the opening one: a comment
 * there ends the text node early and the paragraph stops being read at all,
 * which is not the same as excusing it and would quietly excuse whatever
 * somebody writes there next.
 */
export const CLAIM_ESCAPE = 'retired-claim-ok'

/**
 * A changelog entry is a record of what shipped, and rewriting it to match the
 * present is how a changelog stops being worth reading. So entries **dated
 * before** a claim was retired keep their wording. Anything written after has no
 * excuse, and this reads the dates in the file rather than exempting it whole.
 */
function changelogDateAt(file: SourceFile, line: number): number | null {
  if (!file.path.endsWith('data/changelog.ts')) return null
  const lines = file.text.split(/\r?\n/)
  for (let at = line - 1; at >= 0; at--) {
    const found = /date:\s*'(\d{4}-\d{2}-\d{2})'/.exec(lines[at] ?? '')
    if (found?.[1]) return Date.parse(found[1])
  }
  return null
}

export function checkRetiredClaims(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  const hits: { file: SourceFile; line: number; text: string; claim: string; instead: string }[] = []

  for (const file of bundle.sources) {
    const lines = file.text.split(/\r?\n/)
    for (const found of extractUiStrings(file)) {
      if (escaped(lines, found, CLAIM_ESCAPE)) continue

      for (const retired of RETIRED_CLAIMS) {
        if (!retired.pattern.test(found.text)) continue

        // A changelog entry from before the retirement is history, not a claim.
        const dated = changelogDateAt(file, found.line)
        if (dated !== null && dated < Date.parse(retired.since)) break

        hits.push({
          file,
          line: found.line,
          text: found.text,
          claim: retired.claim,
          instead: retired.instead,
        })
        break
      }
    }
  }

  const describe = (h: (typeof hits)[number]) =>
    `${h.file.path}:${h.line}  "${h.claim}" was retired. ${h.instead}  ${h.text.slice(0, 60)}`

  if (hits.length) {
    out.push(
      fail('retired claims', `${hits.length} UI strings make a claim the tool no longer may`, [
        ...cap(hits.map(describe)),
        `Add ${CLAIM_ESCAPE} to the line if the phrase is genuinely right in context, and say why.`,
      ]),
    )
  }
  if (!hits.length && bundle.sources.length) {
    out.push(
      info('retired claims', `no UI string repeats any of the ${RETIRED_CLAIMS.length} retired claims`),
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// 6. Roster. DESIGN.md 3.1: do not hard-code who exists. The extractor emits
//    the roster and the validator checks the app has not grown an assumption.
// ---------------------------------------------------------------------------

/**
 * Gods, from the loot data, with inheritance resolved.
 *
 * GodLoot decides whether a god counts toward MaxGodsPerRun, and it is
 * inherited: Poseidon and Zeus never state it and pick up true from BaseLoot,
 * while Hermes and Chaos state false outright and Selene's SpellDrop inherits
 * from nothing at all. Reading the flag without following InheritFrom would
 * drop two Olympians.
 */
export function rosterFromLoot(loot: Dict): { gods: string[]; olympians: string[] } {
  // Flatten to record name -> record, since InheritFrom names records.
  const records = new Map<string, Dict>()
  const owner = new Map<string, string>()
  for (const [setName, set] of Object.entries(loot)) {
    for (const [recordName, record] of Object.entries(dictOf(set))) {
      if (!isDict(record)) continue
      records.set(recordName, record)
      owner.set(recordName, setName)
    }
  }

  const godLootOf = (recordName: string, seen = new Set<string>()): boolean => {
    if (seen.has(recordName)) return false
    seen.add(recordName)
    const record = records.get(recordName)
    if (!record) return false
    if (typeof record.GodLoot === 'boolean') return record.GodLoot
    for (const parent of stringsOf(record.InheritFrom)) {
      if (records.has(parent) && godLootOf(parent, seen)) return true
    }
    return false
  }

  // Speaker is the discriminator, not Traits. The shared WeaponUpgrade pool
  // holds 92 traits and has no Speaker, and Selene has a Speaker and no Traits
  // because her Hexes are declared in TraitData_Spell instead.
  const gods: string[] = []
  const olympians: string[] = []
  for (const [recordName, record] of records) {
    if (typeof record.Speaker !== 'string') continue
    const setName = owner.get(recordName) ?? recordName
    if (!gods.includes(setName)) gods.push(setName)
    if (godLootOf(recordName) && !olympians.includes(setName)) olympians.push(setName)
  }
  return { gods: gods.sort(), olympians: olympians.sort() }
}

export function checkRoster(bundle: Bundle): Finding[] {
  const loot = generatedData(bundle, 'loot')
  if (!Object.keys(loot).length) return []

  const { gods, olympians } = rosterFromLoot(loot)
  const out: Finding[] = [
    info('roster', `${olympians.length} Olympians count toward the cap, out of ${gods.length} gods with a loot set`, [
      `Olympian: ${olympians.join(', ')}`,
      `Offers boons but does not count: ${gods.filter((g) => !olympians.includes(g)).join(', ') || 'none'}`,
    ]),
  ]

  // An app file naming three or more of them has grown a roster of its own.
  const names = new Set(gods.map((g) => g.toLowerCase()))
  for (const file of bundle.sources) {
    if (file.kind !== 'ts' && file.kind !== 'tsx') continue
    if (file.text.includes(VOCAB_ESCAPE)) continue
    const mentioned = new Set<string>()
    for (const found of extractUiStrings(file)) {
      const key = found.text.trim().toLowerCase()
      if (names.has(key)) mentioned.add(key)
    }
    if (mentioned.size >= 3) {
      out.push(
        fail('roster', `${file.path} names ${mentioned.size} gods as string literals`, [
          [...mentioned].join(', '),
          'Read the roster from data/generated/loot.json instead. DESIGN.md 3.1.',
        ]),
      )
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 7. Curated records. REQUIREMENTS.md 9 and DESIGN.md 2.2 and 5.
//    Schema breaks fail. Orphans are reported, never silently dropped.
// ---------------------------------------------------------------------------

/**
 * Where a curated record comes from, and the three are not equal.
 *
 * `source` traces to a named symbol in the game's Lua and is a fact. `wiki` is
 * a lead somebody verified. `curator` is a judgement and the owner's to make.
 *
 * `source` was added when the first rule pack landed: every rule in it is
 * derived from the game's own tables, and calling that `curator` would have
 * filed a fact as an opinion, which is the exact confusion CLAUDE.md's order of
 * authority exists to prevent.
 */
const CURATED_SOURCES = ['source', 'curator', 'wiki']

export function checkCurated(bundle: Bundle): Finding[] {
  if (!bundle.curated.length) {
    return [
      info('curated', 'no curated files yet', [
        'data/curated/ holds what the game cannot state: ratings, tags, archetypes, rule packs.',
      ]),
    ]
  }

  const out: Finding[] = []
  const knownIds = new Set([
    ...Object.keys(generatedData(bundle, 'traits')),
    ...Object.keys(generatedData(bundle, 'arcana-cards')),
  ])

  for (const file of bundle.curated) {
    const doc = dictOf(file.json)

    if (!Array.isArray(doc.knownGaps)) {
      out.push(
        fail('curated', `${file.path} has no knownGaps array`, [
          'A gap recorded in chat is a gap nobody reads again. CLAUDE.md.',
        ]),
      )
    }

    const records = Array.isArray(doc.records) ? doc.records : []
    if (!Array.isArray(doc.records)) {
      out.push(fail('curated', `${file.path} has no records array`))
      continue
    }

    const orphans: string[] = []
    records.forEach((entry, i) => {
      const record = dictOf(entry)
      const at = `${file.path} records[${i}]`
      const id = record.id

      if (typeof id !== 'string' || !id) {
        out.push(fail('curated', `${at} has no id`))
        return
      }
      if (!Array.isArray(record.aliases)) {
        out.push(
          fail('curated', `${at} (${id}) has no aliases array`, [
            'Every record carries one so a rename keeps saved runs resolving. REQUIREMENTS.md 9.',
          ]),
        )
      }
      if (record.source !== undefined && !CURATED_SOURCES.includes(String(record.source))) {
        out.push(
          fail('curated', `${at} (${id}) has source "${String(record.source)}"`, [
            `Only ${CURATED_SOURCES.join(' or ')} is allowed. Our opinions never look like sourced facts.`,
          ]),
        )
      }
      // A rule that cannot explain itself is a score nobody should trust.
      const isRule = record.delta !== undefined || record.when !== undefined || record.match !== undefined
      if (isRule && (typeof record.say !== 'string' || !record.say.trim())) {
        out.push(
          fail('curated', `${at} (${id}) is a rule with no say`, [
            'DESIGN.md 5: the Exit UI renders the sentence, not the number.',
          ]),
        )
      }
      // A rule's id is its own name, not a trait's. Only records that claim to
      // be about something generated get checked against it, or every rule in
      // a rule pack reports as an orphan and the warning stops meaning
      // anything.
      if (!isRule && knownIds.size && !knownIds.has(id) && !stringsOf(record.aliases).some((a) => knownIds.has(a))) {
        orphans.push(id)
      }
    })

    if (orphans.length) {
      out.push(
        warn('curated', `${orphans.length} records in ${file.path} resolve to nothing generated`, [
          ...cap(orphans),
          'Reported, not dropped. A renamed id belongs in that record aliases array.',
        ]),
      )
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// 8. Control characters in source. Same family as the charset check below: an
//    encoding fault that every other gate passes.
// ---------------------------------------------------------------------------

/**
 * A control character where a character was meant.
 *
 * Three of these got into source in one session, all from one mistake: a CSS
 * unicode escape written inside a non-raw Python string, where a backslash
 * followed by digits is an octal escape. The file ended up holding a single NUL
 * byte instead of the five characters of the escape.
 *
 * What it cost: a separator rendered as a diamond and the characters "b7" on
 * a build card, and a React key that was a NUL. Neither was caught by the
 * typecheck, the tests or the build. The first was found by reading a
 * screenshot, the second only by sweeping for it afterwards, and the third was
 * written into the docblock explaining the other two.
 *
 * That is the same shape as the charset bug below, which is why this sits
 * beside it: a fault that renders wrong, passes everything automated, and needs
 * a human eye or a rule like this one.
 */
export function checkControlChars(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  // Tab, newline and carriage return are the legitimate ones.
  const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]', 'g')

  for (const file of bundle.sources) {
    const matches = [...file.text.matchAll(CONTROL)]
    if (!matches.length) continue
    const at = matches[0]?.index ?? 0
    const line = file.text.slice(0, at).split('\n').length
    const code = file.text.charCodeAt(at).toString(16).toUpperCase().padStart(4, '0')
    out.push({
      check: 'control characters',
      severity: 'fail',
      message: `${file.path}:${line} holds U+${code}`,
      detail: [
        `${matches.length} control character${matches.length === 1 ? '' : 's'} in this file.`,
        'A NUL is usually a unicode escape that a generator read as an octal one.',
      ],
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// 9. The charset meta. A missing one mangled every interpunct on the live site,
//    and it is invisible to a DOM query. Cheap to check, so check it forever.
// ---------------------------------------------------------------------------

export function checkCharset(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  for (const file of bundle.sources) {
    if (file.kind !== 'html') continue
    const metas = [...file.text.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0])
    const first = metas[0]
    if (!first || !/charset\s*=\s*["']?utf-8/i.test(first)) {
      const finding = first
        ? `${file.path} first meta is not the charset: ${first.slice(0, 60)}`
        : `${file.path} has no meta tags at all`
      out.push(fail('charset', finding))
    }
  }
  if (!out.length) out.push(info('charset', 'every page opens with <meta charset="utf-8">'))
  return out
}

// ---------------------------------------------------------------------------
// 9. Assets. Build order step 3: every trait has an icon or is listed in
//    knownGaps, and the gap count is reported against assets/manifest.json.
// ---------------------------------------------------------------------------

/** knownGaps and overrides, read out of data/curated/icons.json if it exists. */
export function iconCuration(bundle: Bundle): { gaps: Set<string>; overrides: IconOverrides } {
  const gaps = new Set<string>()
  const overrides: IconOverrides = new Map()

  for (const file of bundle.curated) {
    if (!file.path.endsWith('icons.json')) continue
    const doc = dictOf(file.json)
    for (const gap of Array.isArray(doc.knownGaps) ? doc.knownGaps : []) {
      // A gap is a trait id, or a record naming one and saying why.
      if (typeof gap === 'string') gaps.add(gap)
      else if (isDict(gap) && typeof gap.id === 'string') gaps.add(gap.id)
    }
    for (const record of Array.isArray(doc.records) ? doc.records : []) {
      const rec = dictOf(record)
      if (typeof rec.id === 'string' && typeof rec.asset === 'string') overrides.set(rec.id, rec.asset)
    }
  }
  return { gaps, overrides }
}

export function checkAssets(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  const traits = generatedData(bundle, 'traits')
  if (!Object.keys(traits).length) return out

  if (!bundle.manifest) {
    return [fail('assets', 'no assets/manifest.json', ['Write one with npm run assets'])]
  }

  // 1. The manifest has to describe the directory. It went stale once already,
  //    when the wiki Arcana were replaced with game art and nothing rewrote it.
  const onDisk = new Set(bundle.assetFiles)
  const inManifest = new Set((bundle.manifest.assets ?? []).map((entry) => entry.file))
  const vanished = [...inManifest].filter((file) => !onDisk.has(file))
  const unlisted = [...onDisk].filter((file) => !inManifest.has(file))

  if (vanished.length) {
    out.push(
      fail('assets', `${vanished.length} manifest entries name a file that is not on disk`, [
        ...cap(vanished),
        'Rebuild it with npm run assets.',
      ]),
    )
  }
  if (unlisted.length) {
    out.push(
      fail('assets', `${unlisted.length} images on disk are not in the manifest`, [
        ...cap(unlisted),
        'Rebuild it with npm run assets.',
      ]),
    )
  }

  // 2. One slug, one image. Two categories holding the same slug means one
  //    shadows the other and which one wins is decided by sort order, which is
  //    no way to decide anything. It hid four Black Coat aspects behind wiki
  //    copies filed under hammers/.
  const bySlug = new Map<string, { file: string; sha256: string }[]>()
  for (const entry of bundle.manifest.assets ?? []) {
    if (typeof entry?.id !== 'string' || typeof entry.file !== 'string') continue
    const copies = bySlug.get(entry.id) ?? []
    copies.push({ file: entry.file, sha256: typeof entry.sha256 === 'string' ? entry.sha256 : '' })
    bySlug.set(entry.id, copies)
  }
  const shadowed = [...bySlug.entries()].filter(([, copies]) => copies.length > 1)
  // Two files under one slug, same bytes, is the same picture shelved twice.
  // Two files under one slug with different bytes is a coin toss decided by
  // sort order, which is what hid four Black Coat aspects behind wiki copies.
  const sameBytes = shadowed.filter(([, copies]) => new Set(copies.map((c) => c.sha256)).size === 1)
  const differentBytes = shadowed.filter(([, copies]) => new Set(copies.map((c) => c.sha256)).size > 1)

  if (differentBytes.length) {
    out.push(
      warn('assets', `${differentBytes.length} slugs are claimed by two different images`, [
        ...cap(differentBytes.map(([slug, copies]) => `${slug}: ${copies.map((c) => c.file).join(', ')}`)),
        'The first by path wins, which is no way to decide. Rename or remove the loser.',
      ]),
    )
  }
  if (sameBytes.length) {
    out.push(
      info('assets', `${sameBytes.length} images are shelved in two categories, byte for byte the same`, [
        ...cap(sameBytes.map(([slug, copies]) => `${slug}: ${copies.map((c) => c.file).join(', ')}`)),
      ]),
    )
  }

  // 3. Every trait a run can offer has art, or a recorded reason it does not.
  const names = generatedData(bundle, 'text-traits')
  const { gaps, overrides } = iconCuration(bundle)
  const index = buildIconIndex(bundle.manifest)

  const offerable = offerableTraits(traits, generatedData(bundle, 'loot'))
  const aspects = aspectTraits(traits)
  const missing: string[] = []
  const recorded: string[] = []
  const matched = { offerable: 0, aspects: 0 }

  const groups: [string, string[], 'offerable' | 'aspects'][] = [
    ['offerable', offerable, 'offerable'],
    ['aspect', aspects, 'aspects'],
  ]

  for (const [label, ids, counter] of groups) {
    for (const id of ids) {
      const displayName = dictOf(names[id]).name
      const name = typeof displayName === 'string' ? displayName : null
      const weapon = dictOf(traits[id]).RequiredWeapon
      const keys = name && typeof weapon === 'string' ? aspectIconKeys(name, weapon) : []

      const found = resolveIcon(id, name, index, { overrides, keys })
      if (found.found) matched[counter] += 1
      else if (gaps.has(id)) recorded.push(id)
      else missing.push(`${label}  ${id}  "${name ?? '(no display name)'}"  ${found.why}`)
    }
  }

  out.push(
    info(
      'assets',
      `${matched.offerable} of ${offerable.length} offerable traits and ${matched.aspects} of ${aspects.length} weapon aspects have art, ${recorded.length} gaps recorded, ${bundle.assetFiles.length} images in the library`,
    ),
  )

  if (missing.length) {
    out.push(
      fail('assets', `${missing.length} traits have neither art nor a recorded gap`, [
        ...cap(missing),
        'Fill them with npm run assets -- --fill, or record them in data/curated/icons.json knownGaps.',
      ]),
    )
  }

  // An id in knownGaps that now resolves is a gap someone quietly closed.
  const stale = [...gaps].filter((id) => {
    const displayName = dictOf(names[id]).name
    const name = typeof displayName === 'string' ? displayName : null
    const weapon = dictOf(traits[id]).RequiredWeapon
    const keys = name && typeof weapon === 'string' ? aspectIconKeys(name, weapon) : []
    return resolveIcon(id, name, index, { overrides, keys }).found
  })
  if (stale.length) {
    out.push(
      warn('assets', `${stale.length} recorded gaps now have art`, [...cap(stale), 'Remove them from data/curated/icons.json.']),
    )
  }

  return out
}

// ---------------------------------------------------------------------------

export function runAllChecks(bundle: Bundle): Finding[] {
  return [
    ...checkProvenance(bundle),
    ...checkReferences(bundle),
    ...checkClassification(bundle),
    ...checkCounts(bundle),
    ...checkVocabulary(bundle),
    ...checkRetiredClaims(bundle),
    ...checkRoster(bundle),
    ...checkCurated(bundle),
    ...checkAssets(bundle),
    ...checkControlChars(bundle),
    ...checkCharset(bundle),
    ...checkRoadmap(bundle),
  ]
}

// ---------------------------------------------------------------------------
// 12. The user-facing roadmap, held to the code it describes.
// ---------------------------------------------------------------------------

/**
 * Every roadmap entry names a file, and the file's existence must match the
 * stage.
 *
 * **`src/data/roadmap.ts` has gone false twice and nothing could tell.** It
 * says what the tool does, nothing imports it for behaviour, so no test and no
 * type can fail when a claim stops being true. The first round put the exchange
 * and device sync under "Intended, but not started" while both were live; the
 * correction for that is item 4a in `ROADMAP.md`. Within a day of it, the
 * exchange gained following, offers, takedowns and per-version counts, and the
 * entry still described taking a copy.
 *
 * The rule is symmetric, and the second half is the one that keeps catching
 * things: **a built thing's file must exist, and a planned one's must not.**
 * Something shipping without its entry moving is the exact failure both times.
 *
 * It reads `bundle.sources`, which already holds every non-test file under
 * `src/`, so this check needed no new plumbing. That is also why a proof has to
 * be a path under `src/`: a claim resting on a file the validator cannot see
 * would pass for the wrong reason.
 *
 * **A null proof is allowed and has to be argued for**, because some claims are
 * not about whether a file exists. "The library ships empty" is about the
 * contents of `SAMPLE_BUILDS`. "Whether a build is strong is not in any file"
 * is a standing refusal that no file will ever prove. Those carry `why`, so an
 * unprovable entry is a decision rather than an omission, the same shape as
 * `NO_ART` in `build-filter.icons.test.ts`.
 */
export function checkRoadmap(bundle: Bundle): Finding[] {
  const out: Finding[] = []
  const has = new Set(bundle.sources.map((file) => file.path))

  for (const entry of ROADMAP) {
    if (entry.proof === null) {
      if (!entry.why?.trim()) {
        out.push(
          fail('roadmap', `"${entry.title}" has no proof and no reason given for having none`),
        )
      }
      continue
    }

    if (!entry.proof.startsWith('src/')) {
      out.push(
        fail(
          'roadmap',
          `"${entry.title}" names ${entry.proof}, which is outside src/ and so outside what this check can see`,
        ),
      )
      continue
    }

    const exists = has.has(entry.proof)
    if (entry.stage === 'now' && !exists) {
      out.push(
        fail('roadmap', `"${entry.title}" is listed as built, but ${entry.proof} does not exist`),
      )
    }
    if (entry.stage !== 'now' && exists) {
      out.push(
        fail(
          'roadmap',
          `"${entry.title}" is listed as ${entry.stage}, but ${entry.proof} exists. Built things belong under "now"`,
        ),
      )
    }
  }

  if (!out.length) {
    const proven = ROADMAP.filter((one) => one.proof !== null).length
    out.push(
      info('roadmap', `${proven} of ${ROADMAP.length} roadmap entries prove their stage, ${ROADMAP.length - proven} argue why they cannot`),
    )
  }
  return out
}
