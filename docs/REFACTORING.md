# Refactoring Status

Internal status document for the refactoring that established xomda's MDA foundation. Not part of the user-facing
documentation surface; for the architecture in its current shape see [Architecture](./architecture.md), and for
forward-looking work see [Roadmap](./todo.md).

## Completed

### Phase 1 — Self-definition foundation

- All shared schemas centralised in `@xomda/core/src/schemas/`.
- xomda's own meta-types (`Entity`, `Attribute`, `Enum`, `Package`, `Model`) defined inside `.xomda/model.json`.
- Schema openness via `.loose()` so tier-2 users can extend types without breaking serialization.
- Dynamic schema builder (`buildEntitySchema()`) constructs strict schemas from effective attributes.

### Phase 2 — Runtime introspection

- Inheritance helpers: `getEffectiveAttributes()`, `getEntityAncestors()`, with cycle detection.
- Lookup helpers: `findEntityById()`, `findEntityByName()`, `getAllPackages()`, and friends.
- Model diffing via `diffModels()` for change detection and versioning.
- Test factory helpers and accompanying coverage.

### Phase 3 — Self-bootstrapping UI

- `DynamicForm` adapts to model changes automatically.
- Attributes distinguish reference (by id) from embed (inline).
- File browser overlays generated files on the real file tree.
- Generate → diff → promote workflow for code regeneration.

### Phase 4 — Advanced features

- Model versioning with snapshot storage in `.xomda/history/` and diff capabilities.
- Cell-based template engine with `provider`, `provider-logic`, `logic`, `handlebars`, `buffer`, `markdown`, and
  `output` cells; iteration over entities, enums, packages, or arbitrary JS.
- Type-safe tRPC router covering full model CRUD ([API reference](./api.md)).
- Clean cross-package separation with no dependency cycles.

## Principles now in place

- **Self-definition.** xomda's meta-model is editable from within xomda.
- **Self-bootstrapping.** TypeScript code is generated from the meta-model; the UI adapts to model changes without
  hard-coded forms.
- **Runtime introspection.** Applications can query model structure, resolve inheritance, and validate against
  dynamic schemas at runtime.
- **Versioning.** Snapshots and diffs capture model evolution and form the basis for migration generation.

## Open refactoring opportunities

These are not planned for any specific milestone; track concrete work items in [Roadmap](./todo.md).

- **Plugin architecture for template packages.** External, distributable template packages for Spring Boot, NestJS,
  Next.js, etc., with package-level options.
- **Configurable generation options** surfaced consistently in the UI (Lombok yes/no, Java version, etc.).
- **Multi-user collaboration**: concurrent editing with conflict resolution and locking.
- **Performance**: lazy loading and virtualisation for large models.
- **Migration generation**: database migration scripts derived automatically from model diffs.
- **HMR-style restart**: automatic reload on model changes during development.
- **Validation**: cross-reference and integrity checking across the full model.

## See also

- [Architecture](./architecture.md) — current package layout.
- [Concepts](./concepts.md) — the MDA principles the refactoring established.
- [Roadmap](./todo.md) — concrete forward-looking work.
