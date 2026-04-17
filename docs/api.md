# API

xomda's backend (`@xomda/node`) exposes a tRPC router. The client consumes it with full end-to-end type safety; the
same router can be called from any tRPC-compatible client. Routers are namespaced under `model`, `template`, and
`file`.

## Usage

```typescript
// Backend — packages/model/src/router/index.ts
export const appRouter = router({
  model: modelRouter,
  template: templateRouter,
  file: fileRouter,
})

// Client — packages/client/src/router/index.ts (types auto-derived)
const model = await trpc.model.get.query()
await trpc.model.addEntity.mutate({ name: 'User', attributes: [] })
```

## `model.*`

CRUD over the model. Inputs are validated against the Zod schemas in `@xomda/core`.

### Basic

| Procedure | Description |
|---|---|
| `get()` | Returns the current model. |
| `save(model)` | Persists the entire model after validating against `ModelSchema`. |

### Entity

| Procedure | Description |
|---|---|
| `addEntity(packageId?, entity)` | Create an entity at the model root or inside a package. |
| `updateEntity(entity)` | Modify an entity anywhere in the hierarchy. |
| `deleteEntity(id)` | Remove an entity (recursive search). |
| `addAttribute(entityId, attribute)` | Add an attribute to an entity. |
| `updateAttribute(attribute)` | Modify an attribute. |
| `deleteAttribute(entityId, attributeId)` | Remove an attribute. |
| `reorderAttributes(entityId, attributeIds)` | Reorder an entity's attributes. |

### Enum

| Procedure | Description |
|---|---|
| `addEnum(packageId?, enum)` | Create an enum at the model root or inside a package. |
| `updateEnum(enum)` | Modify an enum. |
| `deleteEnum(id)` | Remove an enum (recursive search). |
| `reorderEnumValues(enumId, values)` | Reorder an enum's values. |

### Package

| Procedure | Description |
|---|---|
| `addPackage(parentPackageId?, package)` | Create a package nested under another, or at the root. |
| `updatePackage(package)` | Modify a package. |
| `deletePackage(id)` | Remove a package (recursive search). |
| `moveToPackage(itemId, itemType, targetPackageId, index?)` | Move an item between containers. |
| `moveRootPackage(id, index)` | Reorder root-level items. |

## `template.*`

| Procedure | Description |
|---|---|
| `list()` | List all templates. |
| `read(name)` | Load template content. |
| `write(name, content)` | Save or update a template. |
| `delete(name)` | Remove a template. |

## `file.*`

| Procedure | Description |
|---|---|
| `list(path, showHidden)` | List directory contents with metadata (size, mtime, `is-xomda-folder` flag). |

## Schema location

All input/output schemas live in `@xomda/core` (`packages/core/`). Consumer packages import them rather than
redefining them. See [Architecture](./architecture.md) for the rationale.

## See also

- [Data model](./data-model.md) — the shape of values flowing through these procedures.
- [Architecture](./architecture.md) — where the routers fit in the package layout.
