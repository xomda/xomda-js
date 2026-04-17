# Data Model

This document specifies the structure of a xomda model: the types stored in `.xomda/model.json`, their fields, and
how the file is laid out on disk. For the ideas behind the model see [Concepts](./concepts.md); for how templates
consume it see [Templates](./templates.md).

All types are **open**: tier-2 users can extend them with extra fields, and those fields round-trip losslessly
through xomda's serialization.

## Model

The root container. Every xomda project has exactly one model.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Display name. Default: `Untitled Model`. |
| `version` | string | Semver. Default: `1.0.0`. |
| `packages` | Package[] | Top-level packages. |
| `entities` | Entity[] | Entities defined at the model root. |
| `enums` | Enum[] | Enums defined at the model root. |
| `elementsOrder` | UUID[] | Explicit ordering for top-level elements; drives stable serialization. |
| `createdAt` | ISO datetime | |
| `updatedAt` | ISO datetime | |

## Package

A hierarchical namespace. Packages can nest indefinitely.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Unique among siblings. |
| `packages` | Package[] | Nested child packages. |
| `entities` | Entity[] | Entities defined in this package. |
| `enums` | Enum[] | Enums defined in this package. |
| `elementsOrder` | UUID[] | Orders entities, enums, and sub-packages within this package. |
| `description` | string? | Optional free text. |

## Entity

A named data type with a list of typed attributes — equivalent to a class or record in most languages.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Unique within its package. |
| `attributes` | Attribute[] | Ordered; attribute names must be unique within the entity. |
| `description` | string? | Optional free text. |
| `extends` | UUID? | Parent entity whose attributes are inherited. |
| `abstract` | boolean | When true, the entity is a blueprint and should not be instantiated directly. |

## Attribute

A single field on an entity.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Unique within the entity. |
| `type` | string | See *Attribute type system* below. |
| `required` | boolean | Default `false`. |
| `multiValue` | boolean | Holds a list of values when true. Default `false`. |
| `primaryKey` | boolean | Default `false`. |
| `unique` | boolean | Default `false`. |
| `uniqueScope` | `'global' \| 'parent'` | Only when `unique` is true. `parent` enforces uniqueness among siblings within the parent container. |
| `reference` | boolean | When true and the type names another entity, stores a UUID reference rather than embedding the entity inline. Default `false`. |
| `defaultValue` | string? | Optional default as a string. |
| `description` | string? | Optional free text. |

### Attribute type system

The `type` field of an attribute is a plain string. The recognised values are:

- **Primitives**: `string`, `number`, `boolean`, `Date`, `UUID`, `decimal`.
- **Entity reference**: the name of another entity in the model. With `reference: true` the attribute stores a UUID;
  with `reference: false` (default) the entity is embedded inline.
- **Enum reference**: the name of an enum in the model. The attribute stores one of the enum's values.

Type names are resolved by name at code-generation time, not by UUID. This keeps templates readable.

## Enum

An enumeration type.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Unique within its package. |
| `values` | EnumValue[] | Each has an `id` (UUID) and a `name`. |
| `description` | string? | Optional free text. |

## File layout

Every xomda project has a `.xomda/` folder at its root:

```
.xomda/
├── model.json       # the serialised model
└── templates/       # cell-based templates (*.template.json), optionally grouped in sub-folders
```

Override the location with the `XOMDA_DIR` environment variable (default: `.xomda`).

## On-disk format

`model.json` is human-readable and safe to check into version control. Two design choices keep it diff-friendly:

- **Deterministic ordering.** `elementsOrder` arrays on `Model` and `Package` hold explicit UUIDs that control the
  serialization order of all child elements. Reordering in the UI changes one array; it does not shuffle objects
  throughout the file.
- **Definition-order arrays.** Entities, enums, and packages are stored as arrays in definition order; their position
  in the file matches `elementsOrder`.

## Worked example

```json
{
  "id": "…",
  "name": "MyDatabase",
  "version": "1.0.0",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "packages": [
    {
      "id": "…",
      "name": "domain",
      "entities": [
        {
          "id": "…",
          "name": "User",
          "attributes": [
            { "id": "…", "name": "id", "type": "UUID", "primaryKey": true, "required": true },
            { "id": "…", "name": "email", "type": "string", "required": true, "unique": true }
          ]
        }
      ],
      "enums": [],
      "packages": [],
      "elementsOrder": ["…"]
    }
  ],
  "entities": [],
  "enums": [],
  "elementsOrder": ["…"]
}
```

## See also

- [Concepts](./concepts.md) — what the primitives mean and why they exist.
- [Templates](./templates.md) — how generators consume the model.
- [API](./api.md) — the tRPC procedures that mutate the model at runtime.
