# **Enodia: Workflow: Briefing Claude Code**

> How a decision made in this project becomes a scoped piece of work for the Claude Code session. Use it whenever the conversation has settled and the next move is code.

---

# **Sizing**

One brief is **one build-order step, or one screen, or one bug**. A brief with two goals is two briefs.

`DESIGN.md` section 10 already sequences Phase 1 into eleven steps, each verifiable before the next begins. Use that sequence rather than inventing one. If the requested work sits outside it, say which step it displaces and why before writing the brief.

> [!tip] The owner is not writing this himself
> He describes what he wants and this project produces the brief. He reads it to check it says what he meant, not to check that it is technically correct.

---

# **The Template**

Everything between the fences is what gets pasted into Claude Code.

```
Goal
<One sentence. What is true when this is done, in the owner's terms, not in
implementation terms.>

Build order position
DESIGN.md section 10, step N. <Why this step is next.>

Touch
<Files this work may change.>

Do not touch
<Files, properties or behaviours that must survive unchanged. Name the ones this
task could plausibly break, not everything in the repo.>

Unverified assumptions
<One line each, with the file to check it in. Verify before building on it. If one
turns out to be wrong, stop and report rather than working around it.>

Done when
- On screen: <what the owner will look at, and exactly what he expects to see>
- Machine: <a count, a test, or a validator pass that either holds or does not>

Rules in reach for this task
<Only the working-agreement rules this particular task could break. Not the whole
agreement, which is already in CLAUDE.md.>
```

---

# **The Field That Matters Most**

**`Done when` is a demo script, not a claim about correctness.**

The owner recognises wrong on sight and cannot verify an assertion about internals. So an acceptance criterion has to be something he can perform and observe.

| Not checkable | Checkable |
|---|---|
| "Reachability is correct" | "Fill the Cast slot with an Apollo boon. The Zeus legendary moves to DEAD, and the sentence names the Cast slot as the reason" |
| "The extractor handles display names" | "Look up `BoltRetaliateBoon` in the output, one of the seventeen traits Zeus offers, and read its name against the card in game" |
| "Exit mode is fast" | "On a phone, from opening the screen to knowing which of the three to take, under four seconds" |
| "The validator catches bad references" | "Break one trait id in a curated file on purpose. The build fails and names that id" |

Every criterion should be phrased as an action followed by an observation. If a criterion cannot be written that way, the work is not ready to brief.

The machine check exists because a green build proves nothing. `DESIGN.md` 11 is explicit that Vite does not check that a component receives the prop it uses, and a crashing tier list shipped once on a green build.

---

# **Two Fields People Skip**

### Do not touch

Most damage in this repo would come from something quiet. The extractor output is never hand edited. `engine/` imports nothing from `ui/` or `state/`, and that purity is what lets the health check measure the real shipped code. `assets/build-lib.ps1` has a guard preserving the game-file categories.

Name the ones this task could reach. Leave the rest out, because a wall of boilerplate gets skimmed.

### Unverified assumptions

Anything this project asserted about the game while writing the brief goes here, marked as unverified, with the file to check it in.

> [!danger] This is the safety valve for the one hard rule
> This project cannot read the game files. If a design rests on a mechanic and that mechanic is wrong, the brief carries the error into code. Listing the assumption converts a silent wrong claim into a first step.

Close the field with the instruction to stop and report. A working around a wrong assumption is worse than a halt, because it hides the wrong assumption.

---

# **Worked Example**

The real next piece of work at the time of writing. Step 1 finished with a stated gap: `Content/Game/Text/en/TraitText.en.sjson` is sjson, not Lua, so no boon has a display name yet, and nothing renders to a player until it does.

```
Goal
Every trait the extractor emits carries the display name the game shows the player.

Build order position
DESIGN.md section 10, still step 1. The extractor is otherwise done, 57 files
loading with zero failures against game version 138174. This is the stated gap in
CLAUDE.md, and steps 2 and 3 both join against names.

Touch
scripts/extract.mjs, or a sibling module it calls.
data/generated/, new or extended output.
package.json if a dependency is needed.

Do not touch
The existing 57-file Lua load order. It is a real dependency graph and it took work
to get right.
Nothing in data/generated/ gets hand edited, including this new output.

Unverified assumptions
- That TraitText.en.sjson keys on the same internal trait names the Lua uses, for
  example BoltRetaliateBoon. Check before designing the join. If the key shape
  differs, stop and report rather than writing a fuzzy matcher.
- That SGG-Modding publishes an sjson reader worth using rather than hand rolling
  one. Check what is available before writing a parser.

Done when
- On screen: the owner picks five boons he knows by sight, one per god, looks them
  up in the output, and the names read exactly as the game shows them, including
  punctuation and any Ω.
- Machine: every trait id in the generated trait data resolves to a display name, or
  is listed in knownGaps with a reason. The count of unresolved names is zero, and
  the count of knownGaps entries is reported.

Rules in reach for this task
Display names are never a key. The internal name stays the id, and a name change
goes into aliases. REQUIREMENTS.md section 9.
Encoding is load bearing here. A mangled character in a display name is exactly the
bug that reached the live site through a missing meta charset.
```

---

# **After The Brief Comes Back**

The owner reports what he saw, usually in a sentence. Three outcomes:

| Outcome | Next move |
|---|---|
| It does what the brief said | If it settled anything, run `project/workflow-decision.md` |
| It does what the brief said, and the brief was wrong | The design was wrong, not the code. Redesign here, then a new brief |
| An assumption came back wrong | Record the correction first. A wrong mechanic that reached a brief will reach a page next |

The third case is the one that matters. `CLAUDE.md` keeps a numbered list of errors already made, specifically so they are not repeated, and a corrected assumption belongs on it.
