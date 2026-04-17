# Agent Instructions

**Single source of truth** for all AI coding assistants (Claude, Cursor, Copilot, Windsurf, Cline/Roo, Junie, …).
Tool-specific files (`CLAUDE.md`, `.clinerules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.cursor/rules/*`)
defer here.

## Project

**xomda.js** — Model-Driven Architecture (MDA) platform. TypeScript pnpm-workspace monorepo. Users design data models
visually; code is generated from cell-based templates (`*.template.json`). Self-describing: its own meta-model lives in
`.xomda/model.json`, editable from within xomda.

Deeper context: [`docs/concepts.md`](./docs/concepts.md), [`docs/architecture.md`](./docs/architecture.md), [
`docs/data-model.md`](./docs/data-model.md).

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

The Maven aggregator (`integrations/jvm/pom.xml`) covers Maven modules only (`generator-core`, `maven`, `eclipse/*`).
Gradle modules (`gradle`, `intellij`) must run separately. Order:

1. `test:jvm:install-core` — publish `xomda-generator-core` to project-local repo `integrations/jvm/.m2-repo/` so
   downstream JVM consumers don't depend on `~/.m2/` state. Use `-Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo` (NOT
   `-DaltDeploymentRepository`, which is for `deploy` not `install`).
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
    core                          @xomda/analysis-core — node-side framework
                                  (ProjectAnalyzer, registry, worker_thread runner)
    client                        @xomda/analysis-client — browser-side registry
                                  (icons, custom preview components)
    plugins                       @xomda/analysis-plugins — node-side aggregator
                                  (side-effect imports every plugin's index.ts)
    plugins-client                @xomda/analysis-plugins-client — client-side
                                  aggregator (side-effect imports every ./client)
    <name>                        @xomda/plugin-analysis-<name> — 17 technology detectors
                                  with both halves: ./index (node detect + fileTypes
                                  + projectKind), ./client (icon + preview components).
                                  (ant, binary, eslint, gradle, intellij, markdown, maven,
                                   node, prettier, rust, stylelint, typescript, visualstudio,
                                   vite, vscode, webpack, xomda)

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

**Split rationale:** `packages/` = platform libraries (build on each other). `integrations/` = adapters to external
ecosystems; they import from `packages/`, never the reverse. Grouped by language first (`node/` vs `jvm/`) because
sibling plugins in the same language share code natively (pnpm workspace deps for TS, project-local Maven repo for JVM);
cross-language sharing only happens at file-format level (the `.xomda/` convention).

Dependency direction (no cycles):

```
client → model → template → core
client → ui → icons                  (HexView, MultiIcon, etc. live in @xomda/ui)
client → diagram → icons
client → codeeditor
client → analysis-client, analysis-plugins-client
node   → model
cli    → model, template
model  → analysis-core, analysis-plugins         (server runs the analyzer)
packages/analysis/core                            (node only — imports node:fs)
packages/analysis/<plugin> → analysis-core, core, icons
packages/analysis/<plugin>/client → analysis-client, icons
packages/analysis/plugins        → every <plugin>          (side-effect aggregator)
packages/analysis/plugins-client → every <plugin>/client   (side-effect aggregator)
integrations/node/* → packages/*                        (workspace deps; bundled at packaging)
integrations/jvm/{gradle,maven,intellij,eclipse} → integrations/jvm/generator-core
```

## Essential rules

1. **pnpm only** — never `npm`/`yarn`.
2. **TypeScript strict; no `any`.** Use `unknown` + narrowing or generics. Always `import type` for type-only.

- **Vuetify types:** Import `JSXComponent` from `'vuetify'` for icon/component props. `Record<string, any>` only for
  Vuetify activator slot props (Vuetify's own type — don't widen further). `vuetify.d.ts` shim files contain only
  `import '@xomda/icons'` — no hand-rolled overrides.
- **Callbacks:** Let TS infer `.map`/`.filter`/`.some`/`.find` params — never annotate `: any`.
- Sanctioned `any` only: the `on*` index signature in `env.d.ts` (Vue vnode hook compat) and generated code strings (
  e.g., `declare const x: any`). Anywhere else = bug.

3. **Vue components are `.tsx`** with `defineComponent`. No `.vue` SFCs.
4. **Named exports only** for components.
5. **One component per file.**
6. **Folder per composite component.** Sub-components in a folder; `index.ts` exports only the public API. Internal
   sub-components not re-exported.
7. **`index.ts` in every subfolder** (except `__tests__`). List exports explicitly — never `export *`.
8. **Shortest-route imports.** `import { X } from './X'`, not `'./X/X'` or `'./X/X/X'`.
9. **No file extensions in imports** (no `.ts`/`.tsx`).
10. **SCSS modules** for component-scoped styles (`*.module.scss`).
11. **Schemas live in `@xomda/core`.** Never define shared Zod schemas in consumer packages.
12. **Tests come with the change.** Vitest (or Cypress for E2E).

- **Placement:** `__tests__/` subfolder next to code under test. `src/path/to/X.tsx` →
  `src/path/to/__tests__/X.spec.tsx`.
- **Naming:** `*.spec.ts(x)` (not `*.test.ts`); type tests `*.spec-d.ts`.
- **Import:** from parent — `import { X } from '../X'`.
- **Bug fixes:** add a test that reproduces the bug (fails before the fix, passes after) — Vitest for logic, Cypress
  for E2E. Skip only when a test is genuinely impractical (e.g. environment-specific build glitch) and note why in the
  commit.

13. **Check config before deciding what's idiomatic:** `tsconfig.json`, `.editorconfig`, `.prettierrc`,
    `eslint.config.mjs`, `.stylelintrc.json`.
14. **Commit per logical unit, autonomously.** One coherent step (file, feature, passing-tests milestone) = one commit,
    made *before* starting the next step; task authorisation covers its commits — don't ask. N independent changes ≈ N
    commits, never one batched commit at the end. Push only on user request.
15. **Centralize reusable logic.** A component file should read like a component, not half a program:

- **Shared across components** → composable (`use*.ts`) or utility in the most fitting package.
- **Heavy but component-specific** → sibling `.ts` file (e.g., `MyComponent.logic.ts`); may export symbols NOT
  re-exported from `index.ts`. A composable with exactly one friend.
- **Truly component-local** → inline, only if lightweight and tied to rendering/lifecycle.
  Rule of thumb: if moving logic out makes the component easier to read, move it out.
- **Where the file lives:** generic, reusable across packages → `packages/ui/src/{composables,stores}`. Tied to one
  consumer (its tRPC router, its routes) → that consumer's `src/composables`. Promote up when a second consumer needs
  it.

16. **Every visual component in a package that has a Storybook ships a `*.stories.tsx`** next to it (same folder,
    exported via `index.ts` only if there's a reason; the story file itself is auto-picked up). Packages with a
    Storybook: `@xomda/ui`, `@xomda/diagram`. **Wire Actions + Interactions whenever the component has behavior to
    observe:** import `fn`/`expect`/`fireEvent`/`waitFor`/`within` from `storybook/test`; pass `fn()` spies (or declare
    `argTypes.onX: { action: 'x' }`) for every event/callback so the Actions panel logs them; add a `play` async fn
    using `step('…', …)` to script the golden interactions and assert observable outcomes. Prefer `fireEvent.*` over
    `userEvent.*` — Vuetify's `VApp` wrapper can carry `pointer-events: none` mid-transition and break userEvent's
    pointer trace. Use `data-testid` (not `data-test`) — that's what `getByTestId` matches. Skip play only for
    purely-presentational components with no interaction worth verifying.
17. **Every icon-only button has a tooltip.** Use `MenuButton` from `@xomda/ui` when the button opens a menu — it
    enforces tooltip + aria-label. For non-menu icon buttons, wrap a `<VBtn icon={…} aria-label="…">` in `<VTooltip>`.
18. **WCAG 2.1 AA.** `aria-label` on every icon-only control; sufficient contrast for `color="error"` / disabled states;
    all interactive items keyboard-reachable. `Menu` items inherit keyboard navigation from the underlying `VList`. *
    *Drag-and-drop**: `useNodeDrag` is currently pointer-only — keyboard equivalence (Space-to-pick-up, arrow-to-move,
    Esc-to-cancel) is a known gap tracked in `docs/todo.md` and must be added before any new DnD surface is allowed to
    merge.
19. **Keep xomda's self-bootstrap in sync.** xomda is self-describing: its meta-model lives in [
    `.xomda/model.json`](./.xomda/model.json) and its own generator targets live under [
    `.xomda/templates/`](./.xomda/templates/). Whenever you change:

- the data-model schema in `@xomda/core` (entities, attributes, enums) or the model router (`@xomda/model`) — *
  *update `.xomda/model.json` to match** so xomda can still regenerate itself.
- a template processor, cell type, or generated-output convention in `@xomda/template` — **update the corresponding
  template under `.xomda/templates/`** (or add a new one) so the meta-templates reflect the new contract.
  Failing to round-trip leaves the self-bootstrap inconsistent — the next regen drifts from the source code. If a
  change is genuinely out of scope for the self-model (UI-only, ephemeral), say so explicitly in the commit message
  instead of skipping silently.

20. **Document the _why_, only where it's not obvious.** Don't comment for the sake of it. Readers (human + AI) should
    grasp non-obvious intent without git archaeology. Applies to TS _and_ JVM (Java/Kotlin under `integrations/jvm/`).

- **JSDoc / Javadoc / KDoc on exported symbols whose purpose isn't obvious from name + types** (fn, class, component,
  composable, store, type): purpose, non-obvious contracts, side effects, ordering, units. `@param`/`@returns` only
  when they add info the type doesn't.
