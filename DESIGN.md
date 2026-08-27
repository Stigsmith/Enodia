# Enodia: High-Level Design

Draft 1, 22 August 2026. Implements `REQUIREMENTS.md`. Read that first for the why.

---

## 0. What changed since the requirements

The requirements listed six things to verify before writing data. The most important one is
now settled, and it changes the data layer completely.

**The game ships its logic as 479 plain-text Lua files** at
`Content/Scripts/` in the Steam install. Not packed, not encrypted, not compiled.

Verified 22 August 2026 against the local install:

| Question from REQUIREMENTS section 12 | Answer |
|---|---|
| Does the game ship readable data files | Yes. 479 `.lua` files, plain text |
| How are duo prerequisites specified | `OneFromEachSet`, a formal constraint structure. Section 3.2 |
| Rating per boon, or per boon and rarity | **Per boon and rarity.** `RarityLevels` appears 382 times in the trait data |
| Full roster at current patch | Derivable by script. Section 3.1 |

### Consequence

**Nothing that the engines depend on gets transcribed by hand, and nothing factual gets
scraped from a wiki.** The wiki was only ever a lossy human summary of these files. We read
the source instead.

This kills the largest risk in the requirements document, which was reachability being
wrong because prerequisites were copied by hand. It also removes the per-patch content
treadmill that killed hades2builder: a patch means re-running the extractor, not re-reading
a wiki.

The 523-image library stays exactly as valuable. The game ships art in packed formats and
the wiki has already done that extraction. **Facts from the game, pictures from the wiki.**

---

## 1. Architecture

```
  Steam install                    build time                       runtime
  ─────────────                    ──────────                       ───────

  Content/Scripts/*.lua  ──┐
   TraitData*.lua          │    ┌──────────────┐
   LootData_*.lua          ├───►│  extractor   ├──► data/generated/*.json ──┐
   WeaponSets.lua          │    │  (lua host)  │    NEVER hand edited       │
   ...                   ──┘    └──────────────┘                           │
                                                                           │
  data/curated/*.json ─────────────────────────────────────────────────────┤
   ratings, tags, archetypes, rule packs                                   │
   hand authored, joined on id                                             ▼
                                                                    ┌─────────────┐
  assets/  (523 images) ────────────────────────────────────────────►│  static app │
   manifest.json, slug = join key                                    │  no server  │
                                                                     └──────┬──────┘
                                ┌──────────────┐                            │
                                │  validator   │◄───────────────────────────┘
                                │  (prebuild)  │     fails the build
                                └──────────────┘
```

Static site. No network call at runtime. All state in `localStorage`. The whole of Phase 1
through 3 ships without a server.

### Package layout

```
src/
  engine/          pure. no react, no storage, no fetch, no imports from ui/
    reachability.ts
    rating.ts
    rules.ts
    slots.ts
    runsim.ts        run generator, used by the health checks
    briefing.ts      re-entry summary. derives shape from a RunContext
    tally.ts         run counts and gap analysis over run history
    suggest.ts       Surprise Me. builds a plan from the bottom of the tally
  data/
    load.ts          joins generated + curated on id, once, at module init
    types.ts
  ui/
  state/             the run context, localStorage adapter
scripts/
  extract.ts         lua -> data/generated
  validate.ts        wired into prebuild
  health.ts          rule population measurement
```

**The purity rule is load bearing.** `engine/` imports nothing from `ui/` or `state/`.
That is what lets `scripts/health.ts` import the real shipped rating code and measure it,
instead of a second copy that drifts.

---

## 2. Data pipeline

### 2.1 Extraction

The Lua files are data declarations, not programs. They call
`OverwriteTableKeys( TraitData, { ... } )` with nested table literals.

Run them, do not parse them. A Lua host (`wasmoon` in Node, or the `lua` binary) with the
handful of SGG globals stubbed out, then serialise the resulting tables to JSON. This is
how `JustinLove/hades-boons` sourced its chart, and parsing Lua with a regex is a trap.

Inputs that matter:

| File | Yields |
|---|---|
| `TraitData.lua` | `LinkedTraitData` (26 named sets) and the prerequisite table (46 `OneFromEachSet` blocks) |
| `TraitData_<God>.lua` | Per-god boons: slot, rarity levels, icon, stat lines |
| `TraitData_Duo.lua` | Duo definitions |
| `TraitData_Aspect.lua` | Weapon aspects |
| `TraitData_MetaUpgrade.lua` | Arcana cards |
| `TraitData_Spell.lua` | Selene Hexes |
| `TraitData_Keepsake.lua` | Keepsakes |
| `LootData_<God>.lua` | Which god offers which traits, and the god roster |
| `WeaponSets.lua` | `ValidWeapons` set membership, for aspect exclusions |

