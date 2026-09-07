/**
 * A build that arrived in a link.
 *
 * `DESIGN.md` 9 settled the mechanism years before this screen: a URL
 * fragment, compressed, no server. A fragment is never sent to a server even
 * as part of the request, so a build pasted into a chat is between the two
 * people in the chat and nobody else.
 *
 * **It asks before it writes.** A link can be opened by accident, twice, or by
 * someone who already has that build, and none of those should quietly change
 * what is in their library. The card says what arrived, says plainly whether
 * it would replace something, and does nothing until it is told to.
 */

import { arcanaById, iconOf, olympians, traits, weapons } from '../data/app.ts'
import { readRepeat } from '../engine/repeat.ts'
import { Stamp } from './Stamp.tsx'
import { useEscape } from './escape.ts'
import { readName, sharedLine } from '../state/identity.ts'
import type { ShownBuild } from '../data/builds.ts'

/** How many boons the card draws before it starts counting instead. */
const SHOWN = 10

export function Shared({
  build,
  replaces,
  onKeep,
  onDismiss,
  takenDown,
}: {
  build: ShownBuild
  /** the build already here with this id, when there is one */
  replaces: ShownBuild | null
  onKeep: () => void
  onDismiss: () => void
  /**
   * Whether the author has taken this listing off the shelves.
   *
   * The link keeps working after a takedown, on purpose: the id was already
   * shared and destroying the build would empty it out of the library of
   * everybody following it. So somebody can arrive here at a build nobody can
   * find any more, and showing it as though it were current would be the wrong
   * kind of quiet. Only a short link can be taken down; a build carried inside
   * a fragment has no listing behind it.
   */
  takenDown?: boolean
}) {
  /* The same as “Not now”, which is the button sitting next to it. The build
     is still in the link it arrived on, so nothing is destroyed by leaving. */
  useEscape(true, onDismiss)

  const weapon = weapons.find((one) => one.id === build.weapon)
  const aspect = build.aspect ? traits.get(build.aspect) : null
  const centrepiece = build.centrepiece ? traits.get(build.centrepiece) : null
  const marks = build.boons.flatMap((id) => {
    const icon = iconOf.get(id)
    return icon ? [{ id, icon, name: traits.get(id)?.name ?? id }] : []
  })

  return (
    <div className="shared" role="dialog" aria-label="A build someone shared with you">
      <div className="shared-card">
        <p className="shared-eyebrow">{sharedLine(build.author, readName())}</p>
        {takenDown ? (
          <p className="shared-down">
            This one has been taken off the exchange. It is the last version its author
            published, and it will not change again.
          </p>
        ) : null}
        <h2 className="shared-name">{build.name || 'Untitled build'}</h2>
        {build.say ? <p className="shared-say">{build.say}</p> : null}

        {/* The reason this reading exists at all. Somebody opening a link has no
          * idea what they have been handed, and the sender is the last person
          * who is going to volunteer that it took them forty runs. */}
        <Stamp read={readRepeat(build, traits, olympians)} size="medium" showSay />

        <p className="shared-arm">
          {weapon?.arm ?? 'Unknown arm'}
          {aspect ? <span>{aspect.name?.replace(/^Aspect of /, '')}</span> : null}
          {weapon ? <span>{weapon.name}</span> : null}
        </p>

        {marks.length ? (
          <ul className="shared-marks">
            {marks.slice(0, SHOWN).map((one) => (
              <li key={one.id}>
                <img src={`/${one.icon}`} alt="" loading="lazy" title={one.name} />
              </li>
            ))}
            {/* Twenty-one boons is a real build and a wall of icons. The rest
              * are counted rather than drawn, because a row that quietly stops
              * at ten is a card that lies about what it is offering. */}
            {marks.length > SHOWN ? (
              <li className="shared-more">+{marks.length - SHOWN}</li>
            ) : null}
          </ul>
        ) : null}

        {centrepiece ? (
          <p className="shared-centre">
            Built around <strong>{centrepiece.name}</strong>
          </p>
        ) : null}

        {build.arcana.length ? (
          <p className="shared-arcana">
            Bring:{' '}
            {build.arcana
              .map((id) => arcanaById.get(id)?.name ?? id)
              .join(', ')}
          </p>
        ) : null}

        {replaces ? (
          <p className="shared-warn">
            You already have this build, saved as <strong>{replaces.name}</strong>. Keeping it will
            replace your copy.
          </p>
        ) : null}

        <p className="shared-note">
          Nothing about how it has played for them comes with it. Ratings, runs and clears stay
          where they were made.
        </p>

        <div className="shared-buttons">
          <button type="button" className="shared-go" onClick={onKeep}>
            {replaces ? 'Replace my copy' : 'Add to my builds'}
          </button>
          <button type="button" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
