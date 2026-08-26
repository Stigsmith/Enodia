# **Hades 2 Companion: Starter Instructions**

> Written 22 August 2026, carried over from the Helldivers 2 tool at `C:\Dev\dds`. Drop this in as the new project's `CLAUDE.md` seed.
>
> **Two kinds of content below.** The Hades 2 specifics are worked out here rather than left as questions, and anything resting on a roster or a number is marked to verify. The D.D.S. lessons are the ones that cost real money to learn and they are stated as rules, not suggestions.

---

# **What Does Not Come With You**

> [!danger] Read this before the rest, because roughly half of D.D.S. does not port and the half that does is the invisible half
> The back end and the working discipline carry over almost unchanged. **The front end, the product framing and the audience assumptions do not.** Anything below in the Patterns section that is not on this list should be treated as a starting point, not a decision already made.

| Does not transfer | Why |
|---|---|
| **The entire visual vocabulary** | The tier badge plate, two rating columns, the filter pane, row expansion, sixty rows on screen. That is a desktop data table for somebody comparing 52 primaries with time to spare. It is a good design for that job and the wrong one for this |
| **The reading posture** | D.D.S. is read at leisure, before a session, on a desktop. A boon tool is read **mid run, in four seconds, probably on a phone next to a keyboard**. Every layout decision follows from that and none of them follow from D.D.S. |
| **The audience** | D.D.S. is for exactly one returning power user who curates his own data and knows the game cold. See below. This is the fork that decides the most |
| **The product shape** | Assembly versus draft under uncertainty. See the next section |
| **Tier lists as the primary surface** | D.D.S. is a browser first and a builder second, by explicit decision, because its user prefers evaluating individual items. A boon is not evaluable on its own, so the browsing surface cannot be the centre here |

> [!danger] The audience question decides more than any other, and it is not answered here
> Every honesty device in D.D.S. works because the reader **is** the curator. "Our call, not a vote", the admitted gaps, the "the source does not record this yet" lines: to the person who set those gaps they read as integrity. To a stranger arriving from a search result they can read as a tool that does not know things.
>
> **If this is a public tool, the confidence register changes everywhere** and so does the amount of explaining each screen has to do. If it is yours alone, keep the D.D.S. register exactly.
>
> The same fork decides whether the data can be opinionated at all. A private tool can say "this boon is overrated". A public one saying that needs either a source or a very visible byline.

### What does transfer, in one list

> [!success] Decided 22 August 2026: build all of this before the audience question is settled
> The audience is undecided and does not need to be decided yet, because **nothing on this list changes either way.** It is also the half that is expensive to retrofit, so there is no reason to wait on it and every reason not to.

The invisible half, and it is the expensive half to get wrong:

- Stable ids, aliases, and a validator wired into the build
- Curated data and fetched data in separate files, joined on read
- Provenance and patch stamps on everything rated
- Pure engine modules, and therefore scriptable measurement
- Rules as JSON data with a mandatory explaining sentence
- The health checks, and the discipline of measuring discrimination before shipping
- The roadmap and changelog split
- The working agreement at the foot of this document

---

# **The One Structural Difference, And It Changes The Product**

> [!danger] Helldivers is assembly. Hades 2 is a draft under uncertainty. Do not port the D.D.S. shape
> A Helldivers player picks nine things from a fixed catalogue, deliberately, before dropping. Every slot is free, nothing is random, and the tool's question is **"which of the 52 primaries should I bring"**. That is a browsing problem and D.D.S. is a browser.
>
> A Hades 2 player is offered **three boons at a door and must take one**, holding whatever they already have, with no idea what the next door offers. The question is never "how good is Lightning Strike". It is **"I am running Sister Blades, I already have Storm Ring and two Hera boons, I am being offered these three, which do I take"**.
>
> That is a conditional question and it has a different engine behind it. **A tool that answers the absolute question is a wiki with opinions. The conditional one is the product.**

### The three questions the tool actually answers

