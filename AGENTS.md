# Agent Instructions

This file is the **single source of truth** for AI coding assistants working in this repository
(Claude, Cursor, GitHub Copilot, Windsurf, Cline / Roo Code, Junie, and any other agent).

Tool-specific files (`CLAUDE.md`, `.clinerules`, `.windsurfrules`, `.github/copilot-instructions.md`,
`.cursor/rules/*`) all defer to this document. If you are an agent reading any of those files, read this one
instead.

## Project in one paragraph

**xomda.js** is a Model-Driven Architecture (MDA) platform: a TypeScript pnpm-workspace monorepo where users design
data models visually and generate code from cell-based templates (`*.template.json`). The platform is
self-describing — its own meta-model lives in `.xomda/model.json` and is editable from within xomda itself.

For deeper context, see [`docs/concepts.md`](./docs/concepts.md), [`docs/architecture.md`](./docs/architecture.md),
and [`docs/data-model.md`](./docs/data-model.md).

## Commands

```bash
pnpm dev          # backend (port 6431) + frontend (port 5173) in parallel
pnpm build        # build all packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # Vitest + Cypress (TS side only)
pnpm test:jvm     # All JVM-side tests (Maven aggregator + Gradle + IntelliJ + Eclipse)
pnpm test:all     # `pnpm test` then `pnpm test:jvm` (TS first — fast-fail before the slow JVM suite)
pnpm lint         # ESLint + Stylelint
pnpm format       # Prettier

pnpm -F @xomda/<pkg> dev          # single package dev
pnpm -F @xomda/<pkg> typecheck    # single package type-check
pnpm -F @xomda/<pkg> test         # single package tests
```

`pnpm -F` is shorthand for `pnpm --filter`. **Never use `npm` or `yarn`.**

### JVM-side scripts

`pnpm test:jvm` runs each JVM build separately because the `integrations/jvm/pom.xml` aggregator
only covers Maven modules (`generator-core`, `maven`, `eclipse/*`); Gradle modules (`gradle`,
`intellij`) build with Gradle and must be invoked on their own. The script chains:

1. `test:jvm:install-core` — publish `xomda-generator-core` to a project-local Maven repo at
   `integrations/jvm/.m2-repo/` so downstream JVM consumers don't need `~/.m2` to be in any
   particular state. Uses `-Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo` (NOT
   `-DaltDeploymentRepository`, which is for `deploy`, not `install`).
2. `test:jvm:maven` → Maven aggregator (generator-core + maven plugin).
3. `test:jvm:gradle-plugin` → Gradle build plugin.
4. `test:jvm:intellij` → IntelliJ plugin (Kotlin, IntelliJ Platform 2024.2.4, JDK 21).
5. `test:jvm:eclipse` → Eclipse plugin (Tycho 4.0.10, Eclipse 2024-09 target).

## Package layout

```
packages/                        Pure-library/runtime TypeScript packages
  @xomda/core                    Zod schemas, types, constants (source of truth for all schemas)
  @xomda/util                    Runtime helpers and utilities
  @xomda/template                Cell-based template engine, processors, file storage
  @xomda/model                   tRPC router (CRUD), business logic
  @xomda/node                    Node.js HTTP server exposing tRPC
  @xomda/client                  Vue 3 SPA (Vuetify, Pinia, Vue Router, tRPC client)
  @xomda/diagram                 Vue 3 diagram components (Storybook)
  @xomda/icons                   Material Symbols icon library
  @xomda/ui                      Generic UI components (DynamicForm, TitleBar, …)
  @xomda/codeeditor              Monaco Editor for template editing
  @xomda/cli                     CLI binary (`xomda generate`)
  @xomda/analysis-core           Project analysis framework
  @xomda/plugin-analysis-*       Technology detectors

integrations/                    External-ecosystem integrations (build tools, IDEs).
  node/                          TypeScript integrations (share code with `packages/` via workspace deps)
    unplugin                     Vite / Rollup / webpack adapter
    vscode                       VS Code extension (bundled with rolldown into one .vsix)
  jvm/                           JVM integrations (share `xomda-generator-core` via a project-local Maven repo)
    generator-core               Java engine; JVM equivalent of `@xomda/template`
    maven                        Maven plugin
    gradle                       Gradle build plugin
    intellij                     IntelliJ Platform plugin (Kotlin)
    eclipse                      Eclipse plugin (Tycho)
    .m2-repo/                    [gitignored] project-local Maven repo for generator-core
    pom.xml                      Aggregator for the *Maven* modules (generator-core + maven only)
```

