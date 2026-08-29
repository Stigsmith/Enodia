# Enodia: Roadmap

**The single status view.** What is done, what is next, what is blocked. Detail lives
elsewhere and is linked, never duplicated: this file says *where things stand*, the others
say *what the thing is*.

Last updated 27 August 2026, game build `138174`.

---

## Where the build is

| | |
|---|---|
| **Phase** | 1, "The Exit" |
| **Build order step** | 10 of 11 complete, step 11 next. **Step 8 was the first shippable point and it is done** |
| **Shippable at** | Step 8, the timeline shell. Useful to a player with no rating engine at all |
| **Stack** | Vite 8, React 19, TypeScript 7, Vitest 4. Scaffolded and building |

**The tool works.** Set up a run, log what each Exit gave, and the timeline records what
each pick closed at the pick that closed it. Settling the fourth Olympian reads "35 builds
closed here" against that entry, and the present entry says what is still live and which god
feeds it. That is the originating complaint answered, and it is the first shippable point.

**And it remembers where you were.** Leave the run and come back, and the timeline opens
under a card: what you were chasing and where it stands now, what moved since you last
looked with the deaths first, what you hold by slot, and how many Exits are left. Pin a
target from the standing drawer and that pin is what the card leads with.

Not shipped yet: the hand-authored page is still `placeholder/index.html` and still what
Netlify serves. Deploying the app is a decision, not a task.

---

## Phase 1 build order

The sequence is fixed in `DESIGN.md` 10. Status only here.

| Step | What | State |
|---:|---|---|
| 1 | Extractor, Lua to `data/generated` | **Done.** 57 files, zero failures. Text and stacking curves included |
| 2 | Validator wired into prebuild | **Done.** 8 checks, 38 unit tests. `npm run build` stops on a broken reference |
| 3 | Asset join, every trait has an icon or a recorded gap | **Done.** 310 of 310 offerable traits and 24 of 24 aspects have art, zero gaps |
| 4 | `engine/slots.ts` and the type layer | **Done.** Inheritance resolved, the lockout encoded, 22 tests |
| 5 | `engine/reachability.ts` | **Done.** Four states, bands, god priority. 114 tests, and it runs against the real 47 targets |
| 6 | `engine/runsim.ts` | **Done.** Seeded, legal runs. The dead-stays-dead property holds over 25 of them |
| 7 | Setup screen, and the rail | **Done.** Weapon, aspect and Exits in, a real RunContext out, and the rail fills as you log |
| 8 | **The timeline shell.** First shippable point | **Done.** Deaths recorded at the pick that caused them, verdicts in the present entry |
| 9 | Verdict snapshotting, `engine/briefing.ts`, re-entry header | **Done.** A trail per run, the diff, the pin, and the card. 16 tests |
| 10 | `engine/rules.ts`, one rule, then `scripts/health.ts` | **Done.** 5 rules as data, the harness that measures them, 17 tests |
| 11 | The offer block inside the present entry | Next |

Later phases are scoped in `REQUIREMENTS.md` 7: **2** before the run, **3** memory,
**4** automation and community.

---

## Blocked, and on whom

| What | On | Note |
|---|---|---|
| Netlify redeploy | The owner | The live page is several revisions behind, and its publish directory is now `placeholder/` rather than `dist/` |
| Two "rooms" on the live page | The owner | The validator reports them. `placeholder/index.html` lines 1106 and 1362 say "ten rooms in" and "encounter rooms". Copy is the owner's to change |
| `feeds` tag | The owner | `DESIGN.md` 12 item 8. Largest hand-authoring job in the project, and the briefing's advice line needs it |
| Archetype `core` / `compatible` / `avoid` lists | The owner | `DESIGN.md` 4.1.4. Not derivable from any file |

---

## Carried over, not done

These are real and none of them block step 2.

**Data**

- ~~Inheritance is not resolved in the extractor~~. **Done.** The extractor runs the game's
  own `ProcessDataInheritance` and writes `traits-resolved.json`. 49 traits state a `Slot`,
  122 carry one afterwards. The validator still walks `InheritFrom` itself for
  classification and `GodLoot`, which is now a redundant second implementation and should
  read the resolved file instead
- `traits.json` is eight entity types in one file. The game tags every one via
  `InheritFrom`, so splitting is mechanical