| When | Question | What it needs |
|---|---|---|
| **Before the run** | Which Arcana, weapon, aspect and keepsake, at this Fear level | Static. Closest to D.D.S. and the easiest to build |
| **At a door, mid run** | Which of these three, given what I hold | The conditional engine. **Four seconds to answer or it is useless** |
| **Mid run, planning** | Is the duo I want still reachable, and what am I missing | Reachability. D.D.S. has no analogue and this is the strongest feature |

**Build the second one first.** It is the reason someone opens the tool, it is the hardest, and the other two fall out of the same engine. D.D.S. built its combination layer five phases late and paid for the rework.

---

# **Reachability: The Engine D.D.S. Does Not Have**

> [!success] This is the feature worth building the data model around
> Duos require a specific pair of gods **and** specific prerequisite boons. Legendaries require several boons from one god. Both are therefore **computable in advance**: given what you hold, which gods you have seen, and how many doors remain, the set of still possible duos is a finite calculation over static data.

Nothing in Helldivers looks like this, so there is nothing to copy. Build it as its own pure module, the same shape as everything else:

```
reachable(held, godsSeen, doorsLeft) -> [{ duo, needs: [...], blocked: false }]
```

Three states per duo and all three matter:

- **Reachable**, and here is exactly what you still need
- **Reachable but tight**, needing more doors than probably remain
- **Dead**, because a required god is out of the pool or a prerequisite slot is already taken by something else

> [!warning] Dead is the state players most need and least expect
> Knowing a duo is off the table changes the boon you take right now. A tool that only lists what is possible, without saying what just became impossible, is giving you half the information at the moment it matters.

**This also makes the conditional rating honest.** A boon that unlocks a reachable duo is worth more than the same boon when that duo is dead, and the tool can say so with a sentence and a number rather than vibes.

---

# **The Data Model**

> [!warning] Verify every roster and every number against the wiki before writing data
> Structure below is stable across patches. Contents are not, and Hades 2 patches more often than Helldivers does. Assume every list here is incomplete until checked.

### Records, and what is the primary key

Every record carries a stable slug `id` and an `aliases` array. **Never key anything on a display name.** Supergiant renames boons between patches and a rename that moves the key orphans every saved run, favourite and unlock.

| File | Holds | Rough shape |
|---|---|---|
| `boons.json` | Every boon, by god and slot | The big one. Attack, Special, Cast, Sprint, Magick, plus the non slot ones |
| `duos.json` | Duo boons, each naming its two gods and its prerequisites | What reachability runs on |
| `legendaries.json` | Legendary boons and their same god prerequisites | Same engine as duos |
| `arcana.json` | Arcana cards, Grasp cost, grid position, awakening conditions | Pre run only |
| `weapons.json` | The six Nocturnal Arms and their aspects | Verify the aspect list per weapon |
| `keepsakes.json` | Keepsakes and their per region effect | One equipped, swappable between regions |
| `familiars.json` | Frinos, Toula, Gale and their abilities | Small file, verify the roster |
| `hexes.json` | Selene's Hexes, and their Path of Stars upgrades | The Hex tree is its own structure, not a flat list |
| `vows.json` | Each vow in the Oath of the Unseen and the Fear it adds | The difficulty model |
| `enemies.json` | Per region, with armour and status vulnerabilities | Only if a rule reads it. See the D.D.S. warning below |

### A boon record

```json
{
  "id": "zeus-lightning-strike",
  "name": "Lightning Strike",
  "aliases": [],
  "god": "zeus",
  "slot": "attack",
  "tags": ["blitz", "chain"],
  "prerequisites": [],
  "rarityScaling": { "common": 40, "rare": 60, "epic": 80, "heroic": 100 },
  "rating": { "tier": "A", "source": "curator", "patch": "1.x" },
  "note": "",
  "effect": ""
}
```

> [!danger] Rarity is not a cosmetic field and rating a boon without it is close to meaningless
> A Common boon and a Heroic one are different cards. Some boons are barely worth a slot at Common and run defining at Heroic; others barely scale at all. **The scaling shape is the interesting stat**, not the base value: a boon that goes 40 to 100 is a Pom target and one that goes 40 to 55 is not.
>
> D.D.S. has no equivalent axis and this is the most likely place to under model. Decide early whether the rating is per boon or per boon and rarity, because retrofitting it touches every record.

### The context object

