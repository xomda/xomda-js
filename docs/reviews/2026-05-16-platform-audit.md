# Platform Audit — 2026-05-16

Conducted per [`docs/code-review.md`](../code-review.md) — 7-lens parallel
review of the full repo against `main`. Branch was clean (no diff vs `main`),
so this is a platform-level audit, not a PR review.

**Trivial-and-unambiguous fixes applied during the review** (not listed as
findings, per project preference):

- `tsconfig.json` — `"target": "ES2022"` → `"ESNext"` (AGENTS.md §24).
- `tsconfig.json` — added missing `paths` entries for the three plugin
  packages that the aggregator imports but the root config didn't map
  (`binary`, `markdown`, `node`). IDE go-to-definition now works for them.
- `AGENTS.md` — package-layout comment updated from "14 technology
  detectors" to the actual 17, with the three missing names added.
- `package.json` scripts block — alphabetised (was authored-order; new
  entries silently drifted to the bottom).
- `package.json` `lint-format-fix` script — was running `lint` (read-only
  check) and never invoking Prettier. Now calls `lint:fix` so the
  ESLint→Stylelint→Prettier sequence runs as the name promises.

---

## 1 — Executive summary

The codebase is in good shape. The canonical composables
(`useMutation`, `useEditBuffer`, `useAsyncState`, `parseTrpcError`,
`useNotificationsStore`, `useNodeDrag`) are honoured throughout — no
parallel implementations, no inline pointer-drag state machines, no direct
`localStorage.setItem`, no `JSON.stringify` dirty-tracking *in production
code* (one test helper violates this — finding **C2**), no `console.error`
on tRPC failures. Dependency direction is clean
(`client → model → template → core`, no reverse leaks). Plugin registry is
sorted, alphabetical, and side-effect-import-driven through a single
typed seam.

Two **critical** issues need to be fixed before they accrete cost: a
silent JVM↔TS schema drift on `TemplateCell` (`outputType` exists only
in TS, `outputDirectory` only in JVM, and Jackson is configured to
swallow the mismatch — finding **C1**) and the Ban #2 violation in
`SettingsView` test helper (**C2**). Five **major** issues are
structural and worth scheduling: ModelView decomposition (1704 LOC, 5
CRUD lifecycles, **M1**); the diff engine's 20× `as unknown as`
double-casts that disable the type system over the most schema-sensitive
module in the platform (**M2**); workspace-wide
`verbatimModuleSyntax` + `references` graph adoption (**M3**); test
pyramid balance (29 UI components without unit tests, zero `*.spec-d.ts`,
8 Cypress smoke tests with no MDA golden-path coverage — **M4**);
ESLint severity (`no-explicit-any: 'warn'` contradicts AGENTS.md §2 —
**M5**).

The minor findings are real but tracked-not-blocking. Nothing in this
audit is performative; nothing is below the noise floor.

## 2 — Architectural assessment

**Layering: clean.** No cycles. No reverse deps from `integrations/`
into `packages/`. The two side-effect aggregators
(`packages/analysis/plugins`, `packages/analysis/plugins-client`)
correctly model their job: register every plugin's half through a typed
seam, no monkey-patching, alphabetical.

**Domain mapping: faithful.** The MDA two-tier (meta-model in `.xomda/`
+ user-domain models) is intact. `@xomda/core` owns every shared Zod
schema; consumer packages compose them, never re-declare. The 34
`z.object({...})` instances inside `packages/model/src/router/` are
all input-grouping (`{ path, root }`, `{ uuid, folder }`), not domain
schemas — correct per AGENTS.md §11.

**Self-bootstrap: drifting at one boundary.** `.xomda/model.json` and
`.xomda/templates/` exist and are in shape, but `docs/.ai/model-format.md`
omits the `layout` field that `packages/core/src/schemas/model.ts:25`
defines (**M6**). The JVM↔TS `TemplateCell` shape divergence
(**C1**) is the more serious self-bootstrap problem: it silently
round-trips wrong.

**Design-pattern hygiene: earned, not ceremonial.** The plugin registry,
the canonical composables, the background-component composable triad
(`useCanvasBackground` + `useThemeMode` + `usePointerField`) all justify
themselves with a single sentence. No do-nothing interfaces, no factories
that construct nothing non-trivially, no `Repository`s that wrap a
`Map`. The diff engine (**M2**) is the one place where the abstraction is
the wrong shape — it pretends to be type-erased generic comparison and
should be a typed key-set comparator.

