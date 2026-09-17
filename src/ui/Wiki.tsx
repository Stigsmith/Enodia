/**
 * The wiki: every named thing the tool knows, a record for each at an address
 * of its own, and an index of them all.
 *
 * **This reverses a non-goal, on the owner's call.** `REQUIREMENTS.md` 4 said
 * "Not a wiki", and on 11 September 2026 the owner chose records and an index.
 * What makes it worth having beside the community wikis is where it comes
 * from: every sentence and number is read out of the game's own files and
 * regenerated on a patch, and the facts the game never states, what a duo
 * needs and what a boon counts toward and how Poms treat it, are derived from
 * those same files.
 *
 * ## The two registers
 *
 * A record opens with the game's own words: its description and its stat lines,
 * drawn exactly as the hover and the dialog draw them. Everything under that is
 * the tool's, set as a list of labelled facts so it never reads as the game
 * talking. A fact with nothing to say is left out rather than printed as a
 * blank, which is `REQUIREMENTS.md` 10's rule that silence is the normal state.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { arcanaById, familiarById, gameVersion, iconOf, olympianList, traits, weaponById } from '../data/app.ts'
import { keepsakesOf } from '../data/builds.ts'
import type { Requirement, Trait, TraitId } from '../data/types.ts'
import { loadBuilds } from '../state/builds.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import { ElementWord } from './Elements.tsx'
import { OdysseusStand } from './Figures.tsx'
import { Page } from './Pages.tsx'
import { StatLines } from './StatLines.tsx'
import { WikiLink } from './WikiLink.tsx'
import { prerequisiteFor, wikiSections } from './wiki-index.ts'
import type { WikiEntry, WikiSection } from './wiki-index.ts'
import type { WikiAt } from './wiki-route.ts'

export function Wiki({ at }: { at: WikiAt }) {
  const top = useRef<HTMLDivElement | null>(null)

  /* A record opens at its top, not wherever the last page was scrolled to. The
   * shell scrolls itself rather than the document, so it is the shell that
   * moves. */
  useEffect(() => {
    top.current?.closest('.shell')?.scrollTo?.(0, 0)
  }, [at])

  return (
    <div ref={top}>
      {/* Odysseus, directly before what makes room for him: `.is-odysseus +
        * .wiki-shelf`. `Figures.tsx` says why. */}
      <OdysseusStand />
      <div className="wiki-shelf">{at ? <Record at={at} /> : <Index />}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

function Index() {
  const sections = useMemo(() => wikiSections(), [])
  const [query, setQuery] = useState('')
  const wanted = query.trim().toLowerCase()

  const shown: WikiSection[] = wanted
    ? sections
        .map((section) => ({
          ...section,
          entries: section.entries.filter((one) => one.name.toLowerCase().includes(wanted)),
        }))
        .filter((section) => section.entries.length)
    : sections
  const total = sections.reduce((n, section) => n + section.entries.length, 0)
  const found = shown.reduce((n, section) => n + section.entries.length, 0)

  return (
    <Page
      measure="broad"
      title="Wiki"
      standfirst={`Everything the tool knows about, ${total} things in all, each with a record of its own. Read out of the game's files, build ${gameVersion}.`}
    >
      <label className="wiki-search">
        <span className="visually-hidden">Find by name</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find by name"
        />
      </label>
      {wanted ? (
        <p className="wiki-found" aria-live="polite">
          {found ? `${found} of ${total}` : 'Nothing by that name.'}
        </p>
      ) : (
        <nav className="wiki-toc" aria-label="Sections">
          {sections.map((section) => (
            <a key={section.id} href={`#wiki-${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
      )}

      {shown.map((section, index) => (
        <section key={section.id} id={`wiki-${section.id}`} className="wiki-section">
          {/* The part's heading goes over the first section in it. */}
          {index === 0 || shown[index - 1]?.part !== section.part ? (
            <h3 className="wiki-part">{section.part}</h3>
          ) : null}
          <h4 className="wiki-title">
            {section.title}
            <span className="wiki-count">{section.entries.length}</span>
          </h4>
          <ul className="wiki-entries">
            {section.entries.map((one) => (
              <li key={`${one.at.kind}:${one.at.id}`}>
                <EntryLink entry={one} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  )
}

function EntryLink({ entry }: { entry: WikiEntry }) {
  return (
    <WikiLink at={entry.at} className="wiki-entry">
      {entry.icon ? (
        <img src={`/${entry.icon}`} alt="" loading="lazy" />
      ) : (
        <span className="wiki-stub" aria-hidden="true">
          {entry.name.slice(0, 1)}
        </span>
      )}
      <span className="wiki-entry-text">
        <span className="wiki-entry-name">{entry.name}</span>
        {entry.sub ? <span className="wiki-entry-sub">{entry.sub}</span> : null}
      </span>
    </WikiLink>
  )
}

// ---------------------------------------------------------------------------
// A record
// ---------------------------------------------------------------------------

function Record({ at }: { at: NonNullable<WikiAt> }) {
  if (at.kind === 'arcana') return <ArcanaRecord id={at.id} />
  if (at.kind === 'familiar') return <FamiliarRecord id={at.id} />
  return <TraitRecord id={at.id} />
}

/** Back to the index, over every record. */
function BackToIndex() {
  return (
    <p className="wiki-back">
      <WikiLink at={null}>The whole wiki</WikiLink>
    </p>
  )
}

function Missing() {
  return (
    <div className="wiki-record">
      <BackToIndex />
      <h2 className="wiki-name">Nothing here by that name</h2>
      <p className="wiki-text">
        The address names nothing in game build {gameVersion}. A patch can rename what the game
        calls a thing, and the index has everything it holds now.
      </p>
    </div>
  )
}

/** A trait's name as a link to its own record. */
function TraitName({ id }: { id: TraitId }) {
  const trait = traits.get(id)
  return <WikiLink at={{ kind: 'trait', id }}>{trait?.name ?? id}</WikiLink>
}

/** A list of trait names, each a link, joined the way a sentence joins them. */
function TraitList({ ids, last = 'and' }: { ids: TraitId[]; last?: string }) {
  return (
    <>
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 ? (index === ids.length - 1 ? ` ${last} ` : ', ') : null}
          <TraitName id={id} />
        </span>
      ))}
    </>
  )
}

/** A prerequisite, the two forms `TraitRequirements` states. */
function Needs({ rule }: { rule: Requirement }) {
  if ('oneOf' in rule) {
    return (
      <>
        Any one of <TraitList ids={rule.oneOf} last="or" />.
      </>
    )
  }
  return (
    <>
      One from each of these:
      <ul className="wiki-sets">
        {rule.oneFromEachSet.map((set) => (
          <li key={set.join('|')}>
            <TraitList ids={set} last="or" />
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * How Poms treat a trait, where `stacking.json` states a curve.
 *
 * The words follow `describeCurve` in `scripts/extract.mjs`: each extra level
 * is worth half the one before until it is down to a tenth of the boon's own
 * base value, and `upTo` is how many levels come before that floor.
 */
function pomLine(stack: NonNullable<Trait['stack']>): string {
  const one = (curve: { shape: string; upTo: number | null }): string | null => {
    switch (curve.shape) {
      case 'floors':
        return `worth Poms up to Lv. ${curve.upTo}, and after that each one adds a tenth of its base value`
      case 'immediate':
        return 'down to a tenth of its base value from the second level, so a Pom adds little'
      case 'none':
        return 'unchanged by Poms: a second level adds nothing'
      case 'converges':
        return 'changed by less with every Pom, with no level where that stops'
      case 'linear':
        return 'raised the same amount by every Pom'
      default:
        return null
    }
  }
  const said = stack.map(one).filter((line): line is string => line !== null)
  if (!said.length) return ''
  if (said.length === 1) return `${said[0]?.charAt(0).toUpperCase()}${said[0]?.slice(1)}.`
  return `Its values do not stack alike. One is ${said.join('; another is ')}.`
}

function TraitRecord({ id }: { id: TraitId }) {
  const trait = traits.get(id)
  const mine = useMemo(
    () =>
      loadBuilds().filter((build) =>
        [
          build.aspect,
          build.centrepiece,
          ...build.boons,
          ...(build.optional ?? []),
          build.hex,
          ...build.hammers,
          ...keepsakesOf(build),
        ].includes(id),
      ),
    [id],
  )
  if (!trait?.name) return <Missing />

  const slot = trait.slot && CORE_SLOTS.includes(trait.slot) ? slotLabel(trait.slot) : null
  const kind = slot ?? KIND_WORD[trait.kind] ?? null
  const counts = prerequisiteFor(id)
  const appear = trait.needsElements?.appear
  const activate = trait.needsElements?.activate
  const arm = trait.requiredWeapon ? weaponById.get(trait.requiredWeapon)?.arm : null
  const icon = iconOf.get(id)

  return (
    <article className="wiki-record">
      <BackToIndex />
      <header className="wiki-head">
        {icon ? <img className="wiki-art" src={`/${icon}`} alt="" /> : null}
        <div>
          <h2 className="wiki-name">{trait.name}</h2>
          <p className="wiki-line">
            {kind ? <span>{kind}</span> : null}
            {trait.gods.length ? <span>{trait.gods.join(' + ')}</span> : null}
            {arm ? <span>{arm}</span> : null}
            {trait.elements?.map((element) => <ElementWord key={element} element={element} />)}
          </p>
        </div>
      </header>

      {trait.text ? <p className="wiki-text">{trait.text}</p> : <p className="wiki-text is-gap">The game ships no description for this.</p>}
      <StatLines lines={trait.stats} spelled />

      <dl className="wiki-facts">
        {trait.requires ? (
          <div>
            <dt>Needs</dt>
            <dd>
              <Needs rule={trait.requires} />
            </dd>
          </div>
        ) : null}
        {counts.length ? (
          <div>
            <dt>A prerequisite for</dt>
            <dd>
              <TraitList ids={counts} />
            </dd>
          </div>
        ) : null}
        {appear ? (
          <div>
            <dt>Offered once you hold</dt>
            <dd>
              <Elements counts={appear} />
            </dd>
          </div>
        ) : null}
        {activate ? (
          <div>
            <dt>Works once you hold</dt>
            <dd>
              <Elements counts={activate} />
            </dd>
          </div>
        ) : null}
        {trait.needsAspect?.length ? (
          <div>
            <dt>Only offered on</dt>
            <dd>
              <TraitList ids={trait.needsAspect} last="or" />
            </dd>
          </div>
        ) : null}
        {trait.noPoms ? (
          <div>
            <dt>Poms</dt>
            <dd>A Pom never raises it.</dd>
          </div>
        ) : trait.stack?.length && pomLine(trait.stack) ? (
          <div>
            <dt>Poms</dt>
            <dd>{pomLine(trait.stack)}</dd>
          </div>
        ) : null}
        {trait.readsOlympian || trait.olympian?.length ? (
          <div>
            <dt>Olympian damage</dt>
            <dd>
              <OlympianFact trait={trait} />
            </dd>
          </div>
        ) : null}
        {mine.length ? (
          <div>
            <dt>In your builds</dt>
            <dd>{mine.map((build) => build.name).join(', ')}</dd>
          </div>
        ) : null}
      </dl>

      <Source id={id} />
    </article>
  )
}

/** Element counts, "4 Water", with the game's glyph. */
function Elements({ counts }: { counts: Record<string, number> }) {
  return (
    <>
      {Object.entries(counts).map(([element, count], index) => (
        <span key={element} className="wiki-element">
          {index > 0 ? ' and ' : null}
          {count} <ElementWord element={element} />
        </span>
      ))}
    </>
  )
}

/** Where the record came from, so it can be checked against the files. */
/**
 * "Damaging effects from Olympians", which the game states as two lists of
 * names rather than as a set of gods.
 *
 * Three traits read those lists, and the projectile list names Artemis and
 * Athena projectiles, while neither god has a `LootData` entry or spends an
 * Olympian slot. So which gods you hold cannot answer it and each boon's own
 * record has to, which is what `scripts/olympian.ts` traces. It names the
 * projectile rather than asserting the rule, so the claim can be checked.
 */
function OlympianFact({ trait }: { trait: Trait }) {
  const readers = [...traits.values()].filter((one) => one.readsOlympian).map((one) => one.id)

  if (trait.readsOlympian) {
    return (
      <>
        It counts damage on the game&rsquo;s own list, {olympianList.projectiles} projectiles and{' '}
        {olympianList.effects} effects, rather than damage from whichever gods you hold. That list
        includes Artemis and Athena projectiles, and neither of them spends an Olympian slot.
      </>
    )
  }

  return (
    <>
      Its damage comes out of {trait.olympian?.map((name, at) => (
        <span key={name}>
          {at > 0 ? ', ' : null}
          <code>{name}</code>
        </span>
      ))}
      , which the game lists as Olympian damage, so <TraitList ids={readers} /> count it.
    </>
  )
}

function Source({ id }: { id: string }) {
  return (
    <p className="wiki-source">
      Read from the game&rsquo;s own files, build {gameVersion}. Its name there is{' '}
      <code>{id}</code>.
    </p>
  )
}

const KIND_WORD: Record<string, string> = {
  boon: 'Boon',
  duo: 'Duo',
  legendary: 'Legendary',
  hex: 'Godsent Hex',
  aspect: 'Aspect',
  keepsake: 'Keepsake',
}

function ArcanaRecord({ id }: { id: string }) {
  const card = arcanaById.get(id)
  if (!card) return <Missing />
  const conditional = Object.keys(card.requires ?? {}).length > 0
  return (
    <article className="wiki-record">
      <BackToIndex />
      <header className="wiki-head is-card">
        {card.icon ? <img className="wiki-card" src={`/${card.icon}`} alt="" /> : null}
        <div>
          <h2 className="wiki-name">{card.name}</h2>
          <p className="wiki-line">
            <span>Arcana</span>
          </p>
        </div>
      </header>
      {card.text ? <p className="wiki-text">{card.text}</p> : null}
      <dl className="wiki-facts">
        {card.cost ? (
          <div>
            <dt>Grasp</dt>
            <dd>{card.cost}</dd>
          </div>
        ) : null}
        {conditional ? (
          <div>
            <dt>Switches on</dt>
            <dd>By a rule of its own rather than by Grasp. The Arcana board says whether it is met.</dd>
          </div>
        ) : null}
      </dl>
      <Source id={id} />
    </article>
  )
}

function FamiliarRecord({ id }: { id: string }) {
  const one = familiarById.get(id)
  if (!one) return <Missing />
  return (
    <article className="wiki-record">
      <BackToIndex />
      <header className="wiki-head">
        {one.icon ? <img className="wiki-art" src={`/${one.icon}`} alt="" /> : null}
        <div>
          <h2 className="wiki-name">{one.name}</h2>
          <p className="wiki-line">
            <span>Familiar</span>
          </p>
        </div>
      </header>
      {one.text ? <p className="wiki-text">{one.text}</p> : null}
      <Source id={id} />
    </article>
  )
}