Output is `data/generated/*.json`, stamped with the game build and the extraction date.
**Never hand edited.** The validator rejects a generated file whose checksum does not match
its recorded provenance.

### 2.2 Curated layer

`data/curated/*.json`, joined to generated records by `id` at load. Holds only what the
game cannot tell us: ratings, playstyle tags, archetype definitions, rule packs, and the
prose the tool says out loud.

A re-extraction after a patch overwrites `generated/` and touches nothing in `curated/`.
Records in `curated/` that no longer resolve to a generated id are reported by the
validator as orphans rather than silently dropped.

### 2.3 Identity

Slug ids, `aliases` on every record. The game's internal name (`ManaBurstCountBoon`) is the
stable key and is never displayed. Display names change between patches, internal names
almost never do. When one does, the old id goes into `aliases` and saved runs keep
resolving.

### 2.4 Vocabulary mapping

The game publishes its own player-facing dictionary as a `Keywords` glossary in
`Content/Game/Text/en/`. The UI uses the game's words. The code may use the internal ones.
One mapping module owns the translation and it is the only place it exists.

| Player-facing | Internal | Note |
|---|---|---|
| Boon | `GodBoon`, `Trait` | |
| Location | `Room` | Locations make up Regions |
| Region | `Biome` | |
| Encounter | `Encounter` | |
| Hex | `Spell`, `SpellDrop` | |
| Exit | `Door` | `ExitNotActive` renders as "Exit Blocked!" |
| Passage | `Barricade` | |
| Attack | `Melee` | |
| Special | `Secondary` | |
| Cast | `Ranged` | |
| Sprint | `Rush` | |
| Magick | `Mana` | |
| Ω Moves | `Omega` | |

**Never invent a term the game already has.** Check the glossary first, the Lua second, and
only then name something ourselves. The validator should fail the build on any UI string
containing "door", "room" or "biome", because all three are internal words with published
player-facing equivalents.

---

## 3. Domain model

### 3.1 Roster, from the files

Boon-granting gods, from `LootData_*.lua`: Aphrodite, Apollo, Ares, Chaos, Demeter,
Hephaestus, Hera, Hermes, Hestia, Poseidon, Selene, Zeus. Additional trait sources with
their own `TraitData_*` files: Artemis, Athena, Dionysus, Hades, plus the NPC sets
Arachne, Circe, Echo, Icarus, Medea, Narcissus.

Do not hard-code this list. The extractor emits it and the validator checks the app has not
grown an assumption about who exists.

### 3.2 Prerequisites, exactly as the game states them

Two forms, and only two:

```lua
-- one trait from this set
WeakVulnerabilityBoon = { OneOf = LinkedTraitData.AphroditeWeakTraits }

-- one trait from EACH set
ManaBurstCountBoon =                    -- Aphrodite x Apollo, a duo
{
  OneFromEachSet =
  {
    { "ManaBurstBoon" },
    LinkedTraitData.ApolloCoreTraits,
  }
}

DoubleExManaBoon =                      -- Apollo legendary
{
  OneFromEachSet =
  {
    { "ApolloWeaponBoon", "ApolloSpecialBoon" },
    { "ApolloCastBoon", "ApolloSprintBoon", "ApolloManaBoon" },
    { "DoubleStrikeChanceBoon", "ApolloCastAreaBoon", "ApolloBlindBoon", "ApolloExCastBoon" },
  }
}
```

Duos are two sets spanning two gods. Legendaries are three sets within one god. That is the
entire prerequisite system, and it is a set-cover problem.

### 3.3 Run context

```ts
type RunContext = {
  weapon: WeaponId
  aspect: AspectId
  arcana: ArcanaId[]
  vows: VowId[]              // Fear is derived, never stored as a scalar
  path: 'underworld' | 'surface'
  region: RegionId
  exitsLeft: number
  held: TraitId[]
  godsSeen: GodId[]
  pinned: TraitId | null     // a view, not a feature. reachability already computes every
                             // live target on every pick, so tracking one is a filter over
                             // that output and costs nothing. ship it, never lead with it
}
```

`held` and `godsSeen` are what the conditional engine reads. Everything else is setup.

---

## 4. The reachability engine

`engine/reachability.ts`. Pure, synchronous, memoised per context.

```ts
reachable(ctx: RunContext): Verdict[]

type Verdict = {
  target: TraitId
  state: 'ON_TRACK' | 'REACHABLE' | 'AT_RISK' | 'DEAD'
  needs: TraitId[][]      // one array of live options per unsatisfied set
  minPicks: number        // lower bound on new traits required
  why: string             // mandatory. never render a state without it
}
```

### 4.1 Algorithm

