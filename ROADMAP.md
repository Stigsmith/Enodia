# Enodia: Roadmap

**The single status view.** What is done, what is next, what is blocked. Detail lives
elsewhere and is linked, never duplicated: this file says *where things stand*, the others
say *what the thing is*.

Last updated 2 September 2026, game build `138174`.

---

## Where the build is

| | |
|---|---|
| **Phase** | 1, "The Exit". **Complete.** Phase 4: stages 1 to 3 built, accounts held shut on mail |
| **Build order step** | **11 of 11.** Step 8 was the first shippable point and it was passed three steps ago |
| **Tests** | 427 in node across 24 files, and **39 inside workerd** against a real D1. `npm test` runs both |
| **Validator** | 0 failures, 3 warnings |
| **Build** | `dist/` is **29 MB and 664 files**, and it runs from a plain static server |
| **Live** | **`enodia.me`**, on Cloudflare Workers, since 2 September 2026. Also `enodia.stigly-official.workers.dev` |
| **Deploy** | `wrangler.jsonc` publishes `dist/` to Cloudflare Workers. Cache tiers and security headers in `assets/_headers`, hashed assets immutable, a CSP that says the page fetches nothing but itself and now actually means it |
| **Stack** | Vite 8, React 19, TypeScript 7, Vitest 4 |

**Phase 1 is complete.** Set up a run, log what each Exit gave, and the timeline records what
each pick closed at the pick that closed it. Settling the fourth Olympian reads "35 builds
closed here" against that entry, and the present entry says what is still live and which god
feeds it. That is the originating complaint answered, and it is the first shippable point.

**And it remembers where you were.** Leave the run and come back, and the timeline opens
under a card: what you were chasing and where it stands now, what moved since you last
looked with the deaths first, what you hold by slot, and how many Exits are left. Pin a
target from the standing drawer and that pin is what the card leads with.

**A mis-tap costs one tap.** Every logged station carries "This did not happen", and taking
one back replays the run from empty so everything after it is recomputed, deaths included.

**The deploy target moved to Cloudflare.** `wrangler.jsonc` publishes `dist/` to Workers
static assets, so the hand-authored `placeholder/index.html` is no longer what a deploy
serves. Running it is the owner's, and the only step left: `npm run deploy`.

**Netlify's rules were never actually live**, which is why this is not a like-for-like move.
The CLI deploy never picked `netlify.toml` up, so the site ran on Netlify's defaults: no CSP,
no `X-Content-Type-Options`, no `Referrer-Policy`, and a bad path 404ing instead of landing
on the app. Every one of those takes effect for the first time on Workers, verified by
reading real responses rather than trusting that they carried over.

**The fonts are self-hosted now.** `index.html` used to pull four families from Google while
the CSP forbade exactly that, which nobody saw because the CSP was never applied. `npm run
fonts` vendors all 38 faces into `assets/fonts/`, so the policy ships unchanged and the page
loads nothing from anybody else. 680 KB, of which a first paint fetches two files.

**Two rounds of playtest feedback have landed since Phase 1 closed**, and they changed more
than polish. The editor was rebuilt around two boon trays, the warnings now name what would
fix them, runs are logged without opening the editor, deleting is recoverable, and two
mechanical claims turned out to be wrong. `src/data/changelog.ts` is the readable version;
the corrections are below and in `CLAUDE.md`.

---

## Phase 1 build order

The sequence is fixed in `DESIGN.md` 10. Status only here.

