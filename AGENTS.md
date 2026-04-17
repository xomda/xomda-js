# Agent Instructions

**Single source of truth** for all AI coding assistants (Claude, Cursor, Copilot, Windsurf, Cline/Roo, Junie, …). Tool-specific files (`CLAUDE.md`, `.clinerules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.cursor/rules/*`) defer here.

## Project

**xomda.js** — Model-Driven Architecture (MDA) platform. TypeScript pnpm-workspace monorepo. Users design data models visually; code is generated from cell-based templates (`*.template.json`). Self-describing: its own meta-model lives in `.xomda/model.json`, editable from within xomda.

Deeper context: [`docs/concepts.md`](./docs/concepts.md), [`docs/architecture.md`](./docs/architecture.md), [`docs/data-model.md`](./docs/data-model.md).

## Commands

```bash
pnpm dev          # backend :6431 + frontend :5173 in parallel
pnpm build        # all packages
pnpm typecheck    # tsc --noEmit across workspace
pnpm test         # Vitest + Cypress (TS only)
pnpm test:jvm     # All JVM tests (Maven aggregator + Gradle + IntelliJ + Eclipse)
pnpm test:all     # TS then JVM (fast-fail before the slow JVM suite)
pnpm lint         # ESLint + Stylelint
pnpm format       # Prettier
pnpm -F @xomda/<pkg> <dev|typecheck|test>   # single package; -F = --filter
```

**Never use `npm` or `yarn`.**

### `pnpm test:jvm` chain

The Maven aggregator (`integrations/jvm/pom.xml`) covers Maven modules only (`generator-core`, `maven`, `eclipse/*`). Gradle modules (`gradle`, `intellij`) must run separately. Order:

1. `test:jvm:install-core` — publish `xomda-generator-core` to project-local repo `integrations/jvm/.m2-repo/` so downstream JVM consumers don't depend on `~/.m2/` state. Use `-Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo` (NOT `-DaltDeploymentRepository`, which is for `deploy` not `install`).
2. `test:jvm:maven` — Maven aggregator (generator-core + maven plugin).
3. `test:jvm:gradle-plugin` — Gradle build plugin.
4. `test:jvm:intellij` — IntelliJ plugin (Kotlin, IntelliJ Platform 2024.2.4, JDK 21).
5. `test:jvm:eclipse` — Eclipse plugin (Tycho 4.0.10, Eclipse 2024-09 target).

## Package layout

```
packages/                         Pure-library/runtime TS packages
  @xomda/core                     Zod schemas, types, constants (schema source of truth)
  @xomda/util                     Runtime helpers
  @xomda/template                 Cell-based template engine, processors, file storage
  @xomda/model                    tRPC router (CRUD), business logic
  @xomda/node                     Node.js HTTP server exposing tRPC
  @xomda/client                   Vue 3 SPA (Vuetify, Pinia, Vue Router, tRPC client)
  @xomda/diagram                  Vue 3 diagram components (Storybook)
  @xomda/icons                    Material Symbols icons
  @xomda/ui                       Generic UI (DynamicForm, TitleBar, …)
  @xomda/codeeditor               Monaco Editor for templates
  @xomda/cli                      CLI binary (`xomda generate`)
  @xomda/e2e-tests                Cypress end-to-end tests
  analysis/                       Analysis framework + plugins (nested subfolder)
    core                          @xomda/analysis-core — analysis framework
    <name>                        @xomda/plugin-analysis-<name> — 14 technology detectors
                                  (ant, eslint, gradle, intellij, maven, prettier, rust,
                                   stylelint, typescript, visualstudio, vite, vscode,
                                   webpack, xomda)

integrations/                     External-ecosystem integrations
  node/                           TS — share code with packages/ via workspace deps
    unplugin                      Vite / Rollup / webpack adapter
    vscode                        VS Code extension (rolldown-bundled .vsix)
  jvm/                            JVM — share xomda-generator-core via project-local Maven repo
    generator-core                Java engine; JVM equivalent of @xomda/template
    maven                         Maven plugin
    gradle                        Gradle build plugin
    intellij                      IntelliJ Platform plugin (Kotlin)
    eclipse                       Eclipse plugin (Tycho)
    .m2-repo/                     [gitignored] project-local Maven repo
    pom.xml                       Aggregator for *Maven* modules only
```