## 3 — Critical issues

### C1 — JVM↔TS `TemplateCell` schema drift (`outputType` vs `outputDirectory`)

- **Severity:** critical · **Blocking:** yes
- **File:** [`integrations/jvm/generator-core/src/main/java/org/xomda/generator/template/TemplateCell.java:15`](../../integrations/jvm/generator-core/src/main/java/org/xomda/generator/template/TemplateCell.java) and [`packages/core/src/schemas/template.schema.ts:53`](../../packages/core/src/schemas/template.schema.ts)
- **Why:** TS schema declares `outputType: 'file' | 'context'` (template.schema.ts L15, L53); JVM POJO declares neither `outputType` nor anything that maps to it, and defines `outputDirectory` that doesn't exist on the TS side. `@JsonIgnoreProperties(ignoreUnknown = true)` on the Java class silently drops `outputType` on deserialization. A template authored in the UI specifies cell dispatch through `outputType`; the JVM generator never sees it.
- **Consequence:** Two runtimes will diverge on what a template means. Tests pass on both sides (each tests its own schema). Drift surfaces only when a user authors in xomda and generates from Maven/Gradle/IntelliJ/Eclipse — i.e. exactly the cross-runtime contract `xomda` exists to provide.
- **Fix:** Decide the canonical field, propagate to both sides, regenerate `.xomda/templates/` if affected, document in [`docs/.ai/template-format.md`](../.ai/template-format.md). Add a round-trip parity test under `packages/analysis/plugins-client` next to the existing id-parity spec. Tighten the JVM POJO with `@JsonIgnoreProperties(ignoreUnknown = false)` (or a `FAIL_ON_UNKNOWN_PROPERTIES` ObjectMapper config) so the next divergence fails loudly.
- **Tradeoffs:** Stricter Jackson will fail on legacy templates that already drift. Mitigation: migrate `.xomda/templates/` in the same commit and document the migration in the release notes.
- **Maintenance:** After the fix, schema evolution stops being a silent-correctness hazard.

### C2 — `JSON.stringify`/`JSON.parse` dirty-tracking in test helper (Ban #2)

- **Severity:** critical · **Blocking:** yes
- **File:** [`packages/client/src/views/SettingsView/__tests__/testEditor.ts:41–52`](../../packages/client/src/views/SettingsView/__tests__/testEditor.ts)
- **Why:** AGENTS.md "Bans" #2 forbids `JSON.stringify(a) !== JSON.stringify(b)` for dirty tracking and `JSON.parse(JSON.stringify(x))` for cloning. The test helper does both, on the exact contract (`PreferencesEditor`) that `useEditBuffer` was built to serve. Tests pass with the broken pattern; production code that copies it will silently mis-handle key-reorder and `undefined`.
- **Consequence:** Anti-pattern leaks back into production by example. Future test authors copy what they see in `__tests__/`.
- **Fix:** Replace the dirty `computed` with `dequal` (already a transitive dep) or use the real `useEditBuffer<PreferencesDraft>`; replace the JSON-roundtrip clones with `structuredClone`. ~6 lines, no behaviour change for passing tests, will surface any test that relied on the broken semantics.
- **Tradeoffs:** None.
- **Maintenance:** Removes a footgun next to the canonical example.

## 4 — High-leverage improvements

### M1 — ModelView.tsx (1704 LOC, 5 CRUD lifecycles)