- 84 of 651 traits have no display name. Believed to be base templates, unverified
- ~~The extractor finds 33 duos. Wikis claim 29 and 37~~. **Answered:** 37 duos, 10
  legendaries, 9 Hex duos, classified by the game's own markers rather than by counting
  prerequisite sets. See `CLAUDE.md`

**Assets**

- ~~144 of 579 trait icons unmatched~~. **Closed for the set that matters:** 306 of the
  310 traits a run can offer have art. The remaining 4 are Daedalus Hammer upgrades that
  are in neither the game package nor the wiki scrape, and they are recorded in
  `data/curated/icons.json` so the build stays honest about them
- ~~Aspect numbering in `assets/aspects/` unverified~~. **Resolved by matching pictures,
  not by assuming.** 24 game icons plus 23 wiki renders, all named by aspect. The Black
  Coat's base render is unusable and is the one real gap left
- Missing: familiars and status effect icons. Tartarus came out of the run history icons,
  and the 4 hammer icons turned out to be present all along
- The Black Coat has no good base render in any source, and five framings were rejected.
  The owner will hunt for one personally. The game's aspect icon carries it until then
- 17 wiki images lost their manifest row when someone moved them between categories.
  `npm run assets` names them
- `placeholder/index.html` inlines its own token copy. `src/ui/tokens.css` is the source,
  and the app now imports it directly

**The open product question, 28 August 2026**

> "A single duo or legendary is not a build. Builds are more intricate, and are often
> centered around a combination of a Daedalus Hammer, a duo, a legendary and a specific
> aspect. Tracking a single duo gives no more of an edge than tracking it in game."

That is right and it changes what the tool tracks. The engine does not need changing: a
build is the same set-cover problem with more sets in it, and `reachable` already takes
targets as an argument. What is missing is the **definitions**, which are judgement and
therefore the owner's, per `CLAUDE.md`. Proposed shape in `data/curated/builds.json`:

```json
{
  "id": "zeus-apollo-double-legendary",
  "name": "Glorious Disaster, both legendaries",
  "say": "what this build does and how it plays, one paragraph",
  "requires": [["ApolloCastBoon"], ["ZeusCastBoon"], ["SpawnKillBoon"]],
  "aspect": "StaffCirceAspect",
  "hammers": ["StaffPowershotTrait"],
  "gods": { "core": ["Zeus", "Apollo"], "compatible": ["Poseidon"], "avoid": ["Hestia"] }
}
```

The 47 duos and legendaries stay as the fallback for a run with no build chosen, since
something has to be tracked before a build is picked.

**The mechanism is built and empty.** `engine/reachability.ts verdictForBuild` judges a
build through the same set-cover code as a duo, counting the aspect and each hammer as
their own set, so an aspect chosen at setup can settle a build before the first Exit.
`data/curated/builds.json` carries the shape and no records. Write one and it works.

**From the owner, 28 August 2026**

- ~~Setup asked how many Exits a run has~~. A player does not know, so it is an estimate
  now, corrected from the run header
- ~~The Exit picker only offered gods~~. It offers what an Exit actually gives, and the
  Encounter gods besides
- ~~A radial weapon picker using the large Codex art, the chosen weapon animating to the
  centre with its four aspects around it~~. Done, and the same ring is now the whole
  picker
- ~~The rail as a permanent sidebar~~. Done, and the timeline is the only thing that
  scrolls now. It unfolds to everything held, by slot, with the game's own sentence on each,
  and every slot has a tooltip
- ~~Which regions each Encounter god appears in~~. **Sourced:** Artemis only in `RoomDataF`
  which is Erebus, Hades only in `RoomDataI` which is Tartarus, Dionysus only in
  `RoomDataP` which is Ephyra. Athena appears in no room data, which fits her arriving
  through her keepsake. The picker filters on it
- **In progress:** a look that is more Crossroads and less web app. The game's own boon
  plates and rarity frames are in `assets/frames/`, and `assets/chrome/` now carries
  `TraitTrayBacking` (the tone-on-tone ornament `VISUAL.md` 1 asks for by name), the tray
  header ribbon, the tooltip nine-slice and the hairline dividers
- ~~The timeline as a separate screen with the picker tacked on underneath~~. **The run is
  one path going down.** Each Exit is a station, centred and large, and the present station
  is the picker itself: kind, then who, then which one, each a ring, skipping any step with
  a single answer. Finishing a pick advances the run and carries the page to the next Exit.
  Going back in time is scrolling up. `Tray.tsx` and `LogPick.tsx` are gone
