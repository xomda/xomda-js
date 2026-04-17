# Data Model

This document specifies the structure of a xomda model: the types stored in `.xomda/model.json`, their fields, and
how the file is laid out on disk. For the ideas behind the model see [Concepts](./concepts.md); for how templates
consume it see [Templates](./templates.md).

All types are **open**: tier-2 users can extend them with extra fields, and those fields round-trip losslessly
through xomda's serialization.

## Model

The root container. A project hosts one **primary model** at `.xomda/model.json` plus any number of **secondary
models** at `.xomda/models/<id>.json`. Both kinds share the same `Model` shape; the primary is just the canonical
default that the selector falls back to when no model id is supplied. See [File layout](#file-layout) and the
`Selector` shape used by every router call.

| Field           | Type         | Notes                                                                  |
| --------------- | ------------ | ---------------------------------------------------------------------- |
| `id`            | UUID         |                                                                        |
| `name`          | string       | Display name. Default: `Untitled Model`.                               |
| `version`       | string       | Semver. Default: `1.0.0`.                                              |
| `packages`      | Package[]    | Top-level packages.                                                    |
| `entities`      | Entity[]     | Entities defined at the model root.                                    |
| `enums`         | Enum[]       | Enums defined at the model root.                                       |
| `blueprints`    | Blueprint[]? | Optional. Top-level shared attribute bundles. Entities `include` them by UUID. |
| `versions`      | VersionsIndex? | Optional per-model version history. Coexists with the legacy project-level `ProjectFile.versions` field; new writes target this per-model index. |
| `elementsOrder` | UUID[]       | Explicit ordering for top-level elements; drives stable serialization. |
| `createdAt`     | ISO datetime |                                                                        |
| `updatedAt`     | ISO datetime |                                                                        |

## Package

A hierarchical namespace. Packages can nest indefinitely.

| Field           | Type      | Notes                                                         |
| --------------- | --------- | ------------------------------------------------------------- |
| `id`            | UUID      |                                                               |
| `name`          | string    | Unique among siblings.                                        |
| `packages`      | Package[] | Nested child packages.                                        |
| `entities`      | Entity[]  | Entities defined in this package.                             |
| `enums`         | Enum[]    | Enums defined in this package.                                |
| `blueprints`    | Blueprint[]? | Optional. Shared attribute bundles declared in this package. Entities `include` them by UUID. |
| `elementsOrder` | UUID[]    | Orders entities, enums, and sub-packages within this package. |
| `description`   | string?   | Optional free text.                                           |
| `visibility`    | `'public' \| 'package-private' \| 'model-private'`? | Visibility across the project graph. Absent reads as `public` for legacy packages. New packages created via the router default to `package-private`. See [Visibility](#visibility). |

## Entity

A named data type with a list of typed attributes — equivalent to a class or record in most languages.

| Field         | Type        | Notes                                                                         |
| ------------- | ----------- | ----------------------------------------------------------------------------- |
| `id`          | UUID        |                                                                               |
| `name`        | string      | Unique within its package.                                                    |
| `attributes`  | Attribute[] | Ordered; attribute names must be unique within the entity.                    |
| `description` | string?     | Optional free text.                                                           |
| `extends`     | UUID?       | Parent entity whose attributes are inherited. Allowed parent kind table below. |
| `kind`        | `'default' \| 'abstract' \| 'interface'` | Entity kind. Defaults to `'default'` on parse — every entity has exactly one effective kind. |
| `implements`  | UUID[]?     | UUIDs of `interface` entities this entity composes. Allowed for `default` and `abstract`; forbidden on `interface`. |
| `includes`    | UUID[]?     | UUIDs of Blueprints this entity composes — their attributes are folded into the entity's effective attribute list. |
| `visibility`  | `'public' \| 'package-private' \| 'model-private'`? | Visibility across the project graph. Same defaults as Package. |

Allowed `extends` parent-kind table:

| Child kind | Allowed parent kind |
| ---------- | ------------------- |
| `default`  | `abstract`          |
| `abstract` | `abstract`          |
| `interface`| `interface`         |

`implements` targets must be `interface`. Cycles across the combined
`extends` + `implements` graph are rejected.

## Blueprint

A named bundle of attributes that entities can `include` to fold those
attributes into their effective attribute list. Blueprints are **not** an
entity kind — distinct from `interface`:

- `interface` is a typed contract that an implementer satisfies with its
  own (or inherited) attributes — validated by the contract checker.
- `Blueprint` is a literal attribute bundle merged into the including
  entity's effective shape.

| Field         | Type        | Notes                                                                                          |
| ------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `id`          | UUID        |                                                                                                |
| `name`        | string      | Unique within its parent (Model or Package).                                                   |
| `attributes`  | Attribute[] | Names must be unique within the blueprint.                                                     |
| `description` | string?     |                                                                                                |
| `visibility`  | `'public' \| 'package-private' \| 'model-private'`? | Same semantics as Entity / Package visibility. |

Blueprints live at Model level (`Model.blueprints`) and Package level
(`Package.blueprints`). They are flat — they do not include other
blueprints. The effective-attributes resolver folds them into including
entities at codegen time.

## Attribute

A single field on an entity.

| Field          | Type                   | Notes                                                                                                                          |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`           | UUID                   |                                                                                                                                |
| `name`         | string                 | Unique within the entity.                                                                                                      |
| `type`         | string                 | See _Attribute type system_ below.                                                                                             |
| `required`     | boolean                | Default `false`.                                                                                                               |
| `multiValue`   | boolean                | Holds a list of values when true. Default `false`.                                                                             |
| `primaryKey`   | boolean                | Default `false`.                                                                                                               |
| `unique`       | boolean                | Default `false`.                                                                                                               |
| `uniqueScope`  | `'global' \| 'parent'` | Only when `unique` is true. `parent` enforces uniqueness among siblings within the parent container.                           |
| `aggregation`  | `'composite' \| 'none'`? | UML 2 aggregation kind. Only meaningful when `type` resolves to an Entity (rejected on primitives and the `enum` meta-type). `'composite'` = parent owns the related instances (embedded); `'none'` = plain association (UUID reference). Combined with `multiValue` expresses one-to-many, many-to-many, one-to-one, many-to-one. When omitted on entity-typed attrs the runtime treats it as composite. Form-created attrs seed from the meta-model's `defaultValue: 'none'`. Legacy `reference: boolean` is migrated automatically on read. |
| `defaultValue` | string?                | Optional default as a string.                                                                                                  |
| `description`  | string?                | Optional free text.                                                                                                            |
| `targetEntity` | UUID?                  | UUID of the Entity this attribute references. Used when `type === 'entity'`; rejected on other types.                          |
| `targetEnum`   | UUID?                  | UUID of the Enum this attribute references. Used when `type === 'enum'`; rejected on other types.                              |
| `length`       | int ≥ 0?               | Max length for `type === 'string'`. Codegen hint.                                                                              |
| `precision`    | int ≥ 0?               | Total digit count for `type === 'decimal'` (SQL precision).                                                                    |
| `scale`        | int ≥ 0?               | Digits after the decimal point for `type === 'decimal'`. Must not exceed `precision` when both are set.                        |

### Attribute type system

The `type` field of an attribute is a plain string on the wire. Recognised
values are exposed through the `ATTRIBUTE_TYPES` constant in `@xomda/core`:

- **Primitives**: `string`, `number`, `boolean`, `date`, `uuid`, `decimal`.
- **Meta-types** (typed references via paired UUID fields):
  - `entity` — pair with `targetEntity: UUID` referencing the Entity.
  - `enum`   — pair with `targetEnum: UUID` referencing the Enum.
  - `package`, `attribute` — reserved meta-types used by Xomda's own
    self-bootstrap (e.g. an Attribute on an Attribute meta-entity).
- **Legacy name-based references**: any string not in the recognised set
  is treated as the name of another Entity or Enum in scope. With
  `aggregation: 'none'` the attribute stores a UUID at runtime; with
  `aggregation: 'composite'` (or unset on an entity type) the named
  entity is embedded inline. Resolves by name at code-generation time.
  Kept for backwards compatibility — new code should use the typed
  `entity`/`enum` form with a UUID target.

## Visibility

`Entity`, `Package`, and `Blueprint` carry an optional `visibility` field.
Three levels:

- `public`           — visible across the entire project graph (current
                       project + parent-project chain).
- `package-private`  — visible within the defining package and its
                       descendant packages, across all models in the
                       same project.
- `model-private`    — visible only within the defining model.

Effective visibility narrows against the containing-package chain:
`MIN(target.visibility, parent.visibility, …)`. Cross-model and
cross-project lookups consult the effective visibility — same-model
lookups always succeed regardless of declared visibility.

Legacy elements (no `visibility` key) read as `public`. New elements
created through the router default to `package-private`.

## Enum

An enumeration type.

| Field         | Type        | Notes                                 |
| ------------- | ----------- | ------------------------------------- |
| `id`          | UUID        |                                       |
| `name`        | string      | Unique within its package.            |
| `values`      | EnumValue[] | Each has an `id` (UUID) and a `name`. |
| `description` | string?     | Optional free text.                   |

## File layout

Every xomda project has a `.xomda/` folder at its root:

```
.xomda/
├── model.json       # the primary model
├── models/          # secondary models, one file per model
│   └── <uuid>.json
├── project.json     # project metadata (see below)
├── templates/       # cell-based templates (*.template.json), optionally grouped in sub-folders
└── history/         # version snapshots (v-<uuid>.json), referenced from project.json.versions
```

### Selecting a model

Every tRPC procedure that targets a model accepts an optional selector:

```ts
Selector = { root?: string; modelId?: string }
```

- omit `modelId` → operate on the primary at `.xomda/model.json`;
- pass `modelId` → operate on the named model, whether it is the primary or a secondary under `.xomda/models/`.

Schema source of truth: `SelectorSchema` in `@xomda/core`.

Override the location with the `XOMDA_DIR` environment variable (default: `.xomda`).

### `project.json`

Holds the project's identity, version history index, sandbox setting, and the
active analysis-plugin list. Stable on disk — sorted plugin arrays minimise diff
churn.

| Field                                  | Type          | Notes                                                                                                                                          |
| -------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                 | string        | Display name shown as the home-page hero. Required.                                                                                            |
| `description`                          | string?       | Optional free text.                                                                                                                            |
| `parentProject`                        | string?       | Optional relative path to a parent xomda project. The project-graph loader walks the chain (default depth 32) and merges visible entities, enums, and blueprints across projects. Path-traversal guarded by `settings.restrictReadsToProjectRoot`. |
| `versions`                             | VersionsIndex | Project-level version history. Kept for backwards compatibility; new writes prefer per-model `Model.versions`.                                |
| `settings.restrictWritesToProjectRoot` | boolean       | When `true` (default), generation refuses to write files outside the project root.                                                             |
| `settings.restrictReadsToProjectRoot`  | boolean       | When `true` (default), the project-graph resolver rejects `parentProject` paths that escape the project root. Set false to enable cross-repo workspaces. |
| `plugins`                              | string[]      | Sorted, deduplicated analysis-plugin ids that are active for this project. Empty = auto-mode (every detected plugin contributes).              |

The file is created on demand by the Settings page (`project.updateMeta`) or on
first plugin refresh (`project.refreshPlugins`). If only a legacy
`.xomda/versions.json` exists on first read, it is migrated into `project.json`
(name defaults to the folder basename) and the legacy file is removed.

Schema source of truth: `ProjectFileSchema` in `@xomda/core`.

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
