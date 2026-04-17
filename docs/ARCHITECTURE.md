# Architecture

This document covers how the xomda codebase is organised at the package level: the dependency graph, what each
package owns, and the architectural principles that hold it together. For the philosophy behind the platform see
[Concepts](./concepts.md); for the data it operates on see [Data model](./data-model.md); for the template language
see [Templates](./templates.md); for the toolchain see [Development](./development.md).

---

## MDA-Enabled Repository Structure

This is a **pnpm workspace monorepo** designed to support MDA principles through clear separation of concerns and
self-definition capabilities.

### MDA Package Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                   Web UI (@xomda/client)                    │
│              Vue 3 + Vuetify + Dynamic MDA Forms            │
└─┬───────────────┬───────────────┬───────────────┬───────────┘
  │               │               │               │
  ▼               ▼               ▼               ▼
@xomda/ui   @xomda/diagram   @xomda/codeeditor   @xomda/analysis-client
  │               │                                   │
  ▼               │                                   ▼
@xomda/icons ◄────┘                          @xomda/analysis-plugins-client
                                                     │
                                            (side-effect imports every
                                             plugin's ./client entry)
                  │
         (Type-Safe tRPC + Runtime Introspection)
                  │
┌─────────────────▼───────────────────────────────────────────┐
│              HTTP Server (@xomda/node)                       │
│              Node.js + tRPC + Self-Defining Models          │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│            Core Business Logic (@xomda/model)               │
│   ├─ Model CRUD (Self-Definition: Entity, Attribute, …)    │
│   ├─ Template Management (Plugin Architecture)             │
│   ├─ Storage (.xomda/model.json + .xomda/project.json)     │
│   ├─ Project router (context, scan, plugin filter, …)      │
│   ├─ Sandbox helper (resolveWriteTarget)                   │
│   └─ Runtime Introspection APIs                             │
└─┬──────────────┬──────────────┬──────────────────┬─────────┘
  │              │              │                  │
  ▼              ▼              ▼                  ▼
@xomda/core  @xomda/template  @xomda/analysis-core  @xomda/analysis-plugins
                                       ▲                  │
                                       └──────────────────┘
                                       (worker-thread runner; aggregator
                                        side-effect-imports every plugin)

@xomda/cli      → @xomda/model, @xomda/template
@xomda/e2e-tests → cypress driving the running stack
```

The analysis subsystem ships in **two halves**: `@xomda/analysis-core` /
`@xomda/analysis-plugins` (node — filesystem detection + worker-thread runner) and
`@xomda/analysis-client` / `@xomda/analysis-plugins-client` (browser — icons + custom
preview components). Each plugin package exports both via `.` and `./client`. See
[Project Analysis](./PROJECT-ANALYSIS.md) for the full contract.

---

## MDA Package Details

### 1. **@xomda/core** - Self-Defining Schemas & Constants

**Location**: `packages/core/`  
**MDA Role**: Foundation for self-definition and runtime introspection

**Purpose**: Contains all model schemas that xomda uses to define itself, enabling the core MDA capability.

**Self-Defining Schemas** (✅ Complete):

```typescript
// These schemas define what Entity, Attribute, etc. look like
// xomda uses these to generate its own code and UI
export const EntitySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    attributes: z.array(AttributeSchema),
    description: z.string().optional(),
    // ✅ Inheritance support implemented
    extends: z.string().uuid().optional(),
    abstract: z.boolean().optional(),
  })
  .loose() // Open schemas for extensions

export const AttributeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.string(), // primitive or entity/enum name
    required: z.boolean(),
    multiValue: z.boolean(),
    primaryKey: z.boolean(),
    unique: z.boolean(),
    uniqueScope: z.enum(['global', 'parent']).optional(),
    reference: z.boolean().optional(), // true = store ID, false = embed
    description: z.string().optional(),
    defaultValue: z.string().optional(),
  })
  .loose()