**Why the split, and why grouped by language:** `packages/` holds the platform libraries that
build on each other. `integrations/` holds adapters out to external ecosystems — they import from
`packages/`, never the other way around. They are grouped by language first (`node/` vs `jvm/`)
because sibling plugins in the same language naturally share code via their language's package
system (pnpm workspace deps for TS, project-local Maven repo for JVM), while cross-language
sharing is only possible at the file-format level (the `.xomda/` folder convention).

Dependency direction (no cycles allowed):

```
client → model → template → core
client → diagram → icons
client → ui → icons
client → codeeditor
node   → model
cli    → model, template
analysis plugins → analysis-core
integrations/node/* → packages/*           (workspace deps; bundled at packaging time)
integrations/jvm/{gradle,maven,intellij,eclipse} → integrations/jvm/generator-core
```

## Essential rules

1. **pnpm only** — never `npm` or `yarn`.
2. **TypeScript strict.** No `any`. Use `unknown` + narrowing or generics. Always `import type` for type-only imports.
   - **Vuetify types:** Import `JSXComponent` from `'vuetify'` when typing icon or component props. Use `Record<string, any>` only for Vuetify activator slot props (that is Vuetify's own type — do not widen further). The `vuetify.d.ts` shim files only carry `import '@xomda/icons'`; never add hand-rolled type overrides there.
   - **Callbacks:** Let TypeScript infer array-callback parameter types (`.map`, `.filter`, `.some`, `.find`) — never annotate them `: any`.
   - The only sanctioned `any` in the codebase is the `on*` index signature in `env.d.ts` (required for Vue vnode hook compatibility) and generated code strings (e.g., `declare const x: any`). Everywhere else is a bug.
3. **Vue components are `.tsx`** with `defineComponent`. No `.vue` SFCs.
4. **Named exports only** for components — no default exports.
5. **One component per file.** Never define multiple components in a single file.
6. **Folder per composite component.** Extract sub-components into a folder with an `index.ts` that exports only the
   public API. Internal sub-components are not re-exported.
7. **`index.ts` in every subfolder** (except `__tests__`). Each `index.ts` lists its exports explicitly — never
   `export *`.
8. **Shortest-route imports.** `import { X } from './X'`, never `'./X/X'` or `'./X/X/X'`.
9. **No file extensions in imports.** Never use `.ts` or `.tsx` in import paths.
10. **SCSS modules** for component-scoped styles (`*.module.scss`).
11. **Schemas live in `@xomda/core`.** Never define shared Zod schemas in consumer packages.
12. **Tests come with the change.** Use Vitest (or Cypress for E2E). Conventions:
    - **Placement**: `__tests__/` subfolder next to the code under test (not in the source folder).
      `src/path/to/X.tsx` → `src/path/to/__tests__/X.spec.tsx`.
    - **Naming**: `*.spec.ts` / `*.spec.tsx` (not `*.test.ts`); type tests use `*.spec-d.ts`.
    - **Import**: from the parent — `import { X } from '../X'`.
13. **Configuration awareness.** Check `tsconfig.json`, `.editorconfig`, `.prettierrc`, `eslint.config.mjs`, and
    `.stylelintrc.json` before deciding what's idiomatic.
14. **Commit after each logical unit of work.** Do not batch everything into one commit at the end. Each self-contained step (feature, fix, refactor) should be its own commit so history stays bisectable.
15. **Centralize reusable logic.** A component file should read like a component, not like half a program. Apply this
    hierarchy:
    - **Shared across components** → extract to a composable (`use*.ts`) or utility, and place it in the most fitting
      package. Other components should be able to benefit from it without duplication.
    - **Heavy but component-specific** → move to a sibling `.ts` file (e.g., `MyComponent.logic.ts`). That file is a
      private helper: it may export symbols that are intentionally *not* re-exported from `index.ts`. Think of it as a
      composable with exactly one friend.
    - **Truly component-local** → keep it inline, but only if it is lightweight and directly tied to rendering or
      lifecycle.
    The rule of thumb: if removing logic from the component body makes the component easier to read, move it out.

## IDE & build integrations (`integrations/`)

Rules that apply specifically to the contents of `integrations/`. The general TypeScript rules
above still apply to `integrations/node/*` packages.

1. **VS Code extension consumes `@xomda/*` via `workspace:*`, never via published versions.**
   Bug fixes flow immediately. `rolldown` (already in the repo via Vite 8.x — do **not** introduce
   esbuild or webpack) bundles the workspace deps into a single `out/extension.cjs` at packaging
   time. `vscode` is the only declared external (it is provided by the extension host at runtime).
2. **No `outDir` in `tsconfig.json` when extending the root `tsconfig.json`.** The root config has
   `paths` mappings that point into other packages' `src/` directories. Setting an explicit
   `outDir` makes TypeScript pin `rootDir` to the current project, which then errors on every
   path-mapped import as "outside `rootDir`". Leave `outDir` off; rolldown handles emission.
3. **All Gradle modules under `integrations/jvm/` must pin `layout.buildDirectory`:**
   ```kotlin
   layout.buildDirectory = layout.projectDirectory.dir("build")
   ```
   This defends against IDEs picking adjacent folders (especially anything called `lib/`) as a
   default compile-output sink, which is the original reason we moved off `lib/`.
4. **JVM plugins consume `xomda-generator-core` from `integrations/jvm/.m2-repo/`, never from
   `~/.m2/`.** The repo is populated by `pnpm test:jvm:install-core` (or its inline equivalent —
   `mvn -f integrations/jvm/generator-core install -Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo`).
   Use `-Dmaven.repo.local`, not `-DaltDeploymentRepository` (that flag is for `mvn deploy`, not
   `install`). This keeps clean checkouts reproducible without `~/.m2/` state.
5. **The Maven aggregator at `integrations/jvm/pom.xml` covers Maven modules only.** Adding the
   Gradle or IntelliJ modules to it would be invalid — they are Gradle projects, not Maven.
   Eclipse has its own aggregator at `integrations/jvm/eclipse/pom.xml`. `pnpm test:jvm` chains
   all four (Maven aggregator + Gradle plugin + IntelliJ plugin + Eclipse) in order.
6. **IDE plugins treat `.xomda/` as user data only.** Do not surface the meta-model self-bootstrap
   pattern (used inside the xomda repo for regenerating `@xomda/core` from `.xomda/templates/`) in
   the plugins' UI. That coupling would confuse end users and tie plugin releases to core regen
   cycles. Revisit only if a real user asks.
7. **Don't add per-plugin npm directories to `.github/dependabot.yml`.** The root `/` npm scan
   already covers the workspace; per-package entries would duplicate PRs.
8. **JVM plugin tests stay JUnit 5 unless they need IntelliJ Platform fixtures.** Adding
   `TestFrameworkType.Platform` to the IntelliJ plugin's dependencies pulls in a session listener
   that depends on legacy `junit.framework.TestCase` (JUnit 3/4). Revisit only when a test
   actually drives the IntelliJ Platform — the unit tests of pure-logic classes
   (`XomdaProjectInfo`, `XomdaModelReader`) do not.

## Code style summary (Prettier)

- 2-space indent, no semicolons, single quotes, 100-character line width.
- Template literals over string concatenation.
- Imports sorted (`simple-import-sort`): external → `@xomda/*` → relative.

## Vue component pattern

```typescript
import { defineComponent } from 'vue'
import styles from './MyComponent.module.scss'

export const MyComponent = defineComponent({
  name: 'MyComponent',
  props: { title: { type: String, required: true } },
  setup(props) {
    return () => <div class={styles.root}>{props.title}</div>
  },
})
```

## tRPC pattern

```typescript
// Router (backend)
export const myRouter = router({
  list: publicProcedure.query(() => readItems()),
  create: publicProcedure.input(ItemSchema).mutation(({ input }) => createItem(input)),
})

// Client
const items = await trpc.model.get.query()
await trpc.model.addEntity.mutate({ entity, packageId })
```

Router namespaces: `model.*`, `template.*`, `file.*`. Full reference: [`docs/api.md`](./docs/api.md).

## UI layout patterns (xomda client)

- **No `VNavigationDrawer` for content panels.** Navigation uses `AppNav`
  (`packages/client/src/components/AppNav`); split panels use `PanelDivider` + `usePanelResize`.
- **Vuetify global defaults** are set in `packages/client/src/vuetify.ts`: `size='small'` + `density='comfortable'` for
  most components with a size prop; **`VBtn` uses `density='default'`** (comfortable + small is too tight);
  `density='compact'` for `VList` / `VListItem` / `VListSubheader`. Do not override inline without reason.

## Full-screen background components

Backgrounds (canvas-2D, WebGL, particles, fractals, …) live in
`packages/ui/src/components/backgrounds/`. New ones go beside `GlassBackground` and `ParticleBackground` and follow
these rules — they exist to keep every background looking and behaving consistently and to centralise the heavy
plumbing.

- **Reuse the shared composables**, never re-implement them inline:
  - `useCanvasBackground({ paused, animationSpeed, onResize, onFrame })` → DPR-aware sizing via `ResizeObserver`,
    `requestAnimationFrame` loop, `paused` watch, `document.visibilitychange`, and `prefers-reduced-motion`. Returns
    `{ canvasRef, renderOnce }`.
  - `useThemeMode(() => props.mode)` → resolves `'light' | 'dark' | 'auto'` to a `Ref<boolean>`. Wraps `useTheme()` in
    a try/catch so unit tests without Vuetify still render.
  - `usePointerField(canvasRef)` → NDC pointer position + smoothed velocity + click-drop queue. Listens on `window`
    because the canvas is `pointer-events: none`.
- **Math helpers (mat4, vec3, `rotateAroundAxis`) are in `@xomda/util`.** Don't add a third copy.
- **Stacking-context contract.** Background canvases use `position: absolute; inset: 0; z-index: -1; pointer-events:
  none`. The consumer's wrapper **must** form a new stacking context (`isolation: isolate`) — see
  `packages/client/src/App.tsx`. Story decorators must do the same or the canvas slides behind the page and renders
  invisibly.
- **Light vs dark behavior.** Light mode keeps the page bright (dark/ink particles, normal alpha blending); dark mode
  glows (additive blending, bright color). Don't mirror the dark visual into light by tinting it dark — pick a
  light-mode-native treatment.
- **WebGL context flags.** Use `getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false })`.
  The default `premultipliedAlpha: true` washes additive passes into haze. WebGL2 only — no WebGL1 fallback (Safari
  15+ supports it); render an empty canvas silently if `getContext('webgl2')` returns `null`.
- **Theme-aware colour defaults.** Accept a `baseColor` prop override but default to a theme-derived colour via
  `useThemeMode`.
- **Presets ship as `Partial<Props>` bundles** in a sibling `presets.ts`. Any prop can be pinned (camera, field,
  physics, colours, lighting). Consumers spread per route: `<X {...presets.galaxy} />`.
- **Storybook controls quirk.** A prop with `default: undefined` is hidden from the Controls panel. Pin a default
  value in the story's `args` if you want users to interact with it.
- **Performance.** Use `Float32Array` buffers, interleaved layout, `bufferSubData` per frame. Particle physics step
  in flat typed arrays — no per-particle objects.

## Environment

- Node.js 20+, pnpm 10+, TypeScript 6.
- Backend port `6431`, frontend port `5173`, Storybook port `6006`.
- `XOMDA_DIR` env var (default: `.xomda`) — overrides the data directory.
- Storage: `.xomda/model.json` + `.xomda/templates/`.

## Where to read more

| Need | Document |
|---|---|
| Concepts (MDA, two-tier, self-definition) | [docs/concepts.md](./docs/concepts.md) |
| Data model schema | [docs/data-model.md](./docs/data-model.md) |
| Template language | [docs/templates.md](./docs/templates.md) |
| tRPC API | [docs/api.md](./docs/api.md) |
| Package architecture deep-dive | [docs/architecture.md](./docs/architecture.md) |
| Toolchain, scripts, env, deploy | [docs/development.md](./docs/development.md) |
| Detailed coding standards (Cursor MDC) | [.cursor/rules/coding-standards.mdc](./.cursor/rules/coding-standards.mdc) |
| Tech-stack details (Cursor MDC) | [.cursor/rules/tech-stack.mdc](./.cursor/rules/tech-stack.mdc) |
| Package overview (Cursor MDC) | [.cursor/rules/project-overview.mdc](./.cursor/rules/project-overview.mdc) |
