# Enodia: Image Library

683 images in 18 categories, categorised and slug-named.

Two sources, and the difference matters. **The file extension tells you which:**

- **Wiki** (`../hades.fandom.com/` zips, deduplicated by SHA-256, always `.webp`)
- **Game files** (extracted with `deppth2`, always `.png`, full resolution): all of
  `arcana/`, `hexes/`, `rarity/` and `vows/`, plus the 82 boon icons the wiki scrape
  never had

`boons/` and `duos/` are mixed, so a category is no longer a source. The extension is.

Two scripts touch this directory and they do different jobs:

| Script | Job |
|---|---|
| `build-lib.ps1` | Rebuilds the **wiki half** out of the saved-page zips. Deletes `.webp` only, and never enters `arcana/`, `hexes/`, `rarity/` or `vows/`. **Do not remove that guard** |
| `npm run assets` | Writes `manifest.json`, and the **only** thing that writes it. `--fill` copies missing icons out of the game extraction first |

The guard used to delete whole directories, which would have taken the game art in
`boons/` and `duos/` with it. It now deletes by extension, which is the same rule stated
above.

> Game art is copyright Supergiant Games. This is an unofficial, non-commercial fan
> project, not affiliated with or endorsed by Supergiant Games.

## Naming convention

```
assets/<category>/<slug>.webp
```

`slug` is lowercase kebab-case derived from the wiki filename: underscores and spaces
become hyphens, apostrophes and periods are dropped, the wiki's `_II` suffix is stripped,
and the `Melino%3F` mojibake is normalised back to `melinoe`.

The slug **is the join key**. `assets/boons/lightning-strike.webp` pairs with the boon the
game calls "Lightning Strike". Never key a record on a display name, and when Supergiant
renames something, add the old slug to that record's `aliases` array rather than renaming
the file.

**One implementation, in `src/data/icons.ts`.** It slugifies a display name the same way
`build-lib.ps1` slugifies a wiki filename, so both ends of the join agree without either
knowing about the other. The validator, the fill script and the UI all call it. A second
copy of a rule like this is how the previous tool ended up printing numbers from a formula
two versions out of date.

When the rule cannot reach a file, `data/curated/icons.json` carries an override keyed by
trait id. There is one today: four wiki filenames kept the percent-encoded apostrophe, so
`Executioner's Chop` was saved as `executioner-27s-chop.webp`. The other three
(`pauper-27s`, `king-27s-ransom`, `queen-27s-ransom`) are now duplicated by correctly
named game art and can be deleted on the next wiki rebuild.

Every file is listed in `manifest.json` with its category, byte size, SHA-256, the original
wiki filename, and the wiki page it was scraped from.

Provenance follows the bytes, not the path: `npm run assets` carries a wiki source page
forward by checksum when a file has been renamed. Renaming the 25 aspect renders dropped
their source pages the first time, which is how that got noticed.

## Categories