```
satisfied(T)      = every set in T.requires intersects held
unsatisfiable(S)  = every trait in S is unobtainable
unobtainable(t)   = t's god is outside the locked god pool          [see 4.1.1]
                  | t needs a core slot already filled by something else
                  | t is excluded by the current weapon or aspect (ValidWeapons)
                  | t has its own requirement and that requirement is DEAD   [recursive]

DEAD      : any set of T is unsatisfiable
ON_TRACK  : satisfied(T)
AT_RISK   : minPicks > exitsLeft
          | a required god has not been seen and few Exits remain
REACHABLE : otherwise
```

Recursion is memoised on trait id with a visited set, because prerequisite chains can share
nodes. Depth is bounded by three in practice.

`minPicks` is a set-cover lower bound over the unsatisfied sets. With k at most three, solve
it exactly rather than greedily: one trait can satisfy two sets at once and a greedy count
overstates the cost, which would report `AT_RISK` on builds that are comfortably reachable.

### 4.1.1 The Olympian pool is capped, and the cap is a hard gate

Verified in the game files 23 August 2026. This is the single largest source of DEAD states.

> **Corrected the same day.** The first version of this section said "four gods". That is
> wrong, and a player who has held six or seven boon sources in one run will spot it
> instantly. The cap counts **Olympians only**. See the eligibility rule below before
> writing any of this into code.

`HeroData.MaxGodsPerRun = 4`. Bounty runs override it to 1 or 2 via `RunOverrides` in
`BountyData.lua`, and `ReachedMaxGods` reads `CurrentRun.MaxGodsPerRun or
HeroData.MaxGodsPerRun`, so the value must come from the run and never be hardcoded.

**What counts toward the cap.** `ReachedMaxGods` filters `CurrentRun.LootTypeHistory` to
entries whose `LootData` has `GodLoot` set. Only the nine Olympians qualify, and they get it
by inheriting `BaseLoot`:

| Counts | Does not count |
|---|---|
| Aphrodite, Apollo, Ares, Demeter, Hephaestus, Hera, Hestia, Poseidon, Zeus | `HermesUpgrade` and `TrialUpgrade` (Chaos) set `GodLoot = false` |
| | `WeaponUpgrade` (hammers) and `StackUpgrade` (poms) set `GodLoot = false` |
| | `SpellDrop` (Selene Hexes) has no `BaseLoot` inheritance |
| | Artemis, Athena, Dionysus and Hades have `TraitData_*` files but **no `LootData_*` file**, because they arrive through Encounter and event Locations rather than Exit rewards |

So a single run can easily present seven or more boon sources while spending only four
Olympian slots. The engine must count Olympians, never "gods".

### 4.1.2 Ordinary Exit rewards are uniform. Devotion Encounters are not.

Players report that a god they have already taken keeps reappearing. That is real, but it
does not come from a weighted pool.

**The ordinary path is uniform.** `RewardLogic.ChooseLoot` is the whole of it:

```lua
local eligibleLootNames = GetEligibleLootNames( excludeLootNames )
newLootName = GetRandomValue( eligibleLootNames )
```

No weighting, no history term. Below the cap an Olympian you already hold is exactly as
likely as one you do not.

**Devotion encounters deliberately re-offer what you hold.** In `SetupRoomReward`, under
`chosenRewardType == "Devotion"`:

```lua
room.Encounter.LootAName = prevOfferedReward.LootAName
                        or GetInteractedGodThisRun()
                        or GetRandomValue( GetEligibleLootNames() )
room.Encounter.LootBName = prevOfferedReward.LootBName
                        or GetInteractedGodThisRun( room.Encounter.LootAName )
                        or GetRandomValue( GetEligibleLootNames({ room.Encounter.LootAName }) )
```

`GetInteractedGodThisRun` returns a random god already in `LootTypeHistory`. Because Lua
`or` short-circuits, the random fallback only runs when you hold nothing at all. So both
Devotion slots are drawn from gods you already have, as a certainty rather than a tilt.

A `trait.ForceBoonName` with uses remaining overrides slot A entirely, provided that god is
already in your history. That is the keepsake path.

**Three distinct effects, and the engine models them separately:**

| Effect | Mechanism | Modelled as |
|---|---|---|
| Held gods recur | Devotion Encounters prefer `LootTypeHistory` | Room-type aware, not a global weight |
| Unheld Olympians vanish | `ReachedMaxGods` freezes the eligible set | Hard DEAD state |
| Everything else | `GetRandomValue` over eligible | Uniform. Do not invent a weighting |

The practical consequence: never tell a player an unheld Olympian is "less likely". Below
the cap it is not, and at the cap it is impossible. There is no middle band.

`RewardLogic.GetEligibleLootNames` then does this:

