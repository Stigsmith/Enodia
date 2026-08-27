# Enodia

An in-run build companion for **Hades II**. Not a build planner and not a wiki: it answers
the question you have while standing at an Exit with fifteen seconds to decide.

Nothing is implemented yet beyond the data layer and its validator. `placeholder/index.html`
is the hand-authored page that stands in for the app.

**Start with [`ROADMAP.md`](ROADMAP.md)** for where the build is, then
[`CLAUDE.md`](CLAUDE.md) for the rules that matter most.

---

## The rule that matters most

The game ships its logic as **679,152 lines of plain-text Lua** in the Steam install. That is
the first source, not the last resort. Wikis, guides and search results are leads to verify,
never sources to cite. `CLAUDE.md` has the full version, including the errors that rule
exists to prevent.

---

## Layout

```
CLAUDE.md          rules, verified mechanics, house style. loaded every session
ROADMAP.md         the single status view. what is done, next, blocked
REQUIREMENTS.md    why it exists, what it is, scope by phase
DESIGN.md          architecture, the engines, the build order
VISUAL.md          the visual language, every colour sourced from the game
LESSONS.md         engineering discipline carried from the previous tool

decisions/         dated decision records. applied to the docs, kept for the reasoning
project/           config for the companion Claude.ai project, not for the product

scripts/extract.mjs   runs the game's Lua, writes data/generated
scripts/validate.ts   the validator, wired into prebuild. rules live in scripts/validate/
data/generated/       extracted game data. never hand edited, checksummed
data/curated/         hand-authored judgement, joined on id. see its README
data/baseline.json    the structural counts the validator holds the extractor to
src/                  the app. tokens.css is the source for every colour
assets/               643 images and their manifest, see assets/README.md
placeholder/          the hand-authored page, live on Netlify until the app ships
dist/                 build output. Vite owns it, git ignores it
```

Three folders are deliberately absent from version control: `extracted/` is 443 MB of
`deppth2` output, `reference/` is mascot art pulled from it, and both are regenerable.

---

## Commands

```bash
npm run dev        # vite, port 5173
npm run build      # validates first, then builds. a broken reference stops it
npm run validate   # the validator on its own
npm test           # vitest
npm run extract    # re-read the game's Lua into data/generated
npm run assets     # rebuild assets/manifest.json. --fill copies icons from extracted/
npm run typecheck
```

`npm run extract` loads the game's Lua in a
[wasmoon](https://www.npmjs.com/package/wasmoon) state and writes `data/generated/*.json`.
Needs Hades II installed. Re-run it after a game patch, then read the validator's count
diff as a patch note before accepting it with
`npm run validate -- --update-baseline`.

The old page is served by the `placeholder` config in `.claude/launch.json`, on port 8777.

---

## Licence and standing

Unofficial fan project. Not affiliated with, endorsed by, or connected to Supergiant Games.
Hades II and all game artwork are the property of Supergiant Games. Non-commercial and
always free.