```

**Runtime Helpers** (✅ Complete):

- **Inheritance**: `getEffectiveAttributes()`, `getEntityAncestors()`, cycle detection
- **Introspection**: `findEntityById()`, `findEntityByName()`, `getAllPackages()`, etc.
- **Diffing**: `diffModels()` for change detection and versioning
- **Dynamic Schemas**: `buildEntitySchema()` constructs strict schemas from effective attributes
- **Testing**: Factory helpers for test data generation
- **Project file**: `ProjectFileSchema`, `ProjectSettingsSchema` — the shape of
  `.xomda/project.json` (name, description, versions, settings, plugins[])

**MDA Impact**: This package enables xomda to introspect and modify its own structure.

---

### 2. **@xomda/util** - Runtime MDA Helpers

**Location**: `packages/util/`  
**MDA Role**: Runtime model knowledge extraction and helper functions

**Purpose**: Utilities for extracting knowledge from models at runtime or compile-time.

**Key Capabilities**:

- Model traversal and querying
- Attribute type validation
- Inheritance resolution
- Blueprint/prototype handling
- Cross-environment helpers

**MDA Impact**: Enables production applications to leverage model knowledge dynamically.

---

### 3. **@xomda/template** - MDA Generation Engine

**Location**: `packages/template/`
**MDA Role**: Cell-based template processing for code generation

**Purpose**: Notebook-style template engine. A template is a _tree_ of cells, each cell processed by a dedicated
processor. Cells share a context: logic cells set variables, handlebars cells consume them and emit text, output cells
declare files. Loop cells nest other cells underneath themselves and iterate over them once per yielded item —
output cells inside a loop emit one file per iteration; output cells after a loop emit one file with the aggregated
content of all iterations. Loops may be nested arbitrarily.

**Template shape** (`@xomda/core` schema):

```typescript
type CellType = 'logic' | 'markdown' | 'handlebars' | 'buffer' | 'output' | 'loop' | 'loop-logic'

interface TemplateCell {
  uuid: string
  type: CellType
  content: string
  variableName?: string // logic / handlebars / loop: name to expose result under
  outputFilename?: string // output cell: filename (Handlebars-evaluated)
  outputContent?: string // output cell: variable name to read content from (defaults to concat of preceding $out buffers)
  loopSource?: 'entities' | 'enums' | 'packages' | 'javascript'
  children?: TemplateCell[] // loop / loop-logic: cells executed per iteration
}

interface Template {
  uuid: string
  name: string
  description?: string
  version: string
  scope?: 'Entity' | 'Enum' | 'Package' // legacy fallback when no loop cell present
  folder?: string
  cells: TemplateCell[]
}