| Step | What | State |
|---:|---|---|
| 1 | Extractor, Lua to `data/generated` | **Done.** 63 files, zero failures, deterministic: a re-run against the same build changes nothing but the date |
| 2 | Validator wired into prebuild | **Done.** 8 checks. `npm run build` stops on a broken reference, and it has caught two of mine |
| 3 | Asset join, every trait has an icon or a recorded gap | **Done.** 310 of 310 offerable traits and 24 of 24 aspects have art, zero gaps |
| 4 | `engine/slots.ts` and the type layer | **Done.** Inheritance resolved, the lockout encoded, 22 tests |
| 5 | `engine/reachability.ts` | **Done.** Four states, bands, god priority, and it runs against the real 47 targets |
| 6 | `engine/runsim.ts` | **Done.** Seeded, legal runs. The dead-stays-dead property holds over 25 of them |
| 7 | Setup screen, and the rail | **Done.** Weapon, aspect and Exits in, a real RunContext out, and the rail fills as you log |
| 8 | **The timeline shell.** First shippable point | **Done.** Deaths recorded at the pick that caused them, verdicts in the present entry |
| 9 | Verdict snapshotting, `engine/briefing.ts`, re-entry header | **Done.** A trail per run, the diff, the pin, and the card. 16 tests |
| 10 | `engine/rules.ts`, one rule, then `scripts/health.ts` | **Done.** 5 rules as data, the harness that measures them, 17 tests |
| 11 | The offer block inside the present entry | **Done.** Ranked, with the reject verdict, and everything shared lifted above the cards |

Later phases are scoped in `REQUIREMENTS.md` 7: **2** before the run, **3** memory,
**4** automation and community.

### What landed after step 11

Phase 1 was the plan. These were not, and each answers something the plan assumed was
already true.

| | |
|---|---|
| `npm run prune` | Ships what the app references. **55 MB and 940 files down to 10 MB and 518** |
| Boon text | 259 of 567 descriptions were wrong. `#` placeholders **422 down to 193** |
| Corrections | "This did not happen" on every station, replaying the run |
| Keyboard | An `h1`, a skip link, named landmarks |
| Arcana and familiars | 25 cards and 5 familiars in the bundle, all 30 with art |
| **The build manager** | Five layouts to choose between, and both aspect ratios |
| `npm run artifact` | The build manager as one self contained HTML file, 2.2 MB, art inlined |

---

### The build manager, and what the review settled