- ~~The gods as the game's `BoonSelectSymbols` glyphs~~. Reverted on sight. They are small
  glowing marks meant to be read on a door at a distance and they render as coloured dots
  in a list. Portraits, larger than before. `assets/symbols/` keeps the glyphs
- ~~The filigree circle around each bubble~~. **The frame is a setting, and the default is
  drawn rather than taken.** The stone ring went in and came back out, then the whole set
  of game rings went out too, for one reason: **none of them is a circle.** The filigree is
  a 482 by 269 disc with wings, the starburst is a four pointed star, the orbit is a band
  across the middle, and BoonSelect's carved stone is the only round one in the package.
  So `src/ui/frames.ts` now opens with three authored in CSS out of two radial gradients
  and a mask, in the palette's own silver, and keeps five of the game's below them for
  comparison. The menu lists all nine with a swatch each and the choice persists. Both
  kinds run the same custom properties, so the swatch draws what the ring will
- ~~A face fills the circle; nothing else does~~. A boon mark, a slot glyph and a hammer
  are rounded squares and a weapon is a diagonal cutout, and a circular crop takes the
  corners off all of them, so they sit inside the frame instead. `RadialItem.art` carries
  the shape and the variant only supplies its default
- **From the owner, 28 August 2026: 43 named textures and two folders out of the
  extraction.** `npm run chrome` copies them and `scripts/chrome.ts` is the record of who
  picked what and for what. New shelves: `icons/` (7 game UI icons), `familiars/` (50),
  `gifts/` (33 Keepsake portraits). `chrome/` went 14 to 52 and `frames/` 17 to 21.
  **Applied so far:** the boon mark is `Icons/Boon.png`, the rarity stepper carries
  `CardRarityIcon_*`, and the quiet buttons wear `Shell/button.png` with its own highlight
  plate on hover. **Held for where they belong:** the boxes, the choice box, the trash
  button, the splash screens, the sidebars and the familiars
- **The menu exists as a shell.** One button top left, covering rather than pushing, with
  build manager, build exchange, account, friends, leaderboards, settings, help and about
  listed and marked unbuilt. Starting a run is always its first entry
- **Open:** which regions each Encounter god appears in. `RoomData` places Artemis in F,
  Dionysus in P and Hades in I, and says nothing about Athena, so the letter to region
  mapping has to be established before the path can filter anything
- **Open:** the owner reports the Fields offer three Encounters behind one Exit, and that
  the first surface Location is one open city with eight or nine ways out rather than two.
  Both are map generation rather than a table, and neither is modelled
- ~~An Encounter spent an Exit~~. It does not. `RoomLogic.BeginAthenaEncounter` reads
  `CurrentRun.CurrentRoom.Encounters`, plural, so an Encounter runs inside a Location
  already reached, and none of the four Encounter gods appears in any reward store. An
  Encounter entry now carries the number of the Exit that led to its Location and costs
  nothing
- ~~The Exit count was the player's to correct~~. It is derived. Setup used to ask, then the
  run header offered a plus and a minus; both were the tool's question rather than the
  player's, because nobody can correct a number they have no way of knowing. It reads
  "about 7 Exits left" now and the beads say "about 5 more, if this run is a usual length"
- ~~Charon was missing~~. He is a kind now, and he spends an Exit, because
  `ChosenRewardType == "Shop"` is a real door reward: `RoomLogic.lua:4126` says a Shop door
  is the one kind that cannot be rerolled. **A shop is not its own family of rewards, it is
  another route to the ones that exist.** `StoreData.WorldShop` stocks `RandomLoot` and
  `BoostedRandomLoot`, which are a boon from any god and therefore spend an Olympian slot,
  plus `ShopHermesUpgrade`, `SpellDrop` and `WeaponUpgradeDrop`. So picking Charon asks the
  same question the other kinds do, and his Poms and health go under "Something else"

**Step 10, and what the harness caught**

`npm run health` measures each rule against 300 random legal runs and reports the share of
its eligible pool it fires on. `DESIGN.md` 5.1 flags anything at 60 percent, because a rule
that fires on most of what it sees is a constant rather than advice.

It earned its place immediately, and not in the way it was meant to. The first run reported
`feeds-a-target-at-risk` at **73.6 percent** and two rules at **0.0**, and all three numbers
were wrong: the sampler ran every simulated run to completion, so every context it measured
had **zero Exits left**. AT_RISK is universal at the end of a run and `exitsLeftAtLeast` can
never hold there. Fixed, the same rules read 3.0, 30.4 and 32.3 percent. **A measurement
harness can be wrong in the direction of confidence**, and this one nearly got a good rule
cut and shipped two dead ones.