| Category | Files | Source | Contents | Status |
|---|---:|---|---|---|
| `boons/` | 264 | mixed, 188 wiki and 76 game | Olympian boon icons, wiki plus game | complete for every boon a run can offer |
| `hammers/` | 111 | wiki | Daedalus Hammer upgrade icons, scraped per weapon page | 101 need verification |
| `duos/` | 48 | mixed, 46 wiki and 2 game | Duo boon icons | complete, 37 of 37 |
| `keepsakes/` | 33 | wiki | Keepsake icons | complete |
| `aspects/` | 56 | mixed, 30 wiki and 26 game | Aspect icons from the game, the wiki's large renders, and the Black Coat candidates | complete, 24 icons and 24 renders |
| `characters/` | 27 | wiki | Non-boon-granting character portraits | good |
| `gods/` | 16 | wiki | Boon-granting god portraits | complete |
| `infusions/` | 11 | wiki | Elemental infusion boons | unverified count |
| `artifacts/` | 11 | wiki | Consumables and run items | partial |
| `biomes/` | 9 | mixed, 8 wiki and 1 game | Region art | complete, Tartarus came out of the run history icons |
| `elements/` | 6 | wiki | Aether, Air, Earth, Fire, Water, Elemental Essence | complete |
| `ui/` | 19 | wiki | Wiki section icons | low value, `icons/` and `chrome/` replace it |
| `slots/` | 5 | wiki | Attack, Special, Cast, Dash, Magick | complete |
| `arcana/` | 25 | game | Arcana cards, named, from game files | complete |
| `vows/` | 19 | game | Oath of the Unseen, from game files | complete |
| `rarity/` | 4 | game | Common/Rare/Epic/Heroic. These are `Icons/CardRarityIcon_*` | complete |
| `hexes/` | 9 | game | Selene's Hex duos, one per Olympian, from game files | complete, 9 of 9 |
| `chrome/` | 52 | game | The game's own furniture: boxes, buttons, backings, medallion, splash art | picked by hand, see `scripts/chrome.ts` |
| `frames/` | 25 | game | Boon and rarity frames, every ring the radial can wear, and the game's own Exit reward marker | see `src/ui/frames.ts` |
| `icons/` | 7 | game | The game's own UI icons: boon, gold, reroll, inventory, warning, unknown | picked by hand |
| `familiars/` | 50 | game | The five familiars, their six skins each and their stat icons | complete, unused so far |
| `gifts/` | 33 | game | Keepsake max gift portraits, one per character. A possible alternate to `gods/` | unused so far |
| `weapons/` | 12 | game | The six Nocturnal Arms, a Codex card and a shrine silhouette each | complete, 6 of 6 |

### Aspect naming, resolved 27 August 2026

The numbering is gone. Every aspect is now named, and there are two images per aspect:

```
aspects/<weapon>-<aspect>.png          the game's own 90x90 icon, all 24
aspects/<weapon>-<aspect>-render.webp  the wiki's large transparent art, 23 of 24
```

`<weapon>` is staff, blades, flames, axe, skull, coat. `<aspect>` is the display name with
"Aspect of " removed, so `coat-melinoe`, `axe-charon`, `blades-the-morrigan`.

**The weapon has to qualify the name.** Six aspects are called "Aspect of Melinoë", one per
weapon, so the display name alone resolves five of them to the wrong picture.
`src/data/icons.ts` builds the key and the validator checks it.

**How the numbering was resolved, since it had to be checked rather than assumed.** The
wiki files arrived as `Weapon_Axe01..04` and the game names its aspects without numbering
them, so the two had to be matched by picture. Method: a hue histogram over the saturated
pixels of each image, then the assignment of renders to icons with the lowest total
distance. It was validated first against the Black Coat, whose three renders the wiki had
already named, and it got all three right. Applied to the five numbered weapons it produced
a clean assignment every time, with the best total roughly half the cost of the next best.

Four of the five weapons turned out to be in icon order. **Sister Blades is not:** the
wiki's `blades-03` is the Morrigan and `blades-04` is Pan, which is the reverse of the icon
numbering. Confirmed by eye as well as by the histogram, and it is exactly the assumption
the old note would have baked in.

## Known gaps

Ordered by how much they block the build.

Closed on 23 August 2026 by extracting `GUI.pkg`:

| Was missing | Now | Notes |
|---|---|---|
| Arcana cards | **25 of 25**, named | 689x1071 PNG. Names resolved from `MetaUpgradeData.lua`, see below |
| Rarity frames | **4 of 4** | `CardRarityIcon_Common/Rare/Epic/Heroic` |
| Vow icons | **19** | Full Oath of the Unseen set, needed for the Fear model |

Closed on 27 August 2026, second pass, after the owner asked about the Nocturnal Arms:

| Was missing | Now | How |
|---|---|---|
| Weapon aspect icons | **24 of 24**, named | The packed name is `HammerSuit_01`, not `Suit_01`. The prefix rule only removed the underscore for `Hammer_`, and assuming it behaved like `Boon_` is what made every aspect icon look absent |
| The four hammer upgrades listed below as missing | **filled** | Same fix. They were never absent |
| A base image for the Black Coat that shows the weapon | **the game's icon** | The wiki's base render is broken. See the still-open table |