```lua
if ReachedMaxGods( excludeLootNames ) then
  eligibleLootNames = OrderedKeysToList( CurrentRun.LootTypeHistory )  -- only gods already seen
else
  eligibleLootNames = OrderedKeysToList( LootData )                    -- every god
end
```

`ReachedMaxGods` counts distinct entries in `CurrentRun.LootTypeHistory` where the loot data
has `GodLoot` set, so it counts gods you have actually taken a boon from.

**This is a binary gate, not a probability curve.** Community folklore says gods you pick
early make other gods "less likely". They do not. Below the cap every god is eligible. At
the cap the set of possible gods is frozen to exactly the ones you already have, and every
other god becomes impossible for the rest of the run.

Consequences for the engine, in order of importance:

1. **Taking your fourth Olympian is the most consequential decision in a run.** It
   permanently fixes the Olympian set, and four Olympians leave only six pairings, so every
   duo outside those six dies at that instant. Duos are Olympian-to-Olympian, which is why
   this cap and the duo roster line up
2. **The warning has to fire before the pick, not after.** At the moment a fourth distinct
   god is on offer, the tool should say what each candidate keeps alive and what it kills.
   Nothing in the game does this
3. `MaxGodsPerRun` is read from the run context, because bounties change it
4. Gods below the cap are never "unlikely", so the confidence bands in 4.3 must not imply
   otherwise

### 4.1.3 A god enters your run on pickup, so declining is free

`InteractLogic.HandleLootPickup`:

```lua
currentRun.LootTypeHistory[loot.Name] = (currentRun.LootTypeHistory[loot.Name] or 0) + 1
```

Written when the loot is **picked up**, not when the Exit is offered. Seeing a god costs
nothing. Taking one boon from a god costs a permanent slot out of four, puts them in the
pool that Devotion Encounters draw from, and can occupy a core slot a target needed.

**This makes refusal a real move, and the engine has to be able to recommend it.** Taking a
Pom, a Hammer, or Shadow Broker currency over a boon from a god outside the build is
frequently correct, and no existing tool says so because none of them model the cost.

### 4.1.4 Build shape: core, compatible, avoid

An archetype anchored only on its duo or legendary is under-specified. Four Olympian slots
means **the gods to keep out matter as much as the gods to get in**.

```ts
type Archetype = {
  core:       GodId[]   // the build does not exist without these
  compatible: GodId[]   // fine, sometimes good. spend a spare slot here
  avoid:      GodId[]   // taking one costs a slot the build needs
}
```

Worked example from the owner, a Zeus and Apollo double-legendary with the duo:

| | Gods | Why |
|---|---|---|
| core | Zeus, Apollo | Both legendaries plus the duo between them |
| compatible | Poseidon, Ares, Demeter | Poseidon for extra minor finds, Ares for attack speed on a Staff build feeding Zeus procs through Magick spend |
| avoid | Aphrodite, Hestia | Spends a slot, occupies a core slot the Zeus legendary needs, and then recurs through Devotion |

`avoid` is not a rating of the god. Hestia is fine, and wrong here. This is per-archetype and
lives in the curated layer, because nothing in the game files expresses it.

### 4.1.5 The reject verdict

Ranking the three boons on offer is not sufficient. The engine must also be able to return
**none of these**, with the reason and the alternative.

```ts
type OfferVerdict =
  | { take: TraitId, why: string }
  | { reject: true, why: string, instead: 'reroll' | 'other-exit' | 'non-god-reward' }
```

Trigger conditions, all computable:

- Every offered boon belongs to a god on the archetype's `avoid` list
- Taking any of them would fill a core slot that a live target still needs
- It would spend the fourth Olympian slot on a god outside `core` and `compatible`

The last one is the most valuable warning the tool can produce, because it is irreversible
and the game gives no indication it is happening.

### 4.2 Why DEAD is computed first

`DEAD` is the state players most need and least expect, and it is the only state that is a
proof rather than a judgement. Compute it before anything else and render it even if the
rating engine is disabled or broken.

The originating complaint, "I kept trying for that Zeus legendary, turns out I needed it on
my Cast", is exactly `unobtainable(t)` clause two: the Cast slot was filled, so every trait
in one required set was unobtainable, so the set was unsatisfiable, so the legendary was
DEAD several rooms before the player found out.

### 4.3 Confidence bands

No percentages. On top of the four states, one of `Likely`, `Possible`, `Long shot`,
derived only from countable facts: `exitsLeft`, `minPicks`, gods not yet seen, open slots.

The game data does carry `Weight` and `PriorityChance` fields, so a genuine offer model may
be recoverable later. Until it is measured and validated it stays out of the UI. A band is
honest. An invented percentage is not.

One thing the bands must not do is blur the god cap. Whether a god can still appear is a
fact, not a likelihood: eligible below the cap, impossible at it. Never render that as
"unlikely".

