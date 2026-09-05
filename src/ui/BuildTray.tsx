/**
 * The build being edited, drawn the way the game draws it.
 *
 * The game's Boons tray is a panel down the left: the aspect at the top, then a
 * grid of framed marks, each in a fixed place. It is the picture a player
 * already has in their head of what they are carrying, and the builder was the
 * one screen in this tool that showed them a form instead.
 *
 * **It is assembly, not new drawing.** `assemble()` already turns a
 * `ShownBuild` into exactly this shape, because that is what the overview card
 * and the Poster consume, and `Mark` already draws a piece with its frame and
 * slot glyph. So this reads the same function and draws the same marks, which
 * is why a duo in the tray and a duo on a card are the same picture rather than
 * two drawings that can drift.
 *
 * **Clicking a mark opens the control that owns it.** The slot bar made that
 * move for the five core slots; this is the same move for the whole build. It
 * is the reason the tray is worth having live rather than being a preview: it
 * is the fastest way to reach the thing you want to change.
 */

/**
 * **The class prefix is `btray`, not `tray`.** The run surface already owns
 * `.tray` and gives it `grid-area: tray`, so this component inherited a named
 * grid placement from a layout it has nothing to do with and got parked in a
 * fourth column of the builder's two-column grid, below the panel and off to
 * the right. It rendered, it was in the DOM, and it was nowhere near where the
 * markup said it should be.
 */

import { Mark } from './BuildMark.tsx'
import { FearMark } from './Fear.tsx'
import type { Assembled, Piece } from './build-pieces.ts'

/**
 * Which tab owns a given part of the build, so a mark can open it.
 *
 * The tray draws marks for four of the five tabs, and Notes has nothing to
 * draw. **The alert is not a mark, though**, and it used to be forced into this
 * same set: a build missing its name sent you to Loadout, which has no name
 * field. So the alert's target is `TrayTarget | 'notes'` and this stays the set
 * of tabs a *mark* can open.
 */
export type TrayTarget = 'loadout' | 'boons' | 'arcana' | 'play'

export function BuildTray({
  built,
  onGo,
  alert,
}: {
  built: Assembled
  /** open the tab that owns this piece, and say which piece was asked for */
  onGo: (target: TrayTarget | 'notes', piece: Piece | null, field?: string | null) => void
  /**
   * The one thing most worth knowing about this build, or nothing.
   *
   * The tray is the only thing on screen from every tab, so it is the only
   * place a warning can be guaranteed to be seen. A blocker on the Boons tab is
   * invisible from the Play tab otherwise, and the whole reason the banner was
   * made sticky was that a warning you have scrolled past may as well not
   * exist. A tab away is further than scrolled past.
   */
  alert: { say: string; blocking: boolean; go: TrayTarget | 'notes'; field: string | null } | null
}) {
  const { build } = built
  const rest = built.run.pieces.filter((piece) => !piece.slot)
  const arcana = built.crossroads.pieces.filter((piece) => piece.kind === 'arcana')
  const kit = built.crossroads.pieces.filter(
    (piece) => piece.kind !== 'arcana' && piece.kind !== 'aspect',
  )

  return (
    <aside className="btray" data-tour="editor-tray" aria-label="The build so far">
      <header className="btray-head">
        <p className="btray-arm">
          {built.arm}
          <span>{built.weaponName}</span>
        </p>
        {/* The counters the game puts across the top of its tray. Gods rather
          * than gold, because gold is not a thing a build has and the Olympian
          * count is the number this tool cares about most. */}
        <p className="btray-counts">
          <span className="btray-count">
            <strong>{built.gods.length}</strong> gods
          </span>
          <span className="btray-count">
            <strong>{build.boons.length}</strong> boons
          </span>
          <FearMark fear={build.play?.fear} />
        </p>
      </header>

      {/* The worst thing about this build, wherever you are.
        *
        * The game's own wants-to-talk marker, which is what it puts on the map
        * when somebody has something to say to you, and that is exactly the
        * job: not an error, a thing worth going and looking at. */}
      {alert ? (
        <button
          type="button"
          className={`btray-alert${alert.blocking ? ' is-blocking' : ''}`}
          onClick={() => onGo(alert.go, null, alert.field)}
        >
          <img src="/icons/wants-to-talk.png" alt="" aria-hidden="true" />
          <span>{alert.say}</span>
        </button>
      ) : null}

      {/* The aspect, at the size the art deserves, exactly as the game leads
        * with it. */}
      <button
        type="button"
        className="btray-aspect"
        onClick={() => onGo('loadout', built.aspect)}
        title={built.aspect ? built.aspect.name : 'Pick an aspect'}
      >
        {built.aspect ? (
          <Mark piece={built.aspect} size="3.4rem" showGlyph={false} />
        ) : (
          <span className="btray-open-aspect">No aspect</span>
        )}
        <span className="btray-aspect-name">
          {built.aspect ? built.aspect.name.replace(/^Aspect of /, '') : 'Pick one'}
        </span>
      </button>

      <TrayBand label="Slots" onAdd={() => onGo('loadout', null)}>
        {built.slots.map((entry) => (
          <button
            key={entry.slot}
            type="button"
            className={`btray-cell${entry.piece ? '' : ' is-open'}`}
            title={entry.piece ? entry.piece.name : `${entry.name}, open`}
            onClick={() => onGo('loadout', entry.piece)}
          >
            {entry.piece ? (
              <Mark piece={entry.piece} size="2.4rem" showGlyph={false} />
            ) : (
              <span className="btray-empty">
                {entry.glyph ? <img src={`/${entry.glyph}`} alt="" loading="lazy" /> : null}
              </span>
            )}
          </button>
        ))}
      </TrayBand>

      {rest.length ? (
        <TrayBand label="Beyond the slots" onAdd={() => onGo('boons', null)}>
          {rest.map((piece) => (
            <button
              key={piece.key}
              type="button"
              className="btray-cell"
              onClick={() => onGo('boons', piece)}
            >
              <Mark piece={piece} size="2.4rem" />
            </button>
          ))}
        </TrayBand>
      ) : null}

      {kit.length ? (
        <TrayBand label="Before you go" onAdd={() => onGo('loadout', null)}>
          {kit.map((piece) => (
            <button
              key={piece.key}
              type="button"
              className="btray-cell"
              onClick={() => onGo(piece.kind === 'hammer' ? 'boons' : 'loadout', piece)}
            >
              <Mark piece={piece} size="2.4rem" />
            </button>
          ))}
        </TrayBand>
      ) : null}

      {arcana.length ? (
        <TrayBand label="Arcana" onAdd={() => onGo('arcana', null)}>
          {arcana.map((piece) => (
            <button
              key={piece.key}
              type="button"
              className="btray-card"
              onClick={() => onGo('arcana', piece)}
            >
              {piece.icon ? <img src={`/${piece.icon}`} alt="" loading="lazy" /> : null}
            </button>
          ))}
        </TrayBand>
      ) : null}
    </aside>
  )
}

/**
 * One band of the tray, with a way into the control that fills it.
 *
 * The plus is not decoration. A band that is empty draws nothing at all, so
 * without it there would be no way to reach the Arcana control from the tray
 * until the build already had an Arcana in it.
 */
function TrayBand({
  label,
  onAdd,
  children,
}: {
  label: string
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <section className="btray-band">
      <button type="button" className="btray-rule" onClick={onAdd}>
        {label}
        <span aria-hidden="true">+</span>
      </button>
      <div className="btray-cells">{children}</div>
    </section>
  )
}
