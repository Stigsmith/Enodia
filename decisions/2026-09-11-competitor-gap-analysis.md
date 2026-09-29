# Decision: the competitor gap analysis, and the game's own stat lines

11 September 2026. From a planning session comparing Enodia with Mobalytics, at the owner's
request. The owner brought eight observations as symptoms rather than specs. Each got a
verdict, options with their tradeoffs and a recommendation, and every mechanic the assessment
leans on was read in the files first.

The brief named a second site and left it as a placeholder. The owner confirmed it was
Mobalytics only, and added BrokenBuilds as an observation: a wall of text, numbers and filters
with no obvious way in, which matches `REQUIREMENTS.md` 2 from 22 August.

---

## What was decided

**Phase A, done the same day.** Mechanical, in scope, and needing no product decision:

- The game's stat lines on the hover and in the dialog, with a rarity ladder where the number
  moves with rarity, and the element on the kind line
- Projectile base values, read out of `Content/Game/Projectiles/*.sjson`
- Every boon's numbers read at the rarity the game's own Codex shows, at every corner of a roll
- The corrections to this project's own documents listed at the end

**Phase B, each waiting on the owner's yes**, in the recommended order:

1. Keepsakes as an ordered list of four, by position
2. The Olympian damage warning in the build checker, from a traced per-trait table
3. A short note on each pick, and `@` mentions stored as ids
4. The evidence filter on the exchange: cleared by at least N other players on this version
5. Every entity's full record at an address, and "Under the hood" brought back, re-verified

**Not recommended now:** a sectioned long-form editor, a rich-text editor, a `/` menu, a guide
type, tier lists, and staff verification. Collections of builds get another look after B3.

## The verdicts

| Observation | Verdict | Recommendation |
|---|---|---|
| Hover cards | Real gap. Most of it was the game's own stat line, which Enodia did not render | **Done** for stat lines and elements. Olympian damage goes in the full record, and as a warning only on builds holding something that reads it |
| Guide format | Partly real. The missing piece is the author's reason for each pick. Length is a different product | A short note on each pick. No sectioned long-form editor |
| Tagging entities into text | Real, and a data feature before it is a writing feature | An `@` picker in plain text that stores ids, with the build's own picks ranked first |
| Verified and Community | Their version does not apply. Enodia's per-version counts are a better signal | A filter on the one list, labelled with the count it rests on. Nobody grants it |
| Guides as their own type | Mostly outside scope. One smaller form fits | Not now. Collections of builds later |
| Tier lists | A different product | Do not build. The facet boards are the honest version |
| The wiki | Real gap, and Enodia's strongest position. It reverses a written non-goal | Every entity's full record at its own address, generated. Bring back "Under the hood" |
| Per Region | The premise fails in two run modes. One per-Region fact belongs in a build | Four keepsakes, by position. Per-Region history derived from logged runs |

## What was examined

- **Mobalytics, live.** The sixteen PDFs the owner attached are page captures with no text
  layer, 65 to 210 words each, all of it URL and date, so the pages were read in a browser: the
  Circe build, the guides index, the Gods tier list, the tier list index, the wiki index and
  the boons catalogue. The editor screenshots were read as images.
- **The game files**, including `Content/Game/Projectiles/`, which nothing here had read.
- **Enodia**: `Peek.tsx`, `PieceCard`, `BuildEditor.tsx`, `data/builds.ts`, `state/transfer.ts`,
  the exchange and boards workers, the three design documents, and the placeholder page
  deleted in `6900c00` that morning.

What Mobalytics has, measured rather than impressed by:

- **Builds.** Verified is granted by hand: the author attaches a run video and asks a staff
  member on Discord. The four Verified builds carry the attention, 87 favourites on the Circe
  build, and community builds have 1 to 4.
- **Guide format.** The Circe build is about 2,400 words of page text with 110 entity icons
  inside 81 paragraphs and list items, roughly one per 22 words. The editor has six sections of
  up to 10,000 characters, each with a prompt, and three of the prompts ask the author to explain
  groups the Full Build panel above already lists. The published page has subsections called
  Keepsakes, Arcana Cards, God Pool, Hammers, Hex and NPC Boons, so the loadout appears twice.
