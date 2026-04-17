# Template format — AI reference

Reference for authoring `*.template.json` files under `.xomda/templates/`. A
template is a **tree of cells** that runs top-to-bottom; cells share a
context as they go. The longer human-oriented version is `docs/templates.md`
in the xomda repository.

## File location

Anywhere under `.xomda/templates/` (override the root with `XOMDA_DIR`).
Sub-folders become the `folder` field on the loaded template, surfacing as
groupings in the UI but having no effect on generation.

## Top-level shape

```ts
{
  uuid: UUID,             // stable template identity
  name: string,
  description?: string,
  version: string,        // semver
  folder?: string,        // optional grouping (also derivable from path)
  scope?: 'Entity' | 'Enum' | 'Package',  // legacy fallback — prefer a loop cell
  extends?: UUID,         // parent template this one inherits from (no resolver yet — UI metadata)
  disabled?: boolean,     // when true, skipped during code generation
  cells: Cell[],          // ordered, top-to-bottom
}
```

## Cell shape

```ts
{
  uuid: UUID,
  type: 'loop' | 'loop-logic' | 'logic' | 'handlebars' | 'buffer' | 'markdown' | 'output',
  content: string,        // source (JS / Handlebars / markdown / "" for output)
  variableName?: string,  // bind cell output (or per-iteration value) to a name
  // loop / loop-logic only:
  loopSource?: 'entities' | 'enums' | 'packages' | 'javascript' | 'diff-*',
  loopFilter?: string,    // JS predicate run before iteration (TS-side only today; JVM round-trips)
  children?: Cell[],      // executed once per yielded item
  // output only:
  outputType?: 'file' | 'context',  // dispatch: 'file' (default) writes a file; 'context' stashes
                                    // into variables[outputContent] without consuming buffers
  outputFilename?: string,  // Handlebars expression — rendered against current ctx
  outputDirectory?: string, // optional path prefix prepended to the rendered outputFilename
  outputContent?: string,   // variable name to read for the file body (default: buffers)
}
```

## Cell types

| Type | Purpose |
| --- | --- |
| `loop` | Iterate a built-in source (`entities` / `enums` / `packages`). `children` run once per item; `variableName` binds the current item (e.g. `$entity`). Loops nest. |
| `loop-logic` | Like `loop` but `content` is a JavaScript generator function yielding items. Sees outer loop variables as parameters. |
| `logic` | JavaScript executed in the shared context. Top-level `name = …` (no `let`/`const`) exposes the variable to later cells. |
| `handlebars` | Handlebars template string rendered with the current context. Output appends to the current cell's `$out` buffer. With `variableName`, the rendered string is also bound. |
| `buffer` | Named accumulator (rare). |
| `markdown` | Documentation only — does nothing at runtime. |
| `output` | Declares an emitted file. `outputFilename` is itself a Handlebars expression (evaluated against the current context). Body is either `outputContent`'s variable value or the concatenation of preceding cell `$out` buffers. |

## Where `output` cells live

| Where | Result |
| --- | --- |
| Inside a `loop` (a child of the loop) | One file per iteration. Each iteration's preceding buffers feed that iteration's file. |
| Sibling of a loop (after it) | One file with the concatenation of every iteration's unconsumed buffers — the "total" of the loop. |
| At the root, no loop above it | One file from the root buffers. |

A second `output` cell at the same level only consumes what was written
between the two outputs (each `output` consumes the buffer behind it).

## Handlebars helper library

Built-in helpers (compatible with `handlebars.java` for JVM template
parity):

**String transforms:**
`camelCase`, `pascalCase`, `snakeCase`, `kebabCase`, `constantCase`,
`upperCase`, `lowerCase`

**Comparisons:**
`eq`, `ne`, `and`, `or`, `not`

**Array operations:**
`join`, `first`, `last`

**Domain helpers:**
- `required` — filter only required attributes
- `primaryKeys` — filter only primary-key attributes

**Model traversal helpers:**
- `isPrimitive type` — true when `type` is one of the six built-in
  primitives (`string`, `number`, `boolean`, `date`, `uuid`, `decimal`).
  Lowercase only — legacy PascalCase aliases are rejected.