- **Types are docs.** Prefer precise types — TS: literal unions, branded, `readonly`, discriminated unions,
  `Parameters<>`/`ReturnType<>`; Java/Kotlin: sealed types, records, generics, `final`. A good type removes the need
  for a comment. (`any`/`unknown` to silence errors: banned, see rule 2.)
- **Inline comments — _why_ it's there, plus _what_ it does when non-obvious.** Triggers: non-obvious call site, dense
  logic worth a plain-English summary, workaround (link the issue), hidden invariant, deliberate pattern break. Don't
  restate trivial code.
- **Reference durable things** (specs, upstream issues, RFCs). Never the current task/PR — that belongs in the commit
  message and rots.
- **Update comments with the code they describe** in the same commit — a stale comment is worse than none.

21. **Keep `AGENTS.md` itself lean.** This file is loaded into every agent's context — every line pays for itself. Dense
    scannable facts, no narrative; link to canonical docs rather than duplicating them; replace stale lines, don't
    accrete; if a rule fits in five words, don't write fifteen. Audit your own edits with this lens before saving.
22. **Keep [`docs/.ai/*`](./docs/.ai/) in sync with the public surface.** Those files ship inside the published `xomda`
    tarball as the contract for AI agents in downstream projects. Same-commit updates:

- `@xomda/core` data-model schema → [`model-format.md`](./docs/.ai/model-format.md)
- `@xomda/template` engine / cell types / helpers → [`template-format.md`](./docs/.ai/template-format.md)
- CLI surface in `packages/xomda/src/bin.ts` → [`cli-reference.md`](./docs/.ai/cli-reference.md)
- High-level mental model → [`AGENT_GUIDE.md`](./docs/.ai/AGENT_GUIDE.md)
  Drift here doesn't fail tests; agents in dependent projects produce silently-wrong files months later.

