# How to beat the RNG

The seed guide, as a draft. **Nothing here is published.** It goes up under your account, from
the Guides editor, once you have written the two sections marked yours.

**How to use this file.** Each `##` heading below is one field in the editor. Paste the text in
its `text` block into the field with the same name. A mention such as
`@[Everlasting Ember](t:ForceHestiaBoonKeepsake)` turns into the keepsake itself once it is in
the field, and is drawn with the game's current name whatever it was written as. A field left
empty is skipped when the guide is read.

`src/data/seed-guide.test.ts` reads this file and fails if a mention in it stops pointing at a
real record, if it names anything but the nine Olympians' keepsakes, or if it outgrows what the
editor accepts. Everything under a **Traced** line is for you and is not pasted.

---

## Title

```text
How to beat the RNG
```

## What this is

A first line, for you to keep or replace.

```text
A few rules for the runs where the Exits will not give you what the build needs.
```

## What you need

Left empty. Yours, if anything is assumed.

```text
```

## How it goes

**Written, and verified.** The rule is `CLAUDE.md`'s, and every sentence below is one of its
cited facts.

```text
Four Olympians is where the random pool stops, not where the run stops.

Once you have taken Boons from four Olympians, a Boon Exit only offers gods you already have. A god counts from the moment you take one of their Boons, not when you see them, so turning an Exit down costs nothing. Hermes, Selene, Chaos and the gods you meet in Encounters never count.

A keepsake gets round it. Every Olympian has one: @[Beautiful Mirror](t:ForceAphroditeBoonKeepsake), @[Harmonic Photon](t:ForceApolloBoonKeepsake), @[Sword Hilt](t:ForceAresBoonKeepsake), @[Barley Sheaf](t:ForceDemeterBoonKeepsake), @[Adamant Shard](t:ForceHephaestusBoonKeepsake), @[Iridescent Fan](t:ForceHeraBoonKeepsake), @[Everlasting Ember](t:ForceHestiaBoonKeepsake), @[Vivid Sea](t:ForcePoseidonBoonKeepsake) and @[Cloud Bangle](t:ForceZeusBoonKeepsake). With one on, the next Boon Exit is that god's, and the cap is not asked again. So a fifth Olympian is a keepsake away.
```

**Traced**, each sentence against its source:

- The pool stops at four, and only offers gods already held: `ReachedMaxGods` filtering
  `LootTypeHistory` on `GodLoot`, inside `GetEligibleLootNames`
- A god counts on pickup, not on offer: `InteractLogic.HandleLootPickup`
- Who never counts: `GodLoot = false` for Hermes, Selene and Chaos, and no `LootData` entry at
  all for Artemis, Athena, Dionysus and Hades
- The keepsake overrides the choice and the cap is not read again: `RewardLogic.lua:238`
  beside `:242`, where any held `ForceBoonName` with `Uses > 0` replaces what `ChooseLoot`
  picked
- **Added on 25 September 2026:** the keepsake's one use is spent when that god's Boon is
  handed out, in `GiveLoot` (`RoomLogic.lua:2064`), not when the Exit is shown. And it is not
  spent by a Boon bought in a shop, because `GiveLoot` skips it when `BoughtFromShop` is set
- The nine keepsakes are the app's `keepsakeForGod`, read from the game's
  `KeepsakeData.GiftData` by `scripts/extract.mjs`

## What to watch for

Left empty. Yours, if there is anything.

```text
```

## Pom of Power

**Yours to write.** The rule you meant by the upgrade token.

```text
[Yours to write: the Pom of Power rule.]
```

**Traced**, for you to use or ignore:

- On screen it says: choose 1 out of 3 random Boons you have and give it +1 level.
  `StackUpgrade` in `LootData.lua:89`, `TraitText` "Pom of Power", and `MaxChoices = 3` in
  `UpgradeChoiceData.lua:24`
- It never spends an Olympian slot: `GodLoot = false` on the record
- Some are worth two or three levels: `StackUpgradeBig` has `StackNum = 2` and
  `StackUpgradeTriple` has `StackNum = 3`, in the same file
- Each extra level is worth less on 20 traits and the same on every other, per
  `data/generated/stacking.json`. `CLAUDE.md` has the curve, and the app already shows it
- **Charon's shop sells them and the Shrine of Hermes does not.** `StackUpgrade` is in
  `StoreData.WorldShop` and not in `StoreData.SurfaceShop`

## Shrine of Hermes

**Yours to write.** It is the Surface shop, `SurfaceShop` in the scripts, and not the Well of
Charon.

```text
[Yours to write: the Shrine of Hermes rule.]
```

**Traced**, for you to use or ignore:

- **Surface only, and the Well of Charon is Underworld only.** Every Surface Region sets
  `WellShopSpawnChance = 0.0` and a `SurfaceShopSpawnChance` of its own: `RoomDataN.lua:21`,
  `RoomDataO.lua:288`, `RoomDataP.lua:339`, `RoomDataQ.lua:42`
- It needs the incantation Rush of Fresh Air, `WorldUpgradeSurfaceShops` ("Cause Locations on
  the surface to sometimes contain a Shrine of Hermes", `HelpText.en.sjson:6845`; a
  `WorldUpgrade` is an incantation on screen, "Incantation Learned" at `:1733`), and shows up
  only three Locations or more into a Region and not within three Locations of the last one
  (`SurfaceShopRequirements`, `RoomData.lua:589` and `RoomDataN.lua:2578`)
- **Four items a visit**, one from each of three weighted groups and two from the middle one
  (`StoreData.SurfaceShop`). Among them: Boon of Hermes, Mystery Boon, Daedalus Hammer, Gift of
  the Moon, Path of Stars, Centaur Heart, Soul Tonic, Kiss of Styx, and Shield or Aegis Charm
- **Waiting makes it cheaper.** Each item is delivered after 2 to 8 Encounters, drawn at random
  (`RoomDelay`, `DelayMin` and `DelayMax` in `SurfaceShopData.lua`), and its price follows the
  wait: 1.2 times the base at 2, 1.0 at 4, 0.6 at 8 (`DelayPriceDiscount`). Having it at once
  costs 1.5 times the base (`ImpatienceMultiplier`). The screen says Encounters; the code counts
  Locations
- **Your recollection, checked:** Charon's timed buffs, such as the rarity bonus on the Boons
  that follow (`TemporaryBoonRarityTrait`), are in `StoreData.RoomShop.Traits`, which only the
  Well of Charon sells from (`StoreLogic.lua:437`). None of them is in the Shrine of Hermes'
  stock, and the Well never appears on the Surface, so they cannot be bought there at all
- A Boon of Hermes never counts toward the four: Hermes' `GodLoot` is `false`

---

## Found on the way, and not a rule of yours

`BoonSkipShrineUpgrade`, a vow at 3 Fear (`ShrineData.lua:64`), replaces the first Boon reward
in each Region with a consolation prize (`RoomRewardConsolationPrize`, `ShrineLogic.lua:918`).
One line in "What to watch for", if you want it.
