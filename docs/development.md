# Development

This document covers everything needed to develop xomda itself: prerequisites, scripts, code-quality rules,
environment variables, deployment notes, and common troubleshooting. For broader project context see
[Architecture](./architecture.md); for the contribution workflow see [Contributing](./contributing.md).

## Prerequisites

- **Node.js** 20 or newer
- **pnpm** 10 or newer

xomda is a pnpm workspace monorepo. Always use `pnpm` — never `npm` or `yarn`.

## Quick start (development)

```bash
git clone <repo-url> xomda
cd xomda
pnpm install
pnpm dev
```

Backend at `http://localhost:6431`, client at [http://localhost:5173](http://localhost:5173) with HMR.
For the compiled single-port flow, see the [README Quick start](../README.md#quick-start).

## Scripts

### Workspace-wide

| Command          | What it does                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`       | Start backend (`@xomda/node`, port `6431`) and client (`@xomda/client`, port `5173`) in parallel. |
| `pnpm build`     | Build all packages.                                                                               |
| `pnpm typecheck` | `tsc --noEmit` across all packages.                                                               |
| `pnpm test`      | Run all tests (Vitest + Cypress).                                                                 |
| `pnpm lint`      | ESLint + Stylelint.                                                                               |
| `pnpm format`    | Prettier auto-fix.                                                                                |
| `pnpm generate`  | Generate code from the current model.                                                             |

### Per-package

```bash
pnpm --filter @xomda/node dev           # backend only
pnpm --filter @xomda/client dev         # frontend only
pnpm --filter @xomda/diagram dev        # Storybook (port 6006)
pnpm --filter @xomda/<pkg> typecheck    # type-check a single package
pnpm --filter @xomda/<pkg> test         # test a single package
```

`pnpm -F` is a shorter alias for `pnpm --filter`.

## Code quality

### Formatting (Prettier)

- 2-space indentation
- No semicolons
- Single quotes
- 100-character line width
- Template literals over string concatenation

Run `pnpm format` to auto-fix.

### Linting (ESLint, flat config)

Key rules:

- No `any` types (warning).
- Unused variables must start with `_` (e.g. `_unused`).
- Imports must be sorted (`simple-import-sort`).
- Type-only imports must use `import type { … }`.
- String concatenation forbidden — use template literals.

Stylelint covers CSS/SCSS.

### TypeScript

- Target ES2022, strict mode (all strict checks enabled).
- `moduleResolution: "bundler"` for browser packages; `"NodeNext"` for server packages.
- Never use `.ts` or `.tsx` file extensions in import paths.
- Always use `import type` for type-only imports.

### Tests

Add tests when adding functionality. Conventions:

- **Placement**: `__tests__/` subfolder next to the code under test (not in the source folder).
  Pattern: `src/path/to/X.tsx` → `src/path/to/__tests__/X.spec.tsx`.
- **Naming**: `*.spec.ts` or `*.spec.tsx` (not `*.test.ts`); type tests use `*.spec-d.ts`.
- **Tools**: Vitest for unit tests, Cypress for E2E (`packages/client/cypress/`), Storybook for component
  documentation (`@xomda/diagram`).

## Environment variables

### Backend (`@xomda/node`)

| Variable    | Default       | Notes                                       |
| ----------- | ------------- | ------------------------------------------- |
| `XOMDA_DIR` | `.xomda`      | Root folder for `model.json` and templates. |
| `NODE_ENV`  | `development` | `development` or `production`.              |

### Frontend (`@xomda/client`)

| Variable       | Default                 | Notes        |
| -------------- | ----------------------- | ------------ |
| `VITE_API_URL` | `http://localhost:6431` | Backend URL. |

## Deployment

### Backend (`@xomda/node`)

```bash
pnpm --filter @xomda/node build
# Output: packages/node/dist/
node packages/node/dist/index.js  # default port 6431
```

Minimal Dockerfile:

```dockerfile
FROM node:20
WORKDIR /app
COPY packages/node/dist .
CMD ["node", "index.js"]
```

### Frontend (`@xomda/client`)

```bash
pnpm --filter @xomda/client build
# Output: packages/client/dist/ — deploy as a static site (Vercel, Netlify, S3, …).
```

### Component library (`@xomda/diagram`)

```bash
pnpm --filter @xomda/diagram build
# Output: packages/diagram/dist/ (with .d.ts).
# Publish: npm publish dist/
```

## Tech stack

| Layer                  | Technology            | Version |
| ---------------------- | --------------------- | ------- |
| Language               | TypeScript            | 6.0.3   |
| Runtime                | Node.js               | 20+     |
| Package manager        | pnpm                  | 10.33.0 |
| Frontend               | Vue 3                 | 3.5.32  |
| UI library             | Vuetify               | 4.0.5   |
| Backend API            | tRPC                  | 11.16.0 |
| Build tool             | Vite                  | 8.0.8   |
| Template engine        | Cell-based (in-house) | —       |
| Handlebars (cell type) | Handlebars            | 4.7.9   |
| Schema validation      | Zod                   | 4.3.6   |
| Unit tests             | Vitest                | 4.1.4   |
| E2E tests              | Cypress               | 15.14.0 |
| Linting                | ESLint                | 10.2.1  |
| Formatting             | Prettier              | 3.8.3   |
| CSS linting            | Stylelint             | 17.8.0  |
| Styling                | Sass (SCSS)           | 1.99.0  |

## Troubleshooting

### Port already in use

```bash
lsof -i :6431      # find the process
kill -9 <pid>      # or change the port in packages/node/src/index.ts / packages/client/vite.config.ts
```

### Dependencies not installing

```bash
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Stale type errors

```bash
find . -name "*.tsbuildinfo" -delete
pnpm typecheck
```

### Build fails

Run `pnpm lint` first; many build failures surface as lint errors with clearer messages.

## See also

- [Architecture](./architecture.md) — package layers and dependency direction.
- [Contributing](./contributing.md) — branch workflow and conventions.
- `.cursor/rules/coding-standards.mdc` — the full coding-standards reference.