- **Severity:** major · **Blocking:** no
- **File:** [`packages/client/src/views/ModelView.tsx`](../../packages/client/src/views/ModelView.tsx)
- **Why:** Owns entity / enum / package / attribute CRUD plus layout-dirty tracking plus deep-route sync. 29 calls into the canonical composables — it uses them correctly, it just uses too many of them in one file. AGENTS.md already names it as the canonical bad example.
- **Consequence:** Every new feature on the model surface lands here. Onboarding cost climbs. Bisect / blame becomes noisy. Trending toward 2000 LOC within a few release cycles.
- **Fix:** Decompose by capability into siblings: `useEntityEditor`, `useEnumEditor`, `usePackageEditor`, `useAttributeEditor` (each owning its `useEditBuffer` + its dialog + its mutations), plus an `EntityEditPanel` / `EnumEditPanel` / etc. component pair per editor. ModelView becomes a router: routing, sub-component composition, canvas-layout orchestration. Target: ~600 LOC.
- **Tradeoffs:** 4–5 commits (one per editor), high blast radius — but each commit is independently shippable and individually small. Compose-don't-rewrite: extract one at a time, leave ModelView orchestrating until the last extraction.
- **Maintenance:** Each editor becomes independently testable. The model surface gains clear ownership boundaries.

### M2 — `packages/core/src/diff/index.ts`: 20× `as unknown as Record<string, unknown>`

- **Severity:** major · **Blocking:** no
- **File:** [`packages/core/src/diff/index.ts:170,171,181,182,216,…`](../../packages/core/src/diff/index.ts) (20 sites)
- **Why:** Each cast erases the structural type of the thing being diffed (Package, Entity, Enum, Attribute) before handing it to `diffFields`. The module is the audit trail of the model — the place where a missed field is *silently* a missed change in the diff UI. Type erasure here means a new field added to `PackageSchema` is never compared until someone updates a `*_KEYS` constant by hand.
- **Consequence:** Schema evolution + diff drift = silent change-detection failures over time. The most observable symptom is "the diff panel says no changes, but the file *did* change" — the worst possible failure mode for an MDA tool.
- **Fix:** Make `diffFields` generic: `function diffFields<T extends object>(before: T, after: T, keys: readonly (keyof T)[]): Change[]`. Caller passes `PACKAGE_KEYS: readonly (keyof Package)[]`; TS now enforces that every key in the array is a real field of the type, and that the constant is exhaustive when used with `satisfies`.
- **Tradeoffs:** Touching `core/diff` requires regenerating any `.xomda/` outputs that depend on it; mechanical refactor; ~200 LOC affected.
- **Maintenance:** Future schema changes either update the `_KEYS` constants (caught at compile) or trigger an exhaustiveness error.

### M3 — Missing `verbatimModuleSyntax` + `references` graph workspace-wide

- **Severity:** major · **Blocking:** no
- **File:** [`tsconfig.json`](../../tsconfig.json) + every `packages/*/tsconfig.json` + every `integrations/node/*/tsconfig.json`
- **Why:** `@typescript-eslint/consistent-type-imports` enforces `import type` at lint time, but it does not catch type-only re-exports or guarantee that the JS output excludes type-only code. `verbatimModuleSyntax: true` makes the compiler enforce the contract. Separately, the workspace declares no `references` graph and no `composite: true` — every `pnpm -r typecheck` recompiles from scratch instead of using project-references caching. The codebase is large enough now (~50k LOC TS) that this is a real iteration-time cost.
- **Consequence:** Tree-shaking quality degrades silently; circular module shapes that would fail under vMS pass today. Workspace incremental builds are slower than they should be.
- **Fix:** Two changes, one root-level. (1) Add `"verbatimModuleSyntax": true` to root `tsconfig.json` `compilerOptions`. Lint-fix any `import { type X }` mixed imports it surfaces (likely a handful). (2) Add `"composite": true, "declaration": true, "declarationMap": true` at root; add a `"references"` array to root + each package mirroring `pnpm-workspace.yaml` deps. A small script can generate `references` from `package.json#dependencies` to avoid drift.
- **Tradeoffs:** vMS may surface a small batch of fixable lint errors. References graph is one-time setup + a generator script. Both are isolated to config files.
- **Maintenance:** Cheaper builds, sharper type contract.

### M4 — Test pyramid skew

