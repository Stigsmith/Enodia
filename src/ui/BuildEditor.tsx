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

import { useMemo, useState } from 'react'

import { arcana, aspectsOf, familiars, godPools, olympians, sources, traits, weapons } from '../data/app.ts'
import { ASSEMBLES } from '../data/builds.ts'
import type { PlayRecord, ShownBuild } from '../data/builds.ts'
import { blankBuild } from '../state/builds.ts'
import { checkBuild, blockers } from '../engine/build-check.ts'
import { ratingCeiling, readRepeat } from '../engine/repeat.ts'
import { Stamp } from './Stamp.tsx'
import { CORE_SLOTS, slotLabel } from '../engine/slots.ts'
import { Dropdown } from './Dropdown.tsx'
import type { DropdownOption } from './Dropdown.tsx'
import { PickList } from './PickList.tsx'
import type { PickOption } from './PickList.tsx'
import { iconOf } from '../data/app.ts'
import type { Slot, TraitId } from '../data/types.ts'

const option = (id: TraitId): DropdownOption => ({
  value: id,
  label: traits.get(id)?.name ?? id,
  icon: iconOf.get(id) ?? null,
})

const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

/**
 * Which god offers a boon, for the grouped picker.
 *
 * A trait's own `gods` is the authority and a duo carries two, so it is filed
 * under both: somebody looking for Killer Current will look under either
 * Poseidon or Zeus and should find it under whichever they try.
 */