D.D.S. calls this the scenario and it is one object, persisted, read by every surface that has an opinion. The Hades 2 equivalent:

```json
{
  "weapon": "sister-blades",
  "aspect": "aspect-of-artemis",
  "arcana": ["...card ids..."],
  "fear": 12,
  "path": "underworld",
  "region": "oceanus",
  "held": ["zeus-lightning-strike", "hera-nexus"],
  "godsSeen": ["zeus", "hera", "aphrodite"]
}
```

Two fields here have no D.D.S. counterpart and they are the ones the conditional engine reads: **`held`** and **`godsSeen`**. Everything else is the pre run setup.

> [!info] Fear is the Heat equivalent and it is not one number
> Fear comes from stacking individual vows, so "Fear 12" is a total that can be reached many ways, and the ways are not equivalent. A vow that speeds up enemies and a vow that cuts your healing produce very different runs at the same Fear.
>
> D.D.S. collapsed difficulty and squad size into one number called peril and that worked because both are scalars. **Fear is a vector and collapsing it loses the thing rules want to read.** Keep the vow list; derive the total for display.

---

# **What The Two Column Reading Becomes**

> The single best **idea** in D.D.S. The idea survives the port in a stronger form. The **column** almost certainly does not: two columns is a table pattern, and a door overlay showing three choices has no table in it. Think of it as two readings shown together, and decide the shape later.

Every row shows **an outside opinion** and **ours for your situation**, with a sentence for every point of difference.

| | D.D.S. | Hades 2 |
|---|---|---|
| Left column | The u.gg community tier | Whatever consensus exists, **if one does** |
| Right column | Ours, for the front and planet | Ours, **given what you already hold** |
| Typical delta | Small. Most items agree | **Large, and that is the point** |

Lightning Strike with no Zeus boons and Lightning Strike when you already hold Storm Ring are different cards. In Helldivers the two columns agree about half the time and the tool had to argue for the difference being worth the width. Here the difference is the entire feature.

> [!danger] Check whether a Hades 2 tier consensus actually exists before designing around one
> D.D.S. rests on u.gg publishing per faction community votes for 224 items. **If nothing equivalent exists for Hades 2, there is no left hand column** and the whole shape changes: the tool becomes a single opinion that must be labelled as one, everywhere, rather than a second opinion set against a first.
>
> This is the first thing to establish and it is not a detail. Do not assume it, and do not manufacture a consensus by averaging a few YouTubers and calling it sourced.

---

# **Rules, Concretely**

Rules are JSON data, not code. Each carries a `when` about the context, a `match` about the subject, a delta in points, and **a mandatory `say`**, because a score that cannot explain itself is a score nobody should trust.

Real shapes this game wants:

```
when: { "weapon": ["sister-blades"] }
match: { "tags": ["chain"] }
say:   "Sister Blades hit fast and often, which is what chain effects are priced for."

when: { "heldGod": { "zeus": { "gte": 2 } } }
match: { "god": ["zeus"] }
say:   "You are two Zeus boons from the legendary. This is one of them."

when: { "fear": { "gte": 16 } }
match: { "tags": ["defensive"] }
say:   "At this Fear the run ends to chip damage rather than to a boss."

when: { "reachable": ["some-duo-id"] }
match: { "prerequisiteFor": ["some-duo-id"] }
say:   "This is the last piece of a duo still on the table."
```

The fourth one is the interesting one and it is the reachability engine feeding the rating engine. **That coupling is the product.**

### The measurement discipline, which is not optional

> [!danger] A rule that fires on most of its pool is describing the pool, not the boon
> D.D.S. shipped five rules that took a tier off **42 of 51 primaries**, because 48 of those 51 had one of two identical input readings. The rules were not judging weapons, they were judging the fact that a primary is a primary.
>
> **Hades 2 will hit this harder than Helldivers did.** Most boons are damage boons. A rule keyed on "is this offensive" fires on most of the pool and says nothing.

Write the health check script **before** the second rule, not after the tenth. It reports, per rule, the share of its eligible pool it fires on and how often it moves a rating, and flags anything at 60% or more. In D.D.S. the armour bug was visible in one line of that output and shipped anyway, because the script did not exist yet.

