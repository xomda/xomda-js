# Roadmap

Internal roadmap for xomda. Tracks larger initiatives and open work, grouped by area. This document is not part of
the user-facing documentation surface; for what xomda already does, see [Concepts](./concepts.md) and the rest of
[`docs/`](./README.md).

Items are ordered roughly by priority within each section.

## Template packages and cross-environment support

### Template package architecture

- Plugin interface for external template packages.
- Package metadata format (name, description, supported languages and frameworks).
- Template discovery and loading mechanism.
- Per-package options and configuration UI.

### Spring Boot template package

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

### Cross-environment validation

- Compile generated code for each target as a smoke test.
- Dependency resolution validation.
- Framework-specific linting integration.

## Advanced modelling

### Tier-2 user experience

- Pick-meta-type UX in *Add* dialogs: when multiple concrete entity types exist, show a picker for concrete types
  only. Abstract entities (`abstract: true`) excluded from instantiation. Single concrete type → direct
  instantiation.
- `DynamicForm` rendering of effective attributes: inherited attributes shown with visual distinction; child entities
  may override.

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

## Technical debt and maintenance

- Eliminate remaining `any` types in critical paths.
- Enable any remaining strict-mode checks.
- End-to-end model-editing workflow tests.
- Template-generation verification tests.
- Cross-package integration tests.
- Automated package publishing, version management, tagging.
- Cross-platform build verification in CI.