- **Severity:** major · **Blocking:** no
- **Files:** `packages/ui/src/components/**/__tests__/` (29 components ship a `*.stories.tsx` without a `*.spec.tsx`); `packages/client/src/views/**` (12 of 41 view-level files have tests); `packages/e2e-tests/cypress/e2e/` (8 specs, all smoke); zero `*.spec-d.ts` files across the workspace; `integrations/jvm/generator-core/src/test/` (~3–4 test classes for 22 source classes).
- **Why:** The canonical composables are well-tested (useMutation/useEditBuffer/parseTrpcError each have ~300 LOC of specs). The component layer above them is not. The Cypress suite covers navigation but not the MDA golden path: create entity → add attribute → pick a template → generate → see file. The JVM generator-core has plugin-level tests but few unit tests on the engine itself, where the JVM↔TS contract lives.
- **Consequence:** Refactors to UI primitives (TitleBar, FileEntryListItem, DynamicForm, etc.) regress consumers without warning. The MDA loop has no automated proof of correctness end-to-end. The JVM generator silently diverges from the TS-side template engine (see **C1**).
- **Fix:** Three discrete pieces of work. (a) Add ~30 minimal component specs in `@xomda/ui` covering the prop/emit/slot contract — not full interaction, just shape. (b) Add 4 Cypress goldens covering: new entity, template generation, template edit + regen + diff, multi-package nesting. (c) Add JVM unit tests around: nested package traversal, cell evaluation with loop variables, output-file collision behaviour. Add `*.spec-d.ts` for the canonical composables' generics.
- **Tradeoffs:** ~3 days of focused work. Cypress suite gets slower; mitigate with parallel runners in CI.
- **Maintenance:** Refactors stop being scary.

### M5 — ESLint severity too permissive

- **Severity:** major · **Blocking:** no
- **File:** [`eslint.config.mjs:46–55`](../../eslint.config.mjs)
- **Why:** `@typescript-eslint/no-explicit-any: 'warn'` contradicts AGENTS.md §2 ("no `any`"). `no-unused-vars: 'warn'` allows dead-symbol accretion. Warnings don't fail CI; the rules don't enforce what the rules claim to enforce.
- **Consequence:** Project rules are aspirational instead of mandatory. Each warn is an invitation to ship.
- **Fix:** Change both to `'error'`. Pre-flight: `grep -rn ': any\|<any>' packages integrations --include='*.ts' --include='*.tsx'` and resolve the dozen-ish hits (most will be the sanctioned `env.d.ts` shim — those need an inline ESLint disable with a comment per AGENTS.md §2).
- **Tradeoffs:** One round of mechanical cleanup; afterwards, CI enforces what the docs already promise.
- **Maintenance:** No more drift between rule docs and rule severity.

### M6 — `docs/.ai/model-format.md` missing `layout` field

- **Severity:** major · **Blocking:** no
- **File:** [`docs/.ai/model-format.md:20–26`](../.ai/model-format.md) vs [`packages/core/src/schemas/model.ts:24–25`](../../packages/core/src/schemas/model.ts)
- **Why:** Schema declares `layout?: Record<string, LayoutEntry>` (canvas positions, persisted in `model.json`). Doc omits it. AI agents in downstream projects (the audience of `docs/.ai/`) read the doc as authoritative and produce `model.json` files that drop layout on rewrite.
- **Consequence:** Silent layout-loss when a downstream agent edits `model.json`. AGENTS.md §22 calls drift here "agents in dependent projects produce silently-wrong files months later."
- **Fix:** Add `layout?: Record<UUID, LayoutEntry>` to the Root-shape table in `model-format.md` with one-line semantics. Add a snapshot test in `packages/core/__tests__/` that compares the doc's schema fragment against the inferred TS type, so drift breaks CI.
- **Tradeoffs:** None for the doc fix. The snapshot test is ~30 LOC.
- **Maintenance:** Self-policing.

### M7 — `packages/node/tsconfig.json` uses `moduleResolution: "bundler"`

- **Severity:** major · **Blocking:** no
- **File:** [`packages/node/tsconfig.json:6`](../../packages/node/tsconfig.json)
- **Why:** `@xomda/node` is a node HTTP server, not a browser bundle. `moduleResolution: "bundler"` ignores `package.json` `exports` `"node"` conditions and `.js` extensions, masking real-runtime resolution mistakes at compile time.
- **Consequence:** A dep with conditional exports could resolve to a browser entry point at typecheck and explode at runtime. Has not bitten yet, but only because no current dep stresses the difference.
- **Fix:** Change to `"moduleResolution": "NodeNext"`. May require adding explicit `.js` extensions to a small number of relative imports (AGENTS.md §9 forbids extensions in *application code*, but NodeNext requires them — accept the per-tsconfig override, documented in the file).
- **Tradeoffs:** One config tweak + possibly a handful of import suffix additions. The same change is appropriate for `@xomda/cli`, `@xomda/template`, `@xomda/analysis-core` if confirmed.
- **Maintenance:** Aligns the type checker with the actual runtime.