Closed on 27 August 2026 by the asset join, build order step 3:

| Was missing | Now | How |
|---|---|---|
| Boon icons the wiki never had | **82 copied in** | `npm run assets -- --fill` matches each trait's `Icon` field against the extraction, stripping the packed prefix |
| Selene Hexes on disk | **9 of 9**, in `hexes/` | Same pass. They are `Boon_Selene_*` and were always findable, they were just never copied over |
| A manifest that described the directory | **643 of 643** | `scripts/assets.ts` walks the real directory. The old manifest listed 523 and named 27 files that no longer existed |

Still open:

| Missing | Expected | Have | Why it matters | Where to look |
|---|---:|---:|---|---|
| ~~**Boon icons**~~ | ~~300+~~ | ~~199~~ | **Solved, see below** | |
| ~~**Selene Hexes**~~ | ~~9~~ | ~~0~~ | **Solved, see below** | |
| **Black Coat base render** | 1 | 0 | `aspects/coat-melinoe-render.webp` is the wiki's `Weapon_Coat01`, and it is unusable: the coat's parts are scattered at odd angles with a stray thumbnail in the corner, where the other three coat renders are properly composed. The 90x90 game icon is fine, so nothing is blocked | The wiki has no `Xinth - Aspect of Melinoë` image. Either the wiki's Weapons page has a better one, or it wants an in-game screenshot |
| **Familiars** | 5 | 0 | Roster art | `GUI.pkg` has only cosmetic effigies. Try `CatFamiliar.pkg`, `FrogFamiliar.pkg`, `HoundFamiliar.pkg`, `PolecatFamiliar.pkg`, `RavenFamiliar.pkg` |
| **Status effect icons** | ~15 | 0 | Needed for tag filtering | Not yet located |
| **Resource icons** | ~10 | 3 | Ash, Psyche, Bones, Moon Dust, Nectar, Grasp | Partly in `GUI/Icons`, worth a second pass |

### Correction, 27 August 2026: the boon icons were there all along

This document previously said boon icons were **"not in any package"**, on the basis that
grepping all 85 `.pkg_manifest` files for `Boon_` returned zero hits.

That conclusion was wrong, and the method was the problem. **The packed sprites drop the
prefix.** The trait data says `Boon_Aphrodite_27`; the file is `Aphrodite_27.png`, sitting in
`GUI/Screens/BoonIcons/`, which holds **537 stills**.

Matching every `Icon` field in the trait data against the full extraction, stripping the
`Boon_`, `Keepsake_`, `Hammer_` and `Shop_` prefixes:

| | |
|---|---|
| Traits carrying an `Icon` | 579 |
| Icon file present in `GUI.pkg` | **435** |
| Still unmatched | 144 |

The Selene Hexes go with it, since they are `Boon_Selene_*` and share the same prefix rule.

The 144 that remain are almost entirely `Hammer_*` and `Shop_*`. The wiki already covers the
hammers at 114 files, so the real remaining gap is much smaller than this document claimed.

**The lesson, and it is the same one as the god cap.** A grep that returns zero is evidence
about the grep, not about the world. Extract first, then match against the data, and never
conclude absence from a naming assumption.

### Arcana naming

The card files are named for the card, not `card01`. The mapping came from
`MetaUpgradeData.lua`, where each entry carries `Image = "CardArt_NN"` and a source comment
naming the card. Keep the internal key when writing `arcana.json`, since that is the stable
id and the filename is only the display slug:

| File | Internal key | Card |
|---|---|---|
| `sorceress.png` | `ChanneledCast` | I, Medea |
| `wayward-son.png` | `HealthRegen` | II, Zagreus |
| `night.png` | `MagicCrit` | IV, Nyx |
| `the-fates.png` | `TradeOff` | XVI, the Three Fates |
| `judgment.png` | `CardDraw` | XXV, Hades |

The remaining twenty follow the same pattern and are listed in `manifest.json`.

### Worth extracting next

- `BiomeMap.pkg`, 24 MB. Region art, including the missing Tartarus
- The five familiar packages
- `Dora.pkg`, 7 MB. More poses of the mascot, useful since she marks unbuilt features
- The per-god packages hold **portraits with expressions**, for example
  `Portraits_Zeus_Pleased_01`. Higher resolution than the wiki grabs and far more of them
