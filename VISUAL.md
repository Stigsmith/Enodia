# Brief: the visual language

Written 27 August 2026. Paste this whole file into Claude Code, or point it at the path.

Produced from a design conversation in the Claude.ai project. Everything factual below was
read out of the repo or out of the extracted game art, and the two places where it is a
judgement are marked.

---

## Goal

Enodia has one visual language, taken from the game's own interface art rather than from a
guess about it, and `dist/index.html` is rebuilt in that language as the proof.

## Build order position

Outside `DESIGN.md` section 10, which sequences engines and data. This is the layer every
one of steps 7 through 11 renders into. Doing it now is cheap because one page exists.
Doing it after step 11 means restyling the whole run surface, its rail and its overlays.

---

## What the design conversation settled

### The chrome is the Crossroads, the content is Olympus

The tool's own furniture, panels, rails, frames, dividers, headings, stays in one fixed
palette permanently. Colour and variety arrive with the boons and the god portraits, which
carry their own palettes. That is how the page gets to be art heavy without its identity
dissolving every time the player switches god.

### The owner picked Hecate over Melinoe

The tool is named for an epithet of Hecate. The chrome wears her, not Melinoe's leather.

### Verdict is light, not hue

Jade green is the ambient light of the whole tool, so a green "on track" pill says nothing.
State is expressed as luminance instead:

| State | Treatment |
|---|---|
| On track | Fully lit. Glow present |
| Reachable | Lit, no glow. Still |
| At risk | Flicker on the rim light |
| Dead | Unlit iron, with a hairline crack in the rim colour |

This satisfies the positional ramp rule in `REQUIREMENTS.md` 10 better than colour does, and
nothing in the code has to say "green" or "red".

---

## The palette, and where each value came from

Sampled with median-cut quantisation over the alpha-masked pixels, near-black and near-white
dropped. Files named so the sampling can be repeated.

### Ground, from the game's own panels

`extracted/gui/textures/GUI/HUD/TraitTrayBacking.png` and
`extracted/gui/textures/GUI/Tooltip_Backing_01.png`:

```
#0d0b0d  35%   #1d2020  32%   #191d1f  21%   #131517   8%
```

Hue 180 to 210. Near-black leaning teal-green. **The placeholder's existing `--ink-950`
through `--ink-700` ramp is already correct** and should not be touched. This was checked
because the design conversation initially proposed shifting it violet, based on Hecate's
character portrait. The portrait leans violet, the interface leans teal, and for chrome the
interface wins.

### Dividers

`extracted/gui/textures/GUI/HorizontalDivider.png`:

```
#262d2d   #2b3232   #2f3738   #353e3f   #424d4f
```

Hue 180 to 189, value 18 to 31. The placeholder has nothing in this band. Add it.

### Silver, from the game's own metal

`assets/rarity/common.png`, which came out of the game files:

```
highlight #9aa1cd    body #686f9b    shadow #333546    deep #22232e
```

**Hue 231 to 235 throughout.** Silver in this game is violet-leaning, not neutral grey, which
is why it reads cold and godly rather than like chrome. Any neutral grey used as metal will
look wrong next to real game art.

### Jade, the living light

`assets/characters/hecate.webp` and `reference/hecate-full.png`:

```
#3d6b63 dim     #649c97 mid     #8fd4c4 hot
```

The placeholder's `--verdigris:#57A08A` sits inside this range and is correct. Keep it,
extend it to a three-step ramp.

### Rim light, for events only

From the character art, where the edge lighting is magenta and cyan, never gold:

```
magenta #c96aa8     cyan #5ad4d4
```

Reserved for the at-risk flicker and the dead crack. Never used for anything ambient.

### One token swaps, the rest do not

Per-god themes are wanted later, an Ares skin and so on. Nothing needs building for that
now, but it decides how these tokens are grouped, so it is written down here.

The split is the one this brief already opens with. **The chrome is the Crossroads and the
content is Olympus**, so the furniture is fixed and the light is not.

| Group | Under a theme |
|---|---|
| Ground, dividers, silver | **Fixed.** The Crossroads does not change colour because you took Ares |
| Jade, the living light | **Swaps.** This is the per-god hue, and the only one |
| Rim light, magenta and cyan | **Fixed.** It signals events, and an event means the same thing in every theme |

So a theme is one ramp of three values replacing `--jade` dim, mid and hot. That is what
"a theme is a token set, not a rewrite" means in practice, and it is why the ramps have to
stay positional. `--jade-hot` must mean the brightest living light in every theme, never a
literal colour.

