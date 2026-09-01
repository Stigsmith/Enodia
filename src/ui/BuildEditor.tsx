/**
 * The build builder.
 *
 * **It is a form, and the interesting part is that it argues back.**
 * `engine/build-check.ts` runs on every keystroke and says what the game would
 * not allow: two boons in one core slot, a fifth Olympian, an aspect from
 * another arm. Those are the same questions `builds.test.ts` asks of the
 * shipped samples, so a build made here is held to what a sample is held to.
 *
 * It never says a build is *bad*. `CLAUDE.md` is clear that evaluations come
 * from the owner and are in no file, so the checker is mechanical and this
 * screen has no opinion beyond it.
 *
 * ## What it will not do
 *
 * **It will not refuse to save an unfinished build.** A player sketching
 * something they are working towards has a legal, incomplete build, and a form
 * that demanded five Arcana before it would keep anything would be the tool
 * telling them they are using it wrong. Only the impossible blocks a save.
 *
 * ## Everything is chosen from the game's own data
 *
 * Every list here is derived: aspects from the chosen arm, boons from what
 * occupies each slot, hammers from that arm's `sources` entry. There is no way
 * to type an id, so there is no way to save a build naming something that does
 * not exist.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  arcana,
  arcanaById,
  aspectsOf,
  familiars,
  godPools,
  olympians,
  sources,
  traits,
  weapons,
} from '../data/app.ts'

import { ASSEMBLES, PLAYSTYLES } from '../data/builds.ts'
import type { PlayRecord, ShownBuild } from '../data/builds.ts'
import { blankBuild } from '../state/builds.ts'
import { MAX_CARDS, MAX_GRASP, checkBuild, blockers } from '../engine/build-check.ts'
import type { Fix, FixOption, Problem } from '../engine/build-check.ts'
import { FixList } from './FixList.tsx'
import { ratingCeiling, readRepeat } from '../engine/repeat.ts'
import { Stamp } from './Stamp.tsx'
import { FearStepper, Stepper } from './Fear.tsx'

/**
 * The most runs a stepper will count to.
 *
 * Not a rule of anything: a ceiling the arrows need so they can be disabled at
 * the top, and high enough that nobody meets it. Somebody with more than a
 * thousand runs on one build can type the number.
 */
const RUNS_CEILING = 999
import { Tabs, TabPanel } from './Tabs.tsx'
import type { Tab } from './Tabs.tsx'
import { BuildTray } from './BuildTray.tsx'
import { BoonSort } from './BoonSort.tsx'
import type { Tray } from './BoonSort.tsx'
import type { TrayTarget } from './BuildTray.tsx'
import { assemble } from './build-pieces.ts'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import { SLOT_GLYPH } from './build-pieces.ts'
import { Dropdown } from './Dropdown.tsx'
import type { DropdownOption } from './Dropdown.tsx'
import { PickList } from './PickList.tsx'
import { iconOf } from '../data/app.ts'
import type { Slot, TraitId } from '../data/types.ts'

const option = (id: TraitId): DropdownOption => ({
  value: id,
  label: traits.get(id)?.name ?? id,
  icon: iconOf.get(id) ?? null,
})

const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

/**
 * The five tabs, and what each one is carrying.
 *
 * Counts rather than badges: a tab that says 0 tells you the Arcana are empty
 * without a click, which is the whole reason to put a number there. Loadout
 * counts filled core slots out of five, because "3/5" is the one number that
 * says how far from finished a build is.
 */
/**
 * Which tab a problem lives on, so the tray can send you there.
 *
 * `Problem.field` was written to let the form point at the right control, which
 * is the same question one level up now that the controls are on five tabs.
 */
const TAB_FOR: Record<Problem['field'], TrayTarget | 'notes'> = {
  name: 'notes',
  centrepiece: 'notes',
  aspect: 'loadout',
  hex: 'loadout',
  boons: 'boons',
  hammers: 'boons',
  arcana: 'arcana',
}

