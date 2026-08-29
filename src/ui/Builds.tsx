/**
 * The build manager, and five arguments about how to draw one.
 *
 * `ROADMAP.md` had this behind the run companion. It is in front of it now, on
 * the owner's reading: a player with 300 hours does not need to be told what an
 * Exit costs them, they need somewhere to go for "what shall I try this run"
 * and "what am I not playing". Both of those are answered by looking at builds,
 * not by logging one.
 *
 * **This screen is a question, not an answer.** The crux the owner named is
 * visual: a full loadout is eighteen items across six categories, and every
 * obvious way to draw it is either cluttered or a spreadsheet. So rather than
 * pick one and defend it, all five are here behind a switcher, each built to
 * its own philosophy and each honest about what it gives up. The switcher goes
 * once a direction is chosen, and four of these files go with it.
 *
 * The five, and what each one is for:
 *
 * | Variant | Approach | Answers |
 * |---|---|---|
 * | Loadout | mimic the game's own tray | recognition |
 * | Poster | editorial, one build as a page | what shall I try |
 * | Constellation | fixed positions, shape at a glance | where are my gaps |
 * | Ribbon | an ordered plan, not an inventory | what do I take now |
 * | Contact | uniform tiles, several at once | which is different |
 *
 * Each variant's own file argues its case at the top, including what it is bad
 * at. Read those before choosing.
 */

import { useState } from 'react'

import { FIRST_BUILD, SAMPLE_BUILDS } from '../data/builds.ts'
import { assemble } from './build-pieces.ts'
import type { Piece } from './build-pieces.ts'
import { Contact } from './variants/Contact.tsx'
import { Constellation } from './variants/Constellation.tsx'
import { Loadout } from './variants/Loadout.tsx'
import { Poster } from './variants/Poster.tsx'
import { Ribbon } from './variants/Ribbon.tsx'

type VariantId = 'loadout' | 'poster' | 'constel' | 'ribbon' | 'contact'

type Variant = {
  id: VariantId
  name: string
  approach: string
  gives: string
  multi: boolean
}

/**
 * A non-empty list, stated as one.
 *
 * `noUncheckedIndexedAccess` is on, so `VARIANTS[0]` is `Variant | undefined`
 * and every use of it needs a guard for a case that cannot happen. Naming the
 * first element separately says the same thing to the compiler once.
 */
const FIRST_VARIANT: Variant = {
  id: 'loadout',
  name: 'Loadout',
  approach: "The game's own tray. Slots down the side, everything else in a labelled drawer.",
  gives: 'No character. Three builds in it look alike.',
  multi: false,
}

const VARIANTS: Variant[] = [
  FIRST_VARIANT,
  {
    id: 'poster',
    name: 'Poster',
    approach: 'One build as a page. The art at the size it deserves, everything else demoted.',
    gives: 'One at a time, and a scroll on a phone.',
    multi: false,
  },
  {
    id: 'constel',
    name: 'Constellation',
    approach: 'Five fixed positions round the arm. A dark spoke is a gap you see before you read anything.',
    gives: 'Names. It leans on the art to identify things.',
    multi: false,
  },
  {
    id: 'ribbon',
    name: 'Ribbon',
    approach: 'Not an inventory. An order: what is locked in, what to fill first, what it is all for.',
    gives: "The whole. You cannot see a build's shape in it.",
    multi: false,
  },
  {
    id: 'contact',
    name: 'Contact sheet',
    approach: 'Uniform tiles, same band in the same place. Built so several builds can be compared.',
    gives: 'Everything else. Nothing in it is emphasised.',
    multi: true,
  },
]

export function Builds({ onClose }: { onClose?: () => void }) {
  const [variant, setVariant] = useState<VariantId>('poster')
  const [buildId, setBuildId] = useState(FIRST_BUILD.id)
  const [open, setOpen] = useState<Piece | null>(null)

  const chosen = VARIANTS.find((entry) => entry.id === variant) ?? FIRST_VARIANT
  const build = SAMPLE_BUILDS.find((entry) => entry.id === buildId) ?? FIRST_BUILD
  const built = assemble(build)

  return (
    <div className="builds" data-variant={variant}>
      <header className="builds-top">
        {onClose ? (
          <button type="button" className="builds-back" onClick={onClose}>
            Back
          </button>
        ) : null}
        <h2>Builds</h2>
        <p className="builds-note">
          Five ways of drawing the same build. Pick the one that reads best and the other four go.
        </p>
      </header>

      <nav className="builds-variants" aria-label="Layout to try">
        {VARIANTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`builds-variant${entry.id === variant ? ' is-on' : ''}`}
            aria-pressed={entry.id === variant}
            onClick={() => setVariant(entry.id)}
          >
            {entry.name}
          </button>
        ))}
      </nav>

      <p className="builds-approach">
        <span className="builds-approach-for">{chosen.approach}</span>
        <span className="builds-approach-against">Gives up: {chosen.gives}</span>
      </p>

      {/* The contact sheet is the one variant whose whole argument is several
       * builds at once, so it gets all of them and no build picker. */}
      {chosen.multi ? null : (
        <nav className="builds-picker" aria-label="Build">
          {SAMPLE_BUILDS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`builds-pick${entry.id === buildId ? ' is-on' : ''}`}
              aria-pressed={entry.id === buildId}
              onClick={() => setBuildId(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </nav>
      )}

      <div className="builds-stage">
        {variant === 'loadout' ? <Loadout built={built} onOpen={setOpen} /> : null}
        {variant === 'poster' ? <Poster built={built} onOpen={setOpen} /> : null}
        {variant === 'constel' ? <Constellation built={built} onOpen={setOpen} /> : null}
        {variant === 'ribbon' ? <Ribbon built={built} onOpen={setOpen} /> : null}
        {variant === 'contact' ? (
          <div className="builds-sheet">
            {SAMPLE_BUILDS.map((entry) => (
              <Contact key={entry.id} built={assemble(entry)} onOpen={setOpen} compact />
            ))}
          </div>
        ) : null}
      </div>

      {/* Sample data says so, plainly and every time it is on screen.
       * `data/curated/builds.json` is the owner's and is still empty; nothing
       * here is a recommendation and the page must not be mistaken for one. */}
      <p className="builds-disclaimer">
        These three are samples, built to test the layouts. Every id in them is real and every duo actually
        holds its prerequisites, but which build is worth playing is not in any game file and is not claimed
        here.
      </p>

      {open ? <PieceCard piece={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * One piece, opened.
 *
 * Every layout hands clicks here rather than growing its own detail view,
 * because what a boon does is the same fact in all five and the layouts are
 * meant to differ only in arrangement.
 */
function PieceCard({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  return (
    <div className="piececard" role="dialog" aria-label={piece.name}>
      <div className="piececard-body">
        <header>
          {piece.icon ? <img src={`/${piece.icon}`} alt="" /> : null}
          <div>
            <h3>{piece.name}</h3>
            <p>
              {piece.slotName ? <span>{piece.slotName}</span> : null}
              {piece.gods.length ? <span>{piece.gods.join(' + ')}</span> : null}
            </p>
          </div>
        </header>
        {piece.text ? (
          <p className="piececard-text">{piece.text}</p>
        ) : (
          <p className="piececard-gap">No text.</p>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
