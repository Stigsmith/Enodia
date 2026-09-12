/**
 * Things the game never tells you, sorted by whether you would ever find them.
 *
 * This lived on the page that stood in front of the app, and left the product
 * with it on 11 September 2026. It is back because the reason for it still
 * holds: building this means reading the game's own code, and that turns up
 * rules nobody is told. Some would never surface in a thousand runs. Some you
 * would work out eventually, and finding those yourself is better than being
 * told, so the tiers are sorted by that and nothing opens unless a reader
 * opens it.
 *
 * **Every mechanical entry cites the symbols it rests on**, and the two that
 * are ours say so. `underhood.test.ts` holds that line, because a page like
 * this is exactly where a judgement would slip in wearing a source's clothes.
 *
 * ## One entry was wrong the whole time it was live
 *
 * "The moment your run stops being open" said that a fourth Olympian made every
 * other god impossible for the rest of the run. `ReachedMaxGods` is real and
 * governs `ChooseLoot` alone: eight lines later `RewardLogic.lua:242` replaces
 * that choice from any held keepsake with `Uses > 0`, without consulting the
 * cap again, and all nine Olympians have such a keepsake. That is `CLAUDE.md`
 * error 6, it shipped on a public page, and the entry below is the corrected
 * one. Everything else here was re-read against the game on 12 September 2026.
 */

export type Entry = {
  summary: string
  body: string[]
  /** The symbols it rests on. Every entry that states a rule has one. */
  source?: string
  /**
   * Ours: how to play it, rather than something the files state. Kept visibly
   * apart, because `REQUIREMENTS.md` 10 is that a judgement and a sourced fact
   * must never look equally weighed.
   */
  ours?: boolean
}

export type Tier = {
  level: 1 | 2 | 3
  title: string
  say: string
  entries: Entry[]
}

export const UNDER_HOOD: Tier[] = [
  {
    level: 1,
    title: 'You were never going to work this out',
    say: 'Invisible during play. No amount of runs would surface these.',
    entries: [
      {
        summary: 'Why the same god keeps coming back',
        body: [
          'Devotion Encounters do not roll freely. Both of the gods they offer are drawn from the ones you have already taken a boon from, and the random fallback only runs when there is nobody to draw from.',
          'A keepsake with charges left can override the first of the two outright, as long as that god is already in your run.',
        ],
        source: 'RewardLogic.SetupRoomReward, lines 267 to 273, through GetInteractedGodThisRun',
      },
      {
        summary: 'What a fourth Olympian actually closes',
        body: [
          'Take a boon from a fourth Olympian and the random pool freezes to the four you hold. Every other Olympian stops being offered at an ordinary Exit, and so does every duo that needed one.',
          'That is not the end of it, and this page used to say it was. The cap is consulted when the pool is drawn and never again: a keepsake with charges left overwrites the choice outright, and all nine Olympians have one. So a fifth god is a keepsake away, and the tool refuses to call any build impossible for wanting one.',
          'Hermes, Chaos, Selene and the gods who interrupt you inside a Location are outside the count and cost you nothing. A Chaos Trial can set the cap to one or two instead of four.',
        ],
        source: 'ReachedMaxGods filtering LootTypeHistory on GodLoot, beside RewardLogic.lua:242, and RunOverrides in BountyData',
      },
      {
        summary: 'Nothing is nudging the odds toward gods you already have',
        body: [
          'An ordinary Exit reward picks uniformly from whatever is eligible. No weighting, no history term, no rubber banding. An Olympian you hold is exactly as likely as one you do not.',
          'What you feel is the two rules above rather than a tilted pool. Below the cap an unheld god never becomes less likely: it goes from fully possible to out of the pool in one step.',
        ],
        source: 'RewardLogic.ChooseLoot',
      },
      {
        summary: 'Damage from Olympians is a list of names, not a set of gods',
        body: [
          'Three things read it: Extended Family, the Earth infusion Rallying Cry, and Argent Skull’s Aspect of Persephone. What they count is damage that came out of one of 63 named projectiles or 3 named effects.',
          'The list includes Artemis and Athena projectiles, and neither of them has a loot set or ever spends an Olympian slot. So the word means one thing in the cap and a different thing here, and which gods you hold does not answer it. Every record in the wiki whose damage is on the list says so, and names the projectile it comes out of.',
        ],
        source: 'WeaponSets.OlympianProjectileNames and OlympianEffectNames, read at TraitData_Hera.lua:1881, TraitData_Elementals.lua:250 and TraitData_Aspect.lua:2061',
      },
    ],
  },
  {
    level: 2,
    title: 'You might get there eventually',
    say: 'Findable, after a lot of runs and some suspicion.',
    entries: [
      {
        summary: 'Rarity is worth far more on some boons than others',
        body: [
          'Every boon carries its own scaling table and the shapes are not alike. Two Zeus boons over the same Common to Heroic jump: Heaven Strike’s Blitz damage runs 80 to 200, and Storm Ring’s bolts run 25 to 40.',
          'That is two and a half times against one and a half, for the same upgrade. The scaling shape is the interesting number, not the base value, which is why every boon in the tool now draws its whole ladder rather than one figure.',
        ],
        source: 'RarityLevels in TraitData_Zeus.lua, resolved through ProcessTraitData',
      },
      {
        summary: 'There is usually more than one way into a duo',
        body: [
          'A duo needs one boon from each of two listed groups rather than two particular boons, and those groups are often a god’s whole core set. Several different boons open the same duo.',
          'So when three of them are on offer, you can take the one that spends a slot you were not going to use instead of the one that costs you your Cast.',
        ],
        source: 'OneFromEachSet in TraitData.lua, and LinkedTraitData',
      },
    ],
  },
  {
    level: 3,
    title: 'You will work this out yourself',
    say: 'And it is better if you do. Open these only if you would rather not wait.',
    entries: [
      {
        summary: 'The real cost of a boon is not its numbers',
        body: [
          'It is the slot. Attack, Special, Cast, Sprint and Magick each hold one boon for the whole run, and filling one closes every build that wanted something else there.',
          'A weak boon in a slot you needed is more expensive than a strong one in a slot you did not.',
        ],
        source: 'GetPriorityTraits, which offers a core boon only while its slot is unoccupied',
        ours: true,
      },
      {
        summary: 'Which of the two Exits actually matters',
        body: [
          'The god, not the boons behind it. By the time you are reading three offers the expensive decision is already made: that god is in your run, and if it was the fourth then the random pool has closed behind it.',
        ],
        source: 'RewardLogic.ChooseLoot, and ReachedMaxGods',
        ours: true,
      },
    ],
  },
]
