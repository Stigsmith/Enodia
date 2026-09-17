# Enodia: Requirements

Draft 1, 22 August 2026. Companion documents: `assets/README.md` for the image library,
`archive/LESSONS.md` for the seed this grew out of, kept for the record and not current. Formerly the engineering discipline carried over from
the owner's previous loadout tool, referred to throughout as D.D.S.

---

## 1. Context

A Hades 2 player asked for something like an existing loadout tool built for another
game. The two look similar from a distance and are structurally opposite, and that
difference is the whole product.

**In a loadout game you pick everything up front.** A fixed catalogue, a set number of
slots, every choice free and made before the run starts. The question is "which of these
items should I bring". That is a browsing problem, and it is what almost every build tool
is built for.

**In Hades 2 you do not choose your build up front.** You are offered three boons at an Exit
and have to take one, holding whatever you already have, with no idea what the next Exit
offers. The question is never "how good is Lightning Strike". It is "I am running Sister
Blades, I hold Storm Ring and two Hera boons, I am offered these three, which do I take".

The originating complaints, in the player's own words:

- Builds you played and liked are not remembered anywhere, so players default to one
  weapon and one playstyle forever.
- Whole gods go unused across hundreds of runs. Hera, Hephaestus, Hestia, Ares and
  Poseidon sit untouched while Apollo and Hades get picked every time.
- Most weapon aspects are never touched because the player does not know a build that
  makes them work.
- Runs are lost to invisible lockouts. "I kept trying for that Zeus legendary. Turns out
  I needed the boon on my Cast, and I never picked it."

That last one is the product in one sentence.

---

## 2. What already exists, and where it stops

Researched 22 August 2026. The build-planner space is crowded. The in-run space is empty.

