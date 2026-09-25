# How to beat the RNG

The seed guide, written in full and ready to publish. **Nothing here is published yet.** It goes
up under the owner's account, from the Guides editor.

**How to publish it.** Open Guides, press Write a guide, and paste each `text` block below into
the field with the same heading. The first four headings are the prompts already in the editor;
for the last two, press Add a section and type the heading. A mention such as
`@[Everlasting Ember](t:ForceHestiaBoonKeepsake)` becomes the keepsake itself once it is in the
field, and is drawn with the game's current name.

`src/data/seed-guide.test.ts` reads this file the way the editor will, and fails if a mention in
it stops pointing at a real record, if the keepsake list stops being every Olympian's, or if it
outgrows what the editor accepts. Everything under a **Traced** line is for whoever maintains
the guide, and is not pasted.

**Where it came from.** The owner asked for the guide to be written on 25 September 2026 and for
other people's guides to be used as inspiration. They were used as leads only: every claim below
was then checked against the game's scripts, and two of the leads were dropped because the
scripts say otherwise. The notes under each section say which.

---

## Title

```text
How to beat the RNG
```

## What this is

```text
A few rules for runs where the Exits will not give you what you need. Each one is about something the game lets you control, and each has been checked against the game's own scripts.
```

## What you need

```text
The keepsake of the Olympian your build depends on most. The incantation Rush of Fresh Air, if you want the Shrine of Hermes on the Surface. Nothing else.
```

## How it goes

```text
The cap of four Olympians only limits which gods an Exit offers at random.

Once you have taken Boons from four Olympians, a Boon Exit only offers those four. A god counts from the moment you take one of their Boons. Seeing them on an Exit and choosing another costs nothing. Hermes, Selene, Chaos and the gods you meet in Encounters never count.

A keepsake gets round the cap. Every Olympian has one: @[Beautiful Mirror](t:ForceAphroditeBoonKeepsake), @[Harmonic Photon](t:ForceApolloBoonKeepsake), @[Sword Hilt](t:ForceAresBoonKeepsake), @[Barley Sheaf](t:ForceDemeterBoonKeepsake), @[Adamant Shard](t:ForceHephaestusBoonKeepsake), @[Iridescent Fan](t:ForceHeraBoonKeepsake), @[Everlasting Ember](t:ForceHestiaBoonKeepsake), @[Vivid Sea](t:ForcePoseidonBoonKeepsake) and @[Cloud Bangle](t:ForceZeusBoonKeepsake). While you wear one, the next Boon Exit is that god's, and the cap is not checked. So you can have a fifth Olympian by wearing their keepsake.
```

**Traced:**

- The pool stops at four and then only offers gods already held: `ReachedMaxGods` filtering
  `LootTypeHistory` on `GodLoot`, inside `GetEligibleLootNames` (`RewardLogic.lua:187`)
- A god counts on pickup, not on offer: `InteractLogic.HandleLootPickup`
- Who never counts: `GodLoot = false` for Hermes, Selene and Chaos, and no `LootData` entry at
  all for Artemis, Athena, Dionysus and Hades
- The keepsake overrides the choice and the cap is not read again: `RewardLogic.lua:238`
  beside `:242`, where any held `ForceBoonName` with `Uses > 0` replaces what `ChooseLoot`
  picked
- The nine keepsakes are the app's `keepsakeForGod`, read from the game's
  `KeepsakeData.GiftData` by `scripts/extract.mjs`

## What to watch for

```text
A keepsake's Boon is used up when it is handed to you, not when its Exit appears. Take a different Exit and the keepsake is still there for the next one.

Vow of Forfeit replaces the first Boons in each Region with a Red Onion, and that includes the Boon a keepsake would have given you. The keepsake is not used up by it, so it carries on to the first Boon the vow lets through.
```

**Traced:**

- The use is spent in `GiveLoot` (`RoomLogic.lua:2059`), which calls `ReduceTraitUses` when
  the god it hands out is the keepsake's. An Exit's Boon is given by `GiveLoot` in the Location
  that Exit leads to (`RewardLogic.lua:372`), so only once you have taken it
- Vow of Forfeit is `BoonSkipShrineUpgrade`: "The first N Boons in each Region become [an
  onion] instead" (`TraitText.en.sjson:1612`). `CheckBoonSkipShrineUpgrade`
  (`ShrineLogic.lua:918`) runs before `GiveLoot` for Boon rewards and Hermes rewards alike
  (`RewardLogic.lua:363` and `:370`) and returns a `RoomRewardConsolationPrize`, "Red Onion"
  (`TraitText.en.sjson:8064`), in its place. `GiveLoot` is then never called, so no keepsake
  use is spent. The vow's rank sets N, so the guide says "the first Boons" rather than a number

## Pom of Power

```text
A Pom of Power offers three of the Boons you hold, picked at random from the ones a level would still change. Only Olympians' Boons are in that draw: nothing from Hermes, Selene or Chaos, nothing from the gods you meet in Encounters, and never a duo or a legendary.

So every Olympian Boon you take and do not need makes a Pom less likely to offer the one you do. With three that can grow, the one you want is always offered. With six it is offered half the time, and with twelve, a quarter.

A Pom is not an Olympian, so taking one never uses up a place among the four.

Most Boons gain the same from every level. About twenty gain less from each level than the one before, and the wiki says so on each of their records.
```

