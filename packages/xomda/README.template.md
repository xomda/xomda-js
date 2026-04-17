# xomda-js

`xomda-js` is a model-driven code-generation platform. You describe your
domain once (entities, attributes, enums, packages) and templates regenerate
the rest of your codebase whenever the model changes.

The package bundles the CLI, the tRPC server, and a pre-built Vue/Vuetify/Monaco
SPA into a single npm artifact. Run it without installing:

```bash
npx xomda-js
```

> The npm package is `xomda-js`. The installed CLI binary is `xomda` — so
> after `npm i xomda-js` you call `xomda generate`, `xomda preview`, etc.
> Using `npx`, both `npx xomda-js` and (after one install) `npx xomda` work.

## Quick start

```bash
npx xomda-js              # start the server + SPA on :6431
xomda generate            # write generated files to disk
xomda preview [--json]    # show generated output without writing
xomda diff [--json]       # show which generated files differ from disk
xomda wrapper [--pin V]   # create xomdaw / xomdaw.cmd to pin a version per repo
xomda serve [--port N] [--open]
```

All subcommands take `--root <path>` to point at a project directory other than
the current one. Press `O` in the running server's terminal to open your
browser, or pass `--open` to do that automatically. `--port <number>` overrides
the default port.

## Requirements

- Node.js **22.6+** (native ESM + modern crypto/path APIs).
- For the SPA, a modern browser with `<script type="importmap">` support
  (Chrome 89+, Firefox 108+, Safari 16.4+).

---

## For AI coding assistants — read this

If you are an AI coding agent (Claude, Cursor, Copilot, Windsurf, Cline/Roo,
Junie, …) and a project depends on `xomda-js`, **stop and read this section
before generating, editing, or "fixing" any xomda artifacts.** Done right,
xomda lets you create huge amounts of correct, consistent code from a tiny
amount of input. Done wrong (inventing fields, mistyping cells, putting Java
types in the model), every generated file becomes wrong at once.

The deep references below are bundled inside this package — read them from
`node_modules/xomda-js/docs/.ai/`. They are the source of truth.

### The two-tier mental model

- **Tier 1 — xomda itself.** The engine that reads a model plus templates and
  emits files. You don't touch tier 1 from a downstream project.
- **Tier 2 — what the user owns and you author for them.**
  - `.xomda/model.json` — the domain model (language-neutral).
  - `.xomda/templates/**/*.template.json` — cell-based templates that turn the
    model into source files.

### The authoring loop

```
edit .xomda/model.json   ─┐
edit .xomda/templates/   ─┤
                          ▼
                 xomda preview      ← inspect what would be written
                 xomda diff         ← see what differs from disk
                 xomda generate     ← write to disk
```

### Hard rules — do not violate

1. **`.xomda/model.json` is language-neutral.** Primitive `attribute.type`
   values are lowercase: `string`, `number`, `boolean`, `date`, `uuid`,
   `decimal`. Anything else names another `entity` or `enum`. Never put
   `BigDecimal`, `java.time.Instant`, `String`, framework annotations, etc.
   in the model — those decisions belong in templates.
2. **Every element has a `id` UUIDv4.** Generate fresh UUIDs for new
   entities/attributes/enums/values/packages. Don't reuse, don't leave blank,
   don't use placeholders like `"new-entity-1"`.
3. **Array order is display order.** There is no `elementsOrder[]` field
   anywhere — `packages[]`, `entities[]`, `enums[]`, `attributes[]`,
   `values[]` render in their literal array order.
4. **Names are unique within scope.** Inside one package, sibling packages
   + entities + enums must be mutually unique. Attribute names unique within
   their entity, enum values unique within their enum. Case-sensitive.
5. **Don't invent schema fields.** Schemas are Zod and `.loose()`, so unknown
   fields *persist* but the UI won't show them and they won't drive
   generation. If you need a new concept, add it to a template, not the
   model.
6. **The CLI binary is `xomda`, not `xomda-js`.** Call `npx xomda-js` (one
   shot) or `xomda <subcommand>` (after install). If the project has a
   pinned wrapper, use `./xomdaw` instead.

### How to become a master of xomda

Read these in order. Each is short and focused; together they are everything
you need to author advanced models and templates.

| File | Read it when… |
| --- | --- |
| [`AGENTS.md`](./AGENTS.md) | First. One-screen orientation + rule recap. |
| [`docs/.ai/AGENT_GUIDE.md`](./docs/.ai/AGENT_GUIDE.md) | You want the longer "what is xomda, how do I think about it" intro. |
| [`docs/.ai/model-format.md`](./docs/.ai/model-format.md) | Before you touch `.xomda/model.json`. Every field, every constraint, every default. |
| [`docs/.ai/template-format.md`](./docs/.ai/template-format.md) | Before you write or edit a `*.template.json`. The cell catalog, the Handlebars helper library, the loop sources, a worked example. |
| [`docs/.ai/cli-reference.md`](./docs/.ai/cli-reference.md) | When you need to know what a subcommand reads, writes, or prints. |
| [`docs/.ai/integrations.md`](./docs/.ai/integrations.md) | When the project uses the unplugin, the VS Code extension, or a JVM build-tool integration. |

### Tips that aren't obvious until you've been burned

- **Run `xomda preview --json` before `xomda generate`** when you're not 100%
  sure of a template's output. `preview` is read-only and structured; you can
  inspect every file path and content the model would produce.
- **Use `xomda diff` after a model edit** to see exactly which generated
  files are affected. Cheap correctness signal.
- **Look at the user's existing templates first.** Pattern-match the cell
  shapes they already use before inventing a new style. Their templates
  encode project conventions the model doesn't capture.
- **Cell types are exact strings.** `loop`, `logic`, `handlebars`, `output`.
  Typos silently produce empty output — the schema accepts unknown cells in
  loose mode but the engine skips them.
- **A `loop` over entities iterates *every* entity across *every* package*,
  flattened. If you want only one package's entities, scope the loop to that
  package — don't filter inside a `logic` cell.
- **`output` cells declare a file path.** Path collisions mean later cells
  overwrite earlier ones — usually a bug. Use `{{name}}` / `{{snakecase
  name}}` etc. to keep paths unique per entity.
- **Multi-model / multi-project loops.** `loopSource: 'models'` and
  `loopSource: 'projects'` exist so a single template can iterate across
  multiple models/projects. They degrade to a singleton when only one
  exists, so writing templates this way is safe even in simple projects.

## License

[MIT](./LICENSE) © Joris Aerts.

See the [project homepage](https://github.com/xomda/xomda-js) for source,
issues, and contribution guidelines.