interface RenderResult {
  templateId: string
  outputPath: string
  content: string
}
```

**Cell types**:

- `logic` — JavaScript executed against the current context (GraalVM in the Java runtime; sandboxed `Function` in Node).
  Assigns variables (`fields = ...`) that subsequent cells can read.
- `handlebars` — Handlebars template string rendered against the current context; rendered output appended to the cell's
  `$out` buffer and (if `variableName` set) exposed as a variable.
- `output` — Declares an emitted file. `outputFilename` is itself a Handlebars expression (e.g.
  `{{pascalCase name}}.java`); content is either the value of the variable named by `outputContent`, or the
  concatenation of all preceding cell `$out` buffers.
- `loop` — Iterates a model collection (`entities`, `enums`, or `packages`, walking nested packages) and recurses into
  the cell's `children` once per item, with `variableName` (default `item`) and the item's fields spread into context.
  Loops may contain loops.
- `loop-logic` — Like `loop` but the items come from arbitrary JavaScript that returns a list. The function receives
  the surrounding loop variables, so an inner generator can read the outer iteration's binding by name.
- `buffer` — Named accumulator; rarely needed in user templates.
- `markdown` — Inert; carries documentation/preview text.

**Output scoping**:

- An `output` cell inside a loop's `children` consumes the buffers written within the current iteration and emits one
  file per iteration. Its content does not bubble up.
- An `output` cell after a loop sees the concatenation of every iteration's unconsumed buffers — i.e. one file with the
  total. Same applies to outputs at the root of a template.
- Output cells of type `'context'` (snapshotting into a variable) do not consume the buffers — subsequent cells still
  see the same upstream content.

**Scope resolution** (`renderer.ts → renderTemplateByScope`):

1. If a top-level `loop` (or `loop-logic`) cell is present → run the engine over the tree.
2. Else if `template.scope` is `Entity` / `Enum` / `Package` → execute once per item from the model's flattened
   collection (legacy path; loop cells are preferred for new templates).
3. Else → execute once with model context only.

**Backwards compatibility**: legacy templates that use the old `provider` / `provider-logic` types and a flat list of
sibling cells after the provider are auto-migrated to the new `loop` + `children` shape by `normalizeTemplate` (called
on load by both `@xomda/template` storage and `generator-core`'s `TemplateStorage`). Downstream JSON files do not have
to be hand-edited.

**Storage** (`storage.ts`):

- Templates stored as `*.template.json` files under `${XOMDA_DIR}/templates/` (default `.xomda/templates/`).
- `listTemplates`, `readTemplate(uuid)`, `writeTemplate`, `deleteTemplate`, `moveTemplate`, plus folder helpers.

**Helpers** (`helpers.ts`) — registered globally on Handlebars; available inside any handlebars cell:

- **Case Helpers**: `camelCase`, `pascalCase`, `snakeCase`, `kebabCase`, `constantCase`, `upperCase`, `lowerCase`
- **Comparison**: `eq`, `ne`, `and`, `or`, `not`
- **Array Operations**: `join`, `first`, `last`
- **Domain-Specific**: `required` (filters required attributes), `primaryKeys` (filters PK attributes)

These are _generic_. Target-language type maps (Java types, Zod types, etc.) live in `logic` cells inside individual
templates, not in helpers.

**Engine** (`engine.ts → executeTemplate`):

- Walks cells sequentially through `PROCESSORS` (one per cell type, registered in `processors/registry.ts`).
- Each cell processor receives a `CellContext` with `model`, `scopeContext`, mutable `variables`, the array of
  `cellBuffers`, and a fresh `$out` buffer.

**Dependencies**:

- `@xomda/core`: Core types and `TemplateSchema`
- `handlebars`: Used by the `handlebars` cell processor and by output-filename evaluation
- `change-case`: String case transformations exposed as helpers

**Why it exists**: Isolates template logic from business logic. Cells make templates introspectable and previewable
(each cell shows its evaluated output in the editor) and let template authors mix imperative pre-computation with
declarative emit, without inventing a second DSL on top of Handlebars.

---

### 4. **@xomda/model** - Self-Definition CRUD & Introspection (✅ Complete)

**Location**: `packages/model/`  
**MDA Role**: Business logic for self-defining model CRUD operations and runtime introspection

**Purpose**: Complete CRUD operations for xomda's self-defining model, plus versioning and introspection APIs.

**Self-Definition CRUD** (18 tRPC procedures):

```typescript
// Model operations
model.get() → Model
model.save(model) → void
  model.addEntity(packageId ?, entity) → Entity
model.updateEntity(entity) → Entity
model.deleteEntity(id) → void

// Attribute operations
  model.addAttribute(entityId, attribute) → Attribute
model.updateAttribute(attribute) → Attribute
model.deleteAttribute(entityId, attributeId) → void

// Enum operations
  model.addEnum(packageId ?,

enum

) → Enum
model.updateEnum(

enum

) → Enum
model.deleteEnum(id) → void

// Package operations
  model.addPackage(parentId ?, package) → Package
model.updatePackage(package) → Package
model.deletePackage(id) → void
```

**Versioning & Diff System** (✅ Complete):

```typescript
// Snapshot storage in .xomda/history/
model.snapshot(label) → void
  model.listSnapshots() → Snapshot[]