### M8 — `eslint-plugin-storybook` not configured

- **Severity:** major · **Blocking:** no
- **File:** [`eslint.config.mjs`](../../eslint.config.mjs)
- **Why:** `@xomda/ui` and `@xomda/diagram` both ship Storybook stories (AGENTS.md §16). No ESLint coverage for `*.stories.tsx` means story-specific anti-patterns (missing default export shape, anonymous arrow stories, missing args) pass review. Per `docs/code-review.md` §17, plugins must be scoped to the exact glob they apply to — the absence of any storybook plugin is a coverage gap, not a scope precision issue.
- **Consequence:** Stories accumulate inconsistency; the standard Storybook lint surface is missing.
- **Fix:** Add `eslint-plugin-storybook` to root devDependencies and a single ESLint config block scoped to `files: ['**/*.stories.{ts,tsx}']` extending `plugin:storybook/recommended`. ~5 lines of config.
- **Tradeoffs:** One dev dep, one lint pass — will flag a small batch of existing stories.
- **Maintenance:** First-class story hygiene.

## 5 — Duplication & reusability audit

The "two/three/five" heuristic is *already* well-applied — most likely
because the canonical-composables doctrine in AGENTS.md catches what
would otherwise have been duplication. No tree walkers duplicated (one
in `@xomda/core`). No pointer-drag re-implementations (`useNodeDrag` is
the only one). No dirty-tracking re-implementations *in production* (the
test helper from **C2** is the only violation). No parallel
`parseTrpcError`. No second `useNotificationsStore`.

One **deferred** observation: the model-router CRUD helpers in
`packages/model/src/router/helpers.ts` use `removeEntityById /
removeEnumById / removePackageById` while the view layer uses
`deleteEntity / deleteEnum / deletePackage`. Two divergent verbs for one
concept, at exactly two layers — the right call is to wait for a third
occurrence before standardising, but lean toward `delete*` on both sides
when the third comes (it matches the user-facing "Delete" button).

## 6 — AI-readiness assessment

Strengths: every canonical composable has JSDoc; tRPC routers are flat
and discoverable; the analysis plugin contract is sharply typed;
`docs/.ai/` exists and is mostly current. A future agent extending the
codebase can find drag-and-drop (`useNodeDrag`), theme switching
(`useThemeMode`), error toasts (`useNotificationsStore` +
`parseTrpcError`), the analyzer worker
(`packages/analysis/core/src/analyzer.ts`) from cold-read with low
friction.

Gaps: UUIDs are typed as `z.string().uuid()` (runtime), not branded
types (compile-time). An agent reading `EntitySchema` sees `id: string`
and cannot distinguish it from any other string. Adding branded UUID
types in `@xomda/core` would tighten the contract for code generation.
Also: `docs/.ai/model-format.md` drift (**M6**) actively misleads downstream
agents — fix has the highest leverage of any AI-readiness item.

## 7 — Frontend audit

The Vuetify defaults in `packages/client/src/vuetify.ts` are honoured.
No `VNavigationDrawer` regressions. PanelDivider + usePanelResize cover
every split-panel surface. Backgrounds use the
`useCanvasBackground` / `useThemeMode` / `usePointerField` triad. WCAG
findings are minor (see UX/UI audit, §10).

### F1 — `as` cast precedes narrowing guard in ModelView

- **Severity:** minor · **Blocking:** no
- **File:** [`packages/client/src/views/ModelView.tsx:769`](../../packages/client/src/views/ModelView.tsx)
- **Why:** `const s = meta.settings as { diagramMaxEntityAttributes?: number; ... }` runs before the `typeof s.diagramMaxEntityAttributes === 'number'` guards on the next lines. Cast lies if `meta.settings` is a non-object; the guards only work because property access on a primitive returns `undefined`, not because the type is verified.
- **Fix:** Validate first (`typeof meta.settings === 'object' && meta.settings !== null`), then cast. Or define `DiagramSettings` in `@xomda/core` and `safeParse` the field.

