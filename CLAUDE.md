# Enodia

An in-run build companion for Hades II. **`ROADMAP.md` is the status view**: what is done,
what is next, what is blocked, and where every document lives. This file is the rules.

`REQUIREMENTS.md` for what it is and why, `DESIGN.md` for how it is built, `VISUAL.md` for
how it looks, `assets/README.md` for the image library.

---

## The rule that matters most

**The game ships its logic as plain-text Lua. Read it. It is the first source, not the last
resort.**

```
C:\Program Files (x86)\Steam\steamapps\common\Hades II\Content\
  Scripts\*.lua              679,152 lines. Every mechanic is stated here
  Game\Text\en\*.sjson       Display names, and the game's own Keywords glossary
  Packages\1080p\*.pkg       Art. Extract with deppth2, see assets/README.md
```

Reading this is read-only and outside the project folder. That is deliberate and the owner
knows. Do not copy the install into the project; read it in place.

### Order of authority, fixed

1. `Content/Scripts/*.lua` and `Content/Game/Text/en/*.sjson`
2. The owner, who plays the game
3. Nothing else

Wikis, guides, Steam threads and search results are **leads to verify, never sources to
cite**. Three wrong claims have already reached a published page from stale search results.

### Assistant knowledge of Hades 2 is unreliable

Detailed writing about how the game works under the hood is abundant for **Hades 1** and
thin for **Hades 2**. Anything that feels like recalled knowledge about Hades 2 internals
most likely predates 1.0 or is Hades 1 bleeding across. Treat it as worthless.

### Reading source is not the same as understanding it

The worst error so far came from real source, correctly quoted, and was still wrong:
`MaxGodsPerRun = 4` was read without tracing which loot types carry `GodLoot`. The cap is
four **Olympians**, not four gods.

So: **follow every symbol in a condition to its definition, and name the symbols in the
claim.** "Capped at four Olympians, per `ReachedMaxGods` filtering `LootTypeHistory` on
`GodLoot`" is auditable. "Capped at four gods" is not, which is why it survived to the page.

Also check for overrides. `MaxGodsPerRun` is 4 in `HeroData` and 1 or 2 under `RunOverrides`
in `BountyData`.

---

## Use the game's words

The game publishes a `Keywords` glossary. Player-facing term first, then the Lua term, then
and only then something we invent.

| Player-facing | Internal | Note |
|---|---|---|
| Boon | `GodBoon`, `Trait` | |
| **Location** | `Room` | never "room" |
| **Region** | `Biome` | never "biome" |
| **Exit** | `Door` | never "door". `ExitNotActive` renders as "Exit Blocked!" |
| Passage | `Barricade` | |
| Encounter | `Encounter` | |
| **Hex** | `Spell`, `SpellDrop` | never "spell" |
| Attack | `Melee` | |
| Special | `Secondary` | |
| Cast | `Ranged` | |
| Sprint | `Rush` | |
| Magick | `Mana` | |
| Ω Moves | `Omega` | |

UI strings use the left column. Code identifiers may use the right.

---

## Verified mechanics, with their sources

Do not restate these without the citation. Do not extend them without checking.

| Fact | Source |
|---|---|
| Duo and legendary prerequisites are `OneOf` / `OneFromEachSet`. Duos span two Olympians, legendaries use three sets from one | `TraitData.lua`, `LinkedTraitData` |
| A run allows **four Olympians**. At the cap the Exit pool freezes to those held | `HeroData.MaxGodsPerRun`, `ReachedMaxGods` |
| Hermes, Chaos, Selene and the Encounter gods do **not** count toward the cap | `GodLoot = false`, and no `LootData` entry at all for Artemis, Athena, Dionysus, Hades |
| Ordinary Exit rewards are **uniform random**. No weighting toward held gods | `RewardLogic.ChooseLoot` |
| Devotion Encounters draw **both** offers from gods already held | `SetupRoomReward`, `GetInteractedGodThisRun` |
| Rarity scaling differs per boon. Heaven Strike 0.8 to 2.0, Storm Ring 1.0 to 1.6 | `RarityLevels` in `TraitData_Zeus.lua` |
| Rerolling is gated behind an Arcana card | `PanelRerollMetaUpgrade`, `CurrentRun.NumRerolls` |
| Arcana card art maps by `Image = "CardArt_NN"`, and a source comment names each card | `MetaUpgradeData.lua` |
| A god enters `LootTypeHistory` on **pickup**, not on offer. Declining an Exit costs nothing | `InteractLogic.HandleLootPickup` |
| The Huntress fires below **99%** Magick, not "when low" | `LowManaThreshold = 0.99` in `TraitData_MetaUpgrade.lua` |

### What the files cannot tell you

Mechanics are in the source and are mine to go read. **Evaluations are not, and must come
from the owner**, who has around 300 hours across both games.

Not derivable from any file: that a Pom is worth more than a boon from a god outside the
build, that Ares regen pins Magick at full and switches The Huntress off, which gods pair
well beyond what duos imply, or which archetype wants which Arcana.

When given one of these, **go and check whether the files agree and why.** The owner's
heuristics have so far all been mechanically correct, and the source usually adds precision
the play experience cannot see.

### Errors already made, kept so they are not repeated

1. Claimed the Codex cannot track a chosen duo. It can
2. Described an Exit as offering three boons. You pick an Exit, then the god behind it offers three
3. Claimed a cap of four gods. It is four Olympians
4. Used "door" throughout for something the game calls an Exit

---

## House style

- **No em dashes.** Not in UI copy, code comments, commit messages or replies. No ASCII substitutes
- **Plain writing.** No aphorisms, no two-beat inversions, no clever parallel constructions.
  Say the thing
- Product decisions and naming are the owner's. Implementation internals are decided and
  stated with reasoning
- An admitted gap beats a hedged guess
- Verify by loading the page and reading the DOM. A green build proves nothing

---

## Practical notes

- **Python** is at `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`. Its `Scripts`
  directory is not on PATH, so call `deppth2.exe` by full path
- **The preview pane cannot load `dist/index.html` from a `file://` path** because it inlines
  local files as data URLs and the page is over 1 MB. Use `preview_start` with the
  `placeholder` config in `.claude/launch.json`, which serves `dist/` on port 8777
- **Screenshots need the Browser pane open.** If they time out with "not compositing frames",
  ask the owner to open the pane. Computed styles are not a substitute: a `<meta charset>`
  bug that mangled every `·` on the live site was invisible to DOM queries and obvious in a
  screenshot
- **`dist/index.html` must keep its own `<meta charset="utf-8">`.** The Artifact wrapper
  injects one, so encoding bugs are invisible there and live on Netlify
- `assets/build-lib.ps1` rebuilds only the wiki-sourced categories and is coded to preserve
  `arcana/`, `rarity/` and `vows/`, which came from the game. Do not remove that guard
- `extracted/` holds 364 MB of `GUI.pkg` output and is scratch, not source

---

## The extractor, and what it took to build

Status lives in `ROADMAP.md`. This is the reference.