### 4.4 God priority, rolled up from the verdicts

At an Exit the player picks a god, and the boons come afterwards. So the output that matches
the decision being made is not a list of targets. It is a ranked list of gods.

```ts
godPriority(ctx: RunContext): GodVerdict[]

type GodVerdict = {
  god: GodId
  score: number
  keeps: TraitId[]     // live targets this god still feeds
  kills: TraitId[]     // targets that die if this god is taken
  why: string
}
```

Derived entirely from `reachable()`. For each god still in the pool, count the live targets
whose unsatisfied sets contain at least one trait from that god, weighted by proximity. No
new data, no new judgement, no new source of error.

Two things it must carry beyond the score.

**What this god keeps alive.** The ordinary case, and the reason a god is worth wanting.

**What this god kills.** At the fourth Olympian slot this is the whole warning. Four
Olympians leave six pairings, so taking a fourth god ends every duo outside those six at
that instant, per 4.1.1. Nothing in the game reports it, and 4.1.1 point 2 requires the
warning to fire before the pick rather than after. **This function is where that renders.**

---

## 5. The rating engine

`engine/rating.ts` plus `engine/rules.ts`. Rules are JSON, not code.

```ts
type Rule = {
  id: string
  when: ContextPredicate     // about the run
  match: SubjectPredicate    // about the boon being judged
  delta: number              // points. no floors, no ceilings
  say: string                // mandatory
  source: 'curator' | 'wiki'
}
```

`say` is not optional and the validator enforces it. A score that cannot explain itself is
a score nobody should trust, and the Exit UI renders the sentence, not the number.

The rule that matters most is the one coupling the two engines:

```json
{
  "when":  { "reachable": ["$duo"] },
  "match": { "prerequisiteFor": ["$duo"] },
  "delta": 25,
  "say":   "This is the last piece of a duo still on the table."
}
```

Ratings are keyed by `(traitId, rarity)`, because the game stores `RarityLevels` per trait
and a Common and a Heroic version of the same boon are different cards.

### 5.1 Health checks, before the second rule

`scripts/health.ts` imports the real engine and reports, per rule, the share of its eligible
pool it fires on and how often it moves a rating. Anything at 60% or above is flagged.

Measured against `engine/runsim.ts` output: randomly generated legal runs that draw Exits,
respect god pools and respect slot conflicts. **Never against the archetypes that ship with
the tool.** In D.D.S. two rules looked healthy against 39 shipped builds and fired on 86%
and 45% of 300 random ones. Both were cut.

Most Hades 2 boons are damage boons, so a rule keyed on "is this offensive" fires on most of
the pool and says nothing. This project will hit that failure harder than D.D.S. did.

---

## 6. The briefing engine

`engine/briefing.ts`. Pure. Answers "what was I doing" after the player has been away.

```ts
brief(ctx: RunContext, since: SnapshotRef): Briefing

type Briefing = {
  held: Record<Slot, TraitId[]>     // fact
  centre: { slot: Slot, share: number, contributors: TraitId[] } | null   // derived
  advice: string | null             // our opinion. null until curated tags exist
  pinned: Verdict | null
  changedWhileAway: Verdict[]       // targets whose state moved since the snapshot
  position: { region: RegionId, exitsLeft: number, nextBoss: string | null }
}
```

### 6.1 Centre of mass

The useful sentence is not "you have nine boons", it is "your weight is on Cast". Computed
as a weighted share per slot over what the player holds.

The subtlety that makes this need the curated layer: **a boon's slot is not the slot it
affects.** `Slot = "Ranged"` says which slot a boon occupies. Plenty of boons occupy a
passive slot while feeding Cast, and those are exactly the ones that make a Cast build a
Cast build. So the computation runs over a curated `feeds: Slot[]` tag, not over the game's
`Slot` field.

That is why the requirements split this feature across two phases. The factual recap and
the reachability diff need nothing that does not exist at Phase 1 step 8. The advice line
needs `feeds` tags, so it waits for Phase 2 and renders as `null` until then. A briefing
with no advice line is still worth opening. A briefing with a wrong advice line is not.

### 6.2 What changed while away

`changedWhileAway` is a diff, so there has to be something to diff against.

**Snapshot the reachability verdicts on every pick** and keep the most recent one in the
run context. The briefing compares current verdicts to that snapshot and reports only
transitions, with deaths first. A pinned target that died three Exits ago is the single
most important line on the card, and without a snapshot it is indistinguishable from a
target that was never alive.

This costs one array of small records per run and it is the reason the feature works at
all.

### 6.3 Trigger

On resume when the active run is stale, and on demand from anywhere. Staleness is wall
clock since the last pick, not a session boundary, because the player may have left the tab
open for a week. Threshold is a preference with a sane default, not a constant.

