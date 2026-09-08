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
archive/           documents that did their job. Nothing current reads them

decisions/         dated decision records. applied to the docs, kept for the reasoning
project/           config for the companion Claude.ai project, not for the product

scripts/extract.mjs   runs the game's Lua, writes data/generated
scripts/validate.ts   the validator, wired into prebuild. rules live in scripts/validate/
data/generated/       extracted game data. never hand edited, checksummed
data/curated/         hand-authored judgement, joined on id. see its README
data/baseline.json    the structural counts the validator holds the extractor to
src/                  the app. tokens.css is the source for every colour
assets/               643 images and their manifest, see assets/README.md
placeholder/          the hand-authored page, live on Netlify until the deploy moves
dist/                 build output. Vite owns it, git ignores it

wrangler.jsonc        how the site is served. Cloudflare Workers, and the API route
assets/_headers       cache tiers and security headers, copied into dist/ by Vite
worker/               Phase 4. The API under /api/*, accounts and nothing else
migrations/           D1 schema, generated from worker/schema.ts, never hand written
```

Three folders are deliberately absent from version control: `extracted/` is 443 MB of
`deppth2` output, `reference/` is mascot art pulled from it, and both are regenerable.

---

## Commands

```bash
npm run dev        # vite, port 5173
npm run build      # validates first, then builds. a broken reference stops it
npm run validate   # the validator on its own
npm test           # vitest, both projects: 420 in node, 25 inside workerd
npm run test:worker # just the backend, against a real local D1
npm run extract    # re-read the game's Lua into data/generated
npm run assets     # rebuild assets/manifest.json. --fill copies icons from extracted/
npm run typecheck
npm run fonts      # re-vendor the four typefaces. Not a build step, run by hand
npm run deploy     # build, then wrangler deploy to Cloudflare

npm run types        # regenerate worker Env types after editing wrangler.jsonc
npm run db:schema    # better-auth options -> worker/schema.ts
npm run db:generate  # worker/schema.ts -> a numbered migration in migrations/
npm run db:migrate   # apply migrations to the local D1
```

`npm run extract` loads the game's Lua in a
[wasmoon](https://www.npmjs.com/package/wasmoon) state and writes `data/generated/*.json`.
Needs Hades II installed. Re-run it after a game patch, then read the validator's count
diff as a patch note before accepting it with
`npm run validate -- --update-baseline`.

The old page is served by the `placeholder` config in `.claude/launch.json`, on port 8777.
The `workers` config runs `wrangler dev` on 8787, which is the only way to see the real cache
headers, the CSP and the SPA fallback before a deploy. A green build proves none of them.

`npm run fonts` vendors all 38 faces of Caesar Dressing, Inconsolata, Lato and Spectral SC
into `assets/fonts/`, taking every subset Google returns rather than hand-picking `latin`.
The page loads nothing from a third party, which is what lets the CSP say `default-src
'self'` and mean it.

## Accounts and publishing

`worker/` is the API, on the same origin under `/api/*`, with accounts in D1 and
[Better Auth](https://www.better-auth.com/). **The tool works entirely signed out** and an
account is only needed to share or compete, so almost no visit touches any of it.

**An account buys exactly one thing: a short link.** `linkFor` packs a whole build into a URL
fragment, which is why sharing needs no server and always will not. It is also **1,588
characters**, which Discord renders as a wall. Publishing stores the same payload under a
random ten-character id, so the link becomes `enodia.me/b/aB3xK9pQmR`, about thirty.

A published build has a random ten-character id, so nothing about the link is guessable. It
is **listed** now, though: the exchange has an All shelf and the leaderboards name authors,
both of which a signed-out stranger can read. `REQUIREMENTS.md` 5 wanted moderation designed
before anything discoverable existed, and section 4 there records why that was reopened.

**Friends is a code, not a search.** You cannot look anybody up: a display name is not
unique so it cannot address anybody, and searching by email would let a stranger test whether
any given address has an account here. You hand somebody an eight character code, they redeem
it, and both directions are written at once. There are no handles to claim and therefore no
handles to moderate.

**Friends is still not discovery.** A friend sees what you published; there is no way to
search for a person, so nobody can be found who did not want to be, and the moderation tool
for it is removing somebody.

**What is discoverable is the exchange's All shelf and the leaderboards**, both public. They
ship with no report button and no hide button, which is the owner's call and worth stating
rather than glossing. The argument for it is narrow: a listing carries a build name and an
author's display name and no other text a stranger wrote, so there is nothing on either
surface to moderate. The one removal lever is the author taking their own listing down.
Adding a hide would be a nullable column on `published_build` and one clause in
`worker/boards.ts`, because every board and every shelf reads through one file each.

There **was** a curated shelf, hand-picked with a note on each build, and it was the default
and the only thing a stranger could see. It was retired the same day All opened: a shelf
somebody had read every item of answers "what is safe to land on", and All answers it by
being browsable instead. One person reading everything does not scale past one person.

Publishing is a copy, not a move. The build in the browser stays the record and stays what
the export writes. `ACCOUNTS_LIVE` in `src/state/account.ts` hides all of it until password
reset works.

`wrangler dev` runs the whole thing, D1 included, against a local SQLite file under
`.wrangler/`. No Cloudflare account is needed to develop or test it. A real deploy needs
three things the owner does once:

```bash
wrangler login
wrangler d1 create enodia          # paste the id into wrangler.jsonc
wrangler secret put BETTER_AUTH_SECRET
```

Locally the secret lives in `.dev.vars`, which is gitignored, along with the optional
`RESEND_API_KEY` and `MAIL_FROM`. Without those two, `worker/auth.ts` does not offer password
reset at all rather than silently sending nothing, and `/api/capabilities` says so, so the UI
can grey it out and explain.

**Changing `database_id` in `wrangler.jsonc` orphans the local database.** It is keyed by that
id, so `wrangler dev` quietly starts on an empty one and the only symptom is a 500 on any
request with a session cookie. Re-run `npm run db:migrate` after any change to it.

**Rate limiting is stated in `worker/auth.ts`, not defaulted**, because better-auth's default
is `enabled: isProduction` and Workers sets no `NODE_ENV`, so it would never have switched
itself on. 60 requests a minute overall, 20 sign-in attempts per five minutes, 10 sign-ups an
hour, keyed on `cf-connecting-ip`. A Cloudflare rate limiting rule at the edge would be
better still, since it rejects before a Worker runs, and is the owner's to add.

**`worker/schema.ts` is generated, not written.** Use `npm run db:schema`, which runs
`npx auth@latest`. Do not use the deprecated `@better-auth/cli`: it is pinned several minors
behind and emits an `account` table with no `issuer` column, which is `NOT NULL`, so nothing
complains until the first sign-up fails.

---

## Licence and standing

Unofficial fan project. Not affiliated with, endorsed by, or connected to Supergiant Games.
Hades II and all game artwork are the property of Supergiant Games. Non-commercial and
always free.