/**
 * Which tab a problem lives on.
 *
 * **This used to rewrite Notes to Loadout and that was the bug the owner hit.**
 * A build missing its name would send you to Loadout, where there is no name
 * field, because the tray alert's type only allowed the four tabs the tray can
 * draw marks for. The alert is not a mark: it can open any of the five, so it
 * does.
 */
const tabFor = (field: Problem['field']): TrayTarget | 'notes' => TAB_FOR[field]

const TABS = (build: ShownBuild): Tab<TrayTarget | 'notes'>[] => {
  const filled = CORE_SLOTS.filter((slot) =>
    build.boons.some((id) => traits.get(id)?.slot === slot),
  ).length
  const beyond = build.boons.filter((id) => {
    const slot = traits.get(id)?.slot
    return !slot || !CORE_SLOTS.includes(slot)
  }).length

  return [
    { id: 'loadout', label: 'Loadout', count: filled },
    { id: 'boons', label: 'Boons', count: beyond + build.hammers.length },
    { id: 'arcana', label: 'Arcana', count: build.arcana.length },
    { id: 'notes', label: 'Notes' },
    { id: 'play', label: 'Play' },
  ]
}



export function BuildEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: ShownBuild
  onSave: (build: ShownBuild) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}) {
  const firstWeapon = weapons[0]
  const [build, setBuild] = useState<ShownBuild>(
    () => initial ?? blankBuild(firstWeapon?.id ?? '', aspectsOf(firstWeapon?.id ?? '')[0]?.id ?? ''),
  )

  const set = <K extends keyof ShownBuild>(key: K, value: ShownBuild[K]) =>
    setBuild((was) => ({ ...was, [key]: value }))

  /**
   * The play record, patched one field at a time.
   *
   * **Clears is clamped to runs here rather than only on the input**, because
   * lowering runs to below the clears already logged is the other way to make
   * the pair nonsense, and it happens in a different control. `winRate` clamps
   * again when it renders, for storage that never came through this form.
   */
  const setPlay = (patch: Partial<PlayRecord>) =>
    setBuild((was) => {
      const play: PlayRecord = { ...was.play, ...patch }
      const runs = play.runs ?? 0
      if ((play.clears ?? 0) > runs) play.clears = runs
      return { ...was, play }
    })

  const play = build.play

  const problems = checkBuild(build)
  const stopping = blockers(problems)
  // The other question. `checkBuild` says whether the game would allow this;
  // this says whether anybody is going to end a run holding it.
  const repeat = readRepeat(build, traits, olympians)
  /**
   * The most stars this build is allowed to wear.
   *
   * Only a hard stop caps it, and today that is six Olympians or more. Not
   * taste: a build asking for something a run cannot hand over should not be
   * able to look like a recommendation, however much fun the one time was.
   *
   * Everything short of a hard stop keeps all five. A five-star Needs luck
   * build is a real and good thing, and the whole reason the rating and the
   * reading are two separate claims rather than one number.
   */
  const stars = ratingCeiling(repeat)

  /**
   * The caveats a person has to say they have read before they can save.
   *
   * Not the blockers: those already stop a save on their own and there is
   * nothing to acknowledge about a thing you cannot do. These are the ones that
   * are legal, easy to miss, and the reason somebody ends up sharing a build
   * nobody can assemble. `notes` from the checker, plus the reading when it says
   * a lot has to land.
   */
  const caveats = useMemo((): { say: string; fix?: Fix }[] => {
    const out = problems
      .filter((one) => one.severity === 'notes')
      .map((one) => ({ say: one.say, fix: one.fix }))
    if (repeat.hardStop) out.push({ say: repeat.hardStop, fix: undefined })
    else if (repeat.reach === 'needs-luck') {
      out.push({
        say: 'This reads as Needs luck. It is a real build and somebody opening it should know a lot has to land in one run.',
        fix: undefined,
      })
    }
    return out
  }, [problems, repeat.hardStop, repeat.reach])

  /** The sentences alone, which is what the acknowledgement is keyed on. */
  const caveatSays = useMemo(() => caveats.map((one) => one.say), [caveats])

  /**
   * What was acknowledged, as the caveats themselves rather than a boolean.
   *
   * **Keyed to the text on purpose.** A flag would stay ticked while somebody
   * carried on editing, so a person could confirm they had read two caveats,
   * add a sixth Olympian, and save past a warning they never saw. Comparing the
   * list means any change to what is being warned about un-acknowledges it.
   */
  /**
   * The one thing the tray should say, wherever you are in the form.
   *
   * A blocker first, because that is the half that stops a save, then the worst
   * caveat. One only: a list in the sidebar would be the caveats block again in
   * a narrower column, and the point of this is to be the thing you cannot miss
   * rather than the place you read them all.
   *
   * `field` already says which control a problem is about, so the tray can send
   * you to the tab that owns it rather than only telling you something is wrong
   * somewhere.
   */
  const alert = useMemo(() => {
    const worst = stopping[0]
    if (worst) return { say: worst.say, blocking: true, go: tabFor(worst.field), field: worst.field }
    const caveat = caveats[0]
    return caveat ? { say: caveat.say, blocking: false, go: 'play' as const, field: null } : null
  }, [stopping, caveats])

  /**
   * Take one of the options a `Fix` offers.
   *
   * **The displacement happens here rather than being left to the player.** A
   * core boon can only be taken by pushing out whatever holds that slot, and
   * doing half of it would leave the build with two boons in one slot, which is
   * a blocker. The button says what it will replace before it is pressed, so
   * this is carrying out a decision rather than making one.
   */
  const takeFix = (option: FixOption) =>
    setBuild((was) => {
      const boons = was.boons.filter((id) => id !== option.displaces?.id)
      return { ...was, boons: [...boons, option.id] }
    })

  /**
   * Whether the trash button is asking rather than acting.
   *
   * **It used to just fire.** The build menu has had a confirm step since the
   * comment above it was written, recording that delete "fired straight into
   * storage with no confirmation and nothing to undo it". The editor's trash
   * button never got the same treatment, and the owner found it the obvious
   * way: one press and the build was gone.
   */
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [readCaveats, setReadCaveats] = useState<string[]>([])
  const acknowledged =
    caveats.length === 0 ||
    (readCaveats.length === caveats.length && caveatSays.every((one) => readCaveats.includes(one)))

  /** Every trait that can occupy one core slot, for that slot's dropdown. */
  const bySlot = useMemo(() => {
    const map = new Map<Slot, DropdownOption[]>()
    for (const slot of CORE_SLOTS) map.set(slot, [])
    for (const trait of traits.values()) {
      if (trait.kind !== 'boon' || !trait.slot) continue
      const list = map.get(trait.slot)
      if (list) list.push(option(trait.id))
    }
    for (const list of map.values()) list.sort(byName)
    return map
  }, [])


  /**
   * Every boon the sorter can place: what a god actually offers, minus the five
   * core slots, which the slot bar owns.
   *
   * Filtered to the offer pools rather than the whole trait table, so a trait
   * no god hands out cannot be picked and the list adds up to what a run can
   * actually give you.
   *
   * Ids rather than pick options, because `BoonSort` builds its own rows: it
   * needs each trait's kind for the frame and each one's effect on the build
   * for the blocked reason, neither of which a `PickOption` carries.
   */
  const sortable = useMemo(() => {
    const offered = new Set<string>()
    for (const pool of godPools.values()) {
      for (const id of [...pool.priority, ...pool.pool]) offered.add(id)
    }
    return [...offered].filter((id) => {
      const trait = traits.get(id)
      return trait && (!trait.slot || !CORE_SLOTS.includes(trait.slot))
    })
  }, [])

  /**
   * The Arcana, with the ones this board can no longer afford marked.
   *
   * **The editor ignored Grasp entirely** while the Arcana screen enforced it
   * exactly, so the same rule had two answers depending on which screen you
   * were on. Both ceilings are imported from `build-check.ts` rather than
   * restated, so the picker's limit and the checker's failure cannot drift
   * apart: the whole complaint was two screens giving two answers.
   */
  const arcanaOptions = useMemo(() => {
    const spent = build.arcana.reduce((total, id) => total + (arcanaById.get(id)?.cost ?? 0), 0)
    const full = build.arcana.length >= MAX_CARDS

    return arcana.map((card) => {
      const held = build.arcana.includes(card.id)
      const cost = card.cost ?? 0
      let blocked: string | null = null
      if (!held && full) blocked = `Five is as many as a build should name.`
      else if (!held && spent + cost > MAX_GRASP) {
        blocked = `${spent + cost} Grasp, and a save tops out at ${MAX_GRASP}.`
      }
      return { value: card.id, label: card.name, icon: card.icon, note: card.text, blocked }
    })
  }, [build.arcana])

  const hexes = useMemo(
    () =>
      [...traits.values()]
        .filter((trait) => trait.kind === 'hex')
        .map((trait) => option(trait.id))
        .sort(byName),
    [],
  )

  const keepsakes = useMemo(
    () =>
      [...traits.values()]
        .filter((trait) => trait.kind === 'keepsake')
        .map((trait) => option(trait.id))
        .sort(byName),
    [],
  )

  /**
   * The hammer upgrades this build could actually be offered.
   *
   * A hammer's arm lives in `sources`, not on the trait, which is what
   * `build-check.ts` records. **The aspect is a second gate and was missing.**
   * Twenty upgrades across the six arms only appear on one aspect, so a Circe
   * build was being offered Seth's etchings: a hammer no run on that aspect can
   * ever hand you.
   */
  const hammers = useMemo(() => {
    const entry = sources.find((one) => one.kind === 'hammer' && one.weapon === build.weapon)
    return (entry?.traits ?? [])
      .filter((id) => {
        const needs = traits.get(id)?.needsAspect
        return !needs || needs.includes(build.aspect)
      })
      .flatMap((id) => {
        const trait = traits.get(id)
        return trait
          ? [
              {
                value: id,
                label: trait.name ?? id,
                icon: iconOf.get(id) ?? null,
                note: trait.text ?? null,
                // A hammer upgrade is not a boon and has no rarity, but an
                // unframed square in a list of framed ones reads as broken
                // rather than as different.
                rarity: 'Common' as const,
              },
            ]
          : []
      })
      .sort(byName)
  }, [build.weapon, build.aspect])

  const aspects = useMemo(
    () => aspectsOf(build.weapon).map((trait) => option(trait.id)),
    [build.weapon],
  )

  /** What the build actually takes, which is all a centrepiece may be. */
  const centrepieces = useMemo(
    () => [...build.boons, ...(build.hex ? [build.hex] : [])].map(option),
    [build.boons, build.hex],
  )

  /**
   * Which slot's picker is open, or none.
   *
   * One at a time on purpose. Five dropdowns stacked was five controls of equal
   * weight and no shape; the bar is the shape, and it only stops being a bar if
   * two of them can open at once.
   */
  const [openSlot, setOpenSlot] = useState<Slot | null>(null)

  /**
   * Which tab is showing.
   *
   * Local state rather than a route. Which tab is open is a detail of one form,
   * not a place in the app, and a shared link to the builder pointing at the
   * Arcana tab would be an odd thing to send somebody.
   */
  const [tab, setTab] = useState<TrayTarget | 'notes'>('loadout')

  /**
   * The control to put the cursor in once the tab has switched.
   *
   * Opening the right tab is half the job. A build missing its name lands you
   * on Notes with the field somewhere on it, and the thing you came to do still
   * needs finding. Focus finishes the move.
   */
  const [focusField, setFocusField] = useState<Problem['field'] | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!focusField) return
    const found = panelRef.current?.querySelector<HTMLElement>(`[data-field="${focusField}"]`)
    found?.focus()
    setFocusField(null)
  }, [focusField, tab])

  /** The build as the tray draws it, which is the same shape the card uses. */
  const built = useMemo(() => assemble(build), [build])

  /**
   * A mark in the tray opens the tab that owns it.
   *
   * A core slot goes one step further and opens that slot's own picker, which
   * is the whole reason the tray is live rather than a preview: it is the
   * fastest way to reach the thing you want to change.
   */
  const goFromTray = (
    target: TrayTarget | 'notes',
    piece: { slot?: Slot | null } | null,
    field?: string | null,
  ) => {
    setTab(target)
    setOpenSlot(piece?.slot ?? null)
    // `BuildTray` has no business knowing the field union, so it hands back a
    // string and the narrowing happens here, where the union lives.
    if (field) setFocusField(field as Problem['field'])
  }

  const coreAt = (slot: Slot) => build.boons.find((id) => traits.get(id)?.slot === slot) ?? null

  const setCore = (slot: Slot, id: string | null) => {
    setBuild((was) => {
      const without = was.boons.filter((one) => traits.get(one)?.slot !== slot)
      return { ...was, boons: id ? [...without, id] : without }
    })
  }

  /**
   * Put a boon in one tray, the other, or neither.
   *
   * **It always leaves both first.** That is the whole reason this replaced two
   * toggles: a boon in the build and also in Worth adding is not a state a
   * build can be in, and the two toggles could produce it because neither knew
   * about the other. Removing from both before adding to one makes the bad
   * state undescribable rather than detectable.
   */
  const moveBoon = (id: TraitId, to: Tray | null) =>
    setBuild((was) => {
      const boons = was.boons.filter((one) => one !== id)
      const optional = (was.optional ?? []).filter((one) => one !== id)
      if (to === 'build') boons.push(id)
      if (to === 'optional') optional.push(id)
      return { ...was, boons, optional: optional.length ? optional : undefined }
    })

  const toggleArcana = (id: string) =>
    setBuild((was) => ({
      ...was,
      arcana: was.arcana.includes(id) ? was.arcana.filter((one) => one !== id) : [...was.arcana, id],
    }))

  const toggleHammer = (id: TraitId) =>
    setBuild((was) => ({
      ...was,
      hammers: was.hammers.includes(id) ? was.hammers.filter((one) => one !== id) : [...was.hammers, id],
    }))

  return (
    <div className="editor">
      <header className="builds-top">
        <button type="button" className="builds-back" onClick={onCancel}>
          All builds
        </button>
        <h2>{initial ? 'Edit build' : 'New build'}</h2>
      </header>

      {/* Tray on the left, one tabbed panel on the right.
        *
        * This was three `.editor-panel` sections in a two-column grid, so a
        * wide screen wrapped the third and left a column of nothing, with nine
        * stacked headings inside it. The tabs turn nine headings into five and
        * put one screenful on screen at a time, which is what frees the other
        * half of the width for the tray. */}
      <div className="editor-grid">
        <BuildTray built={built} onGo={goFromTray} alert={alert} />

        <section className="editor-panel" ref={panelRef}>
          <Tabs tabs={TABS(build)} open={tab} onOpen={setTab} label="What to edit" />

          <TabPanel id="loadout" open={tab}>
          <h3 className="editor-rule">The arm</h3>
          <Dropdown
            label="Arm"
            all="Pick an arm"
            chosen={build.weapon || null}
            options={weapons.map((weapon) => ({
              value: weapon.id,
              label: `${weapon.arm}, ${weapon.name}`,
              icon: weapon.icon,
            }))}
            onChoose={(value) =>
              /* An aspect belongs to one arm, so changing the arm cannot keep
                 the aspect. Same one-way dependency the filter bar has. */
              setBuild((was) => ({
                ...was,
                weapon: value ?? '',
                aspect: aspectsOf(value ?? '')[0]?.id ?? '',
                hammers: [],
              }))
            }
          />
          <Dropdown
            label="Aspect"
            all="Pick an aspect"
            chosen={build.aspect || null}
            options={aspects}
            onChoose={(value) => set('aspect', value ?? '')}
          />

          {/* The five slots, drawn the way the game draws them and the way every
            * other screen here already does: a row of tiles wearing the game's
            * own slot glyphs when they are empty and the boon's art when they
            * are not.
            *
            * They were five stacked dropdowns, which was five identical wide
            * controls with nothing to tell them apart but their labels, and
            * nothing about it looked like the thing it was editing. A row also
            * shows the one fact the stack could not: how much of the build is
            * still open, at a glance, which is the same thing the overview card
            * shows and the reason the card draws them this way.
            *
            * Clicking a tile opens that slot's picker underneath. */}
          <h3 className="editor-rule">The five slots</h3>
          <div className="slotbar" role="group" aria-label="The five core slots">
            {CORE_SLOTS.map((slot) => {
              const held = coreAt(slot)
              const trait = held ? traits.get(held) : null
              const icon = held ? iconOf.get(held) : null
              const glyph = SLOT_GLYPH[slot]
              return (
                <button
                  key={slot}
                  type="button"
                  className={`slotbar-tile${held ? ' is-held' : ''}${openSlot === slot ? ' is-open' : ''}`}
                  aria-expanded={openSlot === slot}
                  title={trait?.name ?? `${slotLabel(slot)}, open`}
                  onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
                >
                  <span className="slotbar-art">
                    {icon ? (
                      <img src={`/${icon}`} alt="" loading="lazy" />
                    ) : glyph ? (
                      <img className="slotbar-glyph" src={`/${glyph}`} alt="" loading="lazy" />
                    ) : null}
                  </span>
                  <span className="slotbar-slot">{slotLabel(slot)}</span>
                  <span className="slotbar-name">{trait?.name ?? 'Open'}</span>
                </button>
              )
            })}
          </div>

          {openSlot ? (
            <Dropdown
              label={slotLabel(openSlot)}
              all="Open"
              chosen={coreAt(openSlot)}
              options={bySlot.get(openSlot) ?? []}
              onChoose={(value) => {
                setCore(openSlot, value)
                setOpenSlot(null)
              }}
            />
          ) : null}

          <h3 className="editor-rule">Before you go</h3>
          <Dropdown
            label="Hex"
            all="No Hex"
            chosen={build.hex}
            options={hexes}
            onChoose={(value) => set('hex', value)}
          />
          <Dropdown
            label="Keepsake"
            all="No keepsake"
            chosen={build.keepsake}
            options={keepsakes}
            onChoose={(value) => set('keepsake', value)}
          />
          <Dropdown
            label="Familiar"
            all="No familiar"
            chosen={build.familiar}
            options={familiars.map((one) => ({ value: one.id, label: one.name, icon: one.icon }))}
            onChoose={(value) => set('familiar', value)}
          />
          </TabPanel>

          <TabPanel id="boons" open={tab}>
          <BoonSort build={build} options={sortable} onMove={moveBoon} />

          <h3 className="editor-rule">Daedalus Hammer</h3>
          <PickList
            options={hammers}
            chosen={build.hammers}
            onToggle={toggleHammer}
            placeholder="Search upgrades"
            emptySays="No hammer upgrades yet."
          />

          </TabPanel>

          <TabPanel id="arcana" open={tab}>
          <h3 className="editor-rule">Arcana worth bringing</h3>
          <p className="editor-hint">
            The one or two that follow from the build, not a board. The Huntress on an Attack or
            Special build, The Furies on a Cast build. Five at the outside.
          </p>
          <PickList
            options={arcanaOptions}
            chosen={build.arcana}
            onToggle={toggleArcana}
            placeholder="Search Arcana"
            emptySays="No Arcana chosen."
            cards
          />
          </TabPanel>

          <TabPanel id="notes" open={tab}>
          <h3 className="editor-rule">What it is</h3>
          <label className="editor-field">
            <span>Name</span>
            <input
              data-field="name"
              value={build.name}
              maxLength={60}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Killer Current"
            />
          </label>
          <label className="editor-field">
            <span>One line</span>
            <input
              value={build.say}
              maxLength={140}
              onChange={(event) => set('say', event.target.value)}
              placeholder="Poseidon on the swing, Zeus in the ring."
            />
          </label>
          <Dropdown
            label="Leans on"
            all="Not said"
            chosen={build.playstyle ?? null}
            options={PLAYSTYLES.map((one) => ({ value: one.id, label: one.name }))}
            onChoose={(value) => set('playstyle', (value as ShownBuild['playstyle']) ?? undefined)}
          />
          <Dropdown
            label="Built around"
            all="Nothing in particular"
            chosen={build.centrepiece || null}
            options={centrepieces}
            onChoose={(value) => set('centrepiece', value ?? '')}
          />
          <label className="editor-field">
            <span>How it works</span>
            <textarea
              value={build.how}
              rows={7}
              maxLength={900}
              onChange={(event) => set('how', event.target.value)}
              placeholder="What feeds what, and why the pieces are where they are."
            />
          </label>

          {/* Kept separate from How it works, and that separation is the point.
            * A build that lists a Hex and a fifth god among its boons is asking
            * for them. A build that mentions them here is telling you what to do
            * if you happen upon them, which costs nothing and helps more. */}
          <label className="editor-field">
            <span>If the run goes your way</span>
            <textarea
              value={build.luck ?? ''}
              rows={4}
              maxLength={700}
              onChange={(event) => set('luck', event.target.value || undefined)}
              placeholder="Upside worth taking if you meet it, and what to skip if you do not. A Hex, a fifth god on a keepsake, a boon from somebody who turns up when they feel like it."
            />
          </label>

          </TabPanel>

          <TabPanel id="play" open={tab}>
          {/* How it has played, for this player, in this browser.
            *
            * None of these four is required and none of them is checked: a
            * build nobody has rated is the normal case, and the Save button's
            * count must read exactly what it read before this block existed.
            *
            * They are personal to this install and do not travel when a build
            * is shared, which is why they live nested under `play`. */}
          <div className="editor-plays">
            <h3 className="editor-rule">How it plays</h3>
            <p className="editor-hint">Yours alone. None of it travels with a build you send on.</p>

            <div className="editor-field">
              <span>Rating</span>
              {/* Clicking the star you are already on clears it, which is the
                * convention `Setup.tsx` uses for every other clearable pick. */}
              <div className="editor-stars" role="group" aria-label="Rating, one to five">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={stars !== null && star > stars}
                    aria-pressed={star <= (play?.rating ?? 0)}
                    className={star <= (play?.rating ?? 0) ? 'is-on' : ''}
                    title={star === play?.rating ? 'Clear the rating' : `${star} of 5`}
                    onClick={() => setPlay({ rating: play?.rating === star ? undefined : star })}
                  >
                    <span aria-hidden="true">{star <= (play?.rating ?? 0) ? '★' : '☆'}</span>
                    <span className="visually-hidden">{star} of 5</span>
                  </button>
                ))}
              </div>
              {stars !== null ? (
                <p className="editor-hint">{repeat.hardStop} One star until it can be assembled.</p>
              ) : null}
            </div>

            <FearStepper
              value={play?.fear}
              onChange={(fear) => setPlay({ fear })}
            />

            {/* The same stepper Fear uses. It was built for Fear first and
              * these two kept plain number fields on the same panel three rows
              * apart, which the owner noticed immediately. */}
            <div className="editor-pair">
              <Stepper
                label="Runs"
                value={play?.runs}
                max={RUNS_CEILING}
                onChange={(runs) => setPlay({ runs })}
              />
              <Stepper
                label="Clears"
                value={play?.clears}
                /* Clears cannot exceed runs, which `setPlay` also clamps and
                 * `winRate` clamps again when it draws. */
                max={play?.runs ?? 0}
                onChange={(clears) => setPlay({ clears })}
              />
            </div>

            <Dropdown
              label="Assembles"
              all="Not said"
              chosen={play?.assembles ?? null}
              options={ASSEMBLES.map((one) => ({ value: one.id, label: one.name }))}
              onChoose={(value) => setPlay({ assembles: (value as PlayRecord['assembles']) ?? undefined })}
            />
          </div>

          </TabPanel>
        </section>

        {/* The right rail: everything true of the whole build rather than of any
          * one tab, always on screen, mirroring the tray on the other side.
          *
          * The blockers used to be a sticky banner over the panel and the
          * caveats used to be below it, which meant the two halves of "can you
          * save this yet" were in different places and one of them moved. Here
          * they are one column with the Save button at the bottom of it, so the
          * reason a save is refused is beside the thing refusing. */}
        <aside className="editor-rail" aria-label="Before you save">
          {stopping.length ? (
            <div className="editor-banner is-blocking" role="alert">
              <span className="editor-banner-head">
                {stopping.length === 1 ? 'One thing to fix' : `${stopping.length} things to fix`}
              </span>
              <ul>
                {stopping.map((one) => (
                  <li key={one.say}>{one.say}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {caveats.length ? (
            <div className="editor-caveats">
              <span className="editor-banner-head">
                {caveats.length === 1 ? 'One thing worth knowing' : `${caveats.length} things worth knowing`}
              </span>
              <ul>
                {caveats.map((one) => (
                  <li key={one.say}>
                    {one.say}
                    {one.fix ? <FixList fix={one.fix} onTake={takeFix} /> : null}
                  </li>
                ))}
              </ul>
              <label className="editor-confirm">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setReadCaveats(event.target.checked ? caveatSays : [])}
                />
                <span>I have read these</span>
              </label>
            </div>
          ) : null}

          {/* The one state neither of the two above can show. */}
          {stopping.length === 0 && caveats.length === 0 ? (
            <div className="editor-check" aria-live="polite">
              <p className="editor-ok">
                <img src="/icons/complete.png" alt="" aria-hidden="true" />
                Nothing in the way.
              </p>
            </div>
          ) : null}

          <div className="editor-actions">
            <button
              type="button"
              className="quiet"
              disabled={stopping.length > 0 || !acknowledged}
              onClick={() => onSave(build)}
            >
              {stopping.length
                ? `${stopping.length} to fix`
                : acknowledged
                  ? 'Save this build'
                  : 'Read the caveats first'}
            </button>
            {initial && onDelete ? (
              confirmingDelete ? (
                <span className="editor-delete-ask">
                  <span>Delete this build?</span>
                  <button type="button" className="quiet" onClick={() => onDelete(initial.id)}>
                    Delete it
                  </button>
                  <button type="button" className="quiet" onClick={() => setConfirmingDelete(false)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="quiet editor-delete"
                  title="Delete this build"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete
                </button>
              )
            ) : null}
          </div>
        </aside>
      </div>

      {/* The reading, on its own, under all three columns.
        *
        * It is neither a control nor a warning: it is a paragraph about the
        * build, and it wants the width to say six things with their reasons
        * beside them. In the rail it would have been a column of wrapped
        * fragments, and in the panel it moved every time a tab changed height. */}
      <div className="editor-reading">
        <div className="editor-repeat-head">
          <span className="editor-rule">Putting it together</span>
          <Stamp read={repeat} size="medium" showSay />
        </div>

        <ul className="editor-charges">
          {repeat.charges.map((charge) => (
            <li key={charge.id} className={charge.cost === 0 ? 'is-free' : undefined}>
              <span className="editor-charge-say">{charge.say}</span>
              {charge.tip ? <span className="editor-charge-tip">{charge.tip}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}