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
| Duo and legendary prerequisites are `OneOf` / `OneFromEachSet`. **The set count does not classify them.** A duo is a duo because it inherits `SynergyTrait`, a legendary because it inherits `LegendaryTrait` | `TraitData.lua`, `LinkedTraitData`, `SynergyTrait.IsDuoBoon` |
| **37 duos, 10 legendaries, 9 Hex duos.** 33 duos state two prerequisite sets and 4 state three. 9 legendaries state three sets and 1, Hermes' Paid Dues, states `OneOf`. The Hex duos carry `IsDuoBoon` themselves and are gated by `GameStateRequirements` with `SeleneDuosUnlocked`, not by `TraitRequirements` | `InheritFrom` closure over `TraitData`, checked by `scripts/validate.ts` |
| **The four-Olympian cap is on the random pool, not on the run.** At the cap `GetEligibleLootNames` returns only gods already held, and then a keepsake overwrites that choice outright without the cap being consulted again. All nine Olympians have such a keepsake, so a fifth god is a keepsake away and the tool must not block one | `ReachedMaxGods`, and `RewardLogic.lua:238` beside `:242` |
| Hermes, Chaos, Selene and the Encounter gods do **not** count toward the cap | `GodLoot = false`, and no `LootData` entry at all for Artemis, Athena, Dionysus, Hades |
| **`GodLoot` is inherited.** Poseidon and Zeus never state it and pick up `true` from `BaseLoot`. Selene's `SpellDrop` inherits from nothing, so it has no flag to pick up. Reading the field without following `InheritFrom` drops two Olympians | `LootData.BaseLoot`, read at `RunLogic.lua:1823` inside `GetInteractedGodsThisRun` |
| Ordinary Exit rewards are **uniform random**. No weighting toward held gods | `RewardLogic.ChooseLoot` |
| **A god is 4 of 18.** The default Exit store is `RunProgress`: 4 Boon slots, 2 Daedalus Hammer, 1 Selene, 1 Hermes, 1 Devotion, 1 Talent, and 8 slots of Poms, health, Magick and gold. A tool that only records gods cannot describe a real run | `RewardStoreData.RunProgress`, and `RewardLogic.lua:516` makes it the default |
| **Artemis, Athena, Dionysus and Hades have no `LootData` entry.** They carry `TreatAsGodLootByShops` in `UnitSetData` with their own pools of 9, 8, 8 and 8, arrive through Encounters, and never spend an Olympian slot | `NPCData_*.lua`, read at `RunData.lua:556` |
| A Daedalus Hammer upgrade belongs to a weapon through **`<Weapon>HammerTrait`** inheritance. 16, 15, 13, 14, 17 and 17 across the six, which is exactly the 92 in `Loot.WeaponUpgrade.Traits` | `TraitData_Hammer*`, checked against `LootSetData.Loot.WeaponUpgrade` |
| Devotion Encounters draw **both** offers from gods already held | `SetupRoomReward`, `GetInteractedGodThisRun` |
| Rarity scaling differs per boon. Heaven Strike 0.8 to 2.0, Storm Ring 1.0 to 1.6 | `RarityLevels` in `TraitData_Zeus.lua` |
| Rerolling is gated behind an Arcana card | `PanelRerollMetaUpgrade`, `CurrentRun.NumRerolls` |
| Arcana card art maps by `Image = "CardArt_NN"`, and a source comment names each card | `MetaUpgradeData.lua` |
| A god enters `LootTypeHistory` on **pickup**, not on offer. Declining an Exit costs nothing | `InteractLogic.HandleLootPickup` |
| **A filled slot blocks the other gods' boon for that slot**, which is the lockout the project exists for | `GetPriorityTraits`: offers a core boon only when `not occupiedSlots[TraitData[name].Slot]` |
| **It is not a proof of impossible.** A swap can still arrive at `ReplaceChance` **0.1**, after two completed runs, and only while the held boon can still be upgraded. `RarityUpgradeOrder` ends at Heroic, so **a Heroic boon locks its slot outright** | `GetReplacementTraits`, `HeroData.BoonData.ReplaceChance`, `TraitRarityData.RarityUpgradeOrder` |
| Attack and Special are **guaranteed** a place in a priority offer that would otherwise contain neither | `guaranteedSlots = {"Melee", "Secondary"}` in `GetPriorityTraits` |
| Only **45 boons occupy a core slot**, nine per slot, one per Olympian. Everything else a god offers occupies no slot at all | `Slot` over `traits-resolved.json` |
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
6. Then claimed a run *allows* four Olympians, and blocked a fifth in the builder.
   `ReachedMaxGods` is real and only governs `ChooseLoot`. Eight lines later
   `RewardLogic.lua:242` replaces its answer from any held `ForceBoonName` with
   `Uses > 0`, cap unread. Read one line of a function and stopped, which is
   error 3 again one layer down
4. Used "door" throughout for something the game calls an Exit
5. Counted 33 duos and 13 legendaries by counting prerequisite sets. The game marks both
   itself and the real split is 37 and 10. Same shape as error 3: a proxy for the property,
   never checked against the property

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
  injects one, so encoding bugs are invisible there and reach any host that does not.
  Cloudflare is one
- `assets/build-lib.ps1` rebuilds only the wiki half. **The guard is by file extension
  now:** it deletes `.webp` and never `.png`, and stays out of `arcana/`, `hexes/`,
  `rarity/` and `vows/`. Deleting whole directories, which it used to do, would take the
  game art in `boons/` and `duos/` with it. Do not remove that guard
- **`worker/schema.ts` is generated and `worker/schema-app.ts` is not.** Anything of ours
  put in the generated file survives until the next `npm run db:schema` and then vanishes
  without a word, taking the migration history's idea of reality with it. `drizzle.config.ts`
  reads both
- **The local D1 is keyed by `database_id`, so changing that id orphans it.**
  Editing `wrangler.jsonc` from the placeholder to the real id silently pointed
  `wrangler dev` at a fresh empty database, and the only symptom was a 500 on any
  request carrying a session cookie: `no such table: session`. Nothing else broke,
  because every endpoint that does not touch the database kept working.
  `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` grows one `.sqlite` per id.
  **Re-run `npm run db:migrate` after any change to that id**
- **`run_worker_first: ["/api/*"]` is the line that keeps hosting free.** Static asset
  requests are unlimited on every Cloudflare plan; Worker invocations are 100k/day. Assets
  are matched first by default, so the API script did not change that, and this names the
  only paths that reach it. Setting it to `true` makes every wallpaper a billable call
- **`worker/schema.ts` is generated by `npm run db:schema`, which runs `npx auth@latest`.**
  **Not `@better-auth/cli`**, which npm will happily install and which is pinned several
  minors behind: it emits an `account` table with no `issuer` column, that column is
  `NOT NULL`, and nothing fails until the first sign-up. Two CLIs, one right answer, and the
  wrong one is the more obvious name
- **better-auth's rate limiting is OFF on Workers unless you say otherwise, and the default
  reads as though it is on.** It is `enabled: options.rateLimit?.enabled ?? isProduction`,
  and `isProduction` is `NODE_ENV === 'production'`, which Workers never sets. Measured: 150
  wrong-password attempts in 12 seconds, all 401, not one 429. `worker/auth.ts` now states
  it, with `storage: 'database'` because a Worker's memory is per-isolate and a memory
  counter on an edge is close to no counter
- **The client IP is `cf-connecting-ip` here, never `x-forwarded-for`.** better-auth defaults
  to the latter, and Cloudflare *appends* to it rather than replacing, so a caller who sends
  their own arrives with a value of their choosing in front. Every rate limit is keyed on
  that address, so the default would let anyone reset their own counter with a header
- **better-auth has no D1 support**, whatever a search result says. Checked against the
  shipped package at 1.7.2: no `D1Database` anywhere, and its Kysely adapter carries only
  Postgres and MySQL dialects. The path is Drizzle with `provider: 'sqlite'`, and
  `transaction: false` because D1 batches rather than doing interactive transactions
- **Response headers are checked with `wrangler dev`, never inferred.** The `workers`
  config in `.claude/launch.json` serves `dist/` on 8787 with `assets/_headers` actually
  applied. This matters more than it sounds: `netlify.toml`'s rules were live in nobody's
  browser for the whole of Phase 1, because the CLI deploy never read the file, and no build
  and no test could have told you. Curl the real response
- **`assets/_headers` and `assets/fonts/` are not art**, and they sit in `assets/` because
  that is Vite's `publicDir` and therefore the only route into `dist/`. All three scripts
  that walk that directory filter to image extensions, so neither is visible to any of them.
  Check that again before adding a third non-image
- **`npm run assets` is the only writer of `assets/manifest.json`.** The PowerShell used to
  write it too, which is why the manifest went stale the moment a category held art the
  PowerShell never sees. `--fill` copies missing icons out of `extracted/` first
- **The asset join lives in `src/data/icons.ts` and nowhere else.** Slug from display name,
  one rule, shared by the validator, the fill script and the UI
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
| Duos, inheriting `SynergyTrait` | **37** |
| Legendaries, inheriting `LegendaryTrait` | **10** |
| Hex duos, `IsDuoBoon` on the record | **9**, one per Olympian |
| Gated boons, `OneOf` | 32 |
| Trait references resolving, across every generated file | **2203 of 2203** |
| Requirement references unresolved | **0** |

The 46 `OneFromEachSet` blocks split 33 + 4 + 9: two-set duos, three-set duos, three-set
legendaries. The tenth legendary and the nine Hex duos state their gates elsewhere.

These are the numbers `npm run validate` prints and `data/baseline.json` holds it to.

**Inheritance is resolved.** `traits-resolved.json` runs the game's own
`ProcessDataInheritance` and `DeepInheritData` from `RunData.lua`, with
`inheritanceIgnores = { "DebugOnly" }`. It matters more than it sounds: **only 49 of 651
traits state a `Slot` and 122 carry one afterwards**, so anything asking what slot a boon
occupies is blind without it. `traits.json` stays the raw declaration, because
`TraitRequirements` and `LinkedTraitData` are written against that.

**Not yet done:** display names. `Content/Game/Text/en/TraitText.en.sjson` is sjson, not
Lua, and needs its own loader. Nothing renders to a player until that exists.

**Closed question:** the wikis' 37 was right and the extractor's 33 was a definition, not a
count. The four missing duos state three prerequisite sets rather than two: Heinous Affront,
Natural Selection, Ripple Effect and Beach Ball. Every one inherits `SynergyTrait` and every
one is offered by two gods, so the game calls them duos and so do we. Where 29 came from is
still unknown, and it does not matter now that the marker is the source.

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

**Followed through on 27 August 2026.** The asset join copied 106 icons out of the
extraction into `assets/`. **310 of 310 traits a run can offer, and 24 of 24 weapon aspects,
now have art.** Zero recorded gaps. The library is 669 images and `assets/manifest.json`
finally describes it.

**And the same mistake again, one layer down.** The first pass concluded four hammer
upgrades and every aspect icon were absent, because the prefix rule stripped `Hammer_` the
way it strips `Boon_`. `Boon_Apollo_37` packs as `Apollo_37`, but `Hammer_Suit_01` packs as
`HammerSuit_01`: only the underscore goes. One rule was assumed to cover both. Try every
shape of a name before believing an absence, which is now what `scripts/assets.ts` does.

**Six aspects are called "Aspect of Melinoë"**, one per weapon, so a display-name join
resolves five of them to the wrong picture. Aspect keys are `<weapon>-<aspect>`.

**Gold is not a Hades II chrome colour.** Sampled 247,921 chrome pixels across ten `GUI/`
folders. Silver 26.8%, jade 18.9%, gold band 15.1%, but that band is mostly parchment and
shadow, and its bright quarter is pale yellow highlight rather than metal. Real brass is
about 2.6%. `BoonSelect` is 55% silver and 0.1% gold. `--brass` stays deleted.

Both errors have the same shape, and it is the shape of the `MaxGodsPerRun` mistake:
**a negative result from a search proves something about the search.** Extract, then match
against the data. Never conclude absence from a naming assumption.