---

## 7. Tally, gaps and Surprise Me

Three layers, built in order, in `engine/tally.ts` and `engine/suggest.ts`.

### 7.1 Tally

Counts per weapon, aspect, god, slot and archetype over `enodia.run.history`. Pure counting,
no opinion.

Classifying a finished run into an archetype is similarity, not lookup:

```ts
classify(run: CompletedRun, archetypes: Archetype[]): { id: ArchetypeId, score: number } | null
```

Score on overlap between the run's held set and the archetype's anchor plus core traits,
weighted toward the anchor, since an archetype is defined by its duo or legendary and not
by its filler. **Below a confidence floor the run is recorded as unclassified.** Forcing
every run into the nearest archetype would corrupt the tally that everything above it
reads, and unclassified runs are themselves a signal that the archetype set has a hole.

This is the same join that generates the build card from a finished run, so it is written
once and used for both.

### 7.2 Gaps

```ts
gaps(tally: Tally, minRuns: number): Gap[]     // ranked, most neglected first
```

**The minimum sample rule is not a nicety.** With four runs logged, every dimension is
under-used, and a tool that says "you never play Hera" on that evidence is stating noise
with total confidence. Below `minRuns` the function returns a single "not enough runs yet"
result and the UI says so plainly. This is the D.D.S. rule that a rule reading an unset
value must not fire, applied to the player's own history.

Neglect is a rate against opportunity, not a raw count. An aspect unlocked last week and
played twice is not neglected the way one unlocked two hundred runs ago and played twice
is. Normalise by how long the option has been available, which the history provides.

### 7.3 Surprise Me

```ts
suggest(gaps: Gap[], fear: number, seed?: number): Plan
```

Returns a complete, runnable plan: aspect, arcana within the Grasp budget, keepsake
sequence, and a target duo or legendary to chase, plus one line naming the gap it is
drawn from.

Two constraints that decide whether anyone presses it twice:

- **It must be playable at the Fear the player actually runs.** Suggesting a fragile build
  at a Fear level they clear routinely teaches them the tool has bad taste. `fear` defaults
  from their history rather than from zero
- **The plan must be internally reachable.** Run the proposed target through
  `reachability` against an empty context first. A suggestion that is dead on arrival
  because the aspect excludes a required trait is worse than no suggestion

Seeded, so a plan can be shared or re-rolled deterministically.

This is the difference between the plan and a plain randomiser. A random constraint tells
the player what they may not use. A plan tells them what to do, and that is what gets
someone onto a weapon they have avoided for a hundred hours.

---

## 8. Interface

Reading posture is the constraint: mid run, four seconds, one hand, phone beside a keyboard.

### Outside the run

The run surface is what the tool is for, but it is not the whole app. Two things sit around
it.

**The entry flow is pick, set up, run.** A run starts by choosing what you are trying to do,
a build or just a weapon. That choice feeds Setup, and Setup opens the run. Three steps in
one direction, no branching.

**The menu is one button, top left, opening a dropdown.** It holds everything that is not
the current run: restart, browse saved builds, create a build. It covers like an overlay and
returns you where you were, so it is never a place the run navigates to.

> Sketched, not settled. What "pick a build" offers before the Phase 2 archetypes exist, and
> whether weapon-only entry is its own path or simply an empty build, are open.

### The run is one surface

Setup happens once, before the run, and is its own screen. Everything after it is a single
surface in three parts.

| Part | What it is |
|---|---|
| **Timeline** | The run itself, scrolling. One entry per Exit |
| **Rail** | What you hold. Persistent, left edge, icons only, never navigated to |
| **Overlays** | Detail. They cover the timeline, they do not push it |

There is no navigation between them. The rail is always present, an overlay is always
dismissable, and the timeline is always underneath.

### The timeline

Lit entries behind you, one bright entry at the present, unlit beads ahead for the Exits
that remain.

| Position | Carries |
|---|---|
| Past | Which god was behind that Exit, what was taken, and what died at that moment |
| Present | The offer, ranked, one sentence each. The reject verdict. The ranked god list for what you want next |
| Future | Count and nothing else. Unlit beads, no labels, no predicted content |

**The present entry is sticky and is never off screen by default.** A timeline is a history
object and the thing needed in a hurry sits at the far end of it, so position has to be
fought deliberately. The button that returns to the present exists only because someone
scrolled away on purpose.

**Future entries carry shape, never content.** `RewardLogic.ChooseLoot` draws uniformly from
the eligible set, so any prediction of which god sits behind an unreached Exit would be an
invented offer model. That is the same false precision that killed the stated-probability
idea in `REQUIREMENTS.md` 5, and it is refused here for the same reason. What the player
gets instead is the pace of the run, which is real and which a bead count states honestly.