model.diffSnapshots(fromId, toId) → DiffEntry[]
model.diffWithCurrent(snapshotId) → DiffEntry[]
```

**File Browser Integration** (✅ Complete):

```typescript
// Virtual file system overlay
template.preview() → RenderResult[]
template.getDiff() → {
  path, generated, current
}
[]
template.promote(paths ?) → string[]
```

**MDA Impact**: This package implements the runtime behavior of xomda's self-definition.

#### `storage/file-storage.ts` - File-Based Persistence

- `readModel()` / `writeModel(model)`: Loads / persists `.xomda/model.json`
- `readProjectMeta()` / `saveProjectMeta(meta)`: Loads / persists `.xomda/project.json`
- `readVersionsIndex()` / `listVersions()` / `getVersion(id)` / `commitVersion(args)`:
  version history (now stored _inside_ `project.json` rather than the legacy
  `.xomda/versions.json`; one-time migration runs on first read)
- File-based storage (not database) — suitable for version control and local-first workflows

#### `router/trpc.ts` - tRPC Instance Factory

```typescript
export const router = t.router
export const publicProcedure = t.procedure
```

Initializes tRPC server for type-safe RPC.

#### `router/model.router.ts` - Model CRUD Operations (488 lines)

Exposes tRPC procedures:

**Basic CRUD**:

- `get`: Query current model
- `save`: Persist entire model (validates with ModelSchema)

**Entity Operations**:

- `addEntity(packageId?, entity)`: Add entity to root or package
- `updateEntity(entity)`: Update entity anywhere in hierarchy
- `deleteEntity(id)`: Remove entity (recursive search)
- `addAttribute(entityId, attribute)`: Add attribute to entity
- `updateAttribute(attribute)`: Update attribute
- `deleteAttribute(entityId, attributeId)`: Remove attribute

**Enumeration Operations**:

- `addEnum(packageId?, enum)`: Add enum to root or package
- `updateEnum(enum)`: Update enum
- `deleteEnum(id)`: Remove enum (recursive search)
- `reorderEnumValues(enumId, values)`: Reorder enum values (NEW)

**Package Operations**:

- `addPackage(parentPackageId?, package)`: Add package (nested or root)
- `updatePackage(package)`: Update package
- `deletePackage(id)`: Remove package (recursive search)

**Ordering & Reordering** (NEW):

- `reorderAttributes(entityId, attributeIds)`: Reorder entity attributes
- `moveToPackage(itemId, itemType, targetPackageId, index?)`: Move item between packages
- `moveRootPackage(id, index)`: Reorder root-level packages

#### `router/template.router.ts` - Template Management

Exposes tRPC procedures:

- `list` / `get(uuid)` / `save(template)` / `delete(uuid)`: template CRUD
- `listFolders` / `saveFolder` / `deleteFolder`: template folder CRUD
- `moveTemplate` / `moveTemplateFolder`: drag-and-drop reorganisation
- `preview` / `previewWithDiff(beforeVersionId, afterVersionId?)`: render templates
  with optional `ModelDiff` context; returns `RenderResult[]` (paths + content) without
  writing to disk
- `generate` / `generateWithDiff(beforeVersionId, afterVersionId?)`: render _and_ write
  results, routed through `resolveWriteTarget` so writes outside the project root are
  blocked when `restrictWritesToProjectRoot` is on
- `getDiff`: structural diff against the on-disk files

#### `router/file.router.ts` - File System Browser

Exposes tRPC procedures for file system navigation:

- `list(path, showHidden)`: directory listing with metadata (isXomda, isXomdaDir, size, mtime)
- `getStats(path)`: per-file stats (size, mtime, atime, ctime, birthtime)
- `read(path)`: read a text file (UTF-8)
- `readBytes(path, maxBytes?)`: read a file as base64-encoded bytes (size-capped) — used
  for image and `HexView` binary previews
- All paths are resolved against `process.cwd()` and reject any `..`-escape with FORBIDDEN

#### `router/project.router.ts` - Project Metadata + Analysis

Exposes tRPC procedures for project-level state and the analysis subsystem:

- `context(path?)`: walk up from a path looking for `.xomda`; returns
  `'in-root' | 'in-subfolder' | 'none'` plus suggested project root
- `meta(root?)` / `updateMeta({ root?, meta })`: read/write `.xomda/project.json`
- `scan(root?)`: full analyzer run inside a `worker_thread`; returns
  `AnalysisResult & { subprojects, detectedIds }`, filtered by `project.plugins` when set
- `fileTypesFor({ path, root? })`: multi-match file-type descriptors + the
  highest-priority preview hint, filtered by `project.plugins`
- `refreshPlugins(root?)`: re-run detection and overwrite `project.plugins` (sorted)
- `listPlugins`: every analysis plugin known server-side

#### `router/analysis.router.ts` - Legacy Analysis Procedures

Older flat surface kept for backwards compatibility:

- `detect({ path })`: same as `project.scan` minus the filter / subproject merge
- `listPlugins`

#### `router/index.ts` - Composite Router

```typescript
export const appRouter = router({
  analysis: analysisRouter,
  model: modelRouter,
  project: projectRouter,
  template: templateRouter,
  file: fileRouter,
})
```

**Dependencies**:

- `@xomda/core`: Core types
- `@xomda/template`: Template rendering
- `@trpc/server`: RPC framework
- `zod`: Schema validation

**Why it exists**: Centralized business logic layer that can be consumed by any client (web, CLI, desktop) over tRPC
without code duplication.

---

### 5. **@xomda/diagram** - Dynamic UI Components

**Location**: `packages/diagram/`  
**MDA Role**: Model-adaptive visual components

**Purpose**: Vue 3 components that adapt to model changes automatically.

**Dynamic Capabilities**:

- DiagramCanvas that renders based on current model
- Entity components that show attributes dynamically
- Form generation from model definitions
- Relationship visualization

**MDA Impact**: UI that adapts to model changes without hardcoded components.

#### `Enum.tsx` - Enumeration Visualization

Renders enumeration types with their values. Useful for defining fixed sets of values (e.g., Status, Role, Priority).

#### `Package.tsx` - Nested Package/Namespace Container

Hierarchical container supporting nested packages, entities, and enums. Enables organizing domain models into logical
namespaces/modules.

**Also exports `DropZone`** (NEW) - Drag-and-drop zone component for reordering and moving elements between packages.

#### `EntityAttribute.tsx` - Attribute Item

Individual attribute display within entity (name, type, constraints like PK, unique, required).

#### `types.ts` - Component Type Definitions

```typescript
interface Attribute {
  id: string
  name: string
  type: string
  required?: boolean
  multiValue?: boolean
  primaryKey?: boolean
  unique?: boolean
  description?: string
}

