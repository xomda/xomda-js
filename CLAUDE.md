# xomda.js — Claude Code Instructions

> **For comprehensive project context**, see `.cursor/rules/KNOWLEDGE_BASE.md` — the unified knowledge base for all AI agents.

xomda.js is a **Model-Driven Architecture (MDA)** platform: a full-stack TypeScript monorepo where users design data
models visually and generate code from cell-based templates (logic / handlebars / output / provider cells). The app
is self-describing — it manages its own model structure within itself.

## Quick Reference

- **Full context**: [`.cursor/rules/KNOWLEDGE_BASE.md`](.cursor/rules/KNOWLEDGE_BASE.md)
- **Package structure**: [`.cursor/rules/project-overview.mdc`](.cursor/rules/project-overview.mdc)
- **Tech stack & tools**: [`.cursor/rules/tech-stack.mdc`](.cursor/rules/tech-stack.mdc)
- **Coding standards**: [`.cursor/rules/coding-standards.mdc`](.cursor/rules/coding-standards.mdc)
- **Full architecture**: `docs/ARCHITECTURE.md`

## Key Commands

```bash
pnpm dev              # Start server (@xomda/node) + client (@xomda/client) in parallel
pnpm build            # Build all packages
pnpm typecheck        # Type-check all packages (tsc --noEmit)
pnpm test             # Run all tests
pnpm lint             # ESLint + Stylelint
pnpm format           # Prettier

# Per-package
pnpm --filter @xomda/node dev           # Backend only (port 3000)
pnpm --filter @xomda/client dev         # Frontend only (port 5173)
pnpm --filter @xomda/diagram dev        # Storybook (port 6006)
pnpm --filter @xomda/<pkg> typecheck    # Single package
pnpm --filter @xomda/<pkg> test         # Single package tests
```

## Essential Rules

1. **pnpm only** — never npm or yarn. Use `pnpm -F @xomda/<pkg> <cmd>`
2. **TypeScript strict**: No `any`, use `import type` for type-only imports
3. **Vue components**: `.tsx` with `defineComponent` — no `.vue` SFCs
4. **Named exports**: No default exports for components
5. **One component per file**: Never define multiple components in a single file
6. **Folder per composite component**: Extract sub-components into a folder with an `index.ts` that exports only the
   public API
7. **`index.ts` in every subfolder (except `__tests__`)**: Each `index.ts` explicitly lists its exports — never
   `export *`. Internal sub-components are not re-exported.
8. **Shortest-route imports**: Always import through the nearest folder index — `import { X } from './X'` not
   `import { X } from './X/X'` or `'./X/X/X'`
9. **No file extensions in imports**: Never use `.ts` or `.tsx` in import paths
10. **SCSS modules**: Component-scoped styles via `*.module.scss`
11. **Configuration awareness**: Always check `tsconfig.json`, `.editorconfig`, `.prettierrc`, `eslint.config.mjs`, and
    `.stylelintrc.json` for code preferences (imports, newlines, indentation, etc.)
12. **Tests always**: Add Vitest or Cypress tests when adding functionality
    - **Placement**: Create tests in a `__tests__/` subfolder next to the code they test (NOT in the source folder)
    - **Pattern**: `src/path/to/MyComponent.tsx` → tests go in `src/path/to/__tests__/MyComponent.spec.tsx`
    - **Naming**: Use `.spec.ts` or `.spec.tsx` (not `.test.ts`); type tests use `.spec-d.ts`
    - **Import**: Import from parent: `import { X } from '../X'`
13. **No `VNavigationDrawer` for panels**: Navigation uses `AppNav` (`packages/client/src/components/AppNav`); split panels use `PanelDivider` + `usePanelResize`. See `coding-standards.mdc` → UI Layout Patterns.
14. **Vuetify size/density**: Global defaults in `packages/client/src/vuetify.ts`: `size='small'` + `density='comfortable'` for most components with a size prop; **VBtn uses `density='default'`** (comfortable+small is too tight); `density='compact'` for VList/VListItem/VListSubheader. Do not override inline without reason.

## Package Structure at a Glance

```
@xomda/core       → Zod schemas, types, constants
@xomda/util       → Runtime helpers and utilities
@xomda/template   → Cell-based template engine, processors, file storage
@xomda/model      → tRPC router (CRUD), business logic
@xomda/node       → Node.js HTTP server exposing tRPC over HTTP
@xomda/client     → Vue 3 SPA (Vuetify, Pinia, Vue Router, tRPC client)
@xomda/diagram    → Vue 3 diagram components (built with Storybook)
@xomda/icons      → Material Symbols icon library
@xomda/ui         → Generic UI components (DynamicForm, TitleBar, etc.)
@xomda/codeeditor → Monaco Editor component for template editing
@xomda/analysis-core → Project analysis framework
@xomda/plugin-analysis-* → Technology detectors
```

**Dependency direction** (no cycles):

```
client → model → template → core
client → diagram → icons
client → ui → icons
client → codeeditor
node   → model
analysis plugins → analysis-core
```

## Detailed Standards

For detailed coding conventions, testing requirements, and architecture notes, see the referenced knowledge base files
above.