| Tool | What it does | Where it stops |
|---|---|---|
| [Mobalytics](https://mobalytics.gg/hades-2/planner/builds) | Full planner: aspects, arcana, a starting keepsake and three more, familiar, hex, boons bucketed by pool, hammers, NPC offerings, poms. Community builds with a staff-granted Verified tier, creator program, tier lists, a small wiki. Actively maintained | A publishing platform. ~~Rich-text boxes with no guidance on *how* to make a build.~~ Six prose sections per build, each prompted, with game data tagged inline (checked 11 September 2026). Nothing conditional, nothing live. `decisions/2026-09-11-competitor-gap-analysis.md` |
| [BrokenBuilds](https://brokenbuilds.gg/hades-ii) | Boon Synergy Explorer, DPS Calculator, Arcana Grid Planner. Builds tagged by Fear level and tier | All three tools are pre-run and static. Tells you what the ceiling outputs, never how to reach it. Wall of text, numbers, filters and sliders, almost no game imagery |
| [hades2builder](https://hades2builder.vercel.app/) | Visual build creator using real game art. The best-looking of the three | **"Updated as of Early Access Patch 4."** Missing Ares, Artemis, Athena, Dionysus, Selene and Hades entirely. Its author asks visitors to send him image files |
| [orlp duo chart](https://orlp.github.io/hades-boons/duo_boons.html), [JustinLove/hades-boons](https://github.com/JustinLove/hades-boons) | Static prerequisite charts, data extracted from game files | Reference only. No run state, no reachability |
| [hadescompanion](https://hadescompanion.com/hades2/boons), Fandom, Fextralife | Reference databases | Lookup only |
| [game-checklists](https://game-checklists.com/trackers/hades2/), [HadesTracker](https://github.com/mikemerin/HadesTracker) | Completion checklists | Collection tracking, not build decisions |

### The most important competitor is the game itself

> **Corrected 23 August 2026.** Draft 1 claimed the in-game Codex could not track progress
> toward a chosen duo or legendary, citing a Steam feature request as evidence of the gap.
> **That was wrong.** The thread was stale, and the owner, who plays the game, confirms
> target tracking is in. An incantation unlocks the offering lists in the Book of Shadows,
> and the Codex shows prerequisites per god.
>
> This mattered, because target-level tracking was framed as the wedge. It is not. Anything
> on a roadmap that duplicates a shipped in-game feature reads as not knowing the game, and
> costs more credibility than the feature would ever have earned.

**The game answers "what does this duo need". It does not answer "what should I take right
now".** Those are different questions. The first is a lookup against one target. The second
weighs everything held, every build still open, and what each of three offers costs.

Three things follow, and none of them exist in game:

1. **It never tells you to stop.** Track a duo needing a Demeter Cast, commit the Cast to
   Apollo, and the game keeps showing those requirements for the rest of the run. It shows
   what you need. It never shows what you have already lost
2. **It has no model of a build.** It tracks a boon. A build is an aspect plus slot
   commitments plus one or two anchors plus a hammer plus arcana, and nothing in game holds
   that shape
3. **It forgets every run.** No history, no idea which gods you never touch, no suggestions

**The unit of this tool is the build, not the single boon.**

That is a rule about billing, not about exclusion. Single-target tracking still falls out of
the engine for free, because reachability computes state for every live target on every pick
and tracking one is a filter over that same output. It is worth shipping, since the
alternative is leaving the tool to open the Codex mid-run, which is the exact friction this
is meant to remove.

The rule is only this: **never lead with something the game already does.** Build it, use
it, do not put it on the roadmap as though it were new.

Market: roughly 5.2M Steam copies, about $93.5M gross, 96% positive across ~122k reviews.

### Three lessons taken from the competition

1. **Stale data is how these tools die.** hades2builder is visibly dead at Early Access
   Patch 4 while the game sits on Post-Launch Patch 2 Hotfix 5. Patch stamping is a
   day-one requirement, not polish.
2. **Imagery is the differentiator nobody but hades2builder attempted.** BrokenBuilds is
   information-dense and unreadable at a glance. A four-second Exit decision cannot be a
   table.
3. **Nobody owns the conditional question.** That is the wedge.

---

## 3. Product thesis

> A tool that answers the absolute question is a wiki with opinions.
> The conditional one is the product.

Three moments, and the tool must serve all three. Build the second one first.

| When | Question | Engine |
|---|---|---|
| Before the run | Which weapon, aspect, arcana, keepsake, at this Fear | Static. Easiest |
| **At an Exit, mid run** | **Which of these three, given what I hold** | **Conditional rating. Four seconds to answer or it is useless** |
| Mid run, planning | Is the duo I want still reachable, what am I missing | Reachability |

### Positioning

Not a build planner. A **run copilot with a memory**. The copilot answers the Exit
question. The memory turns finished runs into build cards and personal gap analysis. The
memory is the retention loop and the part no competitor can copy, because it is the
user's own data.

---

## 4. Non-goals

- ~~**Not a wiki.** Reference data exists to feed the engines, not to be browsed for its own sake.~~
  **Reversed on 11 September 2026, the owner's call.** There is a wiki: every named thing the tool
  knows has a record at `/wiki/<kind>/<id>`, and an index lists them all. What stands of the old
  line is the reason behind it: nothing in the wiki is written by hand, so there is no
  encyclopedia to keep up. It is generated from the game's files like everything else and read
  again after a patch. `decisions/2026-09-11-competitor-gap-analysis.md` 7
- **Not a DPS simulator.** See section 8.
- **No stated probabilities in v1.** See section 6.2.
- **No accounts, server or social features before Phase 4.** ~~Held through Phases 1 to 3.~~
  Phase 4 has now started: accounts exist in `worker/`, on a Worker and D1 at the same
  origin. ~~The social half of this non-goal still stands, and deliberately. Friends and
  leaderboards need the moderation section 5 asks for.~~ **Retired on 8 September 2026.**
  Friends shipped first and is not discovery: a code you hand over by hand, no search, and
  the moderation tool is removing somebody. Then the exchange's All shelf and the
  leaderboards shipped, and both are discoverable and public, with **no report and no hide**.
  That is a deliberate reversal rather than a drift, and the reasoning is below
- **Not a competitor to Mobalytics on published build guides.** We will lose that fight.

---

## 5. Decisions already taken

| Decision | Choice | Reasoning |
|---|---|---|
| Platform | Web app, mobile-first, static host, `localStorage` | Playable second screen. Works for Steam Deck and console players, whom no PC-only tool reaches |
| Certainty model | Feasibility states plus coarse bands | Section 6.2 |
| Community | Local-first, URL sharing. Accounts deferred to Phase 4 | Most of the engineering budget. ~~Needs moderation from day one~~, see the note below, and the one after it for guides |
| Auto-tracking | Deferred to Phase 4, manual entry always supported | PC-only, and the manual path must exist anyway |
| Build library size | 30 to 40 generated archetypes, not 150 to 500 hand-authored | Section 7, Phase 2 |
| Audience | Public | Sets the confidence register everywhere. Opinions must carry a visible byline or a source |

### Discoverability, and shipping it without moderation

The original rule was that nothing discoverable exists until there is a way to report a
listing and a way to hide one. It held for a year and then was reversed, on 8 September
2026, by the owner. Recorded here rather than quietly dropped.

**What forced the question** was not the leaderboards. The exchange had a hand-picked shelf
and From friends, and neither can contain your own builds: the first showed only what the
owner had picked, and `fromFriends` excludes you by construction. So an account's own
listings appeared on no shelf, and the owner published nine builds and could see one.
Opening the everything shelf and adding a Mine shelf are the same fix from two sides.

**The curated shelf was retired the same day**, on the owner's call: once there is a way to
browse, a shelf somebody has read every item of is a second answer to a question that
already has one, and one person reading everything does not scale past one person.

**What makes it defensible at this size**, stated so it can be checked later rather than
assumed:

- A listing carries a build's name and its author's display name. There is no free text a
  stranger wrote on either the shelf or the boards: no comments, no descriptions from
  anybody but the author, no avatars, no handles to claim.
- The one removal lever is the author taking their own listing down, which takes it off
  every shelf and every board at once.
- Adding a hide is a nullable column on `published_build` and one clause in each of
  `worker/boards.ts` and `worker/exchange.ts`. It is a smaller change than the year of
  deferral made it sound.

**What would change the answer**: any free text a third party can write onto something
somebody else sees, a display name shown to people who did not choose to see it beyond the
boards, or enough accounts that the owner cannot read everything published in an evening.

### Guides, which are that free text, ship with a report and a hide

**The first of those three arrived on 17 September 2026**, and the answer changed with it,
as the paragraph above said it would. A guide is sections of a stranger's writing, listed on
everybody's side. The owner was asked whether guides should be listed with a way to report
and hide one, listed without, or unlisted, and chose **listed, with both, in the same
change**, while a hide is still one column and one clause. Recorded here as a reversal of the
8 September position for guides only: builds still ship without either, for the reasons
above, which still hold for them.

What shipped, in `worker/guides.ts`:

- **A report is one row per person per guide**, with a bounded reason. Nothing returns it and
  nothing acts on it automatically, because a count of reports is something a group can
  manufacture. An author cannot report their own guide: taking it down is that lever.
- **A hide is a column no route writes.** A moderator reads the reports and sets `hidden_at`
  with a statement against the database; the statements are in the file. There is no
  moderator route, so there is no moderator session to find or forge. A hidden guide leaves
  every list and its link answers only its author, who sees it marked hidden.
- **A report has its own low rate limit** on the account, ten an hour, so it cannot be spent
  from the budget ordinary use needs, nor spend it.

**What would change this answer**: enough reports that reading them by hand is not an evening's
work, which is when a moderator screen earns its surface.

### Dead positions, recorded so they are not revived

- **"Show a percentage chance of completing a build."** Killed 22 August 2026. The
  community has not solved the offer and rarity formulas, and the wikis say so outright.
  Any number would be invented, and false precision destroys trust the first time it is
  visibly wrong. Replaced by feasibility states.
- **"Ship a library of 150 to 500 curated builds."** Killed 22 August 2026. That is a
  content treadmill against a game that patches often, and it competes directly with
  Mobalytics' creator program. Replaced by generated archetypes plus promotion from
  logged runs.

---

## 6. The engines

Both are pure modules. No React import, no `localStorage`, no network. That property is
what lets a script import the real shipped code and measure it, and every good decision in
D.D.S. came out of a measurement.

### 6.1 Reachability

```
reachable(held, godsSeen, exitsLeft, weapon, aspect) -> [{ target, state, needs, why }]
```

Duos require specific prerequisite boons from both gods. Legendaries require several from
one god. Both are therefore computable in advance over static data. Four states:

| State | Meaning |
|---|---|
| `ON_TRACK` | Every prerequisite held |
| `REACHABLE` | Required slots open, gods still in pool, Exits remain |
| `AT_RISK` | Needs a slot about to be committed, or a god not yet seen with few Exits left |
| `DEAD` | Provably impossible. A required god is out of the pool, or a prerequisite slot is already occupied |

**`DEAD` is the state players most need and least expect.** A tool that lists what is
possible without saying what just became impossible gives you half the information at the
moment it matters. This is the feature people will tell their friends about, and it is
exactly the "I needed it on my Cast" failure.

### 6.2 Confidence, expressed honestly

No percentages. On top of the four states, a coarse band derived only from countable
facts: Exits remaining, gods not yet encountered, open slots, whether the required slot is
free.

```
Likely  |  Possible  |  Long shot
```

Defensible because it is arithmetic over known quantities, not a claimed RNG model. Monte
Carlo simulation over the room graph may produce real numbers in a later phase, and if it
does they ship clearly labelled as estimates.

### 6.3 Conditional rating

Rules are JSON data, not code. Each carries a `when` about the context, a `match` about the
subject, a delta in points, and a mandatory `say`, because a score that cannot explain
itself is a score nobody should trust.

```
when:  { "reachable": ["hera-zeus-duo"] }
match: { "prerequisiteFor": ["hera-zeus-duo"] }
say:   "This is the last piece of a duo still on the table."
```

That rule is the reachability engine feeding the rating engine. **That coupling is the
product.**

Everything is points. No floors, no ceilings. A floor flattens every item sharing a tag
into one tier and destroys the ordering the tag sits on.

### 6.4 Measurement discipline, not optional

Write the health check script before the second rule, not after the tenth. It reports, per
rule, the share of its eligible pool it fires on and how often it moves a rating, and
flags anything at 60% or more.

**Hades 2 will hit the "rule describes the pool, not the item" failure harder than
D.D.S. did.** Most boons are damage boons, so a rule keyed on "is this offensive"
fires on most of the pool and says nothing. In D.D.S. five rules took a tier off 42 of 51
primaries before anyone noticed.

Measure against randomly generated legal boon sets, never against the builds that shipped
with the tool. That means simulating a run: draw Exits, respect god pools, respect slot
conflicts. The generator is needed for the tool anyway, so build it early.

---

## 7. Scope by phase

### Phase 1: The Exit

The reason someone opens the tool. Nothing else ships until this works. The Codex already
tells you what a single duo needs, so none of this is about a single duo.

- Run context: weapon, aspect, region, Exits remaining, `held`, `godsSeen`
- **Exit mode.** Enter the three boons offered. Get them ranked **against the whole build
  in progress**, each with one sentence saying why, in under four seconds of reading
- **The reject verdict.** Sometimes the answer is none of them. Taking a Pom, a Hammer or
  Shadow Broker currency over a boon from a god outside the build is often correct, because
  a god enters your run on pickup and then costs a permanent slot out of four, recurs
  through Devotion Encounters, and can occupy a core slot a target needed. No other tool
  says this, because none of them model the cost. `DESIGN.md` 4.1.3 and 4.1.5
- **What just died.** The moment a build closes, say so. Committing one slot can close a
  dozen builds at once, and nothing in game reports it. This is the signature feature
- **Every build still open.** All of them at once, sorted by proximity and by what each
  still needs. Filtering that list down to one target is a free view over the same
  computation, so it ships, it just is not what the screen is for
- **Resume briefing.** See below
- Lockout warnings, fired only when something actually just died
- Manual entry, large tap targets, no typing
- `localStorage` only, no network call at runtime

#### Resume briefing

You save mid-run, quit, come back a week later, and you are standing in front of a boss
with no idea what you were building. The state was never lost. Your memory of it was.

Storage already survives that gap, so this is not a persistence feature. It is a
**re-entry** feature, and what it has to rebuild is the player's model of their own run:

- **What you hold**, grouped by slot, not in pickup order
- **What the build centres on**, and therefore how to play it. "Most of your weight is on
  Cast. Nine of your twelve boons feed it. Open with Cast and keep it up"
- **What you were chasing**, and its state now. A pinned target may have died while you
  were away, and that is the single most important thing to say
- **Where you are.** Region, Exits left, what is next

Triggered whenever an active run is resumed after a meaningful gap, and available on
demand at any time. Cheap to build, because it is pure derivation over state that already
exists by Phase 1 step 8.

> The card mixes three confidence levels and must show that it does. What you hold is
> fact. What the build centres on is derived. How to play it is our advice. The rule
> against letting a judgement and a sourced fact sit together looking equally weighed
> applies inside this one card, not just across screens.

The playstyle sentence needs curated tags to be any good, so Phase 1 ships the factual
recap plus the re-run reachability, and Phase 2 adds the advice line once tags exist.

#### Under the hood, spoiler-tiered

Building this means reading the game's code, which turns up rules the game never states.
Publishing them is a feature, but publishing them carelessly takes something away, because
working a mechanic out yourself is part of what the game is for.

So they ship sorted by **how likely you were to find it on your own**, and nothing opens
unless the reader opens it:

| Level | Contains | Framing |
|---|---|---|
| 1 | Invisible during play. No number of runs surfaces it | Safe to read, you were never going to find it |
| 2 | Findable after many runs and some suspicion | You might get there eventually |
| 3 | You will work it out yourself, and it is better if you do | Opening it is explicitly cheating yourself |

Two rules, both load bearing:

- **Every entry cites the symbol it came from**, for example `RewardLogic.ChooseLoot`. That
  makes it auditable, it proves the claim is read rather than guessed, and it is the same
  discipline the working agreement demands
- **Level 3 is worded as a real warning**, not a tease. The point is to let people opt out
  of spoiling their own discovery, so the control that opens it says so

This doubles as the honest version of a wiki. Existing sites publish everything flat, at
the same volume, with no view on whether you wanted to know it yet.

> **11 September 2026.** This shipped on the pre-app page, `placeholder/index.html`, and left
> with it in `de818c7`. No screen carries it now, and nothing recorded that it had gone. The
> five entries are recoverable with `git show de818c7^:placeholder/index.html`, and one of them
> needs rewriting before it returns: it says every other Olympian becomes impossible at the
> fourth, which is `CLAUDE.md` error 6.
>
> **12 September 2026. Built, as a screen of the app.** `src/data/underhood.ts` behind
> `Pages.tsx`, in the menu beside the Wiki. Seven entries across the three tiers, each citing
> its symbols, the two that are judgement marked as ours, and the error 6 entry rewritten
> around `RewardLogic.lua:242`. Both rules above are held by `src/data/underhood.test.ts`,
> which also fails if the old sentence returns.

### Phase 2: Before the run

- 30 to 40 archetypes, each anchored on one or two duo or legendary boons, generated from
  the data model as aspect x core god x win condition
- Arcana loadout against the 5x5 grid and the Grasp budget, surfacing active Awakenings.
  **Rated conditionally, not statically.** The Huntress reads as a niche card and is not:
  `LowManaThreshold = 0.99`, so it is live whenever Magick is below 99%, which is nearly
  always. It goes dark only in a build whose regen pins you at full, which is a property of
  the build and not of the card. Static Arcana ratings are wrong for the same reason static
  boon ratings are
- **Keepsake sequencing.** A build implies four keepsakes, not one: one at the start and one
  at the rack after each of the first three bosses. ~~No competitor does this~~: Mobalytics'
  planner has held a starting keepsake and three more since at least September 2026. Keyed by
  position rather than by Region name, because a Dream run visits Regions out of order
  (`DreamRunLogic.lua`). A build can hold all four since 11 September 2026
  (`ShownBuild.swaps`). Recommending an order is still to do
- Hammer recommendations per aspect
- Fear and vow model. Fear is a vector, not a scalar. Keep the vow list, derive the total
  for display

### Phase 3: Memory

- Post-run journal: what you held, what you cleared, at what Fear, how it felt
- Auto-generated build card from a finished run
- **Screenshot import.** The victory screen shows the run's boons. Perceptual-hash the
  icon crops against the 523-image library and match. No ML required, no mod required, and
  it works for console and Deck players who photograph the screen. The asset library
  doubles as the matching corpus
Then the three layers that attack the default-playstyle problem the project started from.
They are one feature stacked, and they have to be built in this order.

**1. The tally.** Run counts per weapon, aspect, god, slot and archetype. This is data, not
opinion, and it is the substrate for everything above it.

Classifying a finished run into an archetype is a matching problem, not a lookup: given
what you held at the end, which archetype does this most resemble. That is the same join
that generates the build card, so it is written once and used twice. A run that matches
nothing is recorded as unclassified rather than forced into the nearest archetype.

**2. Gap analysis.** The read over the tally. Gods, aspects, slots and archetypes you never
touch, measured from your own runs rather than a checkbox you tick.

> **Minimum sample before it speaks.** With four runs logged, everything is under-used and
> the tool will say so with total confidence and no information. Below the threshold the
> gap analysis reports that it does not know yet. This is the "zero means not said" rule:
> a reader of an unset value must not fire.

**3. Surprise Me.** The action, and the thing the player actually asked for. Not a
constraint, a **complete runnable plan** drawn from the bottom of the tally: aspect, arcana,
keepsake sequence, and a target duo or legendary to chase, with one line on why this one.
"You have run Aspect of Nergal twice in ninety runs and never with Hera. Here is a build
that needs both."

The distinction from a plain randomiser is the whole point. A random constraint tells you
what you may not use. A plan tells you what to do, which is what gets someone to actually
play a weapon they have been avoiding for a hundred hours.

Difficulty must be selectable. A surprise build that is unplayable at the Fear the player
normally runs teaches them the tool has bad taste, and they will not press it twice.

### Phase 4: Automation and community

- Hell2Modding Lua mod writing run state to JSON, app watches the file. Removes manual
  entry entirely. The [Run Boon Overview mod](https://thunderstore.io/c/hades-ii/p/SMarBe/Run_Boon_Overview/)
  proves the hook exists
- Optional accounts, build sharing, voting, friends
- Effectiveness signal: max Fear cleared

---

## 8. Effectiveness, and why not DPS

The player asked for "how good is this build" and doubted it could be sourced. It can, and
not by simulating damage.

Hades 2 ships an objective difficulty metric: the Fear level from the Oath of the Unseen.
BrokenBuilds already tags builds "32 Fear" and "65 Fear". **"This build has cleared 50
Fear" is verifiable in a way a synthetic damage number never is.**

Effectiveness = max Fear cleared, plus community votes once Phase 4 exists, plus the
user's own logged results. A DPS calculator prices the ceiling of a build that has already
assembled itself, which is the question nobody is actually asking at an Exit.

> Check whether a credible Hades 2 tier consensus exists before designing a second-opinion
> column around one. D.D.S. rests on u.gg publishing per-faction community votes. If
> nothing equivalent exists here there is no left-hand column, and every opinion the tool
> holds must be labelled as ours. Do not manufacture a consensus by averaging YouTubers.
>
> **12 September 2026.** Still no consensus to point at, and the exchange now has the one
> thing that is not an opinion: **Cleared by somebody else**, a filter over the single list.
> It asks the count the worker already keeps, clears logged against the version on the shelf
> now, and an author's own runs never reach that number. Not a tier, not a badge, and never
> the word Verified: nobody grants it and nobody can be asked for it. The competitor's
> Verified tier is granted by staff on Discord, which is the shelf this project removed on
> 8 September under another name.

---

## 9. Data architecture

Rules carried over from D.D.S. that are cheap now and expensive later. All of section 9 is
day-one work.

- **Stable slug `id` and an `aliases` array on every record.** Never key on a display name.
  A rename orphans every saved run, favourite and unlock, and it fails silently
- **Curated and fetched data in separate files, joined on read by id.** A re-fetch must
  never overwrite a hand-made judgement
- **Provenance on every rating: a `source` of `curator` or `wiki`, plus a patch stamp.**
  The validator rejects anything else. The UI says "our call, not a vote"
- **A `knownGaps` array inside each data file.** Gaps recorded in chat are gaps nobody
  reads again
- **A validator wired into `prebuild`**
- **Rarity as a first-class axis on boons.** Decide now whether a rating is per boon or per
  boon and rarity, because retrofitting touches every record. The scaling shape is the
  interesting stat: a boon going 40 to 100 is a Pom target, one going 40 to 55 is not

### Files

`boons.json`, `duos.json`, `legendaries.json`, `arcana.json`, `weapons.json`,
`keepsakes.json`, `familiars.json`, `hexes.json`, `vows.json`.

### Run context

```json
{
  "weapon": "sister-blades",
  "aspect": "aspect-of-artemis",
  "arcana": ["..."],
  "vows": ["..."],
  "path": "underworld",
  "region": "oceanus",
  "exitsLeft": 14,
  "held": ["zeus-lightning-strike", "hera-nexus"],
  "godsSeen": ["zeus", "hera", "aphrodite"]
}
```

`held` and `godsSeen` are the two fields with no counterpart in D.D.S., and they are the
ones the conditional engine reads.

---

## 10. Interface requirements

The reading posture is the design constraint. **Mid run, four seconds, one hand, probably
a phone next to a keyboard.** Nothing from a desktop data table survives that.

- An Exit decision is three cards and three sentences. Never a table
- Game art on every card. This is the one thing hades2builder got right and the others did not
- Silence is the normal state. Nothing wrong means nothing said, never a panel reporting
  that everything is fine
- Every warning is conditioned. "You have no defensive boon" is boring. "No defensive boon,
  Fear 16, and Chronos is next" is worth reading
- Advisory means advisory. A warning removes nothing. If the answer is do not take this, it
  should not be on the card
- Empty states say what to do next
- Never let a judgement and a sourced fact sit together looking equally weighed
- Unrated is a first-class state: dashed placeholder, sorts last, survives every filter
  floor. Filtering out the unrated makes every new release invisible
- Colours through CSS custom properties. Ramps positional, not literal, so a class means
  the same thing when the theme flips. Per-god themes are a stretch goal, not a Phase 1 concern
- Spoiler gating, because Hades 2 unlocks gods and regions narratively

---

## 11. Assets

`assets/` holds 523 images in 14 categories, deduplicated by SHA-256, slug-named, with a
`manifest.json` and an idempotent rebuild script. The slug is the join key to the data
layer.

Blocking gaps: **Arcana cards (4 of ~25)**, **Selene Hexes (0 of 9)**, **rarity frames
(0 of 6)**, status effect icons, familiars, vow icons. Full table in `assets/README.md`.

Game art is copyright Supergiant Games. Unofficial, non-commercial, unaffiliated, with the
disclaimer visible. Do not ship the game's fonts, use lookalikes. If donations or ads are
ever added, this position needs revisiting.

---

## 12. To verify before writing any data

None of these can be derived from code, and getting them wrong costs a rewrite.
Four of six were settled on 22 August 2026 against the local Steam install. See
`DESIGN.md` section 0.

| # | Question | Status |
|---|---|---|
| 1 | The full roster at the current patch | **Settled.** Derivable by script from `LootData_*.lua` and `TraitData_*.lua` |
| 2 | Exactly how duo prerequisites are specified | **Settled.** `OneOf` and `OneFromEachSet`, a formal constraint structure. `DESIGN.md` 3.2 |
| 3 | Rating per boon, or per boon and rarity | **Settled: per boon and rarity.** `RarityLevels` appears 382 times in the trait data |
| 6 | Whether the game ships readable data files | **Settled: yes.** 479 plain-text Lua files in `Content/Scripts/` |
| 4 | Whether a credible tier consensus exists | Open. Until it does, every opinion is labelled as ours |
| 5 | Aspect numbering, `assets/aspects/staff-01..04` | Open, and the extractor resolves it |

The consequence of 2 and 6 is large enough to restate: **nothing the engines depend on is
transcribed by hand, and nothing factual is scraped from a wiki.** Facts come from the game
files, pictures come from the wiki. This removes the largest risk in section 13 and the
per-patch treadmill that killed hades2builder.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Data goes stale and the tool dies like hades2builder | **Largely retired.** A patch means re-running the extractor, not re-reading a wiki. Patch stamps on every record, visible "current as of" in the UI |
| Exit mode is too slow to use mid run | Four seconds is a hard requirement, tested on a phone, not an aspiration |
| Rules describe the pool rather than the boon | Health check before the second rule, measured against random legal runs. **The largest live risk** |
| Reachability is wrong because prerequisites were transcribed by hand | **Retired.** Prerequisites are extracted from `TraitData.lua` as the game states them. Validator on every reference |
| Extractor breaks on a patch that restructures the Lua | Golden file per patch. A diff is reviewed as a patch note, never auto-accepted |
| Four phases is a lot of scope | Phase 1 is independently useful and independently shippable. If nothing else ships, the Exit engine still solves the originating complaint |

---

## Working agreement

### The game source is the first source, not the last resort

`Content/Scripts/` in the Steam install is **679,152 lines of plain-text Lua**. Not
compiled, not packed, not encrypted. Every mechanic this tool models is stated there, and
reading it is faster and more reliable than any other route.

Verified 23 August 2026, and the practical value is already proven:

- Duo prerequisites came out as a formal constraint structure, `OneFromEachSet`
- All 25 Arcana names came from a source comment, `MagicCrit = -- Night, Nyx`
- The Olympian cap, and the correction to it, came from `ReachedMaxGods` and `GodLoot`
- The Devotion re-offer rule came from four lines of `SetupRoomReward`
- The game's own player-facing vocabulary came from its `Keywords` glossary

**The order of authority is fixed:**

1. `Content/Scripts/*.lua` and `Content/Game/Text/en/*.sjson`
2. The owner, who plays the game
3. Nothing else. Wikis, guides and forum posts are leads to verify, never sources to cite

Two honest limits on the treasure, so nobody over-trusts it:

- **The comments are internal, not documentation.** Density is roughly 1% full-line, much of
  it commented-out code and section markers. The useful labels are a happy accident of a
  codebase that was never stripped, not a guide written for us
- **The engine is not Lua.** It is proprietary, described by Hell2Modding as The-Forge. Lua
  is the logic and data layer. Anything below that line is not readable this way

Supergiant does support this deliberately, though: `deppth2` and the SJSON plugin are
published under the **SGG-Modding** organisation. Official tooling, not reverse engineering.

### Hades 1 is not Hades 2, and assistant knowledge of Hades 2 is not reliable

The hardest rule in this project, and it has already produced three wrong claims.

- **Detailed writing about how the game works under the hood is abundant for Hades 1 and
  thin for Hades 2.** Anything an assistant "knows" about Hades 2 internals most likely
  predates 1.0 or is Hades 1 bleeding across. Treat it as worthless.
- **Web search is not a fix.** Two of the three errors came from stale forum posts and
  guides that were correct once. Search results carry no date on the mechanic itself.
- **The only trustworthy sources are `Content/Scripts/*.lua` in the local install, and the
  owner, who plays the game.** When those two disagree, ask rather than pick.
- **Reading a source file is not the same as understanding it.** The god-cap error came from
  real source data, correctly quoted, and still wrong: `MaxGodsPerRun = 4` was read without
  tracing which loot types actually carry `GodLoot`. Before stating a mechanic, follow every
  symbol in the condition to its definition, and name them in the claim so it can be checked.
- **State the symbol, not just the conclusion.** "Capped at four Olympians, per
  `ReachedMaxGods` filtering `LootTypeHistory` on `GodLoot`" is auditable. "Capped at four
  gods" is not.
- **A number in the files is not a number in play.** Check for overrides. `MaxGodsPerRun` is
  4 in `HeroData` and 1 or 2 under `RunOverrides` in `BountyData`.

### Use the game's own words

The game ships a `Keywords` glossary in `Content/Game/Text/en/`, which is its own
player-facing dictionary. **Use it.** The order is: what the game calls it in front of the
player, then what the Lua calls it, then and only then something we invent.

| Player-facing | Internal | Note |
|---|---|---|
| Boon | `GodBoon`, `Trait` | "Blessings from the Olympians" |
| **Location** | `Room` | Not "room". Locations make up Regions |
| **Region** | `Biome` | Not "biome" |
| Encounter | `Encounter` | The dangerous kind |
| **Hex** | `Spell`, `SpellDrop` | Not "spell" |
| **Exit** | `Door` | `ExitNotActive` renders as "Exit Blocked!" |
| Passage | `Barricade` | `BarricadeOpened` renders as "Passage Unlocked!" |
| Attack | `Melee` | |
| Special | `Secondary` | |
| Cast | `Ranged` | |
| Sprint | `Rush` | |
| Magick | `Mana` | |
| Ω Moves | `Omega` | |

> **"Door" is our invention and it has to go.** The word does not appear anywhere in
> player-facing text. The game says Exit. Draft copy across the page and both documents uses
> "door" throughout and needs sweeping.

### Errors made so far, kept as a record

1. Claimed the Codex could not track a chosen duo. It can. Source was a stale Steam thread
2. Described a door as offering three boons. Doors offer gods, and the god then offers three
3. Claimed a hard cap of four gods. It is four **Olympians**, and Hermes, Chaos, Selene and
   the encounter gods sit outside it
4. Used "door" throughout for something the game calls an **Exit**. Invented vocabulary when
   the game had already published its own

- Product decisions and naming are the owner's. Implementation internals are decided and
  stated with reasoning, not handed back as a question list
- Show the measurement before shipping anything that re-ranks a list
- An admitted gap beats a hedged guess. Short sentences, no hedging
- No em dashes anywhere. Not in UI copy, code comments, commit messages or replies
- The project's real memory is its `CLAUDE.md`. Nothing lives only in a chat