interface EntityData {
  id: string
  name: string
  attributes: Attribute[]
  description?: string
}

interface EnumValueData {
  id: string
  name: string
}

interface EnumData {
  id: string
  name: string
  values: EnumValueData[]
  description?: string
}

interface PackageData {
  id: string
  name: string
  packages: PackageData[] // Nested packages
  enums: EnumData[]
  entities: EntityData[]
  description?: string
}
```

**Storybook Integration**:

- Located at `.storybook/` directory
- Run with `npm run dev` (starts on port 6006)
- Allows isolated component testing and documentation

**Build Output**:

- Compiled to `dist/` with type definitions (`dist/index.d.ts`)
- CSS included in `dist/index.css`
- Exports as both ESM and declaration files

**Dependencies**:

- `@xomda/icons`: Icon assets
- `vue`: Peer dependency (Vue 3.5.0)
- Dev: `storybook`, `vite`, `vite-plugin-dts`

**Why it exists**: Allows diagram visualization to be independently developed, tested (via Storybook), and reused in any
Vue 3 application.

---

### 6. **@xomda/icons** - UI Assets for Dynamic Interfaces

**Location**: `packages/icons/`  
**MDA Role**: Icon library for dynamic, model-driven interfaces

**Purpose**: Material Symbols icon library for consistent dynamic UI.

**MDA Impact**: Provides visual assets for forms that adapt to model changes.

```typescript
export const HomeIcon = getIconPath('home-outline')
export const ModelIcon = getIconPath('schema-outline')
```

**Why it exists**:

- Single source of truth for icon usage
- Prevents scattered icon strings across the codebase
- Easy to swap icon libraries without changing component code

---

### 7. **@xomda/node** - Runtime Introspection Server

**Location**: `packages/node/`  
**MDA Role**: HTTP server with model knowledge extraction

**Purpose**: Node.js server exposing tRPC APIs for model introspection.

**MDA Capabilities**:

- Runtime model queries
- Type-safe API generation
- CORS-enabled for cross-origin access
- Model validation endpoints

**MDA Impact**: Enables production applications to query model knowledge.
},
})
}

```