Corollary worth stating: **verdict colour cannot come from the theme.** DEAD, at risk and on
track have to read identically whether the player is running Ares or Demeter, which is
another reason the brief puts verdict in light rather than hue.

### Delete `--brass`

`--brass:#C0A15C` in the placeholder. Seven interface files were sampled out of
`extracted/gui/` and none of them contain gold. Neither do Hecate, Melinoe or Nyx. Gold is
Olympus, and Olympus arrives with the boon art, not with the furniture. Removing the token
matters more than removing its current uses, because a gold token left in the file will be
reused.

---

## The two things the placeholder is missing

These are the answer to "not art heavy or effect heavy enough". Both are in
`TraitTrayBacking.png` and neither is expensive.

### 1. Tone-on-tone ornament

The game's panels are not empty. They carry smoke and scrollwork at roughly 8 to 12 percent
contrast above the ground, anchored to one corner and bleeding off the panel edge. It is
almost invisible and it is the entire reason the panel reads as made rather than drawn.

Take the motif from `TraitTrayBacking.png` directly. It is the same art under the same
licence as everything else in `assets/`. Do not author a substitute.

### 2. The lit edge, and the sheen

The panel border is not a uniform hairline. It is a thin edge that catches light, brightest
at the top corners and fading down the sides, with a soft bloom sitting just outside the
corner.

On top of that the owner has asked for the effect the game puts on metal and on godly
things: a specular sheen that travels across a plated surface. Specified as:

- Applies to **rims, linings and edges only**, never to fills. Plating is an edge property
- The travelling highlight is the silver ramp above, `#9aa1cd` at the crest
- Slow, and not synchronised across elements. Several rims sweeping in lockstep reads as a
  loading state
- It is emphasis-tier motion, so it belongs on the recommended card and on the lit rail
  slots, not on every panel at once

---

## Type

| Role | Now | Change to | Why |
|---|---|---|---|
| Display, names, headings | Fraunces | **Cinzel** | Fraunces is modern editorial. Cinzel is a Trajan lookalike and reads classical |
| Body, every sentence the tool says | Karla | **Spectral** | The game sets prose in a serif. A sans in the body is the tell that this is a web app |
| Symbols, paths, citations | IBM Plex Mono | **Keep** | It is already doing semantic work. A monospaced symbol name is visibly a different register from prose, which is the "never let a judgement and a sourced fact look equally weighed" rule enforced typographically |

Cinzel and Spectral are a judgement, not a source. Both are lookalikes, which
`REQUIREMENTS.md` 11 requires. If Spectral fails the small-size legibility check on a phone,
bring Karla back for numerals only and say so.

---

## Motion, in four tiers

| Tier | What | Where |
|---|---|---|
| Ambient | Drifting motes, breathing glow, slow pan | Always running, never asks for attention |
| Emphasis | The silver sheen sweep | The recommended card, lit rail slots |
| Event | The snuff, the crack | Only when something dies |
| Response | Lift on press, dim the rest | One curve, one duration, everywhere |

`prefers-reduced-motion` stops ambient and emphasis entirely. Event and response degrade to
an instant state change rather than disappearing, because they carry meaning.

---

## Touch

```
src/ui/tokens.css        new. the single definition of every token
dist/index.html          restyle. structure and copy unchanged
```

Tokens live in one file. `dist/index.html` inlines a copy until a build exists. If it
inlines rather than imports, add a note in the file saying which is the source.

## Do not touch

```
dist/index.html <meta charset="utf-8">
```

CLAUDE.md is explicit: the Artifact wrapper injects one, so an encoding bug is invisible
there and lives on Netlify. A `<meta charset>` bug already mangled every interpunct on the
live site once.

Also unchanged: the page's structure, its roadmap copy, its spoiler tiering, the "also
considered" section, and the visible disclaimer. This is a restyle, not a rewrite.

Do not recolour, recrop or filter any game art. The art is the reference and the content.

Do not touch `assets/arcana/`, `assets/rarity/` or `assets/vows/`, which
`assets/build-lib.ps1` is coded to preserve.

## Unverified assumptions

Verify before building on any of these. If one is wrong, stop and report rather than
working around it.