**Split rationale:** `packages/` = platform libraries (build on each other). `integrations/` = adapters to external ecosystems; they import from `packages/`, never the reverse. Grouped by language first (`node/` vs `jvm/`) because sibling plugins in the same language share code natively (pnpm workspace deps for TS, project-local Maven repo for JVM); cross-language sharing only happens at file-format level (the `.xomda/` convention).

Dependency direction (no cycles):

```
client → model → template → core
client → diagram → icons
client → ui → icons
client → codeeditor
node   → model
cli    → model, template
packages/analysis/<plugin> → packages/analysis/core
integrations/node/* → packages/*                        (workspace deps; bundled at packaging)
integrations/jvm/{gradle,maven,intellij,eclipse} → integrations/jvm/generator-core
```

## Essential rules

1. **pnpm only** — never `npm`/`yarn`.
2. **TypeScript strict; no `any`.** Use `unknown` + narrowing or generics. Always `import type` for type-only.
   - **Vuetify types:** Import `JSXComponent` from `'vuetify'` for icon/component props. `Record<string, any>` only for Vuetify activator slot props (Vuetify's own type — don't widen further). `vuetify.d.ts` shim files contain only `import '@xomda/icons'` — no hand-rolled overrides.
   - **Callbacks:** Let TS infer `.map`/`.filter`/`.some`/`.find` params — never annotate `: any`.
   - Sanctioned `any` only: the `on*` index signature in `env.d.ts` (Vue vnode hook compat) and generated code strings (e.g., `declare const x: any`). Anywhere else = bug.
3. **Vue components are `.tsx`** with `defineComponent`. No `.vue` SFCs.
4. **Named exports only** for components.
5. **One component per file.**
6. **Folder per composite component.** Sub-components in a folder; `index.ts` exports only the public API. Internal sub-components not re-exported.
7. **`index.ts` in every subfolder** (except `__tests__`). List exports explicitly — never `export *`.
8. **Shortest-route imports.** `import { X } from './X'`, not `'./X/X'` or `'./X/X/X'`.
9. **No file extensions in imports** (no `.ts`/`.tsx`).
10. **SCSS modules** for component-scoped styles (`*.module.scss`).
11. **Schemas live in `@xomda/core`.** Never define shared Zod schemas in consumer packages.
12. **Tests come with the change.** Vitest (or Cypress for E2E).
    - **Placement:** `__tests__/` subfolder next to code under test. `src/path/to/X.tsx` → `src/path/to/__tests__/X.spec.tsx`.
    - **Naming:** `*.spec.ts(x)` (not `*.test.ts`); type tests `*.spec-d.ts`.
    - **Import:** from parent — `import { X } from '../X'`.
13. **Check config before deciding what's idiomatic:** `tsconfig.json`, `.editorconfig`, `.prettierrc`, `eslint.config.mjs`, `.stylelintrc.json`.
14. **Commit after each logical unit of work.** Not one batched commit at the end — keep history bisectable.
15. **Centralize reusable logic.** A component file should read like a component, not half a program:
    - **Shared across components** → composable (`use*.ts`) or utility in the most fitting package.
    - **Heavy but component-specific** → sibling `.ts` file (e.g., `MyComponent.logic.ts`); may export symbols NOT re-exported from `index.ts`. A composable with exactly one friend.
    - **Truly component-local** → inline, only if lightweight and tied to rendering/lifecycle.
    Rule of thumb: if moving logic out makes the component easier to read, move it out.

## IDE & build integrations (`integrations/`)

General TS rules above still apply to `integrations/node/*`.

