# Roadmap

Internal roadmap for xomda. Tracks larger initiatives and open work, grouped by area. This document is not part of
the user-facing documentation surface; for what xomda already does, see [Concepts](./concepts.md) and the rest of
[`docs/`](./README.md).

Items are ordered roughly by priority within each section.

## Template packages and cross-environment support

### Template package architecture

The wizard-registry primitive landed in [`packages/client/src/templateWizards/`](../packages/client/src/templateWizards/);
each new wizard is one file + one import in `registerAll.ts`. The remaining
work to make stack-specific packages first-class:

- Package metadata format (name, description, supported languages and frameworks).
- Template discovery and loading mechanism (today templates live under one
  project's `.xomda/templates/`; cross-project packages need a discovery layer).
- Per-package options and configuration UI — heavier wizards should swap
  the simple `create(folder?)` factory for a multi-step dialog component
  (project name, package prefix, Lombok yes/no, …); the `TemplateWizard`
  contract is additive so this can land without breaking existing wizards.

### Spring Boot template package

Lands as a Spring Boot wizard module under the new registry. The
[`demo/maven-plain`](../demo/maven-plain/) layout convention (`main/` hand-written,
`generated/` regenerated, `test/` hand-written) is the template — reuse it.

- Lombok integration with configurable options.
- JPA / Hibernate entity generation with relationships.
- Spring Data repository interfaces.
- REST controller generation with validation.
- Maven and Gradle build-file generation.
- `application.properties` configuration.

### NestJS template package

- TypeORM entity generation.
- Controller / service / DTO generation.
- Module structure and dependency injection.
- Validation pipes and decorators.

### Next.js template package

- API route generation.
- Component generation with TypeScript.
- Database integration (Prisma or TypeORM).

### Real-project demos (G2–G5)

G1 ([`demo/maven-plain`](../demo/maven-plain/)) landed — pure Java records +
Maven + JUnit 5, regenerate → compile → test in one round-trip. Remaining
demos reuse its skeleton (see [`docs/.backlog/demo-projects.md`](./.backlog/demo-projects.md)
for the full blueprint):

- **G2 `demo/spring-boot`** — flagship; JPA entity + Spring Data repo + REST
  controller + Lombok option + MapStruct DTO. `@SpringBootTest` + Testcontainers Postgres.
- **G3 `demo/gradle-plain`** — same model as G1, different build. Proves the
  Gradle plugin works on a real consumer.
- **G4 `demo/quarkus`** — Panache entity + JAX-RS resource. Different ORM
  idiom; catches JPA assumptions baked into Spring templates.
- **G5 `demo/spring-elastic`** — persistence-layer swap + the first generated
  *test* code (entity smoke tests authored as templates).

Open questions before G5: shared model vs. per-demo model; whether generated
tests live in `src/test/generated/` (gitignored) or are commit-then-edit; CI
gating for the heavier Testcontainers suites.

### Cross-environment validation

- Compile generated code for each target as a smoke test — the demos
  above are this layer; wire each into a `pnpm test:demo` workflow once
  G2 lands.
- Dependency resolution validation.
- Framework-specific linting integration.

## Project analysis & package metadata

The `PackageFetcherPlugin` contract landed in [`packages/analysis/core/src/packageFetcher.ts`](../packages/analysis/core/src/packageFetcher.ts);
[`@xomda/plugin-analysis-node`](../packages/analysis/node/src/npm-fetcher.ts)
ships the first concrete fetcher (npm registry, 8-way concurrent). Remaining
work:

- **Maven fetcher** — `@xomda/plugin-analysis-maven` against Maven Central's
  REST API (`https://search.maven.org/solrsearch/select?q=g:<group>+AND+a:<artifact>`).
- **Gradle fetcher** — `@xomda/plugin-analysis-gradle` against the Gradle Plugin
  Portal API (`https://plugins.gradle.org/api/gradle/<id>`).
- **tRPC surface** — `project.fetchPackageData({ rootPath, pluginIds? })`
  procedure so the client can trigger fetches; wires into `runPackageFetchers()`.
- **Client UI** — render results in the project view: out-of-date badges per
  dep, optional license / deprecated / advisory columns. Surface
  open question: which signal beyond `latest` is worth the network call —
  GitHub Advisories? snyk? license-only? Resolve before the UI lands.

## Advanced modelling

### Tier-2 user experience

- Pick-meta-type UX in _Add_ dialogs: when multiple concrete entity types exist, show a picker for concrete types
  only. Abstract entities (`abstract: true`) excluded from instantiation. Single concrete type → direct
  instantiation.
- `DynamicForm` rendering of effective attributes: inherited attributes shown with visual distinction; child entities
  may override.

### Attribute sub-entities (the richer version of `config`)

`Attribute.config: Record<string, unknown>` shipped as the smallest-viable
container. The richer vision: a dedicated **attribute package** holding
reusable sub-entity definitions that attributes reference by id, e.g.
`ReferenceConfig` (onDelete, fkColumn), `ValidationRule` (minLength,
pattern), `ColumnHint` (name, length, precision). Blocked on:

- Which sub-entity kinds to model first (pick 2–3 concrete ones — the
  whole zoo can grow incrementally).
- Whether the attribute package is auto-created per model or a global
  built-in alongside the meta-model's existing packages.
- Migration of the open `config` field: keep both (open container for
  custom keys + typed references for built-ins) or replace.

### Validation and integrity

- Implement `uniqueScope: 'parent'` in generated schemas.
- Cross-reference validation for `reference: true` attributes.
- Circular dependency detection.
- Orphaned reference detection.
- Type consistency validation.
- Migration impact analysis.

## Production readiness

### Self-bootstrapping engine

- File watcher for `.xomda/model.json`.
- HMR-style reload of model changes.
- Graceful server restart with state preservation.

### Enterprise

- Database migration scripts generated from model diffs.
- API versioning and backward-compatibility helpers.
- Multi-user collaboration: concurrent editing, conflict resolution, model locking, review workflows.

### Performance

- Lazy loading for model elements.
- Virtual scrolling in the diagram canvas.
- Incremental generation for large codebases.

## Documentation and ecosystem

- Runtime introspection API reference.
- Template-helper function reference.
- Template-authoring guide: when to use logic cells vs handlebars cells; custom helper development; provider-cell
  patterns (entities / enums / packages / arbitrary JS).
- Real-world MDA examples (e-commerce, CMS, …).
- Template-package development tutorials.
- Migration guides from traditional development.
- Template-package marketplace and contribution guidelines.

## Accessibility

### Full WAI-ARIA drag-and-drop pattern for diagram + templates

Today's drag surfaces (`useNodeDrag` / `useNodeResize` in the diagram, HTML5 DnD between folders in
`TemplatesView`) have keyboard alternatives — model elements via the side-panel "Move to package" control,
templates and folders via the row menu's "Move to folder…" prompt. These work but are not the WAI-ARIA Authoring
Practices drag pattern:

- Space/Enter on a focused row to "pick up" the item (`aria-grabbed`).
- Arrow keys navigate the tree / canvas with the picked-up item.
- Space/Enter on a drop target to commit the move.
- Esc cancels the operation and restores focus to the source row.

Add this pattern as a composable (`useKeyboardDrag`?) shared by `useNodeDrag`, `useNodeResize`, and the
template-row interaction so every new DnD surface inherits it automatically. Until then, every new DnD surface
must ship an alternative (menu item, prompt) per AGENTS.md §18.

## UI patterns & shared infrastructure

### `ViewShell` retrofit

[`ViewShell`](../packages/ui/src/components/ViewShell/) shipped with the
module system but [`ModelView`](../packages/client/src/views/ModelView.tsx)
and [`FileBrowserView`](../packages/client/src/views/FileBrowserView/) still
hand-roll their left/right side-panel layouts. Retrofit incrementally —
one view per PR — so the collapse + resize behaviour stays consistent and
each view becomes shorter at the same time.

### Tree-view generalization (`useTreeView`)

[`ModelTree`](../packages/client/src/components/ModelTree/) ships as
model-specific; [`useFolderTree`](../packages/client/src/views/FileBrowserView/useFolderTree.ts)
is its file-browser counterpart. Extract the shared parts into a
hierarchy-agnostic composable in `@xomda/ui` (`useTreeView({ getChildren,
getId, ... })`) and a generic `TreeView` component the moment a third
consumer appears. Don't extract prematurely — two consumers isn't enough
shape signal yet (per the incremental-migration rule).

## Technical debt and maintenance

- Eliminate remaining `any` types in critical paths.
- Enable any remaining strict-mode checks.
- End-to-end model-editing workflow tests.
- Template-generation verification tests.
- Cross-package integration tests.
- Automated package publishing, version management, tagging.
- Cross-platform build verification in CI.