- `GUI/TextBacking.png`, `GUI/Tooltip_Backing_01.png` and `GUI/TooltipGraybox.png` are the
  text panels. Read the 9-slice warning below before building on them

### Strays to remove

`ui/boonii.webp`, `ui/healthbar-1upmoros.webp`, `ui/healthbar-1upskelly.webp` are not game
content. `ui/icon-*` are wiki furniture.

`hammers/executioner-27s-chop.webp`, `boons/pauper-27s.webp`, `duos/king-27s-ransom.webp`
and `duos/queen-27s-ransom.webp` kept a percent-encoded apostrophe in the slug. All four are
now duplicated by correctly named game art, so they can go on the next wiki rebuild.

Three wiki copies of the Black Coat aspect icons used to sit in `hammers/`, which is the
wrong shelf, and they shadowed the game art under the same slug. Removed, and
`build-lib.ps1` now skips them so a rebuild does not bring them back.

`npm run assets` also reports **17 wiki images with no source page recorded**. They were
moved between categories by hand after the manifest was written, so the file survived and
its provenance row did not. Harmless, and worth fixing on the next wiki rebuild since
`build-lib.ps1` will re-derive the rows.

## What else is in the extraction, and where

`extracted/` is **392 MB of scratch and is not in version control.** It holds 2,452 stills
and 9,795 animation frames. Anything wanted has to be copied into `assets/`, or it is gone
the next time the directory is cleared. This is the map so nobody has to re-extract to find
out what is there.

| Where | Stills | Frames | Holds |
|---|---:|---:|---|
| `gui/textures/GUI/Screens` | 1454 | 1457 | Boon icons, boon-select furniture, the shop, the Codex frames, the Arcana screen |
| `gui/textures/GUI/HUD` | 111 | 3405 | Health, Magick and Armor bars, every fill state at 400 frames each |
| `gui/textures/Items/Resources` | 249 | 1710 | Ash, Psyche, Bones, Moon Dust and the rest, with their pickup animations |
| `gui/textures/Items/Loot` | 46 | 1785 | Loot pickups |
| `gui/textures/Portraits/Codex` | 180 | 0 | **Codex portraits.** Every character, higher resolution than the wiki grabs |
| `gui/textures/GUI/LocationBackings` | 9 | 183 | Location title plates, animated. See below |
| `hecate/textures/Portraits/Hecate` | 6 | 359 | Hecate, including a 30 frame frozen sequence |
| `gui/textures/GUI/Icons` | 181 | 170 | Rarity frames, resource icons, small chrome |

### The medallion, since it came up

`Screens/UpgradeChoice/Medallion_01.png` is the **Daedalus Hammer screen's backdrop**, and
the game uses one image twice. `Game/Animations/GUI_Portraits_VFX.sjson` defines
`HammerScreen_Medallion01` at `OffsetX 900` with `RotationSpeed 0.5`, and
`HammerScreen_Medallion02` at `OffsetX -900` with `RotationSpeed -0.5`, scaling 1.3 to 1.1
and 1.1 to 0.8 as they fade up. Two counter-rotating medallions, then it chains to
`HammerScreen_Feathers`, which is `HammerBackground.png`.

That is a worked example of the ambient tier in `VISUAL.md`, and of the tone-on-tone
ornament that brief says the page is missing. Both images are now in `chrome/`.

### The Exit reward marker, and it is not in `GUI.pkg`

The medallion the game puts on an Exit when there is something behind it, the one with two
silver wings, is three layers and `RewardPresentation.CreateDoorRewardPreview` names them.
It spawns a backing, sets one animation on it, and that animation chains:

```
RoomRewardAvailable_Back_Run       Fx/RoomRewardAvailable-Back/RoomRewardGlow
  -> RoomRewardAvailable_Front_Run Fx/RoomRewardAvailable-Front/...0001..0060
       -> RoomRewardFrame_Run      Fx/RoomRewardAvailable-Back/RoomRewardFrame-Run
```