**Traced:**

- The three are drawn by `GetRandomValue` (`TraitLogic.lua:1928`) from
  `GetAllUpgradeableGodTraits` (`TraitLogic.lua:1673`), which keeps a held Boon only if one
  more level changes one of its values. So a Boon with nothing left to gain is never offered.
  `MaxChoices = 3` in `UpgradeChoiceData.lua:24`
- "Half the time with six" is three draws without replacement from six. It is exact while every
  candidate carries the same rarity levels, because the draw is made per rarity table, and
  close otherwise
- **Only Olympians:** that function asks `IsGodTrait` with no arguments, which takes only loot
  carrying `GodLoot`. `GodLoot = true` is set in eight places, `LootData.lua:15` (the base that
  Poseidon and Zeus inherit) and seven gods' own files, and nowhere for Hermes, Selene, Chaos or
  any Encounter god. The Encounter gods reach `IsGodTrait` through `FieldLootData`
  (`RunData.lua:557`) with `GodLoot` unset
- **Never a duo or a legendary:** `SynergyTrait` and `LegendaryTrait` both set
  `BlockStacking = true` (`TraitData.lua:878` and `:830`), and `GetAllUpgradeableGodTraits`
  skips anything that does. Twelve more records in seven Olympians' own files set it too.
  That is a count of records, not of Boons, because some may be bases others inherit from,
  which is why the guide names only duos and legendaries
- A Pom is not an Olympian: `StackUpgrade` has `GodLoot = false` (`LootData.lua:89`)
- About twenty: `data/generated/stacking.json`, 20 traits. The wiki's line for each is
  `pomLine` in `src/ui/Wiki.tsx`
- **A lead dropped:** guides online say Dionysus's and Athena's Boons scale well with Poms. In
  Hades II no Encounter god's Boon can take a Pom at all, per the point above. Both claims read
  like Hades, where Athena and Dionysus were ordinary gods
- **A lead dropped:** "a level 2 Common Boon equals a level 1 Rare". Not checked, and not
  needed for anything here, so left out rather than repeated

## Shrine of Hermes

```text
The Shrine of Hermes is the Surface's shop. The Well of Charon never appears on the Surface, so Charon's timed offers cannot be bought there, and the Shrine does not sell Poms of Power.

It offers four things, and each says how many Encounters it will take to arrive, from 2 to 8. The longer the wait, the lower the price: 1.2 times the price at 2 Encounters, the full price at 4, and 0.6 times at 8. Paying to have it straight away costs 1.5 times the price in all. So buy what you want later from the long waits, and pay to rush only what the next fight needs.

A Boon of Hermes never counts toward the four Olympians. A Mystery Boon does: it is drawn from the same gods an Exit would offer. Before you have four it can bring in a god you did not want, and once you have four it is always one of yours. If it lands on the god whose keepsake you are wearing, the keepsake is used up.
```

**Traced:**

- **Surface only, and the Well of Charon Underworld only.** Every Surface Region sets
  `WellShopSpawnChance = 0.0` and a `SurfaceShopSpawnChance` of its own: `RoomDataN.lua:21`,
  `RoomDataO.lua:288`, `RoomDataP.lua:339`, `RoomDataQ.lua:42`. Charon's timed offers are
  `StoreData.RoomShop.Traits`, which only the Well sells from (`StoreLogic.lua:437`). The owner
  remembered the first half of this; the scripts added the second
- Poms are in `StoreData.WorldShop`, Charon's own shop, and not in `StoreData.SurfaceShop`
- It needs Rush of Fresh Air, `WorldUpgradeSurfaceShops` ("Cause Locations on the surface to
  sometimes contain a Shrine of Hermes", `HelpText.en.sjson:6845`). A `WorldUpgrade` is an
  incantation on screen, "Incantation Learned" at `:1733`
- **Four items a visit**, from three weighted groups offering 1, 2 and 1 (`StoreData.SurfaceShop`)
- **The wait.** `RoomDelay = RandomInt(DelayMin, DelayMax)`, 2 to 8 (`SurfaceShopLogic.lua:117`).
  The item becomes a trait with `RemainingUses` set to it and `UsesAsEncounters = true`
  (`TraitData.lua:998`, `SurfaceShopLogic.lua:479`), which ticks down at the end of each
  Encounter (`RoomLogic.lua:2965`). So it counts Encounters, as the screen says, despite the
  variable's name
- **The price.** `DelayPriceDiscount` gives 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6 for waits of
  1 to 8, and a wait is never less than 2. Rushing costs `ImpatienceMultiplier`, 1.5, of the
  base in all, as the discounted price plus the difference (`SurfaceShopLogic.lua:118-130`)
- **The Mystery Boon.** `BlindBoxLoot` unwraps through `UnwrapRandomLoot`, which calls `GiveLoot`
  with no god named (`StoreLogic.lua:1340`), so the god comes from `ChooseLoot`, the cap
  included. It sets `BoughtFromShop` only on the result, after `GiveLoot` has run, so a
  keepsake of the god it lands on is spent. A Boon sold by name sets the flag in its arguments
  (`StoreLogic.lua:133`) and spends nothing
- A Boon of Hermes: Hermes' `GodLoot` is `false`
