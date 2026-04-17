# AGENTS.md — xomda-js for AI coding assistants

You found the `xomda-js` package. This file is the one-screen cheat sheet for
authoring xomda artifacts on behalf of a user. The deep references it points
at are bundled inside this same package under `docs/.ai/`.

If you do nothing else, read this file, then the matching deep-reference file
for whatever you're about to touch. Both `.xomda/model.json` and
`*.template.json` are schema-validated — getting them slightly wrong fails in
ways that are not obvious from the error message, so the up-front reading is
cheaper than guessing.

---

## What xomda is — in one paragraph

A model-driven code-generation tool. The user describes their domain once
(entities, attributes, enums, packages) in `.xomda/model.json`, and templates
in `.xomda/templates/` turn that model into as much code as they want —
TypeScript, Java, SQL, REST clients, anything. Running `xomda generate`
rewrites the generated files when the model or a template changes.

## What you author

| File | What it is |
| --- | --- |
| `.xomda/model.json` | The domain model. Language-neutral. Validated by a Zod schema. |
| `.xomda/templates/**/*.template.json` | Cell-based templates. Validated by a Zod schema. |

## What you run

```bash
npx xomda-js              # start the server + SPA on :6431
xomda preview [--json]    # what would be generated, no writes
xomda diff [--json]       # what generated files would change
xomda generate            # write to disk
```

The npm package is `xomda-js`. The CLI binary it installs is `xomda` (not
`xomda-js`).

## Hard rules for `.xomda/model.json`

Read [`docs/.ai/model-format.md`](./docs/.ai/model-format.md) for every field.
The rules you cannot break:

1. **Language-neutral.** `attribute.type` is one of `string`, `number`,
   `boolean`, `date`, `uuid`, `decimal` (all lowercase) — or the name of
   another `entity` / `enum` in the same model. **Never** `String`,
   `BigDecimal`, `java.time.Instant`, `LocalDate`, `int`, etc. Mapping to
   target-language types is the template's job.
2. **UUIDv4 on every element.** Every `id` field must be a fresh UUIDv4.
   Don't reuse IDs across elements; don't leave them blank; don't use
   strings that "look like" IDs (`"e1"`, `"new-entity"`).
3. **Array order is display order.** No `elementsOrder` field exists. The
   order of `packages[]`, `entities[]`, `enums[]`, `attributes[]`,
   `values[]` *is* the rendered order.
4. **Unique names per scope.** Within one package, the union of
   sibling packages + entities + enums must be mutually unique (the schema
   enforces this in one pass — collisions across kinds also fail).
   Attribute names unique inside their entity. Enum values unique inside
   their enum. Case-sensitive.
5. **`packages[]` is the only top-level container.** No model-level
   `entities[]` or `enums[]` — every entity and every enum lives inside a
   `Package`. Packages nest arbitrarily.
6. **The schema is `.loose()`.** Unknown fields *persist* across save/load
   but don't drive generation and don't appear in the SPA. If you find
   yourself wanting a new model field, write a template instead.

## Hard rules for `*.template.json`

Read [`docs/.ai/template-format.md`](./docs/.ai/template-format.md) for the
full cell catalog and the Handlebars helper library. The rules you cannot
break:

1. **Cell `type` is one of an exact set of strings.** `loop`, `logic`,
   `handlebars`, `output`. Typos silently produce no output.
2. **`output` declares a file path; later writes to the same path overwrite
   earlier ones.** Use `{{name}}` / `{{snakecase name}}` / similar helpers
   so each entity/enum gets a unique path.
3. **`loop` cells iterate flattened.** A loop over `entities` covers every
   entity in every package; over `enums` every enum in every package. If
   you only want one package's contents, scope the loop to that package —
   don't filter inside a `logic` cell.
4. **`logic` cells run JavaScript in a sandbox.** They can set variables on
   the execution context but can't import arbitrary modules. Keep them
   small; if you need real code, do it in a Handlebars helper.
5. **Handlebars helpers ship with xomda.** `pascalcase`, `camelcase`,
   `snakecase`, `kebabcase`, `uppercase`, `lowercase`, pluralization helpers,
   etc. See the helper table in the template reference. Don't re-implement
   them in `logic` cells.
6. **Multi-model / multi-project loops.** `loopSource: 'models'` and
   `loopSource: 'projects'` let one template iterate across multiple
   models/projects. They degrade to a singleton on simple projects, so use
   them by default in templates you expect to be reused.

## Workflow you should follow

1. **Read the user's existing templates first.** They encode project
   conventions the schema doesn't. Pattern-match against them before
   inventing a new style.
2. **Run `xomda preview --json` before `xomda generate`** any time you've
   changed a template or a non-trivial part of the model. Preview is
   read-only and produces structured output you can inspect.
3. **Run `xomda diff` after a model edit.** Cheap correctness signal — tells
   you exactly which generated files would change.
4. **Generate UUIDs with `crypto.randomUUID()` or equivalent.** Never make
   them up.
5. **When in doubt, write less.** A small correct model is infinitely better
   than a sprawling speculative one — templates amplify every mistake.

## Where the deep references live

Bundled inside this package, under `docs/.ai/`:

- [`docs/.ai/AGENT_GUIDE.md`](./docs/.ai/AGENT_GUIDE.md) — longer orientation.
- [`docs/.ai/model-format.md`](./docs/.ai/model-format.md) — every model field.
- [`docs/.ai/template-format.md`](./docs/.ai/template-format.md) — every cell, every helper, worked example.
- [`docs/.ai/cli-reference.md`](./docs/.ai/cli-reference.md) — every subcommand.
- [`docs/.ai/integrations.md`](./docs/.ai/integrations.md) — IDE / build-tool surfaces.

You are now equipped to author xomda models and templates correctly. Go read
the right deep reference for the file you're about to touch.
