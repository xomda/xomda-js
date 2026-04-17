# API

xomda's backend (`@xomda/node`) exposes a tRPC router. The client consumes it with full end-to-end type safety; the
same router can be called from any tRPC-compatible client. Routers are namespaced under `analysis`, `model`,
`project`, `template`, and `file`.

## Usage

```typescript
// Backend — packages/model/src/router/index.ts
export const appRouter = router({
  analysis: analysisRouter,
  model: modelRouter,
  project: projectRouter,
  template: templateRouter,
  file: fileRouter,
})

// Client — packages/client/src/trpc.ts (types auto-derived)
const model = await trpc.model.get.query()
await trpc.model.addEntity.mutate({ name: 'User', attributes: [] })
```

## `model.*`

CRUD over the model. Inputs are validated against the Zod schemas in `@xomda/core`.

### Basic

| Procedure     | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| `get()`       | Returns the current model.                                        |
| `save(model)` | Persists the entire model after validating against `ModelSchema`. |

### Entity

| Procedure                                   | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| `addEntity(packageId?, entity)`             | Create an entity at the model root or inside a package. |
| `updateEntity(entity)`                      | Modify an entity anywhere in the hierarchy.             |
| `deleteEntity(id)`                          | Remove an entity (recursive search).                    |
| `addAttribute(entityId, attribute)`         | Add an attribute to an entity.                          |
| `updateAttribute(attribute)`                | Modify an attribute.                                    |
| `deleteAttribute(entityId, attributeId)`    | Remove an attribute.                                    |
| `reorderAttributes(entityId, attributeIds)` | Reorder an entity's attributes.                         |

### Enum

| Procedure                           | Description                                           |
| ----------------------------------- | ----------------------------------------------------- |
| `addEnum(packageId?, enum)`         | Create an enum at the model root or inside a package. |
| `updateEnum(enum)`                  | Modify an enum.                                       |
| `deleteEnum(id)`                    | Remove an enum (recursive search).                    |
| `reorderEnumValues(enumId, values)` | Reorder an enum's values.                             |

### Package

| Procedure                                                  | Description                                            |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `addPackage(parentPackageId?, package)`                    | Create a package nested under another, or at the root. |
| `updatePackage(package)`                                   | Modify a package.                                      |
| `deletePackage(id)`                                        | Remove a package (recursive search).                   |
| `moveToPackage(itemId, itemType, targetPackageId, index?)` | Move an item between containers.                       |
| `moveRootPackage(id, index)`                               | Reorder root-level items.                              |

## `project.*`

Project-level metadata, project-context detection, and the analysis subsystem.
See [Project Analysis](./PROJECT-ANALYSIS.md) for plugin semantics.

| Procedure                       | Description                                                                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context(path?)`                | Detect project context for the given path (defaults to cwd). Returns `kind: 'in-root' \| 'in-subfolder' \| 'none'`, the discovered `projectRoot`, and suggestions (`useFound`, `createHere`). |
| `meta(root?)`                   | Read `.xomda/project.json`. Returns `null` if missing.                                                                                                                                        |
| `updateMeta({ root?, meta })`   | Write `.xomda/project.json`. Re-parses through `ProjectFileSchema` (defaults materialised; `plugins` sorted + deduped).                                                                       |
| `scan(root?)`                   | Run the full analyzer inside a `worker_thread`. Returns `AnalysisResult & { subprojects, detectedIds }`, with `features` filtered by `project.plugins` when set.                              |
| `fileTypesFor({ path, root? })` | Multi-match lookup: every `FileTypeDescriptor` claiming `path` across all plugins, plus the highest-priority `PreviewHint`. Filtered by `project.plugins` when set.                           |
| `refreshPlugins(root?)`         | Re-run detection and overwrite `project.plugins` (sorted) with the matching set. Creates `project.json` if missing.                                                                           |
| `listPlugins()`                 | Every plugin registered server-side: `{ id, name }[]`.                                                                                                                                        |

## `analysis.*`

Legacy flat surface kept for backwards compatibility. Most consumers want `project.*`.

| Procedure          | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `detect({ path })` | Run the analyzer on `path` (relative to cwd) and return the raw `AnalysisResult`. |
| `listPlugins()`    | Every plugin known to the server.                                                 |

## `template.*`

| Procedure                                                                 | Description                                                                                                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `list()`                                                                  | List every template.                                                                                                                           |
| `get(uuid)`                                                               | Load a template by id.                                                                                                                         |
| `save(template)`                                                          | Save or update a template.                                                                                                                     |
| `delete(uuid)`                                                            | Remove a template.                                                                                                                             |
| `listFolders()`                                                           | List every template folder.                                                                                                                    |
| `saveFolder(folder)` / `deleteFolder(uuid)`                               | Folder CRUD.                                                                                                                                   |
| `moveTemplate({ uuid, folder })` / `moveTemplateFolder({ uuid, parent })` | Reparent templates / folders.                                                                                                                  |
| `preview()`                                                               | Render all enabled templates against the current model. Returns `RenderResult[]` (path + content) without writing.                             |
| `previewWithDiff({ beforeVersionId, afterVersionId? })`                   | Same, but the cell engine sees a `ModelDiff` between the two versions.                                                                         |
| `generate()`                                                              | Render _and_ write to disk. Writes go through `resolveWriteTarget` — outside-root writes are blocked when `restrictWritesToProjectRoot` is on. |
| `generateWithDiff({ beforeVersionId, afterVersionId? })`                  | Diff-aware variant of `generate`.                                                                                                              |
| `getDiff()`                                                               | Structural diff of the rendered output against the on-disk files.                                                                              |

## `file.*`

| Procedure                        | Description                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `list({ path, showHidden? })`    | Directory listing with metadata (`isDirectory`, `isXomda`, `isXomdaDir`, `isHidden`, `size`, `mtime`).           |
| `getStats(path)`                 | Single-entry stats (`size`, `mtime`, `atime`, `ctime`, `birthtime`, `isXomda*`).                                 |
| `read(path)`                     | Read a text file (UTF-8).                                                                                        |
| `readBytes({ path, maxBytes? })` | Read a file as base64-encoded bytes, size-capped (default 65 536). Used for image and `HexView` binary previews. |

All `file.*` paths resolve against `process.cwd()`; any `..`-escape returns `FORBIDDEN`.

## Schema location

All input/output schemas live in `@xomda/core` (`packages/core/`). Consumer packages import them rather than
redefining them. See [Architecture](./ARCHITECTURE.md) for the rationale.

## See also

- [Data model](./data-model.md) — shapes flowing through these procedures, including `.xomda/project.json`.
- [Architecture](./ARCHITECTURE.md) — where the routers fit in the package layout.
- [Project Analysis](./PROJECT-ANALYSIS.md) — semantics of `analysis.*` / `project.scan` / `project.fileTypesFor`.