23. **Build/automation scripts: TS via `node --experimental-strip-types` (preferred for non-trivial), or plain
    ESM `.js`. Never CJS.** Imports in `.ts` scripts need explicit `.ts` extensions (no `tsx`/`ts-node`; strip-types is
    stable in Node 22.18+). Rule 2's "no webpack/esbuild for core" is runtime-only — strip-types and rolldown (
    vscode-ext) are sanctioned build-time tools.
24. **ESNext is the default.** All TypeScript packages target `ESNext` (`"target": "ESNext"`, `"module": "ESNext"`,
    `"moduleResolution": "bundler"` or `"NodeNext"` where appropriate). ES Modules only — never CommonJS (
    `"type": "module"` in `package.json`). No `require()`, no `module.exports`, no `.cjs` output for new code. Downlevel
    transpilation is the bundler's responsibility, not the source's.

## Canonical composables and stores

The five utilities below are the **only** sanctioned way to solve their respective problems. Adding a parallel
implementation in a view or sibling composable is a code-review-blocking issue.

| Problem                                                                         | Use                                                             | Where it lives   |
|---------------------------------------------------------------------------------|-----------------------------------------------------------------|------------------|
| tRPC mutation/query with loading state, parsed error, toast surface             | `useMutation`                                                   | `@xomda/ui`      |
| Local (non-tRPC) async with inline error UI                                     | `useAsyncState` (calls it `run()`, not `execute()` in new code) | `@xomda/ui`      |
| Normalising any tRPC client error into `{ message, code, fields[], transport }` | `parseTrpcError`                                                | `@xomda/ui`      |
| Pushing a toast (info / success / warning / error)                              | `useNotificationsStore`                                         | `@xomda/ui`      |
| Buffered edit state with dirty tracking and revert                              | `useEditBuffer<T>`                                              | `@xomda/ui`      |
| Pointer-drag-to-reposition for a diagram node                                   | `useNodeDrag`                                                   | `@xomda/diagram` |