> [!danger] Measure against a random legal sample, not against a convenient one
> The loadout rules were first measured against the 39 builds that shipped with the tool. Two rules looked healthy. Against **300 randomly generated legal builds** one fired on 86% and the other on 45%. Both were cut before shipping.
>
> For Hades 2 the random sample is **random legal boon sets**, which means simulating a run: draw doors, respect god pools, respect slot conflicts. You need that generator for the tool anyway, so build it early and point the health check at it.

---

# **The Day One List**

> [!danger] Cheap before there is data, expensive after
> Each of these means touching every record if it arrives late.

| Do first | Cost of not |
|---|---|
| **Stable slug ids, `aliases` array on every record** | Every saved run and unlock orphans on the first rename, and it fails silently |
| **A validator wired into `prebuild`** | Broken references accumulate invisibly. D.D.S. has 490 lines of it and every growth spurt caught something real |
| **Curated and fetched data in separate files, joined on read by id** | A re-fetch overwrites a hand made judgement and you cannot tell which fields were yours |
| **Provenance on every rating: source and patch stamp** | You cannot answer "is this still true after the patch", and this game patches |
| **Rarity as a first class axis on boons** | See above. This is the Hades specific one |
| **Engine code as pure functions, no React, no storage** | The load bearing one. See below |
| **One shared script loader** | D.D.S. had the loader copied into one script; when a second needed it, the first copy **had been carrying a stale formula for two versions** and every number it printed was for a situation the engine no longer produced |
| **A `knownGaps` array inside each data file** | Gaps recorded in chat are gaps nobody reads again |

> [!danger] The purity rule is what unlocks everything else
> D.D.S. has four engine files with no React import and no `localStorage`. That is what lets a script import the **real shipped code** and measure it. Every good decision in that project came out of a measurement and every measurement came out of that property.
>
> Once an engine reaches into React state, you cannot answer "what does this rule do to the population" without a second copy, and a second copy drifts.

---

# **The Lessons That Cost The Most**

> Each is a real failure in D.D.S. with a date on it. Ordered by cost.

**Do not charge twice for one fact.** A community tier already prices in what a thing is for. Voters know an assault rifle does not open a Hulk, so its B is a B *given* that. Penalising it again charges twice. In Hades 2: a boon's rating already assumes you will pair it with something, so do not also reward it for being pairable.

**Some properties belong to the combination, not to the item.** The curator's argument, and it is the general form:

> even the item that IS good at armour is not straightforwardly better, because bringing an Eruptor on bugs forces a Stalwart to cover chaff

**Two things built from the same premise agreeing is not verification.** A derived flag matched all 39 hand authored flags and that was recorded as proof. Worthless: the hand authored flags were made with the same wrong rule. Against the source it agreed on 35. Check a derivation against the source, never against an earlier derivation.

**Everything is points. No floors, no ceilings.** A floor flattens every item sharing a tag into one tier, destroying the ordering the tag sits on. A floor and a ceiling that contradict silently resolve by line order, which produced an item at 86 points landing three tiers below one at 64.

**Zero means "not said", and a rule reading an unset value must not fire.** Assuming somebody is solo because they have not told you is how a list confidently ranks for a game nobody is playing.

**A refactor of a scoring engine that changes a score is not a refactor.** The test is byte identical health check output before and after. Same for a copy only change.

**A green build proves nothing about whether the app runs.** Vite does not check that a component receives the prop it uses. A crashing tier list shipped once on a green build. Load the page and read the DOM.

**Unrated is a first class state.** A null rating is not missing data. Those rows show a dashed placeholder, sort last, and **survive every filter floor**, because being seen is the only way something new gets tried. Filtering them out made every new release invisible.

**The judgement layer declares itself.** Sourced facts and our opinions must never look equally weighed. D.D.S. gives every tag a `source` of `curator` or `wiki` and **the validator rejects anything else**. Rules resting on a judgement carry a field explaining it, and the UI says "our call, not a vote".

---

# **Patterns To Copy Wholesale**

### The roadmap split, which you asked about