1. **The palette rests on seven files out of 11,521** in `extracted/gui/`. Representative,
   not exhaustive. Sample a few `GUI/Screens/` subfolders before committing the tokens. If a
   major screen uses gold prominently, the brass decision is wrong

   > **Verified 27 August 2026. The brass decision holds.** Sampled 247,921 chrome pixels
   > across ten folders, content art excluded. Silver leads at 26.8%, jade 18.9%, and the
   > gold hue band 15.1%. But that band is mostly not gold: 34% is pale tan parchment, 25%
   > dark brown shadow, and the "bright" quarter reads `#D2D280`, `#E1E18A`, `#FFFFA0`,
   > which is pale yellow **highlight**, not metal. Genuine mid-brass is about 2.6% of
   > chrome. `BoonSelect`, the screen this tool's Exit block is modelled on, is **55% silver
   > and 0.1% gold**. The bright end of that band is also evidence for the light-not-hue
   > rule above, since it behaves as a highlight rather than a colour.

2. **`CLAUDE.md` says `extracted/` is "scratch, not source".** This brief uses it as the
   primary art reference, which contradicts that line. That is a decision for the owner, not
   a fact to check, and it should be settled before the ornament is lifted out of
   `TraitTrayBacking.png`

3. **The design conversation claimed `assets/slots/dash.webp` should be renamed to
   `sprint.webp`**, on the grounds that the vocabulary table maps Sprint to `Rush`. The
   game's own asset is named `SlotIcon_Dash.png`. That claim was too confident. **Rename
   nothing** until the `Keywords` glossary in `Content/Game/Text/en/` has been read

4. **`DESIGN.md` 12 item 4 says "rarity frames, 0 of 6".** The four files in
   `assets/rarity/` are chevron pips, not frames, and
   `extracted/gui/textures/GUI/Icons/CardRarityIcon_*.png` exists. Worth confirming what is
   actually missing before the card treatment assumes a frame it does not have

---

## Done when

### On screen

1. Open `dist/index.html` on a phone. Put
   `extracted/gui/textures/GUI/HUD/TraitTrayBacking.png` on the monitor beside it. The
   page's panels and the game's tray read as the same material: same near-black, same thin
   lit edge, same faint ornament underneath

2. Scan the whole page for anything gold or brass. There is none

3. Look at one panel rim for ten seconds. A silver highlight travels across it, slowly, and
   the panel beside it is not doing the same thing at the same moment

4. Enable reduced motion in the OS and reload. Every ambient and emphasis animation stops.
   Nothing becomes invisible, nothing loses meaning

5. Read one heading, one sentence, and one symbol name such as `RewardLogic.ChooseLoot`.
   Three visibly different registers, without reading the words

6. Load at 390 points wide and at 1440. No horizontal scroll at either. No body copy under
   13px

### Machine

1. `grep` for `--brass` and for `gold` in `dist/index.html` and `src/ui/tokens.css`. Zero
   hits in both

2. No literal colour value outside the `:root` block, except inside inlined SVG and data
   URIs

3. No token name contains a colour word. Names are positional or role-based, per
   `REQUIREMENTS.md` 10

4. `<meta charset="utf-8">` is still the first `<meta>` in the file

5. The page is served on port 8777 from `.claude/launch.json` and the DOM is read to confirm
   the roadmap sections are present. A green build proves nothing

---

## Rules in reach for this task

- No em dashes. Not in copy, not in comments
- The validator is specified to fail on any UI string containing "door", "room" or "biome".
  The page says Exit, Location, Region, Hex
- Colour through custom properties, ramps positional and not literal
- The game's own fonts do not ship. Lookalikes only
- **Unrated is a first-class state.** Define its treatment now, dashed placeholder, sorts
  last, survives every filter floor. Retrofitting it later means touching every card
- Screenshots need the Browser pane open. If they time out with "not compositing frames",
  ask rather than falling back to computed styles. The interpunct bug was invisible to DOM
  queries and obvious in a screenshot

---

## Two things this brief does not cover

Raised in the same conversation, both needing a document change rather than code, and both
running through `project/workflow-decision.md`:

1. **The run surfaces are now one timeline, not four screens.** `DESIGN.md` 8 lists Setup,
   Exit, Targets, Held and Briefing. The design conversation replaced that with a single
   scrolling timeline, a persistent left rail for Held, and overlays for detail. Lit beads
   behind you, one bright entry at the present, unlit beads ahead for Exits remaining. This
   rewrites `DESIGN.md` 8 and changes what step 8 means

2. **God-level priority is a missing engine output.** At an Exit the player chooses a god
   before seeing boons, so the useful output is every live target rolled up into a ranked
   list of which gods are most wanted. The engine currently returns verdicts per target.
   This is a small derivation over existing output and it belongs in `DESIGN.md` 4