**Bans (anti-patterns).**

- `console.error(e)` on a tRPC failure — silent in production. Wrap the call in `useMutation` (toast comes for free), or
  fall back to `useNotificationsStore().error(parseTrpcError(e).message)`.
- `originalX = JSON.parse(JSON.stringify(X))` + `JSON.stringify(a) !== JSON.stringify(b)` for dirty tracking. Broken on
  key reorder and drops `undefined`. Use `useEditBuffer<T>`.
- Inline pointer-down/move/up state machines on diagram nodes. New node kinds must call `useNodeDrag` (the contract is
  the same for entities, enums, packages, and anything else added later).
- Direct `localStorage.setItem` outside `useLocalStorageStore` — see `packages/ui/src/stores/local-storage.ts`.

## Reviews and audits

When the user asks for a **review**, **audit**, **critique**, or **code review**,
[`docs/code-review.md`](./docs/code-review.md) is the **complete specification** — follow it in full. It defines every
persona (elite architect + staff/principal + tech lead + product engineer + UX/UI + functional analyst + PM + QA +
DevOps + security + performance + observability + API-contract + AI-readiness + TypeScript elite expert + nerd
consistency enforcer), the 7-lens parallel-agent method, the 21-section output format, the per-finding fields, and the
post-review TDD discipline. The quality bar is Apple-style craftsmanship — _no over-engineering, no cargo-culting, no
performative thoroughness_.

## IDE & build integrations (`integrations/`)

General TS rules above still apply to `integrations/node/*`.

1. **VS Code extension consumes `@xomda/*` via `workspace:*`**, never published versions. Bug fixes flow immediately.
   `rolldown` (already in repo via Vite 8.x — do NOT add esbuild/webpack) bundles workspace deps into a single
   `out/extension.cjs` at packaging. `vscode` is the only declared external (provided by extension host at runtime).
2. **No `outDir` in `tsconfig.json` when extending root.** Root config has `paths` into other packages' `src/`. Setting
   explicit `outDir` pins `rootDir` to the current project → errors on every path-mapped import as "outside `rootDir`".
   Leave `outDir` off; rolldown emits.
3. **All Gradle modules under `integrations/jvm/` pin `layout.buildDirectory`:**
   ```kotlin
   layout.buildDirectory = layout.projectDirectory.dir("build")
   ```
   Defends against IDEs picking adjacent folders (especially `lib/`) as default compile-output sink — original reason we
   moved off `lib/`.
