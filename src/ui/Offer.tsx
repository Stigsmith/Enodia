/**
 * The offer block. Build order step 11.
 *
 * `DESIGN.md` 8: **three cards and three sentences, never a table**, with game
 * art on every card, "which is the single thing hades2builder got right and
 * the other two did not."
 *
 * The list here is longer than three, because this is a log rather than the
 * game: the tool cannot know which three a god actually put in front of you, so
 * it shows everything that god could still offer and you pick the one you took.
 * The ranking is what makes that a short read instead of a wall.
 *
 * Each card carries, in this order:
 *
 * 1. the art, because a player recognises a boon by its icon before its name
 * 2. what it does, in the game's own words
 * 3. **one sentence about this run**, from `engine/offer.ts`
 * 4. what taking it would close, when it would close anything
 *
 * Three registers again, and kept apart the way `DESIGN.md` 8 requires. The
 * game's sentence is a fact and is quiet. Our sentence is a judgement and is
 * marked as ours. What a pick closes is a proof, and it is the loudest thing on
 * the card because it is the only part that is irreversible.
 *
 * **Silence is the normal state.** Most boons draw no sentence at all, and a
 * card with nothing to say shows the art, the name and the game's own text. A
 * dashed mark says it is unrated rather than leaving a hole, because
 * `DESIGN.md` 8 makes unrated a first-class state rather than missing data.
 *
 * **Anything true of every card is lifted above them**, by
 * `engine/offer.ts differentiate`. Taking a fourth Olympian closes three dozen
 * duos whichever of their boons you take, and "spends one of your four
 * Olympian slots" fires on all nine of them. Printed on each card that is the
 * same sentence nine times and it buries the one card that is different. A
 * card left with nothing after the lift falls back to silence, which is
 * honest, rather than to a repeat, which is not.
 */

import { useMemo } from 'react'

import { iconOf, traits } from '../data/app.ts'
import { differentiate, judgeOffer } from '../engine/offer.ts'
import { ruleContext } from '../engine/rules.ts'
import { rules } from '../data/rules.ts'
import type { Judged } from '../engine/offer.ts'
import type { HeldTrait, RunContext, TraitId } from '../data/types.ts'

export function Offer({
  run,
  candidates,
  god,
  rarity,
  onTake,
}: {
  run: RunContext
  candidates: readonly TraitId[]
  god: string | null
  rarity: HeldTrait['rarity']
  onTake: (trait: TraitId) => void
}) {
  /**
   * Judging asks reachability what the run would look like after each
   * candidate, which is 47 targets apiece. That is fine once and wasteful on
   * every keystroke, so it is memoised on the things that actually change it.
   */
  const judged = useMemo(() => {
    const ctx = ruleContext(run, traits)
    return judgeOffer(
      candidates.map((id) => ({ id, rarity, god })),
      rules,
      ctx,
    )
  }, [run, candidates, god, rarity])

  const { common, cards } = useMemo(() => differentiate(judged), [judged])

  if (!cards.length) return <p className="offer-empty">Nothing here can still be offered.</p>

  return (
    <>
      {/* Everything true of every card, stated once. It is about taking
          anything from this source rather than about any one of them, and on
          all of them it would drown the one that is genuinely different. */}
      {common.closes.length || common.says.length ? <Common common={common} god={god} /> : null}

      <ul className="offer">
        {cards.map((entry) => (
          <Card key={entry.subject.id} judged={entry} onTake={() => onTake(entry.subject.id)} />
        ))}
      </ul>
    </>
  )
}

function Common({ common, god }: { common: ReturnType<typeof differentiate>['common']; god: string | null }) {
  const named = common.closes.map((id) => traits.get(id)?.name ?? id)
  const shown = named.slice(0, 4)
  return (
    <div className="offer-common">
      <p className="offer-common-head">
        {god ? `True of anything ${god} gives you here` : 'True of all of these'}
      </p>

      {common.says.map((say) => (
        <p key={say} className="offer-common-say">
          {say}
        </p>
      ))}

      {common.closes.length ? (
        <details className="offer-shared">
          <summary>
            <strong>{common.closes.length}</strong>{' '}
            {common.closes.length === 1 ? 'target closes' : 'targets close'} either way
          </summary>
          <p>
            {shown.join(', ')}
            {named.length > shown.length ? `, and ${named.length - shown.length} more` : ''}.
          </p>
        </details>
      ) : null}
    </div>
  )
}

/** One card. `differentiate` has already taken everything shared off it. */
function Card({ judged, onTake }: { judged: Judged; onTake: () => void }) {
  const trait = traits.get(judged.subject.id)
  const icon = iconOf.get(judged.subject.id)
  const closes = judged.closes.map((id) => traits.get(id)?.name ?? id)

  return (
    <li className={`offer-card${closes.length ? ' has-cost' : ''}`}>
      <button type="button" onClick={onTake}>
        <span className="offer-mark">
          {icon ? <img src={`/${icon}`} alt="" loading="lazy" /> : <span className="offer-blank" />}
        </span>

        <span className="offer-body">
          <span className="offer-head">
            <span className="offer-name">{trait?.name ?? judged.subject.id}</span>
            {trait?.slot ? <span className="offer-slot">{trait.slot}</span> : null}
            {judged.rated.unrated ? (
              <span className="offer-unrated" title="No rule had anything to say about this one">
                unrated
              </span>
            ) : null}
          </span>

          {/* Fact: the game's own sentence. */}
          {trait?.text ? <span className="offer-text">{trait.text}</span> : null}

          {/* Judgement: ours, and marked as ours. */}
          {judged.say ? <span className="offer-say">{judged.say}</span> : null}

          {/* Proof, and the only irreversible part. */}
          {closes.length ? (
            <span className="offer-closes">
              {closes.length === 1
                ? `Taking this closes ${closes[0]}.`
                : `Taking this closes ${closes.length}: ${closes.slice(0, 3).join(', ')}${
                    closes.length > 3 ? `, and ${closes.length - 3} more` : ''
                  }.`}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
