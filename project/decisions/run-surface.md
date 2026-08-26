# Decision: the run is one surface

27 August 2026. Produced from a design conversation in the Claude.ai project, run through
`project/enodia_workflow_decision.md`.

Everything below the routing table is replacement text for `DESIGN.md`, written in that
document's own register. Paste it in, or hand this file to Claude Code to apply.

---

## The decision

**The run is one scrolling timeline with a persistent rail, not four screens.**

## What it kills

`DESIGN.md` 8 currently lists five Phase 1 surfaces: Setup, Exit, Targets, Held, Briefing.
Three of those stop being screens.

- **Held** becomes the rail, always on screen, never navigated to
- **Targets** stops existing as a destination. A death is an event in the run, so it is
  recorded at the entry where it happened rather than collected on a separate screen. The
  full live list becomes an overlay
- **Briefing** stops being a surface and becomes a summary header on the timeline. It was
  always a rendering of history, and the timeline is history

Setup survives unchanged. Exit survives as the present entry rather than as its own screen.

## Why it is better than what is written now

Four surfaces cost navigation, and the budget is four seconds. Collapsing them removes the
navigation entirely.

It is also close to free. `DESIGN.md` 6.2 already requires snapshotting the reachability
verdicts on every pick, because the briefing has to diff against something. **A timeline
entry is one of those snapshots rendered.** The data structure this needs is one the
document already committed to building for another reason.

## Routing

| Change | Document |
|---|---|
| The surfaces | `DESIGN.md` 8, replaced |
| What each build order step builds | `DESIGN.md` 10, steps 7 to 11 amended |
| God priority as an engine output | `DESIGN.md` 4, new 4.4 |

The build order **sequence does not change**. Only the description of what each step
produces.

---

# Replacement for DESIGN.md section 8

## 8. Interface

Reading posture is the constraint: mid run, four seconds, one hand, phone beside a keyboard.

### The run is one surface

Setup happens once, before the run, and is its own screen. Everything after it is a single
surface in three parts.

| Part | What it is |
|---|---|
| **Timeline** | The run itself, scrolling. One entry per Exit |
| **Rail** | What you hold. Persistent, left edge, icons only, never navigated to |
| **Overlays** | Detail. They cover the timeline, they do not push it |

There is no navigation between them. The rail is always present, an overlay is always
dismissable, and the timeline is always underneath.

### The timeline

Lit entries behind you, one bright entry at the present, unlit beads ahead for the Exits
that remain.

| Position | Carries |
|---|---|
| Past | Which god was behind that Exit, what was taken, and what died at that moment |
| Present | The offer, ranked, one sentence each. The reject verdict. The ranked god list for what you want next |
| Future | Count and nothing else. Unlit beads, no labels, no predicted content |

**The present entry is sticky and is never off screen by default.** A timeline is a history
object and the thing needed in a hurry sits at the far end of it, so position has to be
fought deliberately. The button that returns to the present exists only because someone
scrolled away on purpose.

**Future entries carry shape, never content.** `RewardLogic.ChooseLoot` draws uniformly from
the eligible set, so any prediction of which god sits behind an unreached Exit would be an
invented offer model. That is the same false precision that killed the stated-probability
idea in `REQUIREMENTS.md` 5, and it is refused here for the same reason. What the player
gets instead is the pace of the run, which is real and which a bead count states honestly.

**A death is recorded where it happened.** Committing a slot can close a dozen builds at
once, and the entry for that pick is the only place in the product where the cause and the
consequence sit next to each other. A separate Targets screen puts the death somewhere the
player has to go looking, and separates it from the pick that caused it.

### The rail

Five slots in fixed positions, always visible, icons only.

**An empty slot is the warning.** A dark Cast slot states, permanently and without saying
anything, the thing that keeps half the live targets alive. The originating complaint, "I
kept trying for that Zeus legendary, turns out I needed the boon on my Cast", is answered by
an icon that was never not there. This is the silence rule working properly: nothing is
announced, and the information is in peripheral vision for the whole run.

Slots that are filled show what fills them. Slots that are empty stay dark and stay in
place. The rail never reorders, because a fixed position is what makes it readable without
being read.

On a phone in portrait the rail is about 44 points wide, icons only, and unfolding it opens
an overlay. On desktop the same rail can afford to sit open.

### Overlays

Three of them, all dismissable, all covering rather than pushing.

| Overlay | Opened from | Holds |
|---|---|---|
| Held, expanded | The rail | Everything held, by slot, and the entry point for correcting a mistake |
| Live targets | The present entry | Every build still open, by state. A filter over the same output |
| Entry detail | Any timeline entry | What that Exit offered and what changed |

### Re-entry

The briefing is not a surface. When an active run is resumed after a meaningful gap, the
timeline opens at the present with a summary header above it: what you hold by slot, what
the build centres on, what you were chasing and its state now, and where you are.

It renders fact, derivation and advice as three visibly distinct registers, and the advice
register is simply absent in Phase 1 rather than filled with something weaker.

Scrolling back through the timeline is the rest of the briefing, and it needs no feature to
make it work.

### Entry

Tap-only. At an Exit you are shown three boons from at most two or three gods, so the picker
is filtered by `godsSeen` plus the current region's pool and is two taps deep, not a search
box.

Rarity is optional at pickup. An unrecorded rarity is unrated, which is a first-class state,
not missing data.

The offer block is three cards and three sentences. Never a table. Game art on every card,
which is the single thing hades2builder got right and the other two did not.

### Rules that survive the posture change

[unchanged, keep the existing bullet list]

---

# Amendment to DESIGN.md section 10

The sequence is unchanged. What steps 7 through 11 produce is restated.

```
 7. Setup screen, and the rail. Enough to produce a real RunContext. Held is no longer a
    screen
 8. The timeline shell, with reachability rendered in the present entry and deaths recorded
    inline at the entry that caused them. No rating engine at all. The tool is already
    useful here, and this is the first shippable point
 9. Verdict snapshotting, then engine/briefing.ts and the re-entry header. Factual recap and
    the changed-while-away diff. No advice line yet
10. engine/rules.ts, one rule, then scripts/health.ts, then the rest
11. The offer block inside the present entry, ranked, with the reject verdict
```

Step 8 remains the milestone that matters, and the timeline makes it cheaper rather than
more expensive: step 9 inherits the rendering rather than building a second one.

---

# New DESIGN.md section 4.4

### 4.4 God priority, rolled up from the verdicts

At an Exit the player picks a god, and the boons come afterwards. So the output that matches
the decision being made is not a list of targets. It is a ranked list of gods.

```ts
godPriority(ctx: RunContext): GodVerdict[]

type GodVerdict = {
  god: GodId
  score: number
  keeps: TraitId[]     // live targets this god still feeds
  kills: TraitId[]     // targets that die if this god is taken
  why: string
}
```

Derived entirely from `reachable()`. For each god still in the pool, count the live targets
whose unsatisfied sets contain at least one trait from that god, weighted by proximity. No
new data, no new judgement, no new source of error.

Two things it must carry beyond the score.

**What this god keeps alive.** The ordinary case, and the reason a god is worth wanting.

**What this god kills.** At the fourth Olympian slot this is the whole warning. Four
Olympians leave six pairings, so taking a fourth god ends every duo outside those six at
that instant, per 4.1.2. Nothing in the game reports it, and 4.1.2 point 2 requires the
warning to fire before the pick rather than after. **This function is where that renders.**

---

## Re-upload

`DESIGN.md`, once the three edits are applied.
