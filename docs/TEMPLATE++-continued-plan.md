# Plan: TEMPLATE++ (continued) Implementation

## Context

`TEMPLATE++.md` defines the overall cell-based templating architecture (schemas, engine,
storage, tRPC routers). Much of that foundation already exists:

- `@xomda/core` — `TemplatePP` / `TemplateCell` Zod schemas
  (`packages/core/src/schemas/templatePP.schema.ts`)
- `@xomda/template` — `executeTemplate`, `OutputBuffer`, scope-aware renderer, JSON storage
  (`packages/template/src/enginePP.ts`, `rendererPP.ts`, `storagePP.ts`)
- `@xomda/model` — full tRPC router: list / get / save / delete / preview / generate / diff
  (`packages/model/src/router/templatePP.router.ts`)
- `@xomda/client` — `TemplatePPView`, `TemplatePPEditor`, `CellEditor`, `OutputCellForm`

`TEMPLATE++ (continued).md` adds the **UI component architecture** and a few **engine
refinements**. Everything below is what is still missing.

---

## Work Items

### 1. `Collapsible` component — `@xomda/ui`

New files:
- `packages/ui/src/components/Collapsible/Collapsible.tsx`
- `packages/ui/src/components/Collapsible/Collapsible.module.scss`
- `packages/ui/src/components/Collapsible/index.ts`

A generic, dumb collapse/expand wrapper with no knowledge of templates or cells.

**Layout:** a row with a small chevron toggle button + the content in a `VExpandTransition`.

```
[ ▶ label? ] ← clicking the chevron or row toggles collapse
[ content   ]   (VExpandTransition, height 0→auto)
```

**Props:**
| prop | type | purpose |
|------|------|---------|
| `modelValue` | `boolean` | controlled open/closed; defaults to `true` (open) |
| `label` | `string \| undefined` | optional label shown next to the chevron |

**Emits:** `update:modelValue`

**Slots:** `default` — the collapsible content

---

### 2. Generic `Cell` component — `@xomda/ui`

New files:
- `packages/ui/src/components/Cell/Cell.tsx`
- `packages/ui/src/components/Cell/Cell.module.scss`
- `packages/ui/src/components/Cell/index.ts`

Purely structural / dumb: knows nothing about template execution, buffers, or previews.

**Props:**
| prop | type | default | purpose |
|------|------|---------|---------|
| `type` | `string \| undefined` | — | label shown as a `VChip` |
| `showDelete` | `boolean` | `true` | show delete button |
| `showMove` | `boolean` | `true` | show move-up and move-down buttons |
| `disableMoveUp` | `boolean` | `false` | disable the up button |
| `disableMoveDown` | `boolean` | `false` | disable the down button |

**Slots:**
- `default` — the main body (editor area)
- `toolbar` — items rendered in the toolbar, next to the type chip
- `action-prepend` — slot before the type chip (e.g. drag handle)
- `properties` — content rendered inside the kebab-menu (`VMenu`), for cell-level settings

**Emits:** `delete`, `moveUp`, `moveDown`

**Structure:**
```
VCard
  VToolbar
    [action-prepend slot]
    VChip (type)          ← only if `type` prop is set
    [toolbar slot]
    VSpacer
    VBtn (▲) if showMove
    VBtn (▼) if showMove
    VBtn (⋮) if properties slot has content  →  VMenu → [properties slot]
    VBtn (🗑) if showDelete
  [default slot]          ← the body / editor
```

Export through `packages/ui/src/components/index.ts`.

---

### 3. `CellSeparator` component — `@xomda/ui`

New files:
- `packages/ui/src/components/CellSeparator/CellSeparator.tsx`
- `packages/ui/src/components/CellSeparator/index.ts`

A thin horizontal divider with a centred `+` icon button. Clicking opens a `VMenu` dropdown
listing the available cell types.

**Props:** `cellTypes: string[]`
**Emit:** `add(type: string)` — the chosen cell type

Export through `packages/ui/src/components/index.ts`.

---

### 4. Refactor `CellEditor` — `@xomda/client`

`packages/client/src/components/templatePP/CellEditor/CellEditor.tsx`

Replace the hand-rolled `VCard`/`VToolbar` layout with the generic `Cell` from `@xomda/ui`.

- `type` prop → use `CELL_LABEL[cell.type]`
- `toolbar` slot → variable-name `VTextField` (logic / buffer cells)
- `properties` slot → any per-cell settings that currently live inline in the toolbar
- `default` slot → `CodeEditor` (for logic/markdown/handlebars/buffer) or `OutputCellForm`
- The `Collapsible` component wraps the body slot content where collapsing is desired;
  the template-level renderer component decides whether to wrap with `Collapsible` (see §5)