### F2 — `as ProjectContext` cast on tRPC return in HomeView

- **Severity:** minor · **Blocking:** no
- **File:** [`packages/client/src/views/HomeView.logic.ts:101`](../../packages/client/src/views/HomeView.logic.ts)
- **Why:** tRPC infers return types directly when the router and client share the type graph; an `as ProjectContext` cast on the result of `trpc.project.context.query()` either masks a missing schema or papers over a router/client type-graph break. Either is worth a one-line fix (delete the cast and import the type, or fix whatever made the cast necessary).

## 8 — Backend & integration audit

JVM↔TS contract drift on `TemplateCell` (**C1**) is the headline. The
Maven-aggregator-vs-Gradle split is correctly tracked in AGENTS.md and
respected. The IntelliJ plugin keeps test framework on plain JUnit 5
per AGENTS.md integrations rule 8.

Two **deferred** notes: (a) the JVM POJOs across `generator-core`
should be reviewed once `outputType`/`outputDirectory` is reconciled
(**C1**) — fields prone to silent drop should all move off
`@JsonIgnoreProperties(ignoreUnknown = true)`. (b) Checkstyle catches
wildcard imports; no findings.

## 9 — Testing & reliability audit

Covered as **M4**. One additional finding worth its own entry:

### T1 — `useMutation` callback-chain edge cases not tested

- **Severity:** minor · **Blocking:** no
- **File:** [`packages/ui/src/composables/__tests__/useMutation.spec.ts`](../../packages/ui/src/composables/__tests__/useMutation.spec.ts)
- **Why:** Specs cover unmount-safety, supersede-on-rerun, error clearing. Missing: `run()` → `reset()` → `run()` chain (does reset clear error before the new run resolves?); `onSuccess` callback that calls `run()` again (can it cause double-loading?); `onSuccess` mutating shared state that the next assertion needs to see committed. These are real usage patterns elsewhere in the codebase.
- **Fix:** Three additional specs, ~20 LOC each. The composable already handles these correctly; the tests just need to pin the behaviour.

## 10 — UX/UI audit

### U1 — `!important` in SCSS without inline rationale

- **Severity:** minor · **Blocking:** no
- **Files:** [`packages/client/src/views/ModelView.module.scss:107,263`](../../packages/client/src/views/ModelView.module.scss), [`packages/client/src/views/HomeView.module.scss:263`](../../packages/client/src/views/HomeView.module.scss)
- **Why:** Each `!important` is probably a deliberate Vuetify override; the global SCSS already documents *why* there is no `!important` on the frosted-card backdrop. The three lone overrides should each carry the same one-line "why" comment.

### U2 — Disabled banner buttons in HomeView lack tooltips

- **Severity:** minor · **Blocking:** no
- **File:** [`packages/client/src/views/HomeView.tsx`](../../packages/client/src/views/HomeView.tsx) (banner-button area; `aria-label` set but no explanation)
- **Why:** WCAG 2.1 AA 3.3.5 (Help): disabled controls should explain why they are disabled. Two banner CTAs ("Use that", "Create here") disable without tooltip.
- **Fix:** Wrap in `<VTooltip>` with a one-line "Available when …" message.

### U3 — `MultiIcon` composes `aria-label` without filtering `undefined`

- **Severity:** nit · **Blocking:** no
- **File:** [`packages/ui/src/components/MultiIcon.tsx:35`](../../packages/ui/src/components/MultiIcon.tsx)
- **Why:** If one icon lacks a label, the composite reads "A, , C" to a screen reader.
- **Fix:** `aria-label={props.icons.map(i => i.label).filter(Boolean).join(', ')}`, or make `label` required.

`useNodeDrag` keyboard-equivalence is a **deferred** finding — already
tracked in `docs/TODO.md` per AGENTS.md §18.

## 11 — Performance audit

No findings rising above the noise floor. `useCanvasBackground` honours
`prefers-reduced-motion` and `visibilitychange`; `usePointerField`
listens on `window` correctly because the canvas is `pointer-events:
none`; particle backgrounds use `Float32Array` interleaved buffers per
AGENTS.md background-component rules. No `setInterval`/`addEventListener`
without `onUnmounted` cleanup found in spot-checks. Bundle-size review
would benefit from the missing `references` graph (**M3**) but that's a
build-tooling finding, not a runtime one.

