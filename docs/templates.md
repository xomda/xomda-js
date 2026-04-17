# Templates

This document describes xomda's template format: how a `*.template.json` is structured, the cell types it can
contain, the helper library available in Handlebars cells, and a complete worked example. For the data the templates
operate on, see [Data model](./data-model.md).

## Mental model

A template is a **tree** of cells, executed top-to-bottom at each level. Cells share a context as they run: logic
cells set variables, handlebars cells consume them and emit text, output cells declare files. Loop cells nest other
cells beneath themselves and run them once per yielded item — the natural place to author per-entity, per-enum, or
per-arbitrary-thing generators.

Templates are stored in `.xomda/templates/`, optionally grouped in sub-folders (which become `folder` metadata on
the template). The file extension is `*.template.json`.

## Cell types

| Type         | Purpose                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loop`       | Declares the iteration unit. Picks a model collection (`entities`, `enums`, `packages`) or runs JavaScript that returns an item list. The cell's `children` execute once per yielded item, with the iteration variable bound. Loops may be nested inside loops. |
| `loop-logic` | Same as `loop` but with arbitrary JavaScript (a generator function) instead of a built-in source. The generator can read the surrounding loop variables.                                                                                                        |
| `logic`      | JavaScript code that runs in the shared context. Assigning a name (`fields = …`) exposes a variable to subsequent cells.                                                                                                                                        |
| `handlebars` | A Handlebars template string rendered with the current context. The rendered string is appended to the cell's `$out` buffer and (if `variableName` is set) bound to a named variable.                                                                           |
| `buffer`     | Named accumulator. Rarely needed.                                                                                                                                                                                                                               |
| `markdown`   | Documentation only; does not affect context or output.                                                                                                                                                                                                          |
| `output`     | Declares an emitted file. `outputFilename` is itself a Handlebars expression. The file's contents are either the value of a variable named by `outputContent`, or the concatenation of all preceding cell `$out` buffers.                                       |

### Where output cells live, and what they emit

| Where                             | What happens                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Inside a loop's `children`        | One file per iteration. The cell consumes the buffers written within that iteration; nothing bubbles up. |
| After a loop (sibling, not child) | One file with the concatenation of every iteration's unconsumed buffers — the "total" of the loop.       |
| At the root (no surrounding loop) | One file from the root buffers, as before.                                                               |

A second `output` cell at the same level emits whatever was written between the two outputs (file outputs consume the
buffers they write). Use `outputType: 'context'` to snapshot the current buffer into a named variable without
consuming it.

For backwards compatibility, a template without any loop cell falls back to the legacy `template.scope` field
(`Entity` / `Enum` / `Package`). Without that, the template runs once over the whole model. New templates should use
loop cells.

## Template metadata

| Field         | Notes                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| `uuid`        | UUID.                                                                       |
| `name`        | Display name.                                                               |
| `description` | Optional free text.                                                         |
| `version`     | Semver string.                                                              |
| `scope`       | Optional legacy `Entity` / `Enum` / `Package` fallback. Prefer a loop cell. |
| `folder`      | Optional sub-folder for grouping in the templates view.                     |
| `cells`       | Ordered tree of cells.                                                      |

## Cell metadata

| Field            | Notes                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`           | UUID.                                                                                                                                                       |
| `type`           | One of `loop`, `loop-logic`, `logic`, `handlebars`, `buffer`, `markdown`, `output`.                                                                         |
| `content`        | The cell's source (JS code, Handlebars string, or markdown text).                                                                                           |
| `variableName`   | Optional. Binds the cell's output (or the per-item value, for loop cells) to a named variable.                                                              |
| `loopSource`     | Loop cell only: `entities`, `enums`, `packages`, `javascript`, or one of the `diff-*` sources.                                                              |
| `children`       | Loop cell only: nested cells executed per iteration.                                                                                                        |
| `outputFilename` | Output cell only. Rendered as a Handlebars expression.                                                                                                      |
| `outputContent`  | Output cell only. Variable name whose value becomes the file content.                                                                                       |
| `outputType`     | Output cell only. `'file'` (default) emits a file and consumes buffers; `'context'` snapshots into the variable named by `outputContent` without consuming. |

Each cell has a collapsible preview panel: logic cells show the resulting context as JSON; handlebars cells show the
rendered string; output cells show the resolved file path. Loop cells render their `children` as an indented sub-tree
in the editor.

