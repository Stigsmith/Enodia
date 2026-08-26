# Enodia: the collaborator project

Configuration for the Claude.ai project **🌙 Enodia**, which is the design and planning half
of this work. Claude Code builds the tool. That project decides what gets built, writes the
brief, and turns the result into document text.

The project exists and is currently empty. Two steps set it up.

---

## Setup

### 1. Custom instructions

Paste the whole of `enodia_instructions.md` into the project's instructions field.

### 2. Project knowledge

Upload six files:

| File | From | Why |
|---|---|---|
| `CLAUDE.md` | repo root | Rules, verified mechanics with sources, current build state |
| `REQUIREMENTS.md` | repo root | What the product is, scope by phase, dead positions |
| `DESIGN.md` | repo root | Architecture, engines, build order, open items |
| `hades-2-companion-lessons learned.md` | repo root | The D.D.S. engineering discipline |
| `enodia_workflow_brief.md` | this folder | Turning a decision into a brief for Claude Code |
| `enodia_workflow_decision.md` | this folder | Turning a settled conversation into repo document text |

The four repo documents go up **verbatim**. They are the original, the uploads are copies,
and nothing gets summarised on the way. Two versions of the same truth would drift, which
is the failure the project's own data rules exist to prevent.

---

## Why there is nothing else here

Three things were considered and left out.

**No condensed briefs.** See above. Drift.

**No decision log.** The repo already carries seven structures that record decisions:
`Decisions already taken`, `Dead positions`, `Errors made so far`, `Verified mechanics`,
`To verify before writing any data`, `Open items`, and the dated inline correction. A
parallel log would compete with all of them. `enodia_workflow_decision.md` routes into what
exists.

**No state-of-play file.** `CLAUDE.md` already opens with where the build is. Keeping a
second copy current is one more thing to forget.

---

## Keeping it fresh

The uploads go stale the moment a repo document changes. The instructions tell that project
never to assert where the build has got to, and to state its assumption in one line instead.

Re-upload after a decision changes a document. Batching three at a time is fine.
`enodia_workflow_decision.md` names the file to re-upload at the end of each decision.

---

## Style

Files in this folder follow the owner's Obsidian project-file style: bold H1, typed callout
blocks, no YAML. That is deliberate, because they are Claude project files, and it differs
from the repo documents, which use plain headings and no callouts.

Do not normalise them to match the rest of the repo. Text drafted **for** a repo document
follows that document's register, and the decision workflow says so.

---

## Where to start

Three conversations worth having first, all drawn from open items in the documents.

1. **The Targets screen, `DESIGN.md` 10 step 8.** The first point where the tool is useful
   to a player, and it is almost entirely a design problem. What it shows, in what order,
   and the exact wording of a DEAD verdict. Ask for the screen written out, not described
2. **The duo count.** The extractor finds 33. Wikis claim 29 and 37. Underneath the
   validator question sits a product one, which is what the Targets screen counts as a
   target at all
3. **The `feeds` tag, `DESIGN.md` 12 item 8.** The largest single piece of hand authoring in
   the project, and the briefing's advice line depends on it. Whether it can be derived
   from the game's own fields, and whether it is worth doing by hand if not, is a scope
   decision and therefore the owner's
