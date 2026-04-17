# xomda Documentation

This folder contains the full documentation for xomda.js. Each document covers one topic; cross-links connect them
where context is needed.

## Concepts

- [Concepts](./concepts.md) — what Model-Driven Architecture means in xomda, the two-tier model, self-definition,
  inheritance and blueprints.
- [Architecture](./architecture.md) — package layers, dependency direction, internal principles.

## Using xomda

- [Getting started](./getting-started.md) — install, run, create a first model and template, generate code.
- [Data model](./data-model.md) — packages, entities, enums, attributes, the `model.json` format, `.xomda/` layout.
- [Templates](./templates.md) — the cell-based template engine, cell types, helpers, a worked example.

## Reference

- [API](./api.md) — tRPC routers and procedures (`model.*`, `template.*`, `file.*`).
- [Project analysis](./project-analysis.md) — technology detection framework.

## Contributing

- [Development](./development.md) — pnpm scripts, code-quality rules, environment, deployment, troubleshooting.
- [Contributing](./contributing.md) — workflow, conventions, where to put what.

## Internal

These documents track in-flight work and are not part of the user-facing documentation surface:

- `refactoring.md` — active refactoring plan and status.
- `todo.md` — roadmap and open tasks.
