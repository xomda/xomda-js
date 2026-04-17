# Contributing

Thanks for your interest in contributing to xomda. This document covers the workflow and conventions; for the full
toolchain and code-quality rules see [Development](./development.md).

## Workflow

1. **Branch.** Create a feature branch from `main`:
   ```bash
   git checkout -b feature/<short-description>
   ```
2. **Make your changes** following the conventions in [Development](./development.md) and the detailed coding
   standards in [`.cursor/rules/coding-standards.mdc`](../.cursor/rules/coding-standards.mdc).
3. **Verify locally** before pushing:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm format
   pnpm test
   ```
4. **Commit** in logical units, with clear messages. Prefer several focused commits over one large one.
5. **Open a pull request** describing the *why* of the change, not just the *what*. Link any related issues.

## Conventions

- **Package manager**: `pnpm` only (never `npm` or `yarn`).
- **TypeScript**: strict mode, no `any`, `import type` for type-only imports.
- **Vue components**: `.tsx` with `defineComponent`. No `.vue` SFCs.
- **Exports**: named exports only — no default exports for components.
- **One component per file.** Folder per composite component, with an `index.ts` that exports only the public API.
- **`index.ts` in every subfolder** (except `__tests__`). Explicit exports — never `export *`.
- **Shortest-route imports**: `import { X } from './X'`, never `from './X/X'`.
- **No file extensions** in import paths (`.ts`, `.tsx`).
- **SCSS modules** for component styles (`*.module.scss`).

## Tests

Add tests when adding functionality. See [Development → Tests](./development.md#tests) for placement and naming.

## Where to put what

- **Shared Zod schemas** belong in `@xomda/core` — never in consumer packages.
- **Generic UI components** belong in `@xomda/ui`.
- **Diagram-specific components** belong in `@xomda/diagram`.
- **Runtime helpers** belong in `@xomda/util`.

The dependency graph is documented in [Architecture](./architecture.md). Do not introduce cycles.

## Documentation changes

If your change alters user-facing behaviour or the data model, update the relevant document in `docs/`:

- API surface → [api.md](./api.md)
- Data model schema → [data-model.md](./data-model.md)
- Template language → [templates.md](./templates.md)
- Tooling, scripts, env → [development.md](./development.md)

The root [`README.md`](../README.md) is end-user oriented; it should rarely need changes for development work.

## See also

- [Development](./development.md) — toolchain, scripts, environment, troubleshooting.
- [Architecture](./architecture.md) — package layers and dependency direction.
- [`AGENTS.md`](../AGENTS.md) — canonical instructions for AI coding assistants.