- **Guides.** Mechanics explainers, one god guide, boss and speedrun strategy. Nearly all by
  the site, 2 to 4 favourites each.
- **Tier lists.** Six staff lists, each one named player's S, A and B ranking, labelled
  Verified, 3 to 12 favourites. A planner for community lists, which have 0 to 4.
- **Wiki.** Nine catalogue pages and six arm pages. No page per boon: a boon exists as a hover
  card on a catalogue page.
- **Keepsakes.** The planner holds a starting keepsake and three more.

## Mechanics read for this

| Fact | Source |
|---|---|
| "Damaging effects from Olympians" means a projectile in `WeaponSets.OlympianProjectileNames` (63) or an effect in `OlympianEffectNames` (3: `DamageShareDeath`, `BurnEffect`, `DamageOverTime`) | `WeaponSets.lua:377`, `:395` |
| Three records read those lists: Extended Family (`DamageShareRetaliateBoon`), the Earth infusion `ElementalOlympianDamageBoon`, and the aspect whose `ChargeSkullImpulse` charges from them, which the patch notes name as Argent Skull's Persephone | `TraitData_Hera.lua:1878`, `TraitData_Elementals.lua:227`, `TraitData_Aspect.lua:2053`, `PatchNotes.en.sjson:514` |
| The lists name Artemis and Athena projectiles, so "Olympian" in the damage sense is not the nine `GodLoot` Olympians | `WeaponSets.lua:413-419` |
| Extended Family adds `(PerUniqueGodMultiplier - 1) * UniqueGodCount`. `UniqueGodCount` counts distinct sources passing `IsGodTrait(..., ForShop, ForLastRunBoon)`: the nine Olympians plus Hermes, Artemis, Athena and Dionysus. Hades, Chaos and Selene do not count | `CombatLogic.lua:664-665`; `TraitLogic.lua:707-736`, `:1547`; `LootData_Hermes.lua:11`; `RunData.lua:556`; `NPCData_Hades.lua:18` |
| A boon's numbers are its `BaseValue`s times its rarity's multiplier, at any depth of the record, rounded to two places. A `SourceIsMultiplier` value scales only the part above 1 | `TraitLogic.lua:152-174`, `:213-345`, `ProcessValue` at `:349` |
| The Codex shows a plain boon at Common, a duo at Duo, a legendary at Legendary, with the low end of a rolled base | `GetBoonRarityFromData`, `BoonInfoLogic.lua:71`, called at `:121` with `ForceMin` |
| A number can roll twice, independently: its base between `BaseMin` and `BaseMax`, and its rarity's multiplier between `MinMultiplier` and `MaxMultiplier`. 57 of the 203 boons, duos, legendaries and Hexes the app shows roll at one rarity or more | `TraitLogic.lua:158`, `:252` |
| `MultiplyByBase` and `ProjectileBase` both call `GetBaseDataValue({ Type = "Projectile" })`, and the engine's projectile records are in `Game/Projectiles/*.sjson` as text. `ZeusEchoStrike` states `Damage = 100` | `TraitLogic.lua:2063`, `:2200`; `PlayerProjectiles.sjson:7980-7987` |
| A stat line's number is the Nth extract entry that is not `SkipAutoExtract`, dressed as `PercentNewTotal` (`:P`), `FlatPercentNewTotal` (`:F`), `DeltaNewTotal` (a written `+`) or `NewTotal` (bare) | `SetTraitTextData`, `TraitLogic.lua:2426-2468`; `PercentFormatNamesLookup`, `UIData.lua:3`; `TraitText.en.sjson:143-196` |
| `{$TooltipData.X}` is field X of the processed record, which the Codex hands to the text as its `LuaValue` | `BoonInfoLogic.lua:186` |
| A run passes `FullRunBiomeCount = 4` Regions, in the order the bounty bases state as `BiomesReached` | `NarrativeData.lua:9077`, `BountyData.lua:158-235` |
| Chaos Trials can start in a later Region: real trials inherit `BasePackageBountyBiomeG`, `H`, `O` or `P` | `BountyData.lua:158-235`, `:357-386` |
| Dream runs visit four Regions in random order across both routes | `DreamRunLogic.lua:1-41`, `:73` |
| No vow sets a starting Region or an order | `ShrineData.lua` |
| The keepsake rack is referenced in `RoomDataF`, `G`, `H`, `N`, `O`, `P` and three times in `RoomDataDream`, not in `I` or `Q` | `WorldUpgradePostBossGiftRack` |
| Two display names collide among the 567 named traits: Aspect of Melinoë six times, Ambition twice | `app-data.json` |