`CELL_LANGUAGE`, `CELL_LABEL`, `CELL_COLOR` maps stay in this file (they are
template-domain knowledge, not generic UI knowledge).

---

### 5. Cell preview wrapping — `@xomda/client`

The preview of a cell's output is a template-domain concern, not a `Cell` UI concern.

In `TemplatePPEditor` (or a new `TemplatePPCellWrapper` component), wrap each `CellEditor`
in a `Collapsible` for the editor body, and optionally prepend another `Collapsible` above
it for the preview panel (to be wired to live execution output in a future step).

This keeps `Cell` and `CellEditor` dumb while allowing the template editor to compose
collapse/expand behaviour freely.

---

### 6. Refactor `TemplatePPEditor` — `@xomda/client`

`packages/client/src/components/templatePP/TemplatePPEditor.tsx`

Replace the single bottom "Add cell" button with `CellSeparator` components:
- one **before** the first cell
- one **between** every adjacent pair of cells
- one **after** the last cell

`addCell` gains an `index` parameter so the new cell is inserted at the correct position.

---

### 7. Engine: implicit per-cell output buffer — `@xomda/template`

`packages/template/src/enginePP.ts`

This is a pure engine concern; the UI components know nothing about it.

- Each cell execution receives a fresh `OutputBuffer` as `$out` in its context.
- **Logic cells** can call `$out.write(...)` from within their JavaScript body to emit
  code inline.
- **Handlebars cells** automatically write their rendered output into `$out` (in addition
  to, or instead of, setting `variableName` when one is given).
- All per-cell `$out` buffers are stored in order on the execution state.
- **Output cells** whose `outputContent` is not set default to concatenating `$out` from
  every preceding cell in document order — preserving the sequential write guarantee.
  Named buffer variables (from `buffer` cells) remain available as before.

---

### 8. xomda model entries for cell types

File: `.xomda/model.json`

Add inside the `xomda` package a `template` sub-package containing:
- **`CellType` enum** — values: `logic`, `markdown`, `handlebars`, `buffer`, `output`
- **`TemplateCell` entity** — `uuid (uuid, PK)`, `type (CellType)`, `content (string)`,
  `variableName (string, opt)`, `outputFilename (string, opt)`,
  `outputDirectory (string, opt)`, `outputContent (string, opt)`
- **`TemplatePP` entity** — `uuid (uuid, PK)`, `name (string)`, `description (string, opt)`,
  `version (string)`, `scope (string, opt)`, `cells (TemplateCell, multiValue)`,
  `extends (uuid, opt)`

---

## Files to create / modify

| file | action |
|------|--------|
| `packages/ui/src/components/Collapsible/Collapsible.tsx` | create |
| `packages/ui/src/components/Collapsible/Collapsible.module.scss` | create |
| `packages/ui/src/components/Collapsible/index.ts` | create |
| `packages/ui/src/components/Cell/Cell.tsx` | create |
| `packages/ui/src/components/Cell/Cell.module.scss` | create |
| `packages/ui/src/components/Cell/index.ts` | create |
| `packages/ui/src/components/CellSeparator/CellSeparator.tsx` | create |
| `packages/ui/src/components/CellSeparator/index.ts` | create |
| `packages/ui/src/components/index.ts` | extend (add new exports) |
| `packages/client/src/components/templatePP/CellEditor/CellEditor.tsx` | modify |
| `packages/client/src/components/templatePP/TemplatePPEditor.tsx` | modify |
| `packages/template/src/enginePP.ts` | modify |
| `.xomda/model.json` | modify |
| `docs/TEMPLATE++-continued-plan.md` | create (project-level copy of this plan) |

---

## Previously out of scope — now implemented

### Template inheritance ✅
- `rendererPP.ts` — `resolveInheritance()` walks the `extends` UUID chain (circular-ref-safe via visited set), wraps parent fetch in try/catch for missing parents, prepends parent cells before child cells
- `TemplatePPView.tsx` — `VSelect` for `extends` added to the properties toolbar; lists all other templates by name, clearable
- `useTemplatePreview.ts` — resolves inheritance client-side using all templates fetched via `trpc.templatePP.list`; no inheritance gap in live preview
- Tests: `packages/template/src/rendererPP.test.ts` (8 new tests: no-scope, entity scope, nested packages, single-level/multi-level inheritance, missing parent, circular references)

