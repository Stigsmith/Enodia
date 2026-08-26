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
| **Build order step** | 1 of 11 complete, step 2 next |
| **Shippable at** | Step 8, the timeline shell. Useful to a player with no rating engine at all |
| **Stack** | Vite, React, TypeScript, Vitest. Not yet scaffolded |

Nothing is implemented beyond the data layer. `dist/index.html` is a hand-authored
placeholder, live on Netlify.

---

## Phase 1 build order

The sequence is fixed in `DESIGN.md` 10. Status only here.

| Step | What | State |
|---:|---|---|
| 1 | Extractor, Lua to `data/generated` | **Done.** 57 files, zero failures. Text and stacking curves included |
| 2 | Validator wired into prebuild | Next |
| 3 | Asset join, every trait has an icon or a recorded gap | |
| 4 | `engine/slots.ts` and the type layer | |
| 5 | `engine/reachability.ts` | |
| 6 | `engine/runsim.ts` | |
| 7 | Setup screen, and the rail | |
| 8 | **The timeline shell.** First shippable point | |
| 9 | Verdict snapshotting, `engine/briefing.ts`, re-entry header | |
| 10 | `engine/rules.ts`, one rule, then `scripts/health.ts` | |
| 11 | The offer block inside the present entry | |

Later phases are scoped in `REQUIREMENTS.md` 7: **2** before the run, **3** memory,
**4** automation and community.

---

## Blocked, and on whom

| What | On | Note |
|---|---|---|
| Scaffolding the app | Nothing | Stack is decided. Step 2 can start |
| Netlify redeploy | The owner | The live page is several revisions behind |
| `feeds` tag | The owner | `DESIGN.md` 12 item 8. Largest hand-authoring job in the project, and the briefing's advice line needs it |
| Archetype `core` / `compatible` / `avoid` lists | The owner | `DESIGN.md` 4.1.4. Not derivable from any file |

---

## Carried over, not done

These are real and none of them block step 2.

**Data**

- Inheritance is not resolved in the extractor. Only 49 of 651 traits carry `Slot`
  directly, the rest inherit it. The game's own `ProcessDataInheritance` at
  `RunData.lua:1363` should do it
- `traits.json` is eight entity types in one file. The game tags every one via
  `InheritFrom`, so splitting is mechanical
- 84 of 651 traits have no display name. Believed to be base templates, unverified
- The extractor finds **33 duos**. Wikis claim 29 and 37. A validator question

**Assets**

- 144 of 579 trait icons unmatched, mostly `Hammer_` and `Shop_`. The wiki already
  covers the hammers
- Aspect numbering in `assets/aspects/` unverified. The extractor can now resolve it
- Missing: familiars, status effect icons, Tartarus region art
- `dist/index.html` inlines its own token copy. `src/ui/tokens.css` is the source

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