A warm bloom behind, a shimmering disc of **60 frames at 30fps** over it, and the two wings
on top. `_Meta` is the same for the MetaProgress store, with a green jewel on each wing.
`Items_General_VFX.sjson` holds all of it.

**They are in `ScriptsBase.pkg`, not `GUI.pkg`.** That is the whole reason nothing on this
shelf had them: every extraction this project had run was of the GUI package, so the marker
was never absent, it was never looked for. Same shape as the boon-icon and the aspect-name
mistakes: a negative result proved something about the search.

`deppth2`'s `-e` filter matched none of these entries under any name tried, including the
exact one `deppth2 ls` prints, so the package comes out whole into
`extracted/scriptsbase/`. It is 6,784 stills and takes several minutes.

**There is no plain 2D copy of it, and there was never going to be.** These are world
objects: the art ships already squashed for the plane it lies on, and the game draws it as
it is. Nothing in any package holds an un-warped version.

It is recoverable exactly, though, because **the disc is a circle in truth, so whatever
ellipse it ships as is the transform.** Second moments of its own alpha put the major axis
at 61.7 degrees with the minor at 0.631 of it. Undoing that, `R(t) diag(1, r) R(-t)`, takes
the disc from 0.631 to **0.999**, which is a circle to three places and is the check that
the transform is right rather than merely plausible.

The wings take the same inverse because they lie on the same plane, and that is what fixes
the shape of each crescent rather than just the angle between them. It leaves the pair on a
12.7 degree axis, so one rotation lays them flat, and they come out as the mirrored pair a
real Exit shows. Neither number is hardcoded: both are measured off the shipped alpha on
every run, so a patch that redraws the marker gets followed rather than fought.

`npm run reward-frame` writes `frames/reward-marker.png`, `frames/reward-wings.png`, both
`-meta` variants, and `chrome/reward-glow.png`.

**A front-facing cousin does exist**, and it was already on this shelf:
`chrome/circle-filigree.png`, which is `UnlockTextCircleBacking.png` out of `GUI.pkg`. Its
disc measures 260 by 251, so it really is round, because it is a UI element rather than a
world one. Same motif, a plate with ornaments either side; different ornament, gold
scrollwork rather than silver crescents.

### Boon icons are 90x90 and there is no larger copy

All **537** files in `Screens/BoonIcons/` are 90x90, every one of them, and nothing else in
the extraction shares a name with any of them at any size. The wiki's copies are the same
icons rescaled. So 90 pixels is the ceiling, not a starting point.

That sets a hard limit on how big a boon can be drawn. The timeline entry was 8.5rem, a 1.5x
upscale, and it looked like one; it is 5rem now, which downsamples. Anything that wants a
boon larger than about 80 pixels needs a different image, and there is not one.

The same is not true of the gods: `gods/` is 214 wide and `gifts/` is 240, so a portrait can
be drawn much larger than a boon before it softens.

### Chrome is picked by hand, and `scripts/chrome.ts` is the record

`npm run assets -- --fill` finds boon art by matching the trait data's `Icon` fields against
the extraction. **Chrome has no trait data behind it.** A pause box or a button plate is on
the shelf because somebody looked at it and said that one, so the table in `scripts/chrome.ts`
is both the copier and the record of who picked what and for what.

```
npm run chrome     copy the named GUI textures out of extracted/
npm run assets     describe them in manifest.json
```

It is idempotent and it refuses two things:

- **A slug that is already taken.** `buildIconIndex` keeps the first entry per slug and
  directory order decides which, so a `gifts/zeus.png` would sort ahead of `gods/zeus.webp`
  and silently change every god portrait in the app. The gift portraits carry a `-gift`
  suffix for exactly this reason, and anything else that would collide is named and skipped
- **Copying something already here.** Six of the 43 files picked on 28 August 2026 were on
  the shelf already, byte for byte, under the names the app uses: the four rarity icons
  (`Icons/CardRarityIcon_*`), `chrome/tooltip-backing.png` (`Tooltip_Backing_01.png`) and
  `chrome/resource-backing.png` (`ResourceBacking.png`). They stay in the table so it is a
  record of what was asked for rather than of what happened to be missing

