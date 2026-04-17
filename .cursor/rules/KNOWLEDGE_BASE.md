# xomda.js Knowledge Base

This is the **single source of truth** for all AI agent instructions across xomda.js development. All AI-specific
instruction files (`AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`, `.clinerules`, `.windsurfrules`)
reference this knowledge base to avoid duplication.

> **AI Agents covered**: Claude (Anthropic), Junie (JetBrains), Cursor, GitHub Copilot, Windsurf (Codeium), Cline / Roo
> Code

## Modular Documentation

- **[Project Overview](./project-overview.mdc)** — Package structure, data model, architecture
- **[Tech Stack](./tech-stack.mdc)** — Technologies, versions, key configs
- **[Coding Standards](./coding-standards.mdc)** — Formatting, linting, TypeScript rules
- **[Development Guide](./DEVELOPMENT_GUIDE.md)** — Feature development workflows

## Quick Start

```bash
pnpm dev              # Start backend (3000) + frontend (5173) in parallel
pnpm build            # Build all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run all tests (Vitest + Cypress)
pnpm lint             # ESLint + Stylelint
pnpm format           # Prettier format
```

## Package Structure at a Glance

```
@xomda/core       → Zod schemas, types, constants (source of truth)
@xomda/util       → Runtime utilities
@xomda/template   → Cell-based template engine + storage
@xomda/model      → tRPC router, business logic, CRUD
@xomda/node       → Node.js HTTP server
@xomda/client     → Vue 3 SPA (Vuetify, Pinia, Vue Router, tRPC)
@xomda/diagram    → Vue 3 diagram components (Storybook)
@xomda/icons      → Material Symbols icons
@xomda/ui         → Generic UI components (DynamicForm, TitleBar, etc.)
@xomda/codeeditor → Monaco Editor for template editing
@xomda/analysis-core → Project analysis framework
@xomda/plugin-analysis-* → Technology detectors (TypeScript, Java, etc.)
```

**Dependency direction (no cycles)**:

```
client → model → template → core
client → diagram → icons
client → ui → icons
client → codeeditor
node   → model
analysis plugins → analysis-core
```

## Essential Rules

1. **Package manager**: Always use **pnpm** — never npm or yarn
2. **Run commands**: `pnpm -F @xomda/<pkg> <cmd>` or from package directory
3. **TypeScript**: Strict mode, no `any`, use `import type` for type-only imports
4. **Components**: `.tsx` with `defineComponent` — no `.vue` SFCs
5. **Exports**: Named exports only (no default exports for components)
6. **Formatting**: Prettier (no semicolons, single quotes, 2-space indent, 100 char width)
7. **Linting**: ESLint flat config (TypeScript + Prettier rules)
8. **Testing**: Always add tests when adding functionality (Vitest + Cypress)

## Using This Knowledge Base

- **AI agents**: Reference the modular `.mdc` files when you need detailed context
- **File locations**: Maintain this reference in `.cursor/rules/KNOWLEDGE_BASE.md` (this file)
- **Updates**: Edit the `.mdc` files directly; AI-specific files link to them
- **AI-specific customizations**: Add only tool preferences or AI-specific guidance to individual instruction files

## Finding Documentation

| Topic                         | Location                                        |
|-------------------------------|-------------------------------------------------|
| Project purpose & structure   | [project-overview.mdc](./project-overview.mdc)  |
| Dependencies & versions       | [tech-stack.mdc](./tech-stack.mdc)              |
| Code formatting & standards   | [coding-standards.mdc](./coding-standards.mdc)  |
| Feature development workflows | [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)  |
| Full architecture deep-dive   | [Root ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| MDA philosophy                | [Root MDA.md](../docs/MDA.md)                   |
| Refactoring plan              | [Root REFACTORING.md](../docs/REFACTORING.md)   |
| Project roadmap               | [Root TODO.md](../docs/TODO.md)                 |