### CLI — `@xomda/cli` ✅
`packages/cli/` — new package, `bin/xomda`:
- `xomda generate` — runs all TEMPLATE++ templates, writes files to disk
- `xomda preview` — renders without writing (--json flag)
- `xomda diff` — shows NEW/CHANGED files vs disk (--json flag)
- All commands accept `--root <path>`

### Vite / webpack / unplugin — `@xomda/unplugin` ✅
`packages/unplugin/` — new package using `unplugin` factory:
- Sub-entries: `./vite`, `./rollup`, `./webpack`
- `XomdaPluginOptions`: `root`, `mode: 'build' | 'serve' | 'always'`
- Runs `generate()` on `buildStart` and/or `watchChange` for `.xomda`/`.template.json` files

### Java / GraalJS — `org.xomda.generator.templatepp` ✅
`lib/xomda-generator-core/src/main/java/org/xomda/generator/templatepp/`:
- `CellType`, `TemplateCell`, `TemplatePP` — Jackson data classes
- `OutputBuffer` — string accumulator, exposed as `$out` / named buffer in JS context
- `FileOutput` — generated file record
- `TemplatePPEngine` — GraalVM JS context per execution; per-cell `$out`; logic/buffer/handlebars/output cell dispatch; mirrors TypeScript `executeTemplate()`
- `TemplatePPStorage` — loads `*.template.json` from `.xomda/templates/`
- `TemplatePPRenderer` — Entity/Enum/Package/model scope dispatch + inheritance resolution; mirrors `renderTemplatePPByScope()`
- `pom.xml` — added `graalvm/polyglot 24.1.2` + `js` runtime

### Live cell preview ✅
- `useTemplatePreview` composable — debounced (300 ms) client-side execution, model cached from tRPC, inheritance resolved client-side using all templates fetched via `trpc.templatePP.list`
- `CellEditor` — "Output" `Collapsible` panel below editor when `cellOutput` has content (output, error, contextDiff, consoleLogs)
- `TemplatePPEditor` — wires `useTemplatePreview` and passes per-cell `cellOutput` to each `CellEditor`

---

## Out of scope (follow-up)

- Java Maven/Gradle plugin wiring for TEMPLATE++ (TypeScript CLI/unplugin already cover build tools)
- Java JUnit tests for `TemplatePPEngine` cell execution

---

## Verification

1. ✅ `pnpm --filter @xomda/ui typecheck` — no errors from new files
2. ✅ `pnpm --filter @xomda/client typecheck` — no errors from new files
3. ✅ `pnpm --filter @xomda/template test` — 40/40 tests pass (8 new rendererPP tests)
4. Start dev server (`pnpm dev`) and open Templates (Advanced):
   - Separators appear between cells and at top/bottom of the list
   - Clicking `+` on any separator opens the cell-type dropdown and inserts at that position
   - Cell toolbar shows the type chip, toolbar-slot content, and kebab menu
   - Move-up / move-down / delete still work
   - Editor body is collapsible via `Collapsible` wrapper
5. Create a template with a logic cell that calls `$out.write('hello')` and an output
   cell with no `outputContent` — verify "hello" appears in the generated file
6. Live preview: add a logic cell with `$out.write('preview test')`, verify the "Output" panel
   appears below the cell with "preview test" content within ~300 ms of stopping edits
7. Create a child template that `extends` a parent; verify the parent's cells appear in the
   child's live preview output

## Change log

- `$output` renamed to `$out` (per-cell implicit output buffer context variable)
- 40 tests total; 8 new rendererPP tests covering scope dispatch, entity nesting, inheritance
- `eval`/`Function` excluded from SANDBOX_BLOCKED (cannot be param names in strict mode)
- Single-expression heuristic extended to exclude `throw`, `if` statements
- `TemplateExecutionResult { files, cellOutputs }` replaces `RenderResult[]` as engine return type
- `CellOutput` and `TemplateExecutionResult` exported from `@xomda/template` main index and `browser.ts`
- Live cell preview implemented client-side via `useTemplatePreview` composable (300 ms debounce, model cached)
- `useTemplatePreview` resolves inheritance client-side via `trpc.templatePP.list` — no inheritance gap in live preview
- Template inheritance: `resolveInheritance()` in `rendererPP.ts` (try/catch for missing parents); `extends` VSelect in `TemplatePPView`
- `@xomda/cli` package: `xomda generate / preview / diff` CLI commands
- `@xomda/unplugin` package: Vite/Rollup/webpack code-gen plugin via `unplugin`
- Java TEMPLATE++ engine: `TemplatePPEngine` + `TemplatePPRenderer` in `lib/xomda-generator-core` using GraalVM JS 24.1.2
