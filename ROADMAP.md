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
| **Build order step** | 7 of 11 complete, step 8 next, which is the first shippable point |
| **Shippable at** | Step 8, the timeline shell. Useful to a player with no rating engine at all |
| **Stack** | Vite 8, React 19, TypeScript 7, Vitest 4. Scaffolded and building |

The app runs. Setup produces a real run, the rail shows what you hold, and logging a Cast
boon removes every other god's Cast boon from the picker, which is the lockout working in
the product rather than in a test. The timeline is next and is the first shippable point.

The hand-authored page is still `placeholder/index.html` and still what Netlify serves.

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
| 8 | **The timeline shell.** First shippable point | Next |
| 9 | Verdict snapshotting, `engine/briefing.ts`, re-entry header | |
| 10 | `engine/rules.ts`, one rule, then `scripts/health.ts` | |
| 11 | The offer block inside the present entry | |

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

**Engine**

- ~~A filled slot is not a proof of impossible~~. Handled: `obtainability` returns `swap`
  as its own route, and only a set with nothing but swaps left in it is called a long shot
- ~~How the app gets its data~~. `npm run data` projects `data/generated` through
  `src/data/load.ts` into `data/app/app-data.json`, 78 KB and 15 gzipped, imported rather
  than fetched. One mapping, shared by the app, the tests and the validator
- **`publicDir` is `assets/`,** so a manifest path is also a URL. 35 MB ships, 23 of which
  is Arcana card art Phase 1 never renders. Downscale it before a real deploy
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