## 12 — Security & operational audit

No findings rising above the noise floor. No `v-html`/`innerHTML` with
dynamic input. tRPC inputs are all Zod-validated. Secrets are not in
source; `.xomda/.m2-repo/` is gitignored. No silent
`exec`/`spawn` shapes. The single open question is supply-chain: a
SCA tool against the `pnpm-lock.yaml` would be a worthwhile follow-up
but is out of scope for an in-repo review.

## 13 — Observability & error-handling audit

Strong overall. Every tRPC mutation surfaces errors via
`useMutation`/`useNotificationsStore`. The one **deferred** observation:

### O1 — `packages/template/src/storage.ts:78` silent `catch { /* skip invalid files */ }`

- **Severity:** minor · **Blocking:** no
- **Why:** During template-folder scan, a corrupt `*.template.json` is skipped silently. The pattern is defensible (one bad file should not kill the scan), but undocumented. The sibling block at L113 logs via `log.error`; consistency would help.
- **Fix:** Either `log.warn` the skipped file path (preferred), or add a one-line comment explaining the intentional silence.

## 14 — Developer experience audit

Onboarding cost is low for a project this size. AGENTS.md is the right
length; CLAUDE.md/AGENTS.md/.cursor/rules/* hierarchy is consistent;
`docs/code-review.md` is sharp. The dev loop (`pnpm dev`) is one
command. The one DX friction worth naming is the lack of project
`references` (**M3**) — `pnpm -r typecheck` is slower than it should
be on a clean workspace.

## 15 — Repository & workspace structure audit

`index.ts` in every subfolder, explicit named exports, no `export *` —
verified by spot-checks across 10 packages. Demo dirs are excluded from
ESLint correctly. `.claude/worktrees/**` is ignored correctly. The
17 analysis plugins are alphabetised in both aggregators; `packages/`
vs `integrations/` split is followed.

One observation, **deferred**: `packages/xomda/` (the bundled tarball
source) sits alongside `packages/cli/` (the binary surface). The
relationship is documented in AGENTS.md "Publishing" section, but a
new contributor will likely first try to extend `packages/cli` when
they should extend `packages/xomda/src/bin.ts`. Not a finding; worth a
sentence of orientation in `packages/cli/README.md` next time it is
touched.

## 16 — TypeScript configuration audit

`verbatimModuleSyntax` and `references` are **M3** (already covered).
`target: "ESNext"` is fixed in-place during this review.
`packages/node/tsconfig.json` `moduleResolution` is **M7**. Additional
findings:

### TS1 — `packages/ui/tsconfig.json` `rootDir: "../../"` + `declarationDir: "dist"` mismatch

- **Severity:** minor · **Blocking:** no
- **File:** [`packages/ui/tsconfig.json:13`](../../packages/ui/tsconfig.json) and [`packages/diagram/tsconfig.json`](../../packages/diagram/tsconfig.json)
- **Why:** `rootDir` pointing at the workspace root lets imports resolve workspace-wide but emits declarations to a `dist/` that's relative to the package. Type-check passes; emit shape is asymmetric. Hasn't bitten because Vite drives the emit.
- **Fix:** Drop `rootDir`; let TS infer from `include`. Drop `declarationDir`; let Vite own emit.

### TS2 — Unexplained `paths: {}` reset in analysis plugin tsconfigs

- **Severity:** nit · **Blocking:** no
- **File:** [`packages/analysis/markdown/tsconfig.json:10`](../../packages/analysis/markdown/tsconfig.json) and siblings
- **Why:** Explicit `paths: {}` resets root path mappings. Intentional (the plugin should not see workspace `@xomda/*` shortcuts that aren't its declared deps), but undocumented. Future maintainer will assume it's a mistake.
- **Fix:** One-line comment above `paths`: `// reset root paths — plugins resolve only their declared workspace deps`.

### TS3 — Stale `ignoreDeprecations: "5.0"` in root tsconfig

- **Severity:** nit · **Blocking:** no
- **File:** [`tsconfig.json:7`](../../tsconfig.json)
- **Why:** TypeScript 6 is in use. The "5.0" cohort is long past the deprecation window; the flag is either inert or about to error.
- **Fix:** Remove. If any 5.x deprecation rule was being silenced, the next typecheck will surface it.

## 17 — Consistency & tooling hygiene audit

The lint chain is correctly ordered (`eslint --fix` → `stylelint --fix`
→ `prettier --write`). Prettier is last in the ESLint config chain (good).
EditorConfig is enforced. `simple-import-sort` runs as `error`. The
trivial entropy items (script-block order, plugin count drift) are
fixed in-place during this review; the ESLint severity gap (**M5**) and
the Storybook plugin gap (**M8**) are above the just-fix line because
they require pre-flight or a new dependency.

No findings beyond what's already covered.

## 18 — Refactoring roadmap (ordered)

Order is impact × (1/cost) × strategic value.

1. **C1 — JVM↔TS `TemplateCell` reconciliation.** Critical. ~1 day for the
   investigation + reconciliation + parity test + migration. Blocks
   long-term confidence in the cross-runtime contract.
2. **C2 — replace `JSON.stringify` dirty tracking in `testEditor.ts`.**
   Critical. ~30 minutes. Removes a footgun and silences AGENTS.md
   Ban #2.
3. **M5 — ESLint severity (`no-explicit-any`, `no-unused-vars` → error).**
   Major. ~1 hour incl. cleanup. High immediate hygiene win.
4. **M6 — `docs/.ai/model-format.md` add `layout` + drift-snapshot test.**
   Major. ~1 hour. Prevents AI agents in downstream projects from
   producing wrong `model.json`.
5. **M8 — add `eslint-plugin-storybook` scoped to `*.stories.{ts,tsx}`.**
   Major. ~30 minutes + cleanup. Closes a lint-coverage gap.
6. **M7 — `packages/node/tsconfig.json` → `moduleResolution: "NodeNext"`**
   (and audit `@xomda/cli`, `@xomda/template`, `@xomda/analysis-core`).
   Major. ~2–4 hours incl. import-suffix fixups.
7. **M3 — add `verbatimModuleSyntax` + `composite` + `references` graph.**
   Major. ~half a day. Speeds builds, sharpens contracts.
8. **M2 — refactor `packages/core/src/diff/index.ts`** to typed key-set
   comparators. Major. ~1 day. High strategic value (diff correctness
   is critical to MDA UX).
9. **M1 — decompose `ModelView.tsx`** into 4 editor composables +
   panels. Major. 4–5 commits over a week. Highest absolute LOC delta;
   schedule when there's no concurrent feature work in this view.
10. **M4 — test pyramid balance:** UI component specs + 4 Cypress
    goldens + JVM generator-core unit tests + `*.spec-d.ts` for
    canonical composables. Major. ~3 days.
11. **Minor cluster** (F1, F2, T1, U1, U2, U3, O1, TS1, TS2, TS3) —
    pick up opportunistically when adjacent files are touched.

## 19 — Architectural principles to adopt

The codebase already operates by the right principles. The only addition
worth codifying:

- **Strict cross-runtime schema parity.** Any field added to a TS Zod
  schema that is also represented JVM-side (TemplateCell, ModelDiff,
  etc.) must be added to the JVM POJO in the same commit, and the JVM
  ObjectMapper must be configured `FAIL_ON_UNKNOWN_PROPERTIES = true`.
  A parity test in `packages/analysis/plugins-client` (next to the
  existing id-parity spec) is the enforcer.

## 20 — Anti-patterns to eliminate

Concrete instances above carry `file:line`. No new categories of
anti-pattern emerged; everything observed is already named in
AGENTS.md or `docs/code-review.md`.

## 21 — Final verdict

This codebase already deserves the bar it aspires to — the canonical
composables, the plugin contracts, the dependency direction, the
self-bootstrap design, the docs hygiene, the test discipline on the
critical paths. The findings above are the difference between "good"
and "durable at any scale". With **C1**, **C2**, and **M1–M8**
addressed, the platform stops carrying any structural debt visible to a
careful reader; with the minor cluster picked up opportunistically, it
reads like a worked example of MDA engineering. Nothing here requires
a rewrite, nothing requires an architectural pivot, nothing requires
introducing a new framework. The path from here to "epic" is execution
on the roadmap above.
