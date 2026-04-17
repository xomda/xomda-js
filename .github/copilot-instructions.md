# xomda.js — GitHub Copilot Instructions

> **For comprehensive project context**, see `.cursor/rules/KNOWLEDGE_BASE.md` — the unified knowledge base for all AI agents.

xomda.js is a **Model-Driven Architecture (MDA)** platform: a full-stack TypeScript monorepo where users design data
models visually and generate code from Handlebars templates.

## Quick Reference

- **Full context**: [`.cursor/rules/KNOWLEDGE_BASE.md`](.cursor/rules/KNOWLEDGE_BASE.md)
- **Package structure**: [`.cursor/rules/project-overview.mdc`](.cursor/rules/project-overview.mdc)
- **Tech stack & tools**: [`.cursor/rules/tech-stack.mdc`](.cursor/rules/tech-stack.mdc)
- **Coding standards**: [`.cursor/rules/coding-standards.mdc`](.cursor/rules/coding-standards.mdc)
- **Full architecture**: `docs/ARCHITECTURE.md`

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

## Key Commands

```bash
pnpm dev         # Backend (3000) + frontend (5173)
pnpm build       # Build all packages
pnpm typecheck   # Type-check all
pnpm test        # Vitest + Cypress
pnpm lint        # ESLint + Stylelint
pnpm format      # Prettier
```

## Package Structure (Simple View)

```
@xomda/core       → Types & schemas (source of truth)
@xomda/template   → Handlebars engine
@xomda/model      → tRPC router & business logic
@xomda/node       → HTTP server
@xomda/client     → Vue 3 SPA (Vuetify, Pinia, Vue Router)
@xomda/diagram    → Vue 3 components (Storybook)
@xomda/ui         → Generic UI components
@xomda/codeeditor → Monaco Editor
@xomda/analysis-core → Analysis framework
@xomda/plugin-analysis-* → Technology detectors
```

Dependency direction: `client → model → template → core`