## Handlebars helper library

Helpers stay generic — target-language type maps (Java types, Zod types, etc.) belong in the template's own logic
cells, not in helpers.

**String transformations** (compatible with handlebars.java):

- `camelCase`, `pascalCase`, `snakeCase`, `kebabCase`, `constantCase`
- `upperCase`, `lowerCase`

**Comparisons**: `eq`, `ne`, `and`, `or`, `not`.

**Array operations**: `join`, `first`, `last`.

**Domain-specific**:

- `required` — filter only required attributes.
- `primaryKeys` — filter only primary-key attributes.

## Worked example: a per-entity Java POJO

```json
{
  "uuid": "f951ceda-977a-4caa-b47e-405d7fcf488b",
  "name": "Main Template (Java)",
  "version": "1.0.0",
  "folder": "Java",
  "cells": [
    {
      "uuid": "…",
      "type": "loop",
      "loopSource": "entities",
      "variableName": "$entity",
      "content": "",
      "children": [
        {
          "uuid": "…",
          "type": "logic",
          "content": "const javaMap = { string: 'String', number: 'Integer', boolean: 'Boolean', decimal: 'BigDecimal', uuid: 'UUID' };\nfields = (attributes||[]).map(a => ({ camel: camelCase(a.name), pascal: pascalCase(a.name), type: javaMap[a.type] || pascalCase(a.type) }));"
        },
        {
          "uuid": "…",
          "type": "logic",
          "content": "fieldDecls = fields.map(f => '  private ' + f.type + ' ' + f.camel + ';').join('\\n');"
        },
        {
          "uuid": "…",
          "type": "handlebars",
          "content": "public class {{pascalCase name}} {\n\n{{{fieldDecls}}}\n\n}\n"
        },
        {
          "uuid": "…",
          "type": "output",
          "outputFilename": "{{pascalCase name}}.java",
          "content": ""
        }
      ]
    }
  ]
}
```

The loop cell makes this run once per entity. The two logic cells precompute language-specific strings; the
handlebars cell is a thin presentation layer; the output cell — sitting inside the loop — writes one file per entity.

## Worked example: a single bundled output for all entities

To generate one file containing every entity's schema, drop the output cell _after_ the loop (as a sibling, not a
child):

```json
{
  "uuid": "…",
  "name": "Schemas (bundled)",
  "version": "1.0.0",
  "cells": [
    {
      "uuid": "…",
      "type": "loop",
      "loopSource": "entities",
      "variableName": "$entity",
      "content": "",
      "children": [
        {
          "uuid": "…",
          "type": "handlebars",
          "content": "export const {{pascalCase name}}Schema = z.object({})\n"
        }
      ]
    },
    {
      "uuid": "…",
      "type": "output",
      "outputFilename": "schemas.ts",
      "content": ""
    }
  ]
}
```

The handlebars cell writes one line per iteration into the iteration's buffer; with no output cell inside the loop,
the buffers bubble up; the outer output cell consumes the lot and emits a single `schemas.ts`.

## Nested loops

Loop cells can be nested. Variables bound by the outer loop are visible inside the inner loop's children (and inside
a `loop-logic` generator function, which receives them as named parameters).

## Backwards compatibility

Older templates used a flat list of cells with a `provider` / `provider-logic` cell that controlled iteration. On
load, `normalizeTemplate` (in both `@xomda/template` and the JVM `generator-core`) rewrites such templates to the
hierarchical shape — `provider` becomes `loop`, `provider-logic` becomes `loop-logic`, `providerSource` becomes
`loopSource`, and every sibling cell after the loop becomes a child. Stored files do not need to be hand-edited; a
re-save via the UI (or via `scripts/migrate-templates-to-loop.mjs` at the repo root) bakes the migration into disk.

## Generation workflow

1. **Author a template** in the _Templates_ view (or by adding a `*.template.json` file under `.xomda/templates/`).
2. **Generate** in the _Generate_ view. xomda runs every template against the current model and writes the output
   files to disk.
3. **Preview** in the file browser, which shows generated files alongside real ones with a "G" chip.

## See also

- [Data model](./data-model.md) — the shape of the data your templates operate on.
- [Concepts](./concepts.md) — why the engine is structured this way.
- [API](./api.md) — programmatic template management via tRPC.