**Key Features**:

- CORS enabled for cross-origin requests
- tRPC HTTP adapter (supports both GET and POST)
- Default port: 6431
- Serves the entire `@xomda/model` router

**Scripts**:

- `npm run dev`: Watch mode with `tsx` (live reload)
- `npm run build`: Compile to JavaScript (tsc)
- `npm run typecheck`: Type checking only
- `npm run test`: Run tests with Vitest

**Dependencies**:

- `@xomda/model`: The API router
- `@trpc/server`: tRPC framework
- Dev: `tsx` (TypeScript execution)

**Why it exists**: Allows the model and templating system to run as a networked service, enabling web clients and CLI
tools to interact with the same business logic.

---

### 8. **@xomda/client** - Self-Bootstrapping Web Application

**Location**: `packages/client/`
**MDA Role**: Web app that adapts to its own model changes

**Purpose**: Vue 3 SPA that demonstrates MDA self-definition.

**Self-Bootstrapping Features**:
- Views that adapt to model changes
- Forms generated from model definitions
- Real-time code generation preview
- Model editing with immediate UI adaptation

**MDA Impact**: Living demonstration of self-definition - the app adapts to changes in its own model.

#### `src/router/` - Vue Router Configuration

Defines client-side routes and navigation structure.

#### `src/views/` - Page-Level Components

- **HomeView.tsx**: project-first dashboard — project name as hero, sections
  (Model, Templates, Files, Versions) with live summaries (entity counts,
  template counts, tech chips from analysis plugins). Shows a context banner
  when not at a project root and lists discovered subprojects.
- **ModelView.tsx** (primary feature):
  - Entity/Enum/Package CRUD operations
  - Attribute and enum value management
  - Visual diagram rendering (uses `@xomda/diagram`)
  - Drag-and-drop reordering (uses `DropZone`)
- **TemplatesView.tsx**:
  - Template list and management
  - Template editing with Monaco Editor (uses `@xomda/codeeditor`)
  - Template rendering preview
- **FileBrowserView.tsx**: file system navigation with multi-icon rendering
  driven by `project.fileTypesFor` + the analysis-client registry; preview
  pane routes through `PreviewHint` (text, markdown, image, binary →
  `HexView`, custom → plugin component).
- **VersionsView.tsx**: history of model snapshots.
- **SettingsView.tsx**: project metadata (name, description), file-system
  sandbox toggle (`restrictWritesToProjectRoot`), and a `PluginsCard` listing
  every analysis plugin with enable/disable + "Refresh detection".

#### `src/components/` - Reusable UI Components

