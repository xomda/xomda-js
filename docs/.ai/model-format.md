# Model format — AI reference

Reference for authoring `.xomda/model.json`. Every field is named, typed, and
constrained. The schema source of truth is `@xomda/core` (Zod). The longer
human-oriented version of this is in `docs/data-model.md` of the xomda
repository.

## File location

`.xomda/model.json` at the project root. Override the parent directory with
the `XOMDA_DIR` env var (default `.xomda`).

### Multiple models per project

A project may carry **one primary model** plus zero or more **secondary
models**:

```
.xomda/
├── model.json              # primary — always loaded by the CLI default
└── models/
    ├── <uuid-a>.json       # secondary models, same `Model` schema
    └── <uuid-b>.json
```

The primary at `.xomda/model.json` is the only model `xomda generate`
operates on by default (and the only one the version-history /
Publish flow currently supports). Secondary models are first-class for
editing and template iteration but cannot be `commitVersion`'d — that
constraint is intentional and the router rejects mismatches with
`BAD_REQUEST`.

Templates iterate every model in the project via the `models` loop
source (see `template-format.md`). Cross-project iteration uses
`projects`. Both default-fallback to a single-model / single-project
list when only one exists, so existing templates keep working.

## Root: `Model`

```ts
{
  id: UUID,              // stable model identity
  name: string,          // display name (default "Untitled Model")
  version: string,       // free-form (default "1.0.0")
  packages: Package[],   // ALL packages live here; there is no top-level
                         // `entities[]` or `enums[]` — every entity and
                         // every enum lives inside a package.
  layout?: { [id: UUID]: LayoutEntry }, // diagram canvas positions; UUID → {x, y, width?, height?}
  createdAt?: ISODateTime,
  updatedAt?: ISODateTime,
}

// LayoutEntry — pixel coordinates on the diagram canvas. Width/height are
// only persisted for nodes the user has explicitly resized.
type LayoutEntry = { x: number; y: number; width?: number; height?: number }
```

`Model` is **open** (Zod `.loose()`): unknown keys round-trip losslessly.

## `Package`

Hierarchical namespace, nestable. Every entity and enum lives in some
package — there is no model-level entity/enum bucket.

```ts
{
  id: UUID,
  name: string,           // unique among siblings within parent
  packages: Package[],    // child packages
  entities: Entity[],
  enums:    Enum[],
  description?: string,
}
```

Sibling names across `packages` + `entities` + `enums` within a single
package must be unique (case-sensitive) — the schema's `superRefine` catches
collisions with attribution to the conflicting kind.

## `Entity`

A named record with attributes.

```ts
{
  id: UUID,
  name: string,             // unique within its package
  attributes: Attribute[],  // ordered, names unique within entity
  extends?: UUID,           // parent entity (inherits attributes)
  abstract?: boolean,       // default false — true = blueprint, not instantiated
  description?: string,
}
```

## `Attribute`

Single field on an entity.

```ts
{
  id: UUID,
  name: string,             // unique within entity
  type: string,             // see "Attribute types" below
  required?: boolean,       // default false
  multiValue?: boolean,     // default false — true = list of values
  primaryKey?: boolean,     // default false
  unique?: boolean,         // default false
  uniqueScope?: 'global' | 'parent',  // only meaningful when unique=true
  reference?: boolean,      // default false — true: store UUID, false: embed
  defaultValue?: string,    // serialized default value
  description?: string,
  /**
   * Open container for sub-data attached to this attribute. Type-specific
   * configuration goes here instead of as flat fields on every attribute.
   * Documented conventions (templates may add more keys):
   *   - validation: { minLength?, maxLength?, pattern?, ... }
   *   - reference:  { onDelete?: 'cascade' | 'restrict' | 'setNull', fkColumn? }
   *   - column:     { name?, length?, precision?, scale? }
   */
  config?: Record<string, unknown>,
}
```

### Attribute types

`type` is a plain string. Recognized primitive values — **all lowercase**:

| Type | Meaning |
| --- | --- |
| `string` | UTF-8 text |
| `number` | floating point |
| `boolean` | true/false |
| `date` | ISO datetime |
| `uuid` | UUIDv4 |
| `decimal` | exact decimal (target-language-specific in templates) |
| `<EntityName>` | reference to another entity by name (not by UUID) |
| `<EnumName>` | reference to an enum by name |

Legacy PascalCase (`Date`, `UUID`) is **not** accepted — `isPrimitiveType('Date')`
is false. Templates and meta-templates must use the lowercase form to round-
trip cleanly. Resolution of non-primitive `type` values is by name, not by
UUID — renaming an entity requires updating every attribute that points at
it.

## `Enum`

```ts
{
  id: UUID,
  name: string,             // unique within package
  values: EnumValue[],
  description?: string,
}
```

## `EnumValue`

```ts
{
  id: UUID,
  name: string,             // unique within enum
}
```

## Hard rules

1. **UUIDs are stable.** Once an element has an ID, that ID persists across
   renames, moves, and edits. Generate a fresh UUIDv4 for new elements
   (anywhere in JavaScript: `crypto.randomUUID()`).
2. **Names are scoped.** Sibling packages + entities + enums within a single
   package must be unique with each other (the schema enforces this across
   all three kinds in one pass). Attribute names are unique within their
   entity; enum-value names are unique within their enum. Case-sensitive.
3. **All entities and enums live under a package.** There is no `Model.entities`
   or `Model.enums` field. A "root" namespace is just a top-level package.
4. **Language-neutral.** `type` strings are domain types, not target-language
   types. Never `BigDecimal`, `java.time.Instant`, `tsstring`. Templates map
   domain types → target-language types.
5. **Open schemas — extra fields persist.** Unknown fields on any object
   round-trip through the loader (every schema uses Zod `.loose()`). They
   don't show in the UI, but they survive. Use sparingly; documented schema
   fields are the contract.
6. **Display order is array order.** The order in which entries appear in
   `packages[]` / `entities[]` / `enums[]` / `attributes[]` / `values[]`
   *is* the display order. There is no separate `elementsOrder[]` field.

## Minimal valid model

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "name": "Untitled",
  "version": "1.0.0",
  "packages": []
}
```

Even `createdAt` / `updatedAt` are optional — the storage layer stamps them
on write.

## Realistic example

```json
{
  "id": "9c5d4d6a-8f12-4d7a-9b8e-1a2b3c4d5e6f",
  "name": "Bookstore",
  "version": "1.0.0",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "packages": [
    {
      "id": "d1c2b3a4-5e6f-4a8b-9c0d-1e2f3a4b5c6d",
      "name": "domain",
      "packages": [],
      "enums": [],
      "entities": [
        {
          "id": "f7e6d5c4-b3a2-4908-9f6e-5d4c3b2a1908",
          "name": "Book",
          "attributes": [
            { "id": "11111111-1111-4111-8111-111111111111", "name": "id",     "type": "uuid",    "primaryKey": true, "required": true },
            { "id": "22222222-2222-4222-8222-222222222222", "name": "title",  "type": "string",  "required": true },
            { "id": "33333333-3333-4333-8333-333333333333", "name": "price",  "type": "decimal", "required": true },
            { "id": "44444444-4444-4444-8444-444444444444", "name": "author", "type": "Author",  "reference": true, "required": true }
          ]
        },
        {
          "id": "abcdef00-0000-4000-8000-000000000001",
          "name": "Author",
          "attributes": [
            { "id": "55555555-5555-4555-8555-555555555555", "name": "id",   "type": "uuid",   "primaryKey": true, "required": true },
            { "id": "66666666-6666-4666-8666-666666666666", "name": "name", "type": "string", "required": true }
          ]
        }
      ]
    }
  ],
  "layout": {
    "f7e6d5c4-b3a2-4908-9f6e-5d4c3b2a1908": { "x": 120, "y": 80 },
    "abcdef00-0000-4000-8000-000000000001": { "x": 420, "y": 80 }
  }
}
```