4. **JVM plugins consume `xomda-generator-core` from `integrations/jvm/.m2-repo/`**, never `~/.m2/`. Populated by
   `pnpm test:jvm:install-core` (or inline:
   `mvn -f integrations/jvm/generator-core install -Dmaven.repo.local=$PWD/integrations/jvm/.m2-repo`). Use
   `-Dmaven.repo.local`, not `-DaltDeploymentRepository` (that's for `deploy`, not `install`). Keeps clean checkouts
   reproducible.
5. **The Maven aggregator covers Maven modules only.** Adding Gradle/IntelliJ to it would be invalid (they're Gradle).
   Eclipse has its own aggregator at `integrations/jvm/eclipse/pom.xml`. `pnpm test:jvm` chains all four (Maven
   aggregator + Gradle + IntelliJ + Eclipse).
6. **IDE plugins treat `.xomda/` as user data only.** Don't surface the meta-model self-bootstrap pattern (used inside
   xomda repo for regenerating `@xomda/core` from `.xomda/templates/`) in plugin UI. Would confuse end users and couple
   plugin releases to core regen. Revisit only on a real user ask.
7. **Don't add per-plugin npm directories to `.github/dependabot.yml`.** Root `/` npm scan already covers the workspace;
   per-package entries duplicate PRs.
8. **JVM plugin tests stay JUnit 5 unless they need IntelliJ Platform fixtures.** Adding `TestFrameworkType.Platform` to
   IntelliJ plugin deps pulls a session listener that requires legacy `junit.framework.TestCase` (JUnit 3/4). Revisit
   only when a test actually drives IntelliJ Platform — pure-logic unit tests (`XomdaProjectInfo`, `XomdaModelReader`)
   don't.

## Publishing

The repo ships **one** public npm package — `xomda` — bundled from every
internal `@xomda/*` workspace package. The internal packages are workspace-private
(`"private": true`) and never published individually.

### Architecture

```
target/npm/                              build output (gitignored)
├── xomda/                               staged tarball root
│   ├── package.json                     generated — see source-of-truth below
│   ├── README.md                        rendered from README.template.md
│   ├── LICENSE
│   ├── dist/cli.js                      Vite-bundled CLI (#!/usr/bin/env node, executable)
│   ├── client/                          pre-built SPA + vendor.manifest.json
│   └── docs/.ai/                        AI-targeted docs (see rule 21)
└── xomda-<version>.tgz                  what gets npm-published
```

Source of truth for the bundle build:

- `packages/xomda/src/bin.ts` — CLI entry. Subcommands: `serve` (default), `generate`, `preview`, `diff`, `wrapper`.
  Imports `startServer` from `@xomda/node` and `generate`/`preview`/`diff`/`wrapper` from `@xomda/cli`.
- `packages/xomda/vite.config.ts` — Vite library mode bundling `bin.ts` → `dist/cli.js`. Externals: `commander`,
  `@trpc/server`, every `node:*`. Everything else (incl. all `@xomda/*` workspace code) is inlined.
- `packages/xomda/package.template.json` + `README.template.md` — stable fields. Per-release fields (version, author,
  repository, …) are merged in from root `package.json` so version sync flows through one file.
- `packages/xomda/scripts/build.ts` — orchestrator. Run via `pnpm build:publish`.

### SPA externalization contract

The SPA externalizes packages listed in [
`packages/client/vite-plugins/externals.ts`](./packages/client/vite-plugins/externals.ts) (`PUBLISH_EXTERNALS`). At
publish-build time (`XOMDA_BUILD=publish`) the publish plugin:

1. Tells Rollup to leave those packages external (not inlined into the SPA).
2. Injects a `<script type="importmap">` into `index.html` mapping each bare specifier to `/vendor/<pkg>/…`.
3. Emits `dist/vendor.manifest.json` listing absolute on-disk paths to each externalized package's root.

The runtime server reads the manifest on startup and serves `/vendor/<pkg>/<deep-path>` by resolving inside that
package's root in its own `node_modules`. So **every package in `PUBLISH_EXTERNALS` must also be a runtime `dependency`
in `packages/xomda/package.template.json`** — the build script verifies this and fails the build if a new external slips
through without a paired dep entry.

**Monaco stays bundled.** Its `?worker` imports in [
`packages/codeeditor/src/monaco.ts`](./packages/codeeditor/src/monaco.ts) are a Vite-bundle-time convention;
externalizing it would break workers in the browser. Don't add `monaco-editor` to `PUBLISH_EXTERNALS`.

**Vuetify CSS stays bundled.** It's compiled from the user's `settings.scss` theme at SPA build time. Only the Vuetify
JS is externalized.

### Tests

`pnpm -F @xomda/bundle test` runs two suites:

- `build.spec.ts` — runs the build once, then asserts staged-tree structure, package.json fields, tarball entries (no
  node_modules, no .ts source, no test files leaking), and bundle-content invariants (commander/`@trpc/server` external,
  `node:*` external, `@xomda/*` inlined, importmap present).
- `install-smoke.spec.ts` — slower: `npm install <tarball>` into a tmpdir, spawns the installed binary, hits `/`,
  `/vendor/lodash-es/lodash.js`, deep vendor paths, `/vendor.manifest.json` (must 404), `/trpc/`, and the SPA fallback.
  Set `XOMDA_SKIP_INSTALL_SMOKE=1` to skip locally.

`pnpm -F @xomda/bundle test:tarball-cypress` runs the browser-level smoke: builds, installs, spawns the binary, and runs
the `smoke/tarball.cy.ts` Cypress spec against it. Needed for releases; not part of the default test loop.

### Publish workflow

`.github/workflows/publish.yml` is **the only path to npmjs.com.** Triggered by `v*` tags. It runs `pnpm test` (incl.
the install-smoke), then `pnpm build:publish`, then
`npm publish target/npm/xomda-<version>.tgz --provenance --access public --tag <derived-tag>`. The `--provenance` flag +
`id-token: write` permission unlocks npm's verified-publisher badge.

The workflow runs the same `pnpm build:publish` script developers run locally — there is no CI-only path. The artifact
at `target/npm/xomda-<version>.tgz` is identical in both flows.

## Code style (Prettier)

2-space indent · no semicolons · single quotes · 100-char line width · template literals over concatenation · imports
sorted by `simple-import-sort`: external → `@xomda/*` → relative.

## Java / Kotlin code style

**Formatter** — Eclipse JDT formatter, profile [`eclipse-formatter.xml`](./eclipse-formatter.xml) at repo root. 4-space
indent, 120-col, K&R braces. Set up to _preserve_ author line breaks ("Never join already wrapped lines") so chained
calls, builders and stream pipelines keep the shape you give them — short chains stay on one line, longer ones wrap
where you wrap them. Auto-applied at Maven `process-sources` by `net.revelc.code.formatter:formatter-maven-plugin`; runs
in the IDE via the Red Hat Java VS Code extension and IntelliJ "Eclipse Code Formatter" plugin.

**Linter** — Checkstyle, rules in [`checkstyle.xml`](./checkstyle.xml). Runs as `validate` phase in every Maven module
under `integrations/jvm/`. Configs are resolved through `${maven.multiModuleProjectDirectory}` (set by the `.mvn/`
marker at the repo root).

**Imports — single-import only.**

1. **No wildcard imports.** Not for regular imports (`import java.util.*`), not for static (
   `import static org.junit.jupiter.api.Assertions.*`). Enforced by Checkstyle `AvoidStarImport`. Import each symbol
   explicitly.
2. **Prefer static imports when they improve readability** — assertions, matchers, common factory methods (`Map.of`,
   `List.of`, `Collectors.toList`, …). The bar is "the call site is clearer without the type prefix"; if a static prefix
   carries useful context, keep it qualified.
3. **No fully-qualified names in the body** — use an `import`. `java.util.UUID.randomUUID()` inline is a smell; import
   `UUID` and call `UUID.randomUUID()`. Same for Kotlin. Inline FQNs only when two different types would collide (one
   wins the import, the other is qualified once at the call site).

Same import rules apply in Kotlin (`integrations/jvm/intellij/**.kt`).

## Vue component pattern

```typescript
import { defineComponent } from 'vue'
import styles from './MyComponent.module.scss'

export const MyComponent = defineComponent({
  name: 'MyComponent',
  props: { title: { type: String, required: true } },
  setup(props) {
    return () => <div class = { styles.root } > { props.title } < /div>
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

Router namespaces: `model.*`, `template.*`, `file.*`, `analysis.*`, `project.*`. Full reference: [
`docs/api.md`](./docs/api.md).

## UI layout patterns (xomda client)

- **No `VNavigationDrawer` for content panels.** Navigation uses `AppNav` (`packages/client/src/components/AppNav`);
  split panels use `PanelDivider` + `usePanelResize`.
- **Vuetify global defaults** in `packages/client/src/vuetify.ts`: `size='small'` + `density='comfortable'` for most
  components with a size prop; **`VBtn` uses `density='default'`** (comfortable + small is too tight);
  `density='compact'` for `VList` / `VListItem` / `VListSubheader`. Don't override inline without reason.

## Full-screen background components

Backgrounds (canvas-2D, WebGL, particles, fractals, …) live in `packages/ui/src/components/backgrounds/`. New ones go
beside `AuroraBackground` (the default in `App.tsx`), `GlassBackground`, and `ParticleBackground` and follow these
rules — they exist to keep every background consistent and centralise the heavy plumbing.

- **Reuse shared composables**, never re-implement inline:
  - `useCanvasBackground({ paused, animationSpeed, onResize, onFrame })` → DPR-aware sizing via `ResizeObserver`,
    `requestAnimationFrame` loop, `paused` watch, `document.visibilitychange`, `prefers-reduced-motion`. Returns
    `{ canvasRef, renderOnce }`.
  - `useThemeMode(() => props.mode)` → resolves `'light' | 'dark' | 'auto'` to `Ref<boolean>`. Wraps `useTheme()` in
    try/catch so unit tests without Vuetify still render.
  - `usePointerField(canvasRef)` → NDC pointer position + smoothed velocity + click-drop queue. Listens on `window`
    because the canvas is `pointer-events: none`.
- **Math helpers (mat4, vec3, `rotateAroundAxis`) are in `@xomda/util`.** Don't add a third copy.
- **Stacking-context contract.** Background canvases use
  `position: absolute; inset: 0; z-index: -1; pointer-events: none`. The consumer's wrapper **must** form a new stacking
  context (`isolation: isolate`) — see `packages/client/src/App.tsx`. Story decorators must do the same or the canvas
  slides behind the page and renders invisibly.
- **Light vs dark behavior.** Light = bright page (dark/ink particles, normal alpha blending); dark = glow (additive
  blending, bright color). Don't mirror dark into light by tinting it dark — pick a light-mode-native treatment.
- **WebGL context flags.** Use `getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false })`.
  Default `premultipliedAlpha: true` washes additive passes into haze. WebGL2 only — no WebGL1 fallback (Safari 15+
  supports it); render an empty canvas silently if `getContext('webgl2')` returns `null`.
- **Theme-aware colour defaults.** Accept a `baseColor` prop override; default to a theme-derived colour via
  `useThemeMode`.
- **Presets ship as `Partial<Props>` bundles** in a sibling `presets.ts`. Any prop can be pinned (camera, field,
  physics, colours, lighting). Consumers spread per route: `<X {...presets.galaxy} />`.
- **Storybook controls quirk.** A prop with `default: undefined` is hidden from Controls. Pin a default in story `args`
  if users should interact with it.
- **Performance.** `Float32Array` buffers, interleaved layout, `bufferSubData` per frame. Particle physics step in flat
  typed arrays — no per-particle objects.

## Environment

Node 22.6+ (declared in root `engines.node`; `.npmrc` has `engine-strict=true`) — required everywhere because
`node --experimental-strip-types` is used in build scripts and the published `xomda` package · pnpm 11+ · TypeScript 6 ·
backend `:6431` · frontend `:5173` · Storybook `:6006` · publish-build artifacts at `target/npm/xomda-<version>.tgz` (
gitignored) · `XOMDA_DIR` env (default `.xomda`) overrides data dir · storage: `.xomda/model.json`,
`.xomda/project.json` (name, description, versions, settings, plugins), `.xomda/templates/`, `.xomda/history/`. Legacy
`.xomda/versions.json` is migrated into `project.json` on first read.

## Where to read more

| Need                                      | Document                                                                                    |
|-------------------------------------------|---------------------------------------------------------------------------------------------|
| Concepts (MDA, two-tier, self-definition) | [docs/concepts.md](./docs/concepts.md)                                                      |
| Data model schema                         | [docs/data-model.md](./docs/data-model.md)                                                  |
| Template language                         | [docs/templates.md](./docs/templates.md)                                                    |
| tRPC API                                  | [docs/api.md](./docs/api.md)                                                                |
| Package architecture deep-dive            | [docs/architecture.md](./docs/architecture.md)                                              |
| Toolchain, scripts, env, deploy           | [docs/development.md](./docs/development.md)                                                |
| How to conduct a code review / audit      | [docs/code-review.md](./docs/code-review.md)                                                |
| AI-agent docs shipped in the npm tarball  | [docs/.ai/](./docs/.ai/README.md) — keep in sync (rule 21)                                  |
| Long-tail plans pending future thought    | [docs/.backlog/](./docs/.backlog/README.md) — **do not auto-traverse**; user-initiated only |
| Detailed coding standards (Cursor MDC)    | [.cursor/rules/coding-standards.mdc](./.cursor/rules/coding-standards.mdc)                  |
| Tech-stack details (Cursor MDC)           | [.cursor/rules/tech-stack.mdc](./.cursor/rules/tech-stack.mdc)                              |
| Package overview (Cursor MDC)             | [.cursor/rules/project-overview.mdc](./.cursor/rules/project-overview.mdc)                  |