`npm run extract` runs `scripts/extract.mjs`, which loads the game's Lua in a
[wasmoon](https://www.npmjs.com/package/wasmoon) state and writes `data/generated/*.json`.
**57 files load, zero failures**, against game version `138174`.

What it took, so nobody rediscovers it:

- The data files call exactly five helpers at load time: `OverwriteTableKeys`,
  `ConcatTableValues`, `ToLookup`, `CombineTables`, `ShallowCopyTable`. Bodies are copied
  from the game's own `UtilityLogic.lua` and `Main.lua` so behaviour matches
- **Load order is a real dependency graph.** `TraitData.lua` reads
  `LootData.TrialUpgrade.PermanentTraits`, so the loot files must load first and `LootData`
  gets assembled from `LootSetData` in between
- `ColorData.lua`, `EffectData.lua` and `EnemySets.lua` are **loaded, not stubbed**. The
  trait data does arithmetic on `EffectData.AresStatus.BonusBaseDamageOnInflict`, so a stub
  would silently produce zeros
- Genuinely external, safe to stub: `GameData`, `PresetEventArgs`, `HeroVoiceLines`,
  `ScreenData` and friends. They auto-vivify and every read is logged

Verified against the criteria in `DESIGN.md` section 10:

| Check | Result |
|---|---|
| `TraitRequirements` entries | 78 |
| Duos, `OneFromEachSet` with 2 sets | **33** |
| Legendaries, 3 or more sets | **13** |
| Gated boons, `OneOf` | 32 |
| `LinkedTraitData` ids resolving to a real trait | **118 of 118** |
| Requirement references unresolved | **0** |

33 + 13 = 46, matching the 46 `OneFromEachSet` blocks in the raw file.

**Not yet done:** display names. `Content/Game/Text/en/TraitText.en.sjson` is sjson, not
Lua, and needs its own loader. Nothing renders to a player until that exists.

**Open question:** the extractor finds 33 duos. Wikis variously claim 29 and 37. Worth a
validator check rather than a guess about who is right.

---

## Stacking curves, and what "diminishing returns" actually means

`data/generated/stacking.json` answers "how many Poms is this boon worth". It is derived,
not judged, and it covers **20 traits**. Everything else stacks linearly.

Poms raise a trait's `StackNum`. `TraitLogic.GetProcessedValue` then applies, per extra copy
`i`:

```
multiplier = (1 + IdenticalMultiplier.Value) * decay^(i-1)     clamped to a floor
```

`TraitMultiplierData` gives the defaults: **decay 0.5, floor 0.1**. So each extra copy is
worth half the last until it bottoms out at a tenth of the base increment. The floor is
never zero, so a boon never becomes literally worthless, only nearly so.

Five curve shapes come out of that:

| Shape | Meaning |
|---|---|
| `floors` | Decays to the floor at `worthTaking` copies. The normal case, 17 traits |
| `immediate` | Already at the floor on the second copy. Take once |
| `none` | `Value = -1`, so extra copies contribute exactly nothing |
| `converges` | Negative multiplier shrinking toward zero. No hard stop |
| `linear` | No decay defined. Every copy worth the same |

Range in practice runs from **Blinding Rush and Buried Treasure at 1** to **Dying Wish and
Back Burner at 9**.

### Two traps in this data

- **A trait can carry several curves**, one per property it modifies. Buried Treasure has
  one curve governing four properties. They are grouped by curve parameters, not flattened
- **Absence is meaningful.** A trait missing from `stacking.json` has no diminishing point
  at all. Do not render "unknown", render nothing, or say it stacks linearly

### What this does not cover

The other kind of falloff, where a chance-based effect nears 100%, or flat damage stops
mattering against a large pool, is **not in the files**. That is a judgement and belongs in
the curated layer with a visible byline, never mixed in with these numbers.

---

## Two corrections worth carrying forward

**Boon icons are in `GUI.pkg`.** An earlier note in `assets/README.md` said they were not,
because grepping the package manifests for `Boon_` returned nothing. The packed sprites drop
the prefix: the data says `Boon_Aphrodite_27`, the file is `Aphrodite_27.png`. Matching the
trait data against the extraction finds **435 of 579 icons**.

**Gold is not a Hades II chrome colour.** Sampled 247,921 chrome pixels across ten `GUI/`
folders. Silver 26.8%, jade 18.9%, gold band 15.1%, but that band is mostly parchment and
shadow, and its bright quarter is pale yellow highlight rather than metal. Real brass is
about 2.6%. `BoonSelect` is 55% silver and 0.1% gold. `--brass` stays deleted.

Both errors have the same shape, and it is the shape of the `MaxGodsPerRun` mistake:
**a negative result from a search proves something about the search.** Extract, then match
against the data. Never conclude absence from a naming assumption.
