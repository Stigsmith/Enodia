# Enodia: Image Library

567 images in 16 categories, categorised and slug-named.

Two sources, and the difference matters:

- **Wiki** (`../hades.fandom.com/` zips, deduplicated by SHA-256, `.webp`): boons, duos,
  keepsakes, hammers, gods, characters, aspects, biomes, elements, slots, infusions,
  artifacts
- **Game files** (extracted with `deppth2`, `.png`, full resolution): `arcana/`, `rarity/`,
  `vows/`

`build-lib.ps1` rebuilds only the wiki half and is coded to leave the game-file categories
alone. Do not remove that guard.

> Game art is copyright Supergiant Games. This is an unofficial, non-commercial fan
> project, not affiliated with or endorsed by Supergiant Games.

## Naming convention

```
assets/<category>/<slug>.webp
```

`slug` is lowercase kebab-case derived from the wiki filename: underscores and spaces
become hyphens, apostrophes and periods are dropped, the wiki's `_II` suffix is stripped,
and the `Melino%3F` mojibake is normalised back to `melinoe`.

The slug **is the join key**. `assets/boons/lightning-strike.webp` pairs with the record
whose `id` ends `lightning-strike` in `boons.json`. Never key on a display name, and when
Supergiant renames something, add the old slug to that record's `aliases` array rather
than renaming the file.

Every file is listed in `manifest.json` with its category, byte size, SHA-256, the original
wiki filename, and the wiki page it was scraped from.

## Categories

| Category | Files | Contents | Status |
|---|---:|---|---|
| `boons/` | 200 | Olympian boon icons | partial, see gaps |
| `hammers/` | 114 | Daedalus Hammer upgrade icons, scraped per weapon page | 101 need verification |
| `duos/` | 47 | Duo boon icons | looks complete |
| `keepsakes/` | 42 | Keepsake icons | complete, 2 strays |
| `aspects/` | 29 | Weapon aspect icons plus aspect character portraits | numbering unverified |
| `characters/` | 28 | Non-boon-granting character portraits | good |
| `gods/` | 16 | Boon-granting god portraits | complete |
| `infusions/` | 11 | Elemental infusion boons | unverified count |
| `artifacts/` | 9 | Consumables and run items | partial |
| `biomes/` | 6 | Region art | missing Tartarus |
| `elements/` | 6 | Aether, Air, Earth, Fire, Water, Elemental Essence | complete |
| `ui/` | 6 | Wiki section icons | low value, replace |
| `slots/` | 5 | Attack, Special, Cast, Dash, Magick | complete |
| `arcana/` | 25 | Arcana cards, named, from game files | complete |
| `vows/` | 19 | Oath of the Unseen, from game files | complete |
| `rarity/` | 4 | Common/Rare/Epic/Heroic, from game files | complete |

### Aspect naming

Five weapons arrived numbered, the Black Coat arrived named:

```
axe-01..04   blades-01..04   flames-01..04   skull-01..04   staff-01..04
coat-01  coat-nyx  coat-selene  coat-shiva
```

**Which number is which aspect is not verified.** The convention is usually 01 = Melinoë,
04 = hidden, but do not write that into data until it is checked against the wiki. Rename
to `<weapon>-<aspect-name>` once confirmed, matching the Black Coat pattern.

## Known gaps

Ordered by how much they block the build.

Closed on 23 August 2026 by extracting `GUI.pkg`:

| Was missing | Now | Notes |
|---|---|---|
| Arcana cards | **25 of 25**, named | 689x1071 PNG. Names resolved from `MetaUpgradeData.lua`, see below |
| Rarity frames | **4 of 4** | `CardRarityIcon_Common/Rare/Epic/Heroic` |
| Vow icons | **19** | Full Oath of the Unseen set, needed for the Fear model |

Still open:

| Missing | Expected | Have | Why it matters | Where to look |
|---|---:|---:|---|---|
| ~~**Boon icons**~~ | ~~300+~~ | ~~199~~ | **Solved, see below** | |
| ~~**Selene Hexes**~~ | ~~9~~ | ~~0~~ | **Solved, see below** | |
| **Familiars** | 5 | 0 | Roster art | `GUI.pkg` has only cosmetic effigies. Try `CatFamiliar.pkg`, `FrogFamiliar.pkg`, `HoundFamiliar.pkg`, `PolecatFamiliar.pkg`, `RavenFamiliar.pkg` |
| **Status effect icons** | ~15 | 0 | Needed for tag filtering | Not yet located |
| **Biome: Tartarus** | 1 | 0 | Hole in the region strip | `BiomeMap.pkg` (24 MB) is the next thing to extract |
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

`keepsakes/boonii.webp`, `keepsakes/healthbar-1upmoros.webp`,
`keepsakes/healthbar-1upskelly.webp` are not keepsakes. `ui/icon-*` are wiki furniture.

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