| File | Role |
|---|---|
| `roadmap.md` in the repo root | The **working document**. Reasoning, dependency chains, open questions, and **dead positions with why they died** |
| `src/data/roadmap.json` | The **public summary** on the site. One sentence per milestone; the moment it needs two it belongs in the working document |

Change the markdown first, then check whether the summary still reads true. **Record superseded positions, not just live ones.** The D.D.S. curated builds question moved three times and each dead answer is written down as dead, because otherwise a later session picks one back up.

### The changelog

`changelog.json`, newest first. **One version is one deploy, not one day**, because work arrives in bursts that do not line up with a calendar. Three places agree and two are automatic: the entry, `package.json`, and everything else reads `CHANGELOG[0].version`. Write the entry as the work lands; reconstructing a week from memory is how a changelog becomes fiction. Entries are written for the player, never naming a file.

### Warnings

- **Silence is the normal state.** Nothing wrong means nothing said, never a panel reporting everything is fine.
- **Every warning is conditioned on context.** "You have no defensive boon" is boring. "No defensive boon, Fear 16, and you are about to fight Chronos" is worth reading.
- **Advisory means advisory.** A warning removes nothing. A hard gate removes the thing entirely, and the rule is: if the answer is do not take this, it should not be on the card.

### Interface rules that survive the change of posture

> [!warning] These four are the only D.D.S. interface decisions worth porting sight unseen
> Everything else in that tool's front end is built for browsing at leisure on a desktop and should be re-decided from scratch. See the opening section.

- **Empty states say what to do next**, not just that nothing was found.
- **A control that changes what is on screen has to be on screen.** In D.D.S. that produced a rule about folded filter panes; here it will produce something entirely different, but the principle holds.
- **Build every component so it works alone, then compose it.** A thing that only exists inside one screen cannot be pre used. This matters more here than it did there, because the same boon card has to work in a leisurely pre run browser **and** in a four second door overlay.
- **Never let a judgement and a sourced fact sit together looking equally weighed.** This is a presentation rule, not a data one, and it survives any layout.

### Theming and shipping

- Colours through CSS custom properties; a theme is a token set, not a rewrite.
- **Ramps are positional, not literal.** `base-950` is always furthest back and `base-100` always the most prominent text, in every theme, so a class means the same thing when the theme flips.
- **The product name lives in exactly one file.**
- Anything that must read identically across themes, like a rating badge, is exempt and says so.
- Hash routing, `localStorage`, static host, **no network call at runtime**. Fetch once by script, ship as JSON. D.D.S. protected that property deliberately and it is why the whole first track shipped without a server.

---

# **What To Verify Before Writing Any Data**

> [!question] Facts to establish. None can be derived from the code, and getting them wrong costs a rewrite
> 1. **Who is this for.** You alone, or the public. Decides the confidence register, how much each screen explains, and whether the data is allowed to be openly opinionated. Nothing else on this list matters as much.
> 2. **Does a credible Hades 2 tier consensus exist.** Decides whether the two column reading exists at all. Do not manufacture one.
> 3. **Where the numbers come from.** Is there a wiki with structured boon data, or does the game ship readable data files? D.D.S. fetches once by script into a generated JSON that is never hand edited, and joins it to curated data on read. Same pattern applies whatever the source.
> 4. **The full roster of gods, slots, weapons, aspects, Arcana and vows**, at the current patch. Every list in this document is from memory and should be treated as a sketch.
> 5. **How duo prerequisites are actually specified**, exactly, because the reachability engine is built on it.
> 6. **Whether rating is per boon or per boon and rarity.** The most expensive thing here to change later.

---

# **The Working Agreement**

> [!info] How the D.D.S. sessions run, worth restating in the new project
> - **Product decisions and naming are yours. Implementation internals are mine**, decided and stated with reasoning rather than handed back as a question list.
> - **Show the measurement before shipping anything that re-ranks a list.** Count what share of the population moves and put that number in front of you first.
> - **Show the actual value, not a description of it**, when a concept is not landing.
> - **An admitted gap beats a hedged guess.** Short sentences, no hedging.
> - **No em dashes anywhere.** Not in UI copy, code comments, commit messages or replies. No ASCII substitutes.
> - The project's real memory is its `CLAUDE.md`, kept current deliberately. Nothing lives only in a chat.