**`chrome/circle-filigree.png` is `UnlockTextCircleBacking.png`,** and it is a filled disc
with gold flourishes rather than a ring with a hole. That is why art behind it shows through
tinted, and why it is the only frame option with a non-square aspect.

**Nothing in the package is a plain circle,** which is worth knowing before hunting for one
again. Sweeping every GUI texture for a ring of alpha around a hole returns nineteen, and
they are: the seven rounded-square BoonIconFrames, three Talent tree four-pointed stars,
three cauldron bands that only cover the middle, `NativeAspectRatioFrame`, a Codex
transition frame, and `BoonBG_Circle_01`. That last one is the only round frame Supergiant
ships, and it is carved stone at 2475 square. The radial's default frame is drawn in CSS
for that reason, in `src/ui/frames.ts`.

### The shelf ships whole, and it is 46 MB now

`vite.config.ts` sets `publicDir: 'assets'`, so every file here is also a URL and page
weight. The 28 August additions are about 9 MB of it, most of which nothing renders yet:
the three 1920x1080 splash screens are 3.8 MB and the gift portraits another 1.8 MB.

Nothing here is wrong, but a real deploy wants a build step that copies only what the app
references rather than the whole library. Until then, downscale before adding, the way
`frames/circle.png` was.

### `frames/circle.png` is downscaled, on purpose

It is `Screens/BoonSelect/BoonBG_Circle_01.png`, the carved ring the game draws behind a
boon offer, and every bubble in the radial picker now wears it. Shipped at its native
2475x2468 it was **2.37 MB**, which is more than the whole rest of `frames/` put together,
for a decoration drawn at about 150 pixels across.

The copy in `assets/` is 512x512 and 249 KB. `vite.config.ts` sets `publicDir: 'assets'`,
so anything on this shelf ships as-is and size here is page weight. The full-resolution
original is still in `extracted/gui/textures/GUI/Screens/BoonSelect/`, so this is
reversible; re-run `npm run assets` after touching it, because the manifest records bytes
and sha256.

The same argument applies to the 23 MB of Arcana card art, which is still full size.

### The Black Coat base image, and why no source has a better one

The wiki's `Weapon_Coat01.webp` is not a bad scrape. It is the game's own Codex card with
the parchment cut away, and the game really does draw the Black Coat as a flat lay of
gauntlets, boots and a folded pile. The coat is worn rather than held, so there is no
assembled-weapon pose to find. Every source was checked: `GUI.pkg`, `WeaponSuit.pkg` and
`Melinoe.pkg` hold Fx frames and portraits, and the weapon itself is a Granny model, which
is 3D and not an image.

Five framings were put in front of the owner on 27 August 2026, from the Codex card to the
shrine silhouette. **None of them was good enough**, so the candidates were removed and the
owner will hunt for a better source personally. Nothing is blocked: `coat-melinoe.png`, the
game's own 90x90 aspect icon, is the working image and it is consistent with the other 23.

### The animated plates

Each is a full in-and-out sequence: it starts empty, peaks, and fades back out. `chrome/`
holds the peak frame of each, which is the resting look.

| Sequence | Frames | Size | What it is |
|---|---:|---:|---|
| `LocationBackings/MinosLocationBacking` | 44 | 9 MB | A location title plate |
| `LocationBackings/ZagreusBacking` | 44 | 8 MB | The death plate, red and black |
| `LocationBackings/ArtemisBacking` | 25 | 5 MB | Artemis's plate, bows and leaves |
| `LocationBackings/AthenaBacking` | 25 | 5 MB | Athena's plate |
| `LocationBackings/GenericSubtitle` | 45 | 1 MB | The subtitle plate under a title |
| `GUI/ItemConsume` | 37 | 1 MB | A 320x320 burst, for something being taken or spent |
| `Screens/BoonEntranceDuo` and `BoonEntranceLegendary` | 30 each | 5 MB each | The flourish behind a duo or legendary offer |
| `Screens/InfoToast/InfoToastLoop` | 140 | 9 MB | A looping toast |