**The owner reordered the product.** The run companion is for a newcomer. A player with 300
hours marks a build in the game and plays; what they need is *inspiration* ("what shall I
try this run") and *gap analysis* ("what am I defaulting to, and what would break it").
Both are answered by looking at builds rather than by logging one.

Five layouts went up behind a switcher, each built to a different design philosophy and
each stating what it gave up. **The review is over and three of the five are gone.**

| Layout | Verdict |
|---|---|
| Contact sheet | **The overview**, shrunk. It was too big to see a couple side by side |
| Poster | **A detail view.** One build as a page, the art large |
| Constellation | **A detail view.** Five fixed clock positions, gaps visible at once |
| Loadout | Deleted. It looked like the game and no build in it had any character |
| Ribbon | Deleted. **One idea worth stealing back**: it marked which picks were actual prerequisites of the centrepiece rather than preferences, which nothing shows now |

Poster or Constellation is a **setting**, not a control on the page: a reader wants one of
them and keeps wanting it, and a switcher on every build asks the same question every time.

The frames went the same way. **Fourteen down to three**: the Exit reward marker is the
default and Hecate's two circles are the alternatives.

### Built for a library, not for eight

The eight samples stand in for dozens of tested community builds, and later for builds the
community adds itself. So the overview **filters and sorts** rather than listing.

**Five dropdowns, arm first.** It was chips and chips lost on space: five facets over eight
builds is 28 of them, about nine rows on a phone, and at eighty builds it would have been
the whole screen before a single build appeared. Five dropdowns are five rows at any size.
The cost is that a facet now holds one value, so "Zeus or Poseidon" is gone.

Arm leads because that is the order a player thinks in, and aspect alone was the wrong first
question: 24 of them with no useful grouping until the weapon is in front. **Choosing an arm
clears the aspect** and drops the now-redundant arm prefix from the aspect labels. Gods,
keepsake and familiar unfold, and the shut disclosure carries a count so a filter left on
out of sight cannot narrow the list invisibly.

**Every facet is derived.** Arm, aspect, gods, keepsake and familiar are computed from the
builds themselves, so adding a build adds its own filter options and there is no list
anywhere to keep in step.

**The counts are the part that would have lied.** A count beside an option is taken with
that option's own facet lifted and every other facet still applied, so it answers "how many
if I pick this as well". Counting against the whole library instead offers a god with 6
beside it that yields nothing, because the aspect already picked excludes all six.
`build-filter.test.ts` clicks every option and asserts the result matches the number.

A build now carries `how`, the paragraph explaining what feeds what, and `by`, which will
tell a tested build from an uploaded one. **`how` describes and does not rate**: every
sentence restates a boon's own text or a prerequisite the data states.

**Both shapes work.** Every variant is authored narrow first, then given `60rem` and again
`100rem`. Mark sizes are four rungs on one scale, so a 21:9 screen gets a bigger drawing
rather than only a wider one.

**There is a shareable copy.** `npm run artifact` builds `artifact/` and folds the
stylesheet, the module and 119 images into a single 2.9 MB HTML file that runs from anywhere
with no server. It is the same components: nothing in `artifact/` reimplements a layout. It
ships two ways, as an Artifact and as `dist/builds.html`.

Writing it hit **the charset bug for the third time**, and for the second time in a wrapper
that hides it. The page was written without a `<meta charset>` because the Artifact wrapper
injects one; served as `dist/builds.html` from a plain server, which injects nothing, the
browser guessed GBK and every interpunct rendered as a Chinese character. `Descura 路
Poseidon + Zeus`. `artifact/` is inside the validator's charset check now.

**The god-literal check earned its keep twice.** `validate.ts` refused a `gods` field on the
build shape, correctly: it was a hand-kept copy of what `assemble()` derives. Then it
refused `NOT_OLYMPIAN = ['Hermes', 'Selene', 'Chaos']` in the filter. Both fixes were the
same fix, and the second is better than what it replaced: keeping to the `olympians` roster
says "carries GodLoot and spends a slot" from the data, rather than naming the exceptions.

**The dropdowns show the game's art, which meant giving up the native control.**
`<option>` cannot hold an image in any engine, so `Dropdown.tsx` is a listbox with arrow
keys, Home and End, Escape, type-ahead, `combobox` and `listbox` roles and
`aria-activedescendant`, all of which the native one gave for free. What it cannot give back
is the phone's own picker, so under 34rem the list opens as a sheet across the bottom of the
screen with 44 pixel rows. Sort stays a real `<select>`: three words, no art, nothing to win.

**The gift portraits, everywhere.** `assets/gifts/` is the max-affection art, one per
character, and `assets/README.md` had it shelved as "a possible alternate to gods/, unused
so far". It is the alternate now, for every god and character in the app, filter and run
surface alike. The `gods/` headshots are crops, and a crop at 22 pixels is a smear of skin
and hair; the gift art is drawn small and whole, with a silhouette and one dominant colour
each. One resolver in `build-app-data.ts` feeds both surfaces, so it was one change.
**Hades is the only fallback**, because its only gift art is the Hades and Persephone pair,
which is not just Hades.

An arm is drawn as its **base aspect's square icon**, not `Weapon.icon`: that field is the
large transparent render, which is right on a poster and reduces the Witch's Staff to a thin
diagonal line at 22 pixels.

**The artifact silently lost five of those icons.** `reachable()` collected art for ids
named in `builds.ts`, and five of the six arm icons come from base aspects no sample names.
Served from `dist/` they resolved, because the image library sits beside the page there; in
the Artifact, which has neither, they would have 404ed. Caught by counting non-data URIs in
the rendered page, which is the only check that actually proves self-containment, and it is
in the verification pass now.

**Every icon was 18 percent too tall, and only the centrepiece showed it.** The frame is
deliberately larger than the icon because the game draws it overhanging, and with `auto`
grid tracks that oversized frame *sized the row*: `height: 100%` on the art then resolved
against the grown row rather than the box, so every mark in the build manager hung below its
own container. Invisible until the centrepiece got a glow ring, which is centred on the real
box and visibly was not centred on the art. Fixed tracks, and the ring's inset now reads the
same `--mark-frame-over` the frame does, so they cannot drift apart again.

**Dark art needed a ground.** Hammer and Hex icons are near-monochrome, and at 42 pixels on
an ink-950 ground three of them in a row looked like three broken images. Every one had
loaded at full size. The game never draws an icon straight onto the background either;
there is always a lit frame interior behind it, and `.mark` has one now.

### The Arcana board

**Six of the twenty-five cost nothing and switch themselves on**, each by its own rule out of
`MetaUpgradeLogic.CheckAutoEquipRequirements`. That is the page: a build naming three cards
leaves unsaid what the other twenty-two do, and one wrong addition turns a free card off.

| Card | Rule |
|---|---|
| The Fates | every neighbour equipped |
| The Moon | at least one neighbour equipped |
| Judgment | between 1 and 3 cards |
| The Queen | no cost used more than twice |
| The Centaur | one card of every cost 1 to 5 |
| Divinity | a complete row or column other than its own |

**Only paid cards count**, including toward each other, which is what makes a third card at
one cost turn The Queen off. **Judgment and The Centaur can never both be on**: one caps the
count at three, the other needs at least five. `arcana.test.ts` proves it rather than
asserting it, and it is most of why the number of sensible bases is small.

Position is load-bearing, so the board is the game's own 5x5 out of
`MetaUpgradeDefaultCardLayout`. A fully unlocked board is assumed and the page says so:
`GetZoomLevel` shrinks the grid while cards are locked, which depends on a save this cannot
read.

`AdjacencyBonus` is a **second, dormant** system: an 8-neighbour multiplier that no card
declares. Written down so nobody re-derives it and assumes otherwise.

Three base layouts ship empty in `src/data/arcana-layouts.ts`. They are the owner's, like
the builds. `arcana-layouts.test.ts` checks a filled one and prints its Grasp, which
conditionals came on and why each of the rest did not; it fails only on the impossible.

---

## Corrections since Phase 1

Three things the tool asserted that were wrong. All three are now in `CLAUDE.md` with their
sources, because each was believed for a while and each shaped code.

**A run is about forty Exits, not twelve.** Four Regions of eight to twelve. `RoomDataN/O/P/Q`
and `RoomDataF/G/H/I` give the structure; the per-Region count is generated rather than
tabled, so the number is the owner's measurement. Everything judging reachability had been
working against a third of a real run.

**The four-Olympian cap is on the random pool, not on the run.** `RewardLogic.lua:238` calls
`ChooseLoot`, which freezes the pool once `ReachedMaxGods` is true; line 242 overwrites that
from any held `ForceBoonName` without consulting the cap. A fifth god is a keepsake away.

**A run has four keepsakes, not one.** One at the start and a swap at the rack after each of
the first three bosses, one `GiftRack` per Region gated on `WorldUpgradePostBossGiftRack`.

---

## What I would pick up next

Phase 1 is done and nothing below blocks anything else. In the order I would take them.

**1. Real build definitions.** The shape is settled and the library now ships empty, which is
the honest state: placeholder builds read as recommendations, so they were cut. `ShownBuild`
carries `how`, `luck`, `playstyle` and `by`, and the filters derive themselves from whatever
is added. This is the owner's, and the community's after that.

**2. Run the deploy.** `wrangler.jsonc` is written, `dist/` builds clean, and every rule is
verified under `wrangler dev`. `npm run deploy` is the whole of it, once `wrangler login` has
run once. Netlify stays up until it is checked.

**3. The `feeds` tag.** ~~Extract `ProjectileData` and `WeaponData`~~ is **done**, and half
of it turned out to be impossible: `WeaponData` and `EffectData` answer, `ProjectileData`
does not have the numbers at all. See above.

The `feeds` tag is the largest hand-authoring job in the project and the owner's, and three
separate features wait on it: the briefing's centre of mass, any rule about what a boon
actually does, and archetypes. Nothing else unlocks as much.

**4. Split `traits.json` by entity type.** Mechanical, and it would let the validator stop
walking `InheritFrom` itself.

**5. Phase 2.** `REQUIREMENTS.md` 7.

---

## Blocked, and on whom

| What | On | Note |
|---|---|---|
| The Cloudflare deploy | The owner | Needs `wrangler login` once, which is a browser sign-in this cannot do. Then `npm run deploy`. Every header and cache rule is already verified under `wrangler dev` |
| `enodia.tools` | The owner | Verified free at the registry, $23/year at cost from Cloudflare Registrar. A purchase, so it is the owner's. Nothing waits on it: the deploy is verified on `workers.dev` and the domain attaches after |
| ~~`wrangler login`~~, ~~`wrangler d1 create`~~, ~~the secret~~, ~~the domain~~ | **Done, 2 September 2026.** Live at `enodia.me` |
| `wrangler d1 create enodia` | The owner | Needs the login above. `wrangler.jsonc` carries a placeholder `database_id`, which `wrangler dev` ignores and a real deploy does not. Paste the id it prints |
| `wrangler secret put BETTER_AUTH_SECRET` | The owner | Signs every session cookie. `.dev.vars` covers local. Without it in production the Worker returns 500 by design, rather than signing cookies with `undefined` |
| A mail provider | The owner | **The one thing holding accounts shut.** Reset is written and waits on a key: `worker/email.ts` is Resend, `RESEND_API_KEY` and `MAIL_FROM` are read from secrets, and `/api/capabilities` reports whether it is configured. Owner is setting one up, expected 3 September 2026 |
| Flipping `ACCOUNTS_LIVE` | The owner | One constant in `src/state/account.ts`, false today. It drives the account room, the menu badge, the menu note and the Publish item together. Flip it once the mail key is in. **It is a UI gate only**: `/api/auth/*` is reachable regardless, which is accepted and explained where the constant is defined |
| ~~The Ko-fi handle~~ | **Done.** `stigsmith`, live in the footer |
| Two "rooms" on the live page | The owner | The validator reports them. `placeholder/index.html` lines 1106 and 1362 say "ten rooms in" and "encounter rooms". Copy is the owner's to change |
| `feeds` tag | The owner | `DESIGN.md` 12 item 8. Largest hand-authoring job in the project, and the briefing's advice line needs it |
| Archetype `core` / `compatible` / `avoid` lists | The owner | `DESIGN.md` 4.1.4. Not derivable from any file |
| Real build definitions | The owner | `data/curated/builds.json` says its records are the owner's alone. The library ships empty now: `SAMPLE_BUILDS` is `[]` and the stress-test build lives in `builds.fixture.ts`, which nothing in the app imports. `how`, `luck`, `playstyle` and `by` are ready for them |

---

## Carried over, not done

These are real and none of them block step 2.

**Data**

- ~~Inheritance is not resolved in the extractor~~. **Done.** The extractor runs the game's
  own `ProcessDataInheritance` and writes `traits-resolved.json`. 49 traits state a `Slot`,
  122 carry one afterwards
- ~~The validator's own `InheritFrom` walk is a redundant second implementation and should
  read the resolved file instead~~. **Checked, and it is not redundant.** Two separate
  reasons, both pinned by `scripts/validate/inheritance.test.ts`:
  - **Resolution is lossy for provenance.** A duo inherits `IsDuoBoon` from `SynergyTrait`;
    a Hex duo states it on its own record. After resolution both carry the same flag and
    nothing says where it came from, so reading it reports **46 duos and 0 Hex duos**
    instead of 37 and 9. `InheritFrom` is byte-identical in both files, so there is no
    shortcut hiding in there either
  - **There is no `loot-resolved.json`.** For `GodLoot` the swap has no file to read.
    Dropping that walk gives **7 Olympians instead of 9**, losing Poseidon and Zeus, which
    is `CLAUDE.md` error 3 exactly
  One belief did not survive the test: the walk does **not** need to be transitive. Every
  marker sits at depth 1, so the recursion is insurance rather than load bearing
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

**Step 11, and the thing it turned up**

The offer block ranks what a god can still give you and puts one sentence on each card:
what it does in the game's words, what it means for this run in ours, and what taking it
would close. That last is the reject verdict, and it is the half a rating cannot answer.

Then it showed nine Poseidon cards all saying **"36 targets close"** and all saying
**"spends one of your four Olympian slots"**, because Poseidon was the fourth god and both
are true of every boon he has. Correct, useless, and it buried the one card that was
actually different.

**An offer block exists to differentiate, so anything true of every card belongs above
them, not on them.** `engine/offer.ts differentiate` lifts both the shared cost and the
shared sentences into one note about the god, and each card keeps only what it alone
carries. A card left with nothing falls back to silence, which is honest, rather than to a
repeat, which is not. A rule can supply `sayAll` for how it reads once hoisted, because
`say` is written for one card and "taking this" refers to nothing above nine of them.

`DESIGN.md` 8's **"unrated sorts last"** also needed correcting, and the correction is in
`rating.ts`. It was written when every delta was a bonus and it holds perfectly there; with
a penalty in the pack it put a boon we know shuts a slot *above* one we know nothing about.
What that rule protects is in its own sentence, "survives every filter floor", and nothing
here is dropped or hidden: unrated scores zero, sits among the zeroes, and loses the tie.

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

**The boon text, and the one gap left in it**

73 of the 567 descriptions the app renders were wrong, and they were wrong in ways a reader
sees immediately: "you receive, health, and now", "While you have at least, you can never
deal less damage", "spill, which can restore Magick". Three separate causes, all fixed by
reading the game's own tables rather than by writing words:

- **`{!Icons.X}` is a noun.** It renders as a glyph in game, so dropping it deletes the
  noun. `HelpText` names them on the same id `{$Keywords.X}` already uses:
  `MetaCurrencyIcon` is `"{!Icons.MetaCurrency} Bones"`, the glyph plus the word
- **`{$TraitData.a.b.c}` is a literal path** into `traits-resolved.json`, one-based where
  it indexes a list. 37 of the 38 in the trait text resolve, and the catch-all had been
  deleting all of them
- **`NoTooltip` and `Alt` are decorations on an id**, not different things, so
  `GodBoonPluralNoTooltip` is `GodBoonPlural`. Eleven descriptions were printing the raw
  identifier at the reader

Two traps in it worth keeping. `HelpText`'s `DisplayName` is a **tooltip title** rather than
an inline noun for a few: `Omega` is "Ω Moves", and reading it off the glossary turned "your
{omega} Cast" into "your **Moves** Cast" where the game says **Ω Cast**. And `Total` is not
a strippable decoration: `ArmorTotal` is not `Armor`, and stripping it turned "+1 armour"
into "+1". The hand table wins and the glossary fills in behind it.

**The numbers are in too.** `scripts/values.ts` is `TraitLogic.ExtractValues` and
`FormatExtractedValue` followed to the letter, for the part of them that is static:
`{$TooltipData.ExtractData.StrikeChance}` walks the trait's `ExtractValues` to a `Key`, to
whichever subtable reports it, to the number. **`ReportValues` is hoisted from any depth**,
which is what took two attempts: a pass that looked only at
`<name>Function.FunctionArgs.ReportValues` resolved 34 of 384, and walking properly resolves
241. 20 tests, and the game's own comments on its formats are the assertions: "eg 0.5
becomes 50", "eg 1.3 becomes 30". One of those comments disagrees with its own code, which
returns +30; the minus lives in the sentence rather than in the number.

**252 of 567 descriptions changed and `#` went from 422 to 213.** Zero holes left, zero raw
identifiers, zero names shipping markup.

**These are base values**, and the surface should say so eventually. Several formats
multiply by something the run carries, `LuckModifiedPercent` by the hero's Luck and
`FlatHeal` by the healing multiplier, and every one of those is 1 on a fresh hero. The game
shows a larger number once a run has boons in it.

**External values are read too, and one of them turned out not to exist.** An `External`
entry names another table. `EffectData` was already loaded by the extractor and simply never
emitted; `WeaponData` was added; `hero.json` was already there. 168 of the 236 External
entries resolve now, and the seven descriptions it fixed are **every one of Selene's Hexes**,
which all read "for # Sec." before.

**`ProjectileBase` is not answerable from the Lua, and that is settled.** It is 50 of the
236 and asks for `Damage`, `Fuse` and `TotalFuse`. `ProjectileData` and its hero files were
loaded to find them, gave 134 entries, and **not one declares any of the three**:
`ProjectileData_Gods.lua` carries overrides and mostly colours, and
`GetBaseDataValue({ Type = "Projectile" })` is an engine call reading the binary data beside
the Scripts folder. The files were dropped again rather than left loading for nothing, and
the reason is in `scripts/values.ts` so nobody goes looking twice.

**What is left is `#` because it depends on a run**: `SlottedBoon` wants what is in a slot
right now, `ResourceAmount` a count, `MultiplyByBase` a projectile's damage. **422 down to
193.**

**A mis-tap no longer costs a run**

`DESIGN.md` 8 asks for "the entry point for correcting a mistake" and there was not one. Log
the wrong boon at Exit 3 and every verdict after it is wrong, with nothing to do about it
but start over. Every logged station carries "This did not happen" now.

Removing an entry cannot splice the list. What is held, which gods are spent, how many
Exits remain and **what each pick closed** are consequences of the whole history, so
`replay` rebuilds the run from empty and recomputes all of it. Verified in the browser:
taking back the second of four Olympians moved the tally from **11 open, 36 closed** to
**47 open**. Every one of those 36 came back, which a splice would never have managed.

The verdict trail is **cleared** rather than repaired, because every snapshot in it was
taken against a history that no longer happened. The next briefing shows what is held and
what is pinned with no diff, which is the truth.

**Engine**

- ~~A filled slot is not a proof of impossible~~. Handled: `obtainability` returns `swap`
  as its own route, and only a set with nothing but swaps left in it is called a long shot
- ~~How the app gets its data~~. `npm run data` projects `data/generated` through
  `src/data/load.ts` into `data/app/app-data.json`, 78 KB and 15 gzipped, imported rather
  than fetched. One mapping, shared by the app, the tests and the validator
- ~~`publicDir` is `assets/`, so the whole shelf ships~~. **Written.** `npm run prune` runs
  after `vite build` and keeps only what the bundle names: **55 MB and 940 files down to 10
  MB and 518**. It also drops `manifest.json`, which was shipping 933 records of build
  metadata the app never reads.
  The interesting part is the guard. Everything the app draws is a literal string by the
  time Vite is done, except a path built from a template literal, and a scanner will
  happily delete every file one of those resolves to. So it also looks for
  `/<category>/${...}` in the built output and **fails the build on any it has not been
  told about**. There is one today, `/rarity/${rarity}.png`, declared with its reason.
  Verified by removing the declaration and watching it refuse
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
| `archive/` | Documents that did their job. `LESSONS.md` is the seed `CLAUDE.md` grew out of, and is superseded by it |
| `assets/README.md` | The image library and its gaps |
| `decisions/` | Decision records, dated. Applied to the documents above, kept for the reasoning |
| `project/` | Configuration for the companion Claude.ai project, not for the product |