1. **VS Code extension consumes `@xomda/*` via `workspace:*`**, never published versions. Bug fixes flow immediately. `rolldown` (already in repo via Vite 8.x — do NOT add esbuild/webpack) bundles workspace deps into a single `out/extension.cjs` at packaging. `vscode` is the only declared external (provided by extension host at runtime).
2. **No `outDir` in `tsconfig.json` when extending root.** Root config has `paths` into other packages' `src/`. Setting explicit `outDir` pins `rootDir` to the current project → errors on every path-mapped import as "outside `rootDir`". Leave `outDir` off; rolldown emits.
3. **All Gradle modules under `integrations/jvm/` pin `layout.buildDirectory`:**
   ```kotlin
   layout.buildDirectory = layout.projectDirectory.dir("build")
   ```
   Defends against IDEs picking adjacent folders (especially `lib/`) as default compile-output sink — original reason we moved off `lib/`.
4. **JVM plugins consume `xomda-generator-core` from `integrations/jvm/.m2-repo/`**, never `~/.m2/`. Populated by `pnpm test:jvm:install-core` (or inline: `mvn -f integrations/jvm/generator-core install -Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo`). Use `-Dmaven.repo.local`, not `-DaltDeploymentRepository` (that's for `deploy`, not `install`). Keeps clean checkouts reproducible.
5. **The Maven aggregator covers Maven modules only.** Adding Gradle/IntelliJ to it would be invalid (they're Gradle). Eclipse has its own aggregator at `integrations/jvm/eclipse/pom.xml`. `pnpm test:jvm` chains all four (Maven aggregator + Gradle + IntelliJ + Eclipse).
6. **IDE plugins treat `.xomda/` as user data only.** Don't surface the meta-model self-bootstrap pattern (used inside xomda repo for regenerating `@xomda/core` from `.xomda/templates/`) in plugin UI. Would confuse end users and couple plugin releases to core regen. Revisit only on a real user ask.
7. **Don't add per-plugin npm directories to `.github/dependabot.yml`.** Root `/` npm scan already covers the workspace; per-package entries duplicate PRs.
8. **JVM plugin tests stay JUnit 5 unless they need IntelliJ Platform fixtures.** Adding `TestFrameworkType.Platform` to IntelliJ plugin deps pulls a session listener that requires legacy `junit.framework.TestCase` (JUnit 3/4). Revisit only when a test actually drives IntelliJ Platform — pure-logic unit tests (`XomdaProjectInfo`, `XomdaModelReader`) don't.

## Code style (Prettier)

2-space indent · no semicolons · single quotes · 100-char line width · template literals over concatenation · imports sorted by `simple-import-sort`: external → `@xomda/*` → relative.

## Java / Kotlin code style

**Formatter** — Eclipse JDT formatter, profile [`eclipse-formatter.xml`](./eclipse-formatter.xml) at repo root. 4-space indent, 120-col, K&R braces. Set up to *preserve* author line breaks ("Never join already wrapped lines") so chained calls, builders and stream pipelines keep the shape you give them — short chains stay on one line, longer ones wrap where you wrap them. Auto-applied at Maven `process-sources` by `net.revelc.code.formatter:formatter-maven-plugin`; runs in the IDE via the Red Hat Java VS Code extension and IntelliJ "Eclipse Code Formatter" plugin.

**Linter** — Checkstyle, rules in [`checkstyle.xml`](./checkstyle.xml). Runs as `validate` phase in every Maven module under `integrations/jvm/`. Configs are resolved through `${maven.multiModuleProjectDirectory}` (set by the `.mvn/` marker at the repo root).

**Imports — single-import only.**

1. **No wildcard imports.** Not for regular imports (`import java.util.*`), not for static (`import static org.junit.jupiter.api.Assertions.*`). Enforced by Checkstyle `AvoidStarImport`. Import each symbol explicitly.
2. **Prefer static imports when they improve readability** — assertions, matchers, common factory methods (`Map.of`, `List.of`, `Collectors.toList`, …). The bar is "the call site is clearer without the type prefix"; if a static prefix carries useful context, keep it qualified.
3. **No fully-qualified names in the body** — use an `import`. `java.util.UUID.randomUUID()` inline is a smell; import `UUID` and call `UUID.randomUUID()`. Same for Kotlin. Inline FQNs only when two different types would collide (one wins the import, the other is qualified once at the call site).

Same import rules apply in Kotlin (`integrations/jvm/intellij/**.kt`).

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

- **No `VNavigationDrawer` for content panels.** Navigation uses `AppNav` (`packages/client/src/components/AppNav`); split panels use `PanelDivider` + `usePanelResize`.
- **Vuetify global defaults** in `packages/client/src/vuetify.ts`: `size='small'` + `density='comfortable'` for most components with a size prop; **`VBtn` uses `density='default'`** (comfortable + small is too tight); `density='compact'` for `VList` / `VListItem` / `VListSubheader`. Don't override inline without reason.

## Full-screen background components

Backgrounds (canvas-2D, WebGL, particles, fractals, …) live in `packages/ui/src/components/backgrounds/`. New ones go beside `AuroraBackground` (the default in `App.tsx`), `GlassBackground`, and `ParticleBackground` and follow these rules — they exist to keep every background consistent and centralise the heavy plumbing.

- **Reuse shared composables**, never re-implement inline:
  - `useCanvasBackground({ paused, animationSpeed, onResize, onFrame })` → DPR-aware sizing via `ResizeObserver`, `requestAnimationFrame` loop, `paused` watch, `document.visibilitychange`, `prefers-reduced-motion`. Returns `{ canvasRef, renderOnce }`.
  - `useThemeMode(() => props.mode)` → resolves `'light' | 'dark' | 'auto'` to `Ref<boolean>`. Wraps `useTheme()` in try/catch so unit tests without Vuetify still render.
  - `usePointerField(canvasRef)` → NDC pointer position + smoothed velocity + click-drop queue. Listens on `window` because the canvas is `pointer-events: none`.
- **Math helpers (mat4, vec3, `rotateAroundAxis`) are in `@xomda/util`.** Don't add a third copy.
- **Stacking-context contract.** Background canvases use `position: absolute; inset: 0; z-index: -1; pointer-events: none`. The consumer's wrapper **must** form a new stacking context (`isolation: isolate`) — see `packages/client/src/App.tsx`. Story decorators must do the same or the canvas slides behind the page and renders invisibly.
- **Light vs dark behavior.** Light = bright page (dark/ink particles, normal alpha blending); dark = glow (additive blending, bright color). Don't mirror dark into light by tinting it dark — pick a light-mode-native treatment.
- **WebGL context flags.** Use `getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false })`. Default `premultipliedAlpha: true` washes additive passes into haze. WebGL2 only — no WebGL1 fallback (Safari 15+ supports it); render an empty canvas silently if `getContext('webgl2')` returns `null`.
- **Theme-aware colour defaults.** Accept a `baseColor` prop override; default to a theme-derived colour via `useThemeMode`.
- **Presets ship as `Partial<Props>` bundles** in a sibling `presets.ts`. Any prop can be pinned (camera, field, physics, colours, lighting). Consumers spread per route: `<X {...presets.galaxy} />`.
- **Storybook controls quirk.** A prop with `default: undefined` is hidden from Controls. Pin a default in story `args` if users should interact with it.
- **Performance.** `Float32Array` buffers, interleaved layout, `bufferSubData` per frame. Particle physics step in flat typed arrays — no per-particle objects.

## Environment

Node.js 20+ · pnpm 10+ · TypeScript 6 · backend `:6431` · frontend `:5173` · Storybook `:6006` · `XOMDA_DIR` env (default `.xomda`) overrides data dir · storage: `.xomda/model.json` + `.xomda/templates/`.

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
