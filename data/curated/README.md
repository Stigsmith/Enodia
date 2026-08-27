# Curated data

Hand authored. Holds only what the game cannot tell us: ratings, playstyle tags, archetype
definitions, rule packs, and the prose the tool says out loud. `DESIGN.md` 2.2.

Nothing lives here yet. The rating engine arrives at build order step 10 and the archetype
lists are the owner's to write, so this directory is a shape waiting for content rather than
an empty file nobody filled in.

## What the validator enforces, today

`scripts/validate.ts` reads every `*.json` in this directory and checks:

| Rule | Severity | Why |
|---|---|---|
| The file has a `knownGaps` array | fails the build | A gap recorded in chat is a gap nobody reads again |
| The file has a `records` array | fails the build | One shape, so one loader |
| Every record has a string `id` | fails the build | The join key onto `data/generated` |
| Every record has an `aliases` array | fails the build | A rename orphans every saved run, and it fails silently |
| `source` is `curator` or `wiki`, when present | fails the build | Our opinions must never look like sourced facts |
| A rule carries a non-empty `say` | fails the build | A score that cannot explain itself is one nobody should trust |
| Every `id` resolves to a generated record, directly or through `aliases` | reported | Orphans are reported, never silently dropped |

## The shape

```json
{
  "knownGaps": ["no ratings for the Hermes boons yet"],
  "records": [
    {
      "id": "StormRingBoon",
      "aliases": [],
      "source": "curator",
      "rating": 4,
      "say": "The last piece of a duo that is still on the table."
    }
  ]
}
```

`id` is the game's internal name, which is the stable key and is never displayed. Display
names change between patches, internal names almost never do. When one does, the old id goes
into `aliases` and saved runs keep resolving.

A re-extraction after a patch overwrites `data/generated/` and touches nothing here.
