# Xomda — AI agent orientation

You're about to author or modify files for a project that uses `xomda`. This
guide tells you what xomda is, what files belong to it, and how to safely
work with them.

## What xomda is

A model-driven code-generation tool. The user describes their domain once
(entities, attributes, enums, packages) and templates regenerate as much of
the surrounding codebase as they want — TypeScript, Java, SQL, REST clients,
admin UIs, anything they can write a template for. When the model changes,
running `xomda generate` rewrites the generated files.

It is **two-tier**:

- **Tier 1** is xomda itself: the engine that reads a model + templates and
  emits files. You don't normally touch tier 1 from a downstream project.
- **Tier 2** is what the user owns: the **model file** (`.xomda/model.json`)
  and any **templates** under `.xomda/templates/`. Most of your work as an
  agent is here.

## The two artifacts you'll touch

### `.xomda/model.json`
JSON describing the user's domain. Top-level shape:

```json
{
  "id": "<uuid>",
  "name": "<display name>",
  "version": "1.0.0",
  "packages": [],
  "layout": {}
}
```

Every entity and every enum lives inside a `Package`. There is no
model-level `entities[]` or `enums[]` bucket — `packages[]` is the only
container at the root. Packages are nestable namespaces; entities have
attributes; enums have values. **Every element has a stable `id` (UUIDv4)
that templates reference and that survives renames.** When you add an
element, generate a new UUID; display order is array order — no separate
`elementsOrder[]` field exists.

See [model-format.md](./model-format.md) for every field.

### `*.template.json` under `.xomda/templates/`
A tree of **cells** describing how to produce one or more files for the
model. Cells have types: `loop` (iterate entities/enums/packages), `logic`
(JavaScript), `handlebars` (text rendering), `output` (declare a file). A
template runs top-to-bottom, executing each cell in order; loops nest.

See [template-format.md](./template-format.md) for the cell catalog, the
Handlebars helper library, and a worked example.

## How a generation cycle works

```
.xomda/model.json  +  .xomda/templates/**/*.template.json
        │                       │
        └──────────┬────────────┘
                   ▼
              xomda generate
                   ▼
             generated files (paths declared by `output` cells)
```

- `xomda preview` runs every template but writes nothing; pipe through
  `--json` for structured output you can parse.
- `xomda diff` shows which generated files would change.
- `xomda generate` writes the changed files to disk.
- `xomda` with no command starts the SPA — the UI where the user edits
  models and templates visually.

## Stable rules — do NOT violate

1. **Never invent fields not in the schema.** Both the model and the
   templates are validated by Zod schemas. Extra fields persist (every
   schema uses `.loose()`) but the user won't see them in the UI; missing
   required fields break loading.
2. **Generate UUIDv4 for any new `id`.** Don't reuse existing IDs, don't
   leave them blank, don't write strings that look like IDs (`"new-entity-1"`).
3. **Display order is array order.** There is no `elementsOrder[]` field
   anywhere — the order of items inside `packages[]` / `entities[]` /
   `enums[]` / `attributes[]` / `values[]` *is* the rendered order.
4. **Names must be unique within their scope.** Within one package, sibling
   packages + entities + enums must be mutually unique (the schema enforces
   this across all three kinds in one pass). Attribute names are unique
   within their entity; enum values unique within their enum. Case-sensitive.
5. **`xomda` is the binary.** Never assume a project has `pnpm xomda` or
   `npm run xomda` — call `npx xomda` (works without installing) or, if the
   user has run `xomda wrapper`, `./xomdaw` (the pinned wrapper).
6. **The model is language-neutral.** Don't put Java types, TS types, or
   framework annotations in `attribute.type`. The primitive `type` values
   are lowercase: `string`, `number`, `boolean`, `date`, `uuid`, `decimal`.
   Anything else is interpreted as the name of another entity or enum.
   Targets like "BigDecimal" or "java.time.Instant" are decided in
   templates, not the model.

## When the user asks you to add a feature

Two questions to answer first:

1. **Is it model-shaped?** Adding a new entity, attribute, enum, or
   relationship → edit `.xomda/model.json`. Don't write boilerplate code
   yourself; let templates do it.
2. **Is it template-shaped?** Adding "for every entity, generate X" → write
   a new `*.template.json` in `.xomda/templates/`. The user runs
   `xomda generate` and the files appear.

If it's a one-off (just one file, not parameterized over the model), write
it directly. Don't templateize what isn't worth templateizing.

## Where to find more

When this guide doesn't cover what you need, look in:

- `docs/.ai/model-format.md` — full model schema reference
- `docs/.ai/template-format.md` — full template + cell + helper reference
- `docs/.ai/cli-reference.md` — every subcommand and flag
- The user's existing `.xomda/templates/` — pattern-match against templates
  that already work in their project