**Every frame is there, so an animation can be rebuilt rather than approximated.** That is
a real option for the event tier in `VISUAL.md`, and it costs nothing until it is used: the
frames stay in scratch, and only what ships gets copied in.

## Refetching: use the game, not the wiki

**Settled 23 August 2026. Every remaining gap in the table above is inside one file you
already own.**

`Content/Packages/1080p/GUI.pkg` in the Steam install is 243 MB and holds **7,462 GUI
assets**. Its `.pkg_manifest` is binary but the asset paths are plain ASCII, so the full
inventory reads out with:

```bash
grep -aoE 'GUI[\\/][A-Za-z0-9_-]+([\\/][A-Za-z0-9_-]+)*' GUI.pkg_manifest | sort -u
```

What it actually yielded, after extracting and checking rather than reading names:

| Gap | Result |
|---|---|
| All 25 Arcana | **Yes.** `GUI\Screens\MetaUpgrade\CardArt\card01` .. `card25`, 689x1071, plus `CardBack` variants |
| Vow icons | **Yes.** 19 clean stills in `GUI\Screens\ShrineIcons\` |
| Rarity frames | **Yes.** `GUI\Icons\CardRarityIcon_*` |
| Panels and chrome | **Yes.** `TextBacking`, `Tooltip_Backing_01`, `TooltipGraybox`, `CodexBackingEntry`, `IconBacking`, `ResourceBacking`, `CategoryTab1..3` |
| Selene Hexes | **No.** Name matches were screen chrome and animation frames, not the nine hex icons |
| Familiars | **No.** Cosmetic effigies only, no roster art |
| Status effects | **No.** Nothing usable found |

> A name appearing in the manifest does not mean a usable icon exists. Of 11,521 extracted
> PNGs only **2,442** are stills; the other 9,079 are numbered animation frames. Filter on
> `[0-9]{4}\.png$` before counting anything as a win.

Extract with [`deppth2`](https://github.com/SGG-Modding/deppth), the SGG modding
community's tool. The `-s` flag splits individual sprites out of the atlases rather than
dumping packed sheets:

```bash
pip install deppth2
```

```bash
deppth2 ex -s "C:\Program Files (x86)\Steam\steamapps\common\Hades II\Content\Packages\1080p\GUI.pkg"
```

Installed and working as of 23 August 2026: Python 3.12.10 at
`%LOCALAPPDATA%\Programs\Python\Python312\python.exe`, deppth2 0.1.6.6 at
`...\Python312\Scripts\deppth2.exe`. That Scripts directory is **not on PATH**, so call the
exe by full path.

Two things the docs do not tell you:

- **Put the source path before `-e`.** `-e` takes variable arguments and will swallow the
  positional source if it comes first
- **`-e` filters top-level atlas entries, not subtextures**, so it cannot target an
  individual sprite. Full extraction is the only practical route

Use the `1080p` package rather than `720p`. `GUI.pkg` takes a few minutes and produces
23,076 files totalling 364 MB.

Once this runs, the wiki scrape becomes a fallback for anything the extraction misses
rather than the primary source, and re-running it after a patch replaces the whole
refetch problem.

### On using the game's UI chrome

The panel art is available, and it is a different decision from using icons. Icons and
card art are content that every Hades wiki already republishes. Reproducing the game's
actual interface panels makes the tool look like it *is* the game rather than a companion
to it. Two practical reasons to lean away from it regardless of that:

- These are fixed-size bitmaps with ornate corners, and ornate corners do not stretch.
  Using one at arbitrary size needs CSS `border-image` with a correct slice inset, and only
  panels with genuinely flat middles will survive it
- Our own design tokens survive a patch. `CodexBackingEntry` does not

Borrow the palette and the feel. Build the panels.

## Rebuilding

`build-lib.ps1` is idempotent. It reads every zip in `../hades.fandom.com/`, keeps the
largest variant of each duplicate slug, and rewrites `manifest.json`. Re-run it after
dropping new archives in. It deletes and rebuilds `assets/`, so do not hand-edit files here.