**Inferred rather than read.** `:P` and `:F` belong to the engine's text formatter, which is not
Lua. `:P` is read as a signed percentage from how the text uses it, and `:F` as an unsigned one
because Moonlight Dress says "use {...:F} Magick less than before" over a value of -30. One look
in game at a Heroic boon would confirm both.

## What Phase A changed, measured

| | Before | After |
|---|---:|---:|
| Values unread in descriptions | 193 | **27** |
| Stat lines drawn | 0 | **275**, on 275 traits |
| Stat lines with a rarity ladder | 0 | **149** |
| Values unread in stat lines | | **11**: ten Hex costs and Blinding Rush's Sprint Speed |
| `app-data.json` | 148.6 KB | 167 KB |
| `projectiles.json` | | 68 projectiles, 5 with an inherited value, 5.8 KB |

Two golden cases, traced end to end and pinned in `scripts/values.test.ts`: **Heaven Strike's
Blitz is 80, 120, 160 and 200**, and **Extended Family is +3%, +4%, +5% and +6% per god**.

**153 descriptions only had holes filled. Four numbers became holes, and every one of the four
was wrong before.** Heartfelt Condolences, Mystic Secrets and Ancestral Offering said "+1
health" or "+1 Magick", which is the number of drops: `HealDropAmount` multiplies by a
`ConsumableData` value this project does not extract. Giga Moonburst said "+40 Magick", which is
a charge stage's whole cost where the game subtracts the first stage's. The second pass of
`SetTraitTextData` is what caught all four.

## By observation

### 1. Hover cards

In the game a boon's tooltip is its description plus stat lines. Enodia drew the description
only, so Heaven Strike read "Your Attacks inflict Blitz." and gave no number, where the game and
Mobalytics both show one. Now done.

**Where the hover stops.** It holds what the game's tooltip holds: name, a kind line of slot,
gods and element, the description and the stat lines, plus at most one line conditioned on the
build or run in view. Anything relating the entity to others goes in the full record one click
away: prerequisites, what it unlocks, the stacking curve, Olympian damage, which published builds
use it. If a piece of it needs a heading, it belongs in the record. BrokenBuilds is what a page
looks like when nobody draws that line.

**Surface what the game does not say, or not?** Both, in different places. The hover says the
game's words. The record adds what the game never states, each fact with its symbol, in the
derived register. Extended Family is the model: the game says "for each Boon-giver you have", and
the record can say which givers count and that it boosts only the listed projectiles and effects.

### 2. Guide format

Two parts of Mobalytics' density are the format's: prompts that mirror the panel, which invite
restating the loadout, and inline icons at one per 22 words. The length is the author's. Enodia's
gap is the reason for each pick, which Mobalytics' sections are all asking for in different
words. A short note keyed to a trait id shows where the reader already looks, stays visibly the
author's, goes when the pick goes, and can sit on the offer card at the Exit where that boon is
offered. The cap on length is deliberate, and it is the constraint authors may resent.

### 3. Tagging entities into text

A reference that stores an id, draws the game's art and hover, survives a rename through
`aliases` and resolves against data regenerated each patch is something a hand-kept wiki cannot
match. The interaction is `@` in the existing plain-text fields, inserting a token. No rich-text
editor, whose stored markup a stranger would see. No matching of display names, which is wrong
for the eight colliding names. No `/` menu, which has nothing to command in a field with no
formatting. The picker ranks the build's own picks first, then the same gods' other boons.