function pickOptions(ids: readonly string[]): PickOption[] {
  const out: PickOption[] = []
  for (const id of ids) {
    const trait = traits.get(id)
    if (!trait) continue
    const base = {
      value: id,
      label: trait.name ?? id,
      icon: iconOf.get(id) ?? null,
      note: trait.text ?? null,
    }
    const gods = trait.gods.length ? trait.gods : ['Other']
    for (const god of gods) out.push({ ...base, group: god })
  }
  return out.sort(byName)
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
   * Everything that occupies no core slot, grouped by the god who offers it.
   *
   * Filtered to what a god actually offers rather than the whole trait table:
   * `godPools` is the offer pool, so a trait no god hands out cannot be picked
   * here, and the groups add up to what a run can actually be given.
   */
  const slotless = useMemo(() => {
    const offered = new Set<string>()
    for (const pool of godPools.values()) {
      for (const id of [...pool.priority, ...pool.pool]) offered.add(id)
    }
    return pickOptions(
      [...offered].filter((id) => {
        const trait = traits.get(id)
        return trait && (!trait.slot || !CORE_SLOTS.includes(trait.slot))
      }),
    )
  }, [])

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

  // A hammer's arm lives in `sources`, not on the trait. See build-check.ts.
  const hammers = useMemo(() => {
    const entry = sources.find((one) => one.kind === 'hammer' && one.weapon === build.weapon)
    return (entry?.traits ?? [])
      .flatMap((id) => {
        const trait = traits.get(id)
        return trait
          ? [{ value: id, label: trait.name ?? id, icon: iconOf.get(id) ?? null, note: trait.text ?? null }]
          : []
      })
      .sort(byName)
  }, [build.weapon])

  const aspects = useMemo(
    () => aspectsOf(build.weapon).map((trait) => option(trait.id)),
    [build.weapon],
  )

  /** What the build actually takes, which is all a centrepiece may be. */
  const centrepieces = useMemo(
    () => [...build.boons, ...(build.hex ? [build.hex] : [])].map(option),
    [build.boons, build.hex],
  )

  const coreAt = (slot: Slot) => build.boons.find((id) => traits.get(id)?.slot === slot) ?? null

  const setCore = (slot: Slot, id: string | null) => {
    setBuild((was) => {
      const without = was.boons.filter((one) => traits.get(one)?.slot !== slot)
      return { ...was, boons: id ? [...without, id] : without }
    })
  }

  const toggleLoose = (id: TraitId) =>
    setBuild((was) => ({
      ...was,
      boons: was.boons.includes(id) ? was.boons.filter((one) => one !== id) : [...was.boons, id],
    }))

  const toggleArcana = (id: string) =>
    setBuild((was) => ({
      ...was,
      arcana: was.arcana.includes(id) ? was.arcana.filter((one) => one !== id) : [...was.arcana, id],
    }))

  const toggleOptional = (id: TraitId) =>
    setBuild((was) => {
      const list = was.optional ?? []
      return { ...was, optional: list.includes(id) ? list.filter((one) => one !== id) : [...list, id] }
    })

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

      <div className="editor-grid">
        <section className="editor-panel">
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

          <h3 className="editor-rule">The five slots</h3>
          {CORE_SLOTS.map((slot) => (
            <Dropdown
              key={slot}
              label={slotLabel(slot)}
              all="Open"
              chosen={coreAt(slot)}
              options={bySlot.get(slot) ?? []}
              onChoose={(value) => setCore(slot, value)}
            />
          ))}

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
        </section>

        <section className="editor-panel">
          <h3 className="editor-rule">Beyond the slots</h3>
          <p className="editor-hint">
            Duos, legendaries and everything that occupies no slot. This is the build.
          </p>
          <PickList
            options={slotless}
            chosen={build.boons.filter((id) => {
              const slot = traits.get(id)?.slot
              return !slot || !CORE_SLOTS.includes(slot)
            })}
            onToggle={toggleLoose}
            placeholder="Search boons"
            emptySays="Nothing beyond the five slots yet."
          />

          <h3 className="editor-rule">Worth adding</h3>
          <p className="editor-hint">
            Boons that raise the ceiling without being the build. One boon from a god you take
            for nothing else still spends an Olympian slot, and this is where that shows.
          </p>
          <PickList
            options={slotless}
            chosen={build.optional ?? []}
            onToggle={toggleOptional}
            placeholder="Search boons"
            emptySays="No upgrades listed."
          />

          <h3 className="editor-rule">Daedalus Hammer</h3>
          <PickList
            options={hammers}
            chosen={build.hammers}
            onToggle={toggleHammer}
            placeholder="Search upgrades"
            emptySays="No hammer upgrades yet."
          />

          <h3 className="editor-rule">Arcana</h3>
          <p className="editor-hint">The Grasp holds five.</p>
          <PickList
            options={arcana.map((card) => ({
              value: card.id,
              label: card.name,
              icon: card.icon,
              note: card.text,
            }))}
            chosen={build.arcana}
            onToggle={toggleArcana}
            placeholder="Search Arcana"
            emptySays="No Arcana chosen."
            cards
          />
        </section>

        <section className="editor-panel">
          <h3 className="editor-rule">What it is</h3>
          <label className="editor-field">
            <span>Name</span>
            <input
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
            label="What it is for"
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

            <div className="editor-pair">
              <label className="editor-field">
                <span>Runs</span>
                <input
                  type="number"
                  min={0}
                  value={play?.runs ?? ''}
                  onChange={(event) =>
                    setPlay({
                      runs:
                        event.target.value === ''
                          ? undefined
                          : Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="editor-field">
                <span>Clears</span>
                <input
                  type="number"
                  min={0}
                  max={play?.runs ?? 0}
                  value={play?.clears ?? ''}
                  onChange={(event) =>
                    setPlay({
                      clears:
                        event.target.value === ''
                          ? undefined
                          : Math.min(Math.max(0, Number(event.target.value) || 0), play?.runs ?? 0),
                    })
                  }
                />
              </label>
            </div>

            <Dropdown
              label="Assembles"
              all="Not said"
              chosen={play?.assembles ?? null}
              options={ASSEMBLES.map((one) => ({ value: one.id, label: one.name }))}
              onChoose={(value) => setPlay({ assembles: (value as PlayRecord['assembles']) ?? undefined })}
            />
          </div>

          {/* The checker, live. Blocking first, because that is the half that
            * decides whether Save does anything. */}
          <div className="editor-check" aria-live="polite">
            {problems.length === 0 ? (
              <p className="editor-ok">Nothing in the way.</p>
            ) : (
              <ul>
                {[...stopping, ...problems.filter((one) => one.severity === 'notes')].map((one) => (
                  <li key={one.say} className={`editor-problem is-${one.severity}`}>
                    {one.say}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Kept apart from the checker above on purpose. That one answers
            * legality and gates the Save button. This one answers likelihood and
            * gates nothing: a demanding build is allowed, and somebody who wants
            * one should be able to write it without being told off. The tips are
            * only here, because this is the one screen where acting on them is a
            * control away. */}
          <div className="editor-repeat">
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

          <div className="editor-actions">
            <button
              type="button"
              className="quiet"
              disabled={stopping.length > 0}
              onClick={() => onSave(build)}
            >
              {stopping.length ? `${stopping.length} to fix` : 'Save this build'}
            </button>
            {initial && onDelete ? (
              <button type="button" className="quiet editor-delete" onClick={() => onDelete(initial.id)}>
                Delete
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
