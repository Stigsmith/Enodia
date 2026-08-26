# **Enodia: Workflow: Recording A Decision**

> How a settled conversation becomes text in a repo document. Run this whenever something is decided, reversed, corrected, or closed. The rule it serves is that nothing lives only in a chat.

---

# **There Is No Decision Log**

Do not create one. The repo already carries its own memory, in structures that are load bearing and already populated:

| Structure | Where | Holds |
|---|---|---|
| Decisions already taken | `REQUIREMENTS.md` 5 | A choice, with its reasoning, in a table |
| Dead positions, recorded so they are not revived | `REQUIREMENTS.md` 5 | A killed idea, dated, with why it died and what replaced it |
| Errors made so far, kept as a record | `REQUIREMENTS.md`, and again in `CLAUDE.md` | Numbered. A wrong claim and its correction |
| Verified mechanics, with their sources | `CLAUDE.md` | A fact and the symbol it came from. Nothing is restated without the citation |
| To verify before writing any data | `REQUIREMENTS.md` 12 | Open questions with a Status column, marked Settled as they close |
| Open items | `DESIGN.md` 12 | Not blocking, listed so they are not forgotten |
| Inline correction | Anywhere | A dated blockquote inside the section it corrects, leaving the wrong claim visible |

A parallel log would compete with all seven and lose. **Write into the structure that already fits.**

---

# **Steps**

1. **State the decision in one line.** If it takes a paragraph, it is not settled yet
2. **Check it does not rest on an unverified mechanic.** If it does, it is not a decision. It is a question for Claude Code, and it goes through `project/workflow-brief.md` first
3. **Say what it kills.** A choice that closes nothing was not a decision. Whatever it closes goes on the record with it
4. **Route it** using the table below
5. **Write the replacement text**, in the target document's register, ready to paste
6. **Name the re-upload**, if the change matters to this project's copies

---

# **Routing**

| The decision is about | Document |
|---|---|
| What the product is, who it is for, what it will not do | `REQUIREMENTS.md` |
| Scope, phases, what ships when | `REQUIREMENTS.md` 7 |
| How something is built. Engines, algorithms, data flow, storage | `DESIGN.md` |
| The order of work in Phase 1 | `DESIGN.md` 10 |
| How Claude Code should behave, or a rule it must follow | `CLAUDE.md` |
| A mechanic verified in the game files | `CLAUDE.md`, verified mechanics table, with the symbol |
| The image library | `assets/README.md` |

> [!question] When it fits two documents
> Requirements say what and why. Design says how. If a decision has both halves, split it, and put a pointer in the shorter half. Do not write the same paragraph into two files.

---

# **Register**

Draft text for a repo document follows that document's style, which is not the style of the files in `project/`:

- Plain headings, no bold H1
- No callout blocks. Tables, blockquotes and prose
- No em dashes, which holds everywhere
- Dates written out: **23 August 2026**
- A mechanical claim names its symbol. "Capped at four Olympians, per `ReachedMaxGods` filtering `LootTypeHistory` on `GodLoot`" is auditable. "Capped at four gods" is not

---

# **Shapes To Copy**

### A killed position

Goes under Dead positions in `REQUIREMENTS.md` 5. Quote the position as it was actually argued, so it is recognisable when someone proposes it again.

```
- **"Show a percentage chance of completing a build."** Killed 22 August 2026. The
  community has not solved the offer and rarity formulas, and the wikis say so outright.
  Any number would be invented, and false precision destroys trust the first time it is
  visibly wrong. Replaced by feasibility states.
```

### A correction to something already published

An inline blockquote inside the section it corrects. The wrong claim stays visible above it. It is not edited away, because the point is that the correction can be seen.

```
> **Corrected 23 August 2026.** Draft 1 claimed the in-game Codex could not track
> progress toward a chosen duo or legendary, citing a Steam feature request as evidence
> of the gap. **That was wrong.** The thread was stale, and the owner, who plays the
> game, confirms target tracking is in.
>
> This mattered, because target-level tracking was framed as the wedge. It is not.
```

Note the second paragraph. A correction says what the error cost, not only what the truth is.

### A closed open question

Two edits, and both are needed. Change the Status cell to **Settled**, then put the answer where it belongs.

```
| 2 | Exactly how duo prerequisites are specified | **Settled.** `OneOf` and
`OneFromEachSet`, a formal constraint structure. `DESIGN.md` 3.2 |
```

A question marked Settled with no answer written anywhere is worse than leaving it open.

### A verified mechanic

Goes in the `CLAUDE.md` table, one row, fact and source. Never the fact alone.

```
| A god enters `LootTypeHistory` on **pickup**, not on offer. Declining an Exit costs
nothing | `InteractLogic.HandleLootPickup` |
```

---

# **Re-upload**

The documents in this project are copies. After a decision is written into the repo, say which file the owner should re-upload, and say it once, at the end.

| Changed | Re-upload |
|---|---|
| A rule, a verified mechanic, or the build state | `CLAUDE.md` |
| Scope, a phase, a dead position | `REQUIREMENTS.md` |
| An engine, an algorithm, the build order | `DESIGN.md` |
| Nothing but wording | Nothing. Say so |

> [!tip] Batch it
> One re-upload after three decisions is fine. Chasing every edit turns a habit into a chore, and a chore stops happening.