### 4. Verified and Community

On 8 September the owner removed the one staff-picked shelf, because people find what they want
themselves. A staff badge would bring it back under another name. `exchange_stat` already holds
per-version runs, clears, best Fear and ratings from followers, with the author's own refused.
Verification here is a threshold on that evidence, derived and never granted, as a filter on the
one list. The owner's lean was a filter, and that is right.

### 5. Guides as their own type

Explainers are what "Under the hood" was designed to be. The derivable half of a god guide is an
entity record. Strategy is not what a run companion does. A collection of builds, anybody's, with
an intro and a note per entry, is the part that fits, and it is built from per-pick notes and
mentions, so it waits for them.

### 6. Tier lists

A tier list answers the absolute question and `REQUIREMENTS.md` 3 says the conditional one is the
product. `REQUIREMENTS.md` 8 asks for a credible consensus before any second-opinion column, and
one player's list labelled Verified is not one. `worker/boards.ts` already ranks facets by counts,
one counted column and never a score. Add a board if one is missing.

### 7. The wiki

567 named traits with the game's text, stat lines, prerequisites, elements, rarity tables and
stacking, regenerated per patch, is more than Mobalytics' wiki holds, and mentions need somewhere
to lead. It reverses `REQUIREMENTS.md` 4 "Not a wiki", which is the owner's call. The deleted
placeholder page gave the owner's earlier answer: not an encyclopedia, with mechanical
explanation where it earns its place, in tooltips and in why a rule works. An address per
entity's record, generated, is that position. Pre-rendered static pages for search engines is a
separate positioning decision.

### 8. Per Region

The premise fails in two modes: a Chaos Trial can start in the second or third Region with a
loadout held, and a Dream run visits four Regions out of order across both routes. So a note keyed
to a Region's name fails in Dream runs and one keyed to "Region 1" fails in Chaos Trials. The one
per-Region fact that belongs in a build is the keepsake, four of them, keyed by position. What to
focus on is advice and belongs in notes on picks. What happened is derivable from a logged run.
`shapeOf` must hash a build with no extra keepsakes exactly as today, or every listing's counts
reset.

## Corrections made to the project's own documents

1. `ProjectileBase` is answerable. `scripts/values.ts`, `scripts/extract.mjs` and `ROADMAP.md`
   said it never would be. `CLAUDE.md` error 9
2. `REQUIREMENTS.md` 7: keepsake sequencing had "no competitor". Mobalytics has four slots
3. `REQUIREMENTS.md` 2 described Mobalytics' editor as unguided. It prompts each section now
4. `ROADMAP.md` said the letter-to-Region order was not established. `BiomesReached` states it
5. "Under the hood" is listed under Phase 1 in `REQUIREMENTS.md` 7 and left the product with the
   placeholder page. Noted where it was listed
6. `CLAUDE.md` carries the new mechanics with their sources, and a note that "Olympian" names two
   different sets in the source

## Leads, not done

- **The per-weapon `WeaponData_*.lua` files are not loaded**, so a number reading a weapon's own
  record stays a `#`: the ten Hex costs, and Giga Moonburst's first charge stage. Loading them
  also exposes a conflation: `values.ts` reads `BaseType = "Weapon"`, which is engine data and
  probably lives in `Game/Weapons/`, out of Lua `WeaponData`. Untangle both together
- **Which boons' own damage counts as Olympian damage** needs a traced per-trait table before B2.
  A string scan found 85 of the 203 naming a listed projectile or effect, and 50 whose text
  mentions damage while naming neither, Flutter Strike and Nova Strike among them. A lead, not a
  table
- **`src/data/roadmap.ts` "Boon interaction data"** says the files state no interaction between
  boons. The Olympian damage lists are one they do state. The copy is the owner's
- **`NextRoomSets`**, which `DreamRunLogic` reads, is the table to read for the Region order