**A death is recorded where it happened.** Committing a slot can close a dozen builds at
once, and the entry for that pick is the only place in the product where the cause and the
consequence sit next to each other. A separate Targets screen puts the death somewhere the
player has to go looking, and separates it from the pick that caused it.

### The rail

Five slots in fixed positions, always visible, icons only.

**An empty slot is the warning.** A dark Cast slot states, permanently and without saying
anything, the thing that keeps half the live targets alive. The originating complaint, "I
kept trying for that Zeus legendary, turns out I needed the boon on my Cast", is answered by
an icon that was never not there. This is the silence rule working properly: nothing is
announced, and the information is in peripheral vision for the whole run.

Slots that are filled show what fills them. Slots that are empty stay dark and stay in
place. The rail never reorders, because a fixed position is what makes it readable without
being read.

On a phone in portrait the rail is about 44 points wide, icons only, and unfolding it opens
an overlay. On desktop the same rail can afford to sit open.

### Overlays

Three of them, all dismissable, all covering rather than pushing.

| Overlay | Opened from | Holds |
|---|---|---|
| Held, expanded | The rail | Everything held, by slot, and the entry point for correcting a mistake |
| Live targets | The present entry | Every build still open, by state. A filter over the same output |
| Entry detail | Any timeline entry | What that Exit offered and what changed |

### Re-entry

The briefing is not a surface. When an active run is resumed after a meaningful gap, the
timeline opens at the present with a summary header above it: what you hold by slot, what
the build centres on, what you were chasing and its state now, and where you are.

It renders fact, derivation and advice as three visibly distinct registers, and the advice
register is simply absent in Phase 1 rather than filled with something weaker.

Scrolling back through the timeline is the rest of the briefing, and it needs no feature to
make it work.

### Entry

Tap-only. At an Exit you are shown three boons from at most two or three gods, so the picker
is filtered by `godsSeen` plus the current region's pool and is two taps deep, not a search
box.

Rarity is optional at pickup. An unrecorded rarity is unrated, which is a first-class state,
not missing data.

The offer block is three cards and three sentences. Never a table. Game art on every card,
which is the single thing hades2builder got right and the other two did not.

### Rules that survive the posture change

- Silence is the normal state. Never a panel reporting that everything is fine
- Every warning is conditioned. "No defensive boon, Fear 16, Chronos next" earns its space,
  "you have no defensive boon" does not
- Advisory means advisory. A warning removes nothing from the card
- Unrated is a first-class state. Dashed placeholder, sorts last, survives every filter
  floor, because filtering out the unrated makes every new boon invisible
- A judgement and a sourced fact never look equally weighed
- Colour through CSS custom properties, ramps positional so a class means the same thing
  when the theme flips
- Spoiler gating, since gods and regions unlock narratively

---

## 9. Persistence

`localStorage`, one key per concern, versioned with a migration function.

```
enodia.run.active      RunContext, written on every pick
enodia.run.snapshot    last reachability verdicts + timestamp. feeds the briefing diff
enodia.run.history     completed runs, Phase 3
enodia.run.tally       derived counts. cache only, rebuildable from history
enodia.prefs           theme, spoiler level, display names, staleness threshold
enodia.schema          integer. bump forces a migration
```

The active run survives a refresh and a phone locking. That is not a nicety: the tool is
open beside a game for forty minutes, and by the briefing feature it may be open for a week.

`enodia.run.tally` is a cache and is never the source of truth. If it disagrees with
`enodia.run.history`, history wins and the tally is rebuilt. A derived store that can drift
from its source is how a tally quietly starts lying about which gods you play.

Build sharing is a URL fragment, compressed, no server. Phase 4 adds accounts and nothing
before it does.

---

## 10. Phase 1 build order

Each step is verifiable before the next begins.

1. **Extractor.** Lua host, stub the SGG globals, emit `generated/*.json`. Verified by:
   the duo count matches the traits inheriting `SynergyTrait`, and every trait id referenced
   inside `LinkedTraitData` resolves to a real trait. **Counting `OneFromEachSet` blocks
   with two sets is not that check.** It reads 33 where the game marks 37, because four duos
   state three sets
2. **Validator into prebuild.** Broken reference fails the build. Orphaned curated records
   reported. It also holds the generated payloads to their recorded checksums, holds the
   structural counts to `data/baseline.json`, and fails a UI string carrying an internal
   word. Rules live in `scripts/validate/checks.ts` as pure functions, each one unit tested
3. **Asset join.** Every trait has an icon or is listed in `knownGaps`. Reports the gap
   count against `assets/manifest.json`
4. **`engine/slots.ts` and the type layer**
5. **`engine/reachability.ts`.** Unit tested against hand-built scenarios, including the
   Cast-slot lockout that started the project