- `nonPrimitiveTypes attrs` — unique list of non-primitive type names
  referenced by `attrs`, excluding self-references and any attribute with
  `reference: true` (those store UUIDs, not embedded values).
- `isSelfRef entityName attrs` — true when an entity has an attribute
  whose `type` is the entity's own name AND `reference !== true` (a
  recursive embed, not a reference-by-id).

Target-language type mappings (`stringType: 'String'` in Java vs `'string'`
in TypeScript) belong in the template's own `logic` cells, not in helpers.

## Worked example — one file per entity

```json
{
  "uuid": "f951ceda-977a-4caa-b47e-405d7fcf488b",
  "name": "Java POJO",
  "version": "1.0.0",
  "folder": "Java",
  "cells": [
    {
      "uuid": "11111111-1111-4111-8111-111111111111",
      "type": "loop",
      "loopSource": "entities",
      "variableName": "$entity",
      "content": "",
      "children": [
        {
          "uuid": "22222222-2222-4222-8222-222222222222",
          "type": "logic",
          "content": "const javaMap = { string: 'String', number: 'Integer', boolean: 'Boolean', date: 'Date', uuid: 'UUID', decimal: 'BigDecimal' };\nfields = (attributes || []).map(a => ({\n  camel: camelCase(a.name),\n  pascal: pascalCase(a.name),\n  type: javaMap[a.type] || pascalCase(a.type)\n}));"
        },
        {
          "uuid": "33333333-3333-4333-8333-333333333333",
          "type": "logic",
          "content": "fieldDecls = fields.map(f => '  private ' + f.type + ' ' + f.camel + ';').join('\\n');"
        },
        {
          "uuid": "44444444-4444-4444-8444-444444444444",
          "type": "handlebars",
          "content": "public class {{pascalCase name}} {\n\n{{{fieldDecls}}}\n\n}\n"
        },
        {
          "uuid": "55555555-5555-4555-8555-555555555555",
          "type": "output",
          "outputFilename": "{{pascalCase name}}.java",
          "content": ""
        }
      ]
    }
  ]
}
```

For each entity: precompute typed fields → render the class body → emit one
`<EntityName>.java` per entity.

## Worked example — one bundle for all entities

Move the `output` cell **outside** the loop:

```json
{
  "uuid": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "name": "Schemas (bundled)",
  "version": "1.0.0",
  "cells": [
    {
      "uuid": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "type": "loop",
      "loopSource": "entities",
      "variableName": "$entity",
      "content": "",
      "children": [
        {
          "uuid": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "type": "handlebars",
          "content": "export const {{pascalCase name}}Schema = z.object({})\n"
        }
      ]
    },
    {
      "uuid": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "type": "output",
      "outputFilename": "schemas.ts",
      "content": ""
    }
  ]
}
```

The loop writes one line per entity into its buffer; the outer `output`
consumes the lot and emits a single `schemas.ts`.

## Patterns to follow

- **Generate UUIDv4 for every new cell and template.** `crypto.randomUUID()`.
- **Loop, don't `scope`.** New templates should use a `loop` cell — `scope`
  is the legacy fallback for old templates only.
- **Type maps in `logic` cells, not in helpers.** Helpers stay generic;
  target-language types are template-local.
- **Variables in `logic` cells are top-level assignments.** Use `name = …`,
  not `let name = …` or `const name = …` (those don't escape the cell).
- **Iteration variables are auto-bound.** Inside `loop: entities`, every
  entity field is in scope (`name`, `attributes`, `description`, …), so
  `{{name}}` and `{{pascalCase name}}` work directly — you don't need
  `{{$entity.name}}` unless an outer loop shadows it.
- **Triple-stash for raw HTML/JS.** `{{{fieldDecls}}}` doesn't HTML-escape;
  `{{name}}` does.

## What NOT to do

- Don't write Java types, TS types, Zod types into the **model**
  (`attribute.type`). Map them in templates.
- Don't reuse another template's `uuid`. Generate a new one.
- Don't put generated output paths outside the project root. By default
  the engine refuses writes outside `project.settings.restrictWritesToProjectRoot`.
- Don't put I/O in `logic` cells. They run inside the engine; no
  `process.cwd()`, no `fetch`, no `fs`. Pure computation.