| Rule | Fires on | Of runs |
|---|---:|---:|
| `last-piece` | 32.3% | 72% |
| `spends-the-last-god-slot` | 30.4% | 30% |
| `shuts-a-slot-others-need` | 3.0% | 9% |
| `feeds-a-target-at-risk` | 3.0% | 5% |
| `free-of-the-cap` | not measurable | |

**"Not measurable" is reported apart from "never fires",** because they are different
findings and treating them alike gets good rules cut. `runsim` draws Olympian Exits only, so
a rule about Hermes, Selene or Chaos has no pool in the harness at all.

Two things the rule engine settled that the spec left open. **A binding means the same thing
on both sides of a rule**: `$target` in `when` and in `match` is one target, tried in turn,
and the first that satisfies both is the one that fires and the one the sentence names.
Without that, the coupling rule degrades to "some duo is live and this feeds some duo",
which on 47 targets is nearly everything. And **a rule fires at most once** however many
targets a boon feeds, or the score runs away from the sentence explaining it.

`source` is a third provenance beside `curator` and `wiki`, and the validator now allows it.
Every rule shipped is derived from the game's own tables, and filing that as `curator` would
have recorded a fact as an opinion.

**Step 9, and the one design decision in it**

`DESIGN.md` 6.2 asks for a snapshot on every pick and a diff against it. Taken literally
that diff is always empty: the most recent snapshot is the state the player is standing on.
What makes the card work is the snapshot from *before the gap*, so `enodia.run.snapshot`
holds a **trail**, one small record per pick, plus a `seen` mark for the Exit the player
last read a card at. Still one array of small records per run, which is what 9 budgets.

`Briefing.centre` and `Briefing.advice` are **null and stay null through Phase 1**, which is
`DESIGN.md` 6.1. "Your weight is on Cast" is the sentence a player wants and it cannot be
computed from the game files: `Slot` says which slot a boon occupies, and the boons that
make a Cast build a Cast build mostly occupy none. That wants the curated `feeds` tag.

`Briefing.position` reports `path` and `exitsLeft` and leaves `region` and `nextBoss` null,
for the reason already in this file: `RoomData` places three Encounter gods in lettered room
sets and says nothing about Athena, so the letter to region mapping is not established.

**Engine**

- ~~A filled slot is not a proof of impossible~~. Handled: `obtainability` returns `swap`
  as its own route, and only a set with nothing but swaps left in it is called a long shot
- ~~How the app gets its data~~. `npm run data` projects `data/generated` through
  `src/data/load.ts` into `data/app/app-data.json`, 78 KB and 15 gzipped, imported rather
  than fetched. One mapping, shared by the app, the tests and the validator
- **`publicDir` is `assets/`,** so a manifest path is also a URL. **46 MB ships now**, 23 of
  which is Arcana card art Phase 1 never renders and 9 of which arrived on 28 August and is
  mostly held for later. `frames/circle.png` is the one downscale done so far: 2.37 MB at
  2475 square, 249 KB at 512. The real fix is a build step that copies only what the app
  references, and it is not written
- The Exit count in Setup defaults to 12 and is a placeholder. The real number wants region
  data, which is not extracted
- The verdicts are only as good as the targets. Every duo and legendary is a target today,
  which is 47. Archetypes, once the owner writes them, are what turn that into a shortlist

**Open questions**

`DESIGN.md` 12 holds ten. The ones that will bite first are the `feeds` tag, the
`minRuns` threshold for gap analysis, and whether the save file can seed the run tally.

---

## Where everything lives

| | |
|---|---|
| `CLAUDE.md` | Rules, verified mechanics with sources, errors already made. Loaded every session |
| `REQUIREMENTS.md` | Why it exists, what it is, scope by phase, dead positions |
| `DESIGN.md` | Architecture, the engines, the build order, open items |
| `VISUAL.md` | The visual language. Every colour sampled from the game, with its source file |
| `LESSONS.md` | Engineering discipline carried from the previous tool |
| `assets/README.md` | The image library and its gaps |
| `decisions/` | Decision records, dated. Applied to the documents above, kept for the reasoning |
| `project/` | Configuration for the companion Claude.ai project, not for the product |