- **AppNav/**: Side navigation. Always-visible Settings shortcut below the
  dark/light toggle.
- **AppTitleBar / AppSearch**
- **CommitModal**, **ModelDiffView**, **PanelDivider**, **ViewCardHeader**

#### `src/router/` - tRPC Client Router

Type-safe client-side tRPC procedure callers that mirror the backend `@xomda/model` router.

#### `src/styles/` - Global Stylesheets

Vuetify theming and custom styling (SCSS modules in views).

#### `src/trpc.ts` - tRPC Client Configuration

Initializes tRPC client pointing to backend server.

#### `src/utils.ts` - Helper Functions

Utility functions for the UI layer.

**State Management**:

- **Pinia**: Manages global state (model data, templates, UI state)

**Styling**:

- **Vuetify 4.0.5**: Material Design component library
- **SCSS Modules**: Component-scoped styles (\*.module.scss)
- **EditorConfig**: 2-space indentation, Unix line endings

**Font Assets**:

- Mulish (variable): Main display font
- Source Code Pro (variable): Monospace for code editors

**Testing**:

- **Vitest**: Unit tests
- **Cypress**: E2E tests (run with `npm run cypress:open` or `npm run cypress:run`)
- **happy-dom**: DOM implementation for unit tests

**Build**:

- `npm run build`: Type-check + Vite build (optimized bundle)
- `npm run dev`: Vite dev server (fast HMR)

**Dependencies**:

- `@xomda/diagram`: Entity diagram components
- `@xomda/icons`: Icon library
- `@xomda/model`: Type definitions
- `@trpc/client`: tRPC client
- `vue`, `vue-router`, `pinia`: State & routing
- `vuetify`: Material UI library
- `@xomda/codeeditor`: Monaco Code Editor integration
- `lodash-es`: Utility library

**Why it exists**: Provides the primary user interface for the xomda system. Separated from backend logic to allow
independent scaling, testing, and framework updates.

---

### 9. **@xomda/codeeditor** - Code Generation Preview

**Location**: `packages/codeeditor/`
**MDA Role**: Live preview of generated code

**Purpose**: Monaco Editor component for template rendering preview.

**MDA Impact**: Allows users to see how model changes affect generated code in real-time.

---

### 10. **@xomda/ui** - Generic UI Components

**Location**: `packages/ui/`
**MDA Role**: Reusable Vue components for consistent UI

**Purpose**: Shared UI components used across the application.

**Key Components**:
- `DynamicForm`: Model-adaptive form generation
- `TitleBar`: Application header component
- `FileEntryIcon`, `FileEntryListItem`: File row primitives
- `FilePreviewDialog`: File content preview
- `HexView`: read-only paged hex/ASCII viewer (used for binary file previews)
- `MultiIcon`: horizontal stack of icons with overflow indicator (used for
  multi-plugin file decorations)
- `Menu`, `MenuButton`, `ContextMenu*`, `SidePanel`, `Cell`, `Collapsible`
- Backgrounds: `AuroraBackground`, `GlassBackground`, `ParticleBackground`
- Composables: `useAsyncState`, `useDelayedLoading`, `useThemeMode`,
  `useCanvasBackground`, `useConfirm`, `usePrompt`, …

**MDA Impact**: Provides consistent, reusable UI building blocks that support dynamic model-driven interfaces.

---

### 11. Analysis subsystem — node and client halves

The analysis subsystem ships as **four** small workspace packages plus one package
per technology detector. See [Project Analysis](./PROJECT-ANALYSIS.md) for the full
plugin contract; the summary below is just where things live.

**`@xomda/analysis-core`** (`packages/analysis/core/`) — node-only. Owns:
- `ProjectAnalyzer.analyze(rootPath)` — runs every registered plugin against a folder
- Self-subscription registry: `registerAnalysisPlugin`, `getRegisteredAnalysisPlugins`
- `runAnalysisInWorker({ rootPath, pluginModules })` — spawns a `worker_thread`,
  imports the requested aggregator(s) for side-effect, runs the analyzer, returns
  the result without blocking the parent's event loop
- `fileTypesFor(path)` — multi-match lookup across all plugins, with
  highest-priority preview hint resolution
- All plugin contract types: `AnalysisPlugin`, `FileTypeDescriptor`, `PreviewHint`,
  `PluginMatch`, `ProjectKindContribution`

**`@xomda/analysis-client`** (`packages/analysis/client/`) — browser-side.
A separate registry holding `AnalysisPluginClient` manifests (icon SVG path,
optional Vue preview components keyed by `PreviewHint.componentId`).

**`@xomda/analysis-plugins`** (`packages/analysis/plugins/`) — node-side
aggregator. Side-effect-imports every plugin's `index.ts`. Importing this once
is enough for the registry to be fully populated.

**`@xomda/analysis-plugins-client`** (`packages/analysis/plugins-client/`) —
client-side aggregator. Side-effect-imports every plugin's `./client` entry.
Also runs an **id-parity** spec asserting every node plugin has a client
counterpart with the same id (and vice versa) — guards against drift.

### 12. `@xomda/plugin-analysis-*` — per-technology plugins

Each plugin lives in `packages/analysis/<name>/` and exports both halves:

```

src/index.ts node-side: detect / inspect / fileTypes / projectKind
src/client.ts browser-side: icon + optional preview components
package.json exports: { ".": "./src/index.ts", "./client": "./src/client.ts" }

```

Currently shipped (14 plugins): `xomda` (owns the `.xomda` project kind),
`typescript`, `vite`, `maven`, `gradle`, `ant`, `eslint`, `prettier`,
`stylelint`, `rust`, `webpack`, `intellij`, `vscode`, `visual-studio`.

Adding a new plugin = create the package with both halves + add one import line
to each aggregator. The aggregator and id-parity specs pick it up automatically.

## MDA Architecture Principles

### Self-Definition Flow

1. **Model Definition**: xomda defines Entity/Attribute/Template schemas in `@xomda/core`
2. **Self-Introspection**: System can query its own model structure
3. **Dynamic UI**: Components adapt to model changes automatically
4. **Code Generation**: Templates generate new capabilities from model
5. **Self-Bootstrapping**: Generated code integrates back into the system

### Cross-Environment Support

- **Unified Models**: Single model definition works across frameworks
- **Template Packages**: Pluggable generation for Spring Boot, NestJS, etc.
- **Runtime Adaptation**: Code adjusts based on target environment
- **Plugin System**: External plugins extend generation capabilities

### Runtime Introspection Architecture

- **Type-Safe Queries**: tRPC ensures type safety for model queries
- **Compile-Time Extraction**: Model knowledge available during build
- **Dynamic Validation**: Runtime validation against model constraints
- **Inheritance Resolution**: Support for complex model relationships

---

## Development Workflow (MDA-Enabled)

### Self-Definition Development Cycle

1. **Modify Core Model** in `@xomda/core` schemas
2. **Update UI Components** in `@xomda/diagram` to reflect changes
3. **Generate Code** using templates in `@xomda/template`
4. **Test Self-Bootstrapping** with `pnpm dev`
5. **Verify Runtime Introspection** APIs work correctly

### Cross-Environment Development

1. **Create Template Package** for target framework (Spring Boot, etc.)
2. **Define Options** (Lombok, Java version, etc.)
3. **Implement Templates** as `.template.json` cell sequences (logic + handlebars + output cells)
4. **Test Generation** with sample models
5. **Package as Plugin** for distribution

---

## MDA Quality Assurance

### Testing Strategy

- **Self-Definition Tests**: Verify system can modify its own model
- **Dynamic UI Tests**: Ensure components adapt to model changes
- **Generation Tests**: Validate code generation for all target frameworks
- **Introspection Tests**: Test runtime model knowledge extraction
- **Bootstrapping Tests**: Verify self-bootstrapping doesn't break functionality

### Code Quality

- **TypeScript Strict Mode**: Ensures type safety in self-defining system
- **Schema Validation**: Zod schemas prevent invalid model states
- **Runtime Type Checking**: tRPC provides end-to-end type safety
- **Automated Testing**: Comprehensive test coverage for MDA features

---

## Future MDA Architecture Evolution

### Advanced Self-Definition
- **Model Versioning**: Track changes to core model definitions
- **Migration Generation**: Auto-generate upgrade code between model versions
- **Inheritance System**: Full support for entity inheritance and interfaces

### Enhanced Runtime Capabilities
- **Compile-Time Introspection**: Model knowledge extraction during build
- **Dynamic Code Generation**: Runtime code generation from model changes
- **Model Diffing**: Advanced comparison between model versions

### Enterprise MDA Features
- **Plugin Marketplace**: Community-contributed template packages
- **Multi-Model Support**: Manage multiple related models
- **Model Governance**: Version control and approval workflows for model changes

---

## Related Documentation

- [Concepts](./concepts.md) — MDA philosophy, two-tier architecture, self-definition.
- [Data model](./data-model.md) — schema of `model.json`.
- [Templates](./templates.md) — the cell-based template engine.
- [API](./api.md) — tRPC procedure reference.
- [Development](./development.md) — toolchain, scripts, environment, deployment.
```