6. **`engine/runsim.ts`.** Needed by step 5's tests and by the health checks later
7. **Setup screen, and the rail.** Enough to produce a real `RunContext`. Held is no longer
   a screen
8. **The timeline shell**, with reachability rendered in the present entry and deaths
   recorded inline at the entry that caused them. No rating engine at all. **The tool is
   already useful here, and this is the first shippable point**
9. **Verdict snapshotting, then `engine/briefing.ts` and the re-entry header.** Factual
   recap and the changed-while-away diff. No advice line yet
10. **`engine/rules.ts`, one rule, then `scripts/health.ts`, then the rest**
11. **The offer block inside the present entry**, ranked, with the reject verdict

Step 8 remains the milestone that matters, and the timeline makes it cheaper rather than
more expensive: step 9 inherits the rendering rather than building a second one. If the
project stops there it still solves the originating complaint, and it does something no
other Hades 2 tool does.

Step 9 sits where it does because snapshotting has to be in place before there is history
worth diffing. Adding it later means every run logged before the change has no snapshot and
the briefing stays silent about them, which is the kind of retrofit that quietly makes a
feature look broken on exactly the runs a returning player cares about.

---

## 11. Testing

| Layer | How |
|---|---|
| Extractor | Golden file per patch. A diff is a patch note, and is reviewed rather than accepted |
| Reachability | Hand-built scenarios plus property tests over `runsim` output. A DEAD verdict must never flip back to alive without the context changing |
| Rules | Population health check. Fires-on share and move rate, per rule |
| Briefing | Snapshot diff is tested by replaying a recorded run and asserting the transitions reported match the picks made |
| Tally and gaps | `classify` measured against `runsim` output: what share of legal runs match no archetype. A high unclassified rate is a hole in the archetype set, not a bug in the matcher |
| Surprise Me | Every generated plan runs through `reachability` before it is returned. A plan that is dead on arrival fails the test suite, not the user |
| App | Load the page and read the DOM. A green build proves nothing: Vite does not check that a component receives the prop it uses, and D.D.S. shipped a crashing tier list on a green build |

A refactor of the rating engine that changes a score is not a refactor. The test is byte
identical health check output before and after.

---

## 12. Open items

Not blocking Phase 1, listed so they are not forgotten.

1. **Aspect numbering.** `assets/aspects/staff-01..04` are unverified. The extractor will
   resolve this from `TraitData_Aspect.lua` and the files should be renamed to match
2. **Arcana art.** 4 of ~25. The biggest asset gap and it blocks the Phase 2 setup screen
3. **Selene Hex art.** 0 of 9
4. **Rarity frames.** 0 of 6, and every boon card needs one
5. **Tier consensus.** Still unestablished whether a credible community consensus exists.
   Until it does, every opinion is labelled as ours. Do not average YouTubers
6. **Offer model.** `Weight` and `PriorityChance` are in the files. Worth a measurement pass
   in Phase 3, kept out of the UI until validated
7. **Legal posture.** Reading the local install for facts is a different act from
   redistributing extracted content. Ship derived data, keep the disclaimer visible, stay
   non-commercial. Do not ship the game's fonts
8. **The `feeds` tag.** Curated, and the briefing's advice line depends on it. Scope is
   every boon, so it is the largest single piece of hand authoring in the project. Worth
   checking whether it can be derived from the game's own tag and modifier fields before
   anyone starts typing
9. **`minRuns` threshold for gap analysis.** Needs a real number, not a guess. Pick it by
   running the tally over synthetic histories of increasing length and finding where the
   ranking stops churning
10. **Seeding the tally.** Manual logging means the gap analysis says nothing useful for
    the first several weeks, which is the worst possible first impression for the feature
    that most needs to feel personal. Worth investigating whether the save file carries run
    history that could seed it on day one. The Hades 1 precedent is the ExportRunHistory
    mod, so treat this as unproven for Hades 2 rather than likely

---

## Working agreement

> **Every mechanical claim in this document must trace to a named symbol in
> `Content/Scripts/*.lua`, or to the owner.** Assistant knowledge of Hades 2 internals is
> unreliable and Hades 1 detail is far better documented, so it bleeds across. Web search
> does not fix this: forum posts and guides carry no date on the mechanic. Reading a source
> file is also not enough on its own; follow every symbol in a condition to its definition
> before writing the claim down. See the full rule in `REQUIREMENTS.md`.

- Product decisions and naming are the owner's. Implementation internals are decided and
  stated with reasoning, not handed back as a question list
- Show the measurement before shipping anything that re-ranks a list
- An admitted gap beats a hedged guess
- No em dashes anywhere. Not in UI copy, code comments, commit messages or replies
- The project's real memory is `CLAUDE.md` plus these documents. Nothing lives only in a chat
