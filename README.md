# xΟΔ

<small style="position:relative; top:-1.4rem; opacity: .7;">_xomda.js - Model-Driven Architecture Platform_</small>

A **Model-Driven Architecture (MDA)** platform where xomda defines its own model within itself, enabling
self-bootstrapping, dynamic UI adaptation, and cross-environment code generation.

**Status**:  Active Development - Self-Definition Loop Closed  Build Issues (Client TypeScript)  
**License**: MIT

---

## What is xomda? (MDA Vision)

xomda.js is a **self-defining, model-driven platform** that revolutionizes data modeling and code generation:

### Core MDA Principles

1. **Self-Definition**: xomda manages its own core models (Entity, Attribute, Template) as entities within its own model
   system
2. **Self-Bootstrapping**: Generates its own TypeScript/Java code from model definitions with automatic restart
   capabilities
3. **Dynamic UI**: Forms and interfaces adapt automatically to model changes—no hardcoded components
4. **Cross-Environment**: Unified models generate code for Spring Boot, NestJS, Next.js, and more
5. **Template Packages**: Pluggable generation systems for different frameworks and languages
6. **Runtime Introspection**: Extract model knowledge at runtime or compile-time for production applications

### Key Capabilities

- **Visual Data Modeling** - Design entities, enums, and packages with an intuitive diagram interface
- **Hierarchical Organization** - Group models using nested packages/namespaces with inheritance support
- **Advanced Modeling** - Blueprints, prototypes, and specialized attribute types
- **Code Generation** - Generate boilerplate code, migrations, APIs using cell-based templates (`*.template.json`)
- **Template Management** - Create, edit, and manage code generation templates with plugin support
- **Type-Safe APIs** - Seamless client-server communication with tRPC and runtime validation

**Think of it as**: An ERD tool that defines itself, generates its own code, and adapts its UI dynamically.

**→ Deep dive into MDA philosophy**: [MDA.md](./docs/MDA.md)

---

## MDA-Enabled Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Web UI (@xomda/client)                    │
│              Vue 3 + Vuetify + Dynamic MDA Forms            │
│              Adapts to model changes automatically          │
└─────────────────┬───────────────────────────────────────────┘
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
│   ├─ Model CRUD (Self-Definition: Entity, Attribute, etc.) │
│   ├─ Template Management (Plugin Architecture)             │
│   ├─ File-based Storage (.xomda/model.json)                │
│   ├─ Runtime Introspection APIs                             │
│   └─ Model Diffing & Versioning                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
      ┌───────────┼───────────┬─────────────┐
      │           │           │             │
┌─────▼──┐  ┌────▼─────┐  ┌──▼──────┐  ┌──▼────┐
│@xomda/ │  │@xomda/   │  │@xomda/  │  │@xomda/│
│template│  │diagram   │  │icons    │  │ui     │
│(MDA    │  │(Dynamic  │  │(Assets) │  │(UI    │
│Engine) │  │Components)│  │         │  │Comps) │
└────────┘  └──────────┘  └─────────┘  └───────┘
```

**12+ Packages** organized by MDA concerns:

- **Core MDA Layer**: `core` (self-defining schemas), `util` (runtime helpers)
- **Business Logic**: `model` (self-definition CRUD), `template` (generation engine)
- **Dynamic UI**: `diagram` (model-adaptive components), `icons` (asset library), `ui` (generic components),
  `codeeditor` (Monaco integration)
- **Applications**: `client` (self-bootstrapping web app), `node` (introspection server)
- **Analysis**: `analysis-core` (framework), `plugin-analysis-*` (technology detectors)

**→ See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed MDA architecture**

---

## Quick Start: Experience Self-Definition

### Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (run `npm install -g pnpm` if needed)

### Installation & Self-Bootstrapping Demo

```bash
# Clone and install
git clone <repo>
cd modelman
pnpm install

# Start MDA self-bootstrapping servers
pnpm dev

# Server runs on http://localhost:3000
# Client runs on http://localhost:5173
```

### Experience MDA Self-Definition

1. **Open the application** at http://localhost:5173
2. **Navigate to Model view** - See xomda's own core models (Entity, Attribute, Template)
3. **Modify an Attribute entity** - Add a new field like `validationPattern`
4. **Watch dynamic adaptation** - UI forms automatically show the new field
5. **Generate code** - Templates create TypeScript interfaces from the model
6. **Self-bootstrapping** - Generated code could restart the system with new capabilities

** Note**: Client build currently has TypeScript errors related to Vuetify component props. The development server
runs successfully, but production builds may fail. Tests pass and core functionality works.

---

## MDA Package Overview

| Package                      | MDA Role                             | Key Capabilities                                       | Status            |
|------------------------------|--------------------------------------|--------------------------------------------------------|-------------------|
| **@xomda/core**              | Self-Defining Schemas                | Entity, Attribute, Template schemas + runtime helpers  |  Complete        |
| **@xomda/util**              | Runtime MDA Helpers                  | Model introspection, validation, diff utilities        |  Complete        |
| **@xomda/template**          | Template Engine                      | Cell-based templates (logic / handlebars / output / provider cells) |  Complete        |
| **@xomda/model**             | Self-Definition CRUD & Introspection | Model CRUD, runtime queries, versioning                |  Complete        |
| **@xomda/diagram**           | Dynamic UI Components                | Model-adaptive diagram canvas, forms, relationships    |  Complete        |
| **@xomda/icons**             | UI Assets                            | Material Symbols for dynamic interfaces                |  Complete        |
| **@xomda/codeeditor**        | Code Generation Preview              | Monaco Editor with live template rendering             |  Complete        |
| **@xomda/ui**                | Generic UI Components                | Reusable Vue components (DynamicForm, TitleBar, etc.)  |  Complete        |
| **@xomda/node**              | Runtime Introspection Server         | tRPC server with model knowledge extraction            |  Complete        |
| **@xomda/client**            | Self-Bootstrapping Web App           | Vue 3 app that adapts to its own model changes         |  Build Issues   |
| **@xomda/analysis-core**     | Project Analysis Framework           | Technology detection and project analysis utilities    |  In Development |
| **@xomda/plugin-analysis-*** | Technology Detectors                 | Language/framework detectors (TypeScript, Java, etc.)  |  In Development |

---

## MDA Development Workflow

### Available Scripts

```bash
# MDA Development
pnpm dev              # Start self-bootstrapping servers
pnpm --filter @xomda/client dev      # Frontend with dynamic UI
pnpm --filter @xomda/node dev        # Backend with introspection

# Building & Generation
pnpm build            # Build all MDA packages
pnpm generate         # Generate code from current model

# Quality Assurance
pnpm typecheck        # TypeScript validation
pnpm lint             # Code quality checks
pnpm test             # MDA feature tests
pnpm test:mda         # Self-definition verification
```

### MDA Development Cycle

1. **Modify Core Model** - Edit Entity/Attribute definitions in the model
2. **Dynamic UI Adaptation** - Watch forms automatically update
3. **Generate Code** - Use templates to create new capabilities
4. **Self-Bootstrapping** - System incorporates new generated code
5. **Runtime Introspection** - Query model knowledge in production

---

## MDA Milestones & Roadmap

### **Completed (Self-Definition Foundation)**

- **Self-Defining Model**: xomda's core types (Entity, Attribute, Enum, Package, Model) are defined within its own
  model.json
- **Self-Bootstrapping UI**: Dynamic forms adapt automatically to model changes—no hardcoded components
- **Inheritance System**: Entity inheritance with blueprint support and abstract entities
- **Reference vs Embed**: Attributes can reference entities by ID or embed them directly
- **Model Versioning & Diff**: Complete diffing system with snapshot storage and change tracking
- **Self-Regeneration Loop**: Generate code from model, compare with disk, promote changes to source
- **Runtime Introspection**: Extract model knowledge at runtime for production applications
- **Cell-Based Template Engine**: notebook-style logic / handlebars / output cells, with `provider` cells for per-entity / per-enum / per-package / arbitrary-JS iteration
- **File Browser Overlay**: Virtual file system showing generated code alongside real files
- **Testing Infrastructure**: 137 comprehensive tests across all packages
- **Schema Openness**: Dynamic schema builder constructs strict schemas from effective attributes

### **In Progress (Advanced MDA)**

- **Template Packages**: Pluggable generation systems for Spring Boot, NestJS, Next.js frameworks
- **Cross-Environment Support**: Stabilize Java/Spring Boot, enhance TypeScript/Zod packages
- **Model Validation**: Advanced uniqueness rules, cross-reference validation
- **UI Enhancements**: Tier-2 UX with meta-type pickers and effective attribute rendering

### **Future Vision (Production MDA)**

- **Automatic Restart**: Self-bootstrapping engine with HMR-like model change detection
- **Enterprise Features**: Model upgrade generation, migration scripts from diffs
- **Plugin Architecture**: External template packages and MDA extensions
- **Performance Optimization**: Lazy loading, caching for large models
- **Multi-User Collaboration**: Concurrent editing with conflict resolution

---

## Documentation

- **[MDA.md](./docs/MDA.md)** - Complete MDA philosophy and vision
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Technical architecture details
- **[REFACTORING.md](./docs/REFACTORING.md)** - MDA-aligned code organization
- **[TODO.md](./docs/TODO.md)** - Project roadmap and tasks
- **Template Documentation** - Individual template package guides
- **Plugin Development** - Extending xomda with custom MDA capabilities

---

## Contributing to MDA Evolution

xomda's self-defining nature means **contributing to xomda improves xomda itself**:

1. **Fork and modify** the core model definitions
2. **Generate new capabilities** using templates
3. **Test self-bootstrapping** with your changes
4. **Submit PRs** that enhance the MDA platform

**Join the evolution of self-defining software!** 

4. **Lint**: `pnpm lint` (ESLint + Stylelint)
5. **Test**: `pnpm test` (Vitest)
6. **Commit**: All checks should pass

### Project Structure Example

```
modelman/
├── packages/
│   ├── core/                    # 🔹 Type definitions
│   │   └── src/index.ts         # Entity, Attribute, Model interfaces
│   ├── template/                # 🔹 Code generation
│   │   ├── src/engine.ts        # Cell pipeline executor
│   │   ├── src/processors/      # One processor per cell type (logic/handlebars/output/provider/...)
│   │   ├── src/helpers.ts       # Handlebars helpers (camelCase, eq, required, ...)
│   │   ├── src/renderer.ts      # Scope-aware renderer (provider cell or legacy template.scope)
│   │   └── src/storage.ts       # File I/O for *.template.json templates
│   ├── model/                   # 🔹 Business logic layer
│   │   ├── src/router/          # tRPC procedures
│   │   ├── src/schemas/         # Zod validation
│   │   └── src/storage/         # Model persistence
│   ├── client/                  # 🔹 Web UI (Vue 3 SPA)
│   │   ├── src/views/           # HomeView, ModelView, TemplatesView
│   │   ├── src/components/      # Sidebar, TitleBar
│   │   └── src/router/          # tRPC client hooks
│   ├── codeeditor/              # 🔹 Monaco Code Editor
│   │   └── src/index.ts         # Editor component & configuration
│   └── node/                    # 🔹 Backend server
│       └── src/server.ts        # HTTP + CORS + tRPC
├── .cursor/rules/               #  AI Agent instructions (Cursor, shared knowledge base)
├── CLAUDE.md                    #  Claude / Junie instructions
├── .clinerules                  #  Cline / Roo Code instructions
├── .windsurfrules               #  Windsurf instructions
├── .github/copilot-instructions.md #  GitHub Copilot instructions
├── docs/                        #  Documentation (MDA, Architecture, TODO)
├── tsconfig.json                # TypeScript configuration
├── eslint.config.mjs            # Linting rules (flat config)
└── pnpm-workspace.yaml          # Workspace definition
```

---

## Data Model Format

### Model Structure (JSON)

The model supports **three organizational levels**: root entities/enums, packages, and nested content:

```json
{
  "id": "uuid",
  "name": "MyDatabase",
  "version": "1.0.0",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "entities": [
    {
      "id": "uuid",
      "name": "User",
      "attributes": [
        {
          "id": "uuid",
          "name": "id",
          "type": "uuid",
          "primaryKey": true,
          "required": true
        }
      ]
    }
  ],
  "enums": [
    {
      "id": "uuid",
      "name": "Status",
      "values": [
        {
          "id": "uuid",
          "name": "ACTIVE"
        }
      ]
    }
  ],
  "packages": [
    {
      "id": "uuid",
      "name": "domain",
      "packages": [],
      "enums": [],
      "entities": []
    }
  ],
  "elementsOrder": [
    "entity-id",
    "enum-id",
    "package-id"
  ]
}
```

**Architecture**: Models organize content into root packages, which can contain nested packages, enumerations, and
entities for full domain-driven design support.

### File Storage

Models and templates are stored in a `.xomda/` directory (configurable via `XOMDA_DIR` env var):

```
.xomda/
├── model.json                  # Your data model (persistent)
└── templates/                  # Code generation templates (cell-based JSON)
    ├── Java/
    │   └── main-java.template.json
    └── TypeScript/
        ├── core-schema.template.json
        └── zod.template.json
```

**Why file-based?** Version control friendly, offline-capable, no database overhead.

---

## Code Generation with Templates

A template is a `*.template.json` file: a sequence of **cells** that execute top-to-bottom, sharing a context. Cell
types:

- `provider` — picks the iteration unit (`entities`, `enums`, `packages`, or arbitrary JS); the rest of the cells run
  once per yielded item.
- `logic` — JavaScript that sets variables (`fields = ...`) for downstream cells.
- `handlebars` — a Handlebars string rendered against the current context; output appended to the cell's `$out` buffer.
- `output` — declares an emitted file. `outputFilename` is itself a Handlebars expression. Content is either a named
  variable (via `outputContent`) or the concatenation of all preceding cell `$out` buffers.
- `buffer` — named accumulator (rarely needed).
- `markdown` — inert; carries documentation.

For backwards compatibility, a template without a provider cell falls back to the `template.scope` field
(`Entity` / `Enum` / `Package`) to determine the iteration unit; without that, the template runs once over the whole
model.

### Example — a per-entity Java POJO template

```json
{
  "uuid": "f951ceda-977a-4caa-b47e-405d7fcf488b",
  "name": "Main Template (Java)",
  "version": "1.0.0",
  "folder": "Java",
  "cells": [
    { "uuid": "...", "type": "provider", "providerSource": "entities", "variableName": "$entity", "content": "" },
    { "uuid": "...", "type": "logic",   "content": "const javaMap = { string: 'String', number: 'Integer', boolean: 'Boolean', decimal: 'BigDecimal', uuid: 'UUID' };\nfields = (attributes||[]).map(a => ({ camel: camelCase(a.name), pascal: pascalCase(a.name), type: javaMap[a.type] || pascalCase(a.type) }));" },
    { "uuid": "...", "type": "logic",   "content": "fieldDecls = fields.map(f => '  private ' + f.type + ' ' + f.camel + ';').join('\\n');" },
    { "uuid": "...", "type": "handlebars", "content": "public class {{pascalCase name}} {\n\n{{{fieldDecls}}}\n\n}\n" },
    { "uuid": "...", "type": "output",  "outputFilename": "{{pascalCase name}}.java", "content": "" }
  ]
}
```

The `provider` cell makes this run once per entity in the model. The two `logic` cells precompute language-specific
strings; the `handlebars` cell is a thin presentation layer; the `output` cell writes one file per entity.

### Available helpers (in handlebars cells)

**String Transformations** (compatible with handlebars.java):

- `camelCase`, `pascalCase`, `snakeCase`, `kebabCase`, `constantCase`
- `upperCase`, `lowerCase`

**Comparisons**: `eq`, `ne`, `and`, `or`, `not`

**Array Operations**: `join`, `first`, `last`

**Domain-Specific**:

- `required`: Filter only required attributes
- `primaryKeys`: Filter only primary key attributes

Helpers stay generic — target-language type maps (Java types, Zod types, etc.) live in the template's own logic cells,
not in helpers.

---

## API Architecture (tRPC)

### Type-Safe RPC

The backend exposes a tRPC router with complete type safety flowing to the frontend:

```typescript
// Backend (@xomda/model/router/index.ts)
export const appRouter = router({
  model: modelRouter, // CRUD for entities/attributes
  template: templateRouter, // Template management
})

// Frontend (@xomda/client/src/router/index.ts) - types auto-generated
const model = await trpc.model.get.query()
await trpc.model.addEntity.mutate({ name: 'User', attributes: [] })
```

### Available Procedures

**Model Router** (`trpc.model.*`): 18 CRUD procedures

*Basic Operations*:

- `get()` - Query current model
- `save(model)` - Persist model (validates with ModelSchema)

*Entity Operations*:

- `addEntity(packageId?, entity)` - Create entity in root or package
- `updateEntity(entity)` - Modify entity anywhere in hierarchy
- `deleteEntity(id)` - Remove entity (recursive search)
- `addAttribute(entityId, attribute)` - Add attribute to entity
- `updateAttribute(attribute)` - Modify attribute
- `deleteAttribute(entityId, attributeId)` - Remove attribute
- `reorderAttributes(entityId, attributeIds)` - Reorder attributes (NEW)

*Enum Operations*:

- `addEnum(packageId?, enum)` - Create enum in root or package
- `updateEnum(enum)` - Modify enum
- `deleteEnum(id)` - Remove enum (recursive search)
- `reorderEnumValues(enumId, values)` - Reorder enum values (NEW)

*Package Operations*:

- `addPackage(parentPackageId?, package)` - Create package (nested or root)
- `updatePackage(package)` - Modify package
- `deletePackage(id)` - Remove package (recursive search)
- `moveToPackage(itemId, itemType, targetPackageId, index?)` - Move item between containers (NEW)
- `moveRootPackage(id, index)` - Reorder root-level items (NEW)

**Template Router** (`trpc.template.*`):

- `list()` - List all templates
- `read(name)` - Load template content
- `write(name, content)` - Save/update template
- `delete(name)` - Remove template

**File Router** (`trpc.file.*`):

- `list(path, showHidden)` - List directory contents with metadata (file size, modification time, is-xomda-folder flag)

---

## Testing

### Unit Tests (Vitest)

```bash
pnpm --filter @xomda/node test
pnpm --filter @xomda/client test:watch
pnpm test:coverage
```

Tests are located in `**/*.test.ts` files alongside source code.

### E2E Tests (Cypress)

```bash
# Headless
pnpm --filter @xomda/client cypress:run

# Interactive GUI
pnpm --filter @xomda/client cypress:open
```

Tests located in `packages/client/cypress/`

### Type Checking

```bash
pnpm typecheck  # tsc --noEmit (no JavaScript output)
```

---

## Code Quality Standards

### Formatting

- **Prettier** with 2-space tabs, no semicolons, single quotes
- **EditorConfig** for universal editor settings
- Run `pnpm format` to auto-fix

### Linting

- **ESLint** (flat config) with TypeScript support
- **Stylelint** for CSS/SCSS
- Run `pnpm lint` to check

### Key Rules

- No `any` types (warned)
- Unused variables must start with `_` (e.g., `_unused`)
- Imports must be sorted (simple-import-sort)
- Type imports must use `import type { X }`
- String concatenation forbidden (use template literals)

### TypeScript

- Target: ES2022
- Mode: Strict (all strict checks enabled)
- No unused variables/imports (warnings)

---

## Environment Variables

### Backend (@xomda/node)

```bash
XOMDA_DIR=.xomda           # Root folder for models/templates (default: .xomda)
NODE_ENV=development       # development | production
```

### Frontend (@xomda/client)

```bash
VITE_API_URL=http://localhost:3000  # Backend URL (used in src/trpc.ts)
```

---

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Complete technical deep-dive (this file is much longer and detailed)
- **[.cursor/rules/](./cursor/rules)** - AI agent instructions (shared knowledge base)
- **[CLAUDE.md](./CLAUDE.md)** - Claude / Junie instructions
- **[.clinerules](./.clinerules)** - Cline / Roo Code instructions
- **[.windsurfrules](./.windsurfrules)** - Windsurf instructions
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - GitHub Copilot instructions

---

## Deployment

### Backend Server (@xomda/node)

```bash
# Build
pnpm --filter @xomda/node build

# Output: packages/node/dist/
# Run: node dist/index.js
# Default port: 3000
```

**Docker Example**:

```dockerfile
FROM node:20
WORKDIR /app
COPY packages/node/dist .
CMD ["node", "index.js"]
```

### Frontend (@xomda/client)

```bash
# Build
pnpm --filter @xomda/client build

# Output: packages/client/dist/
# Deploy as static site (Vercel, Netlify, S3, etc.)
```

### Component Library (@xomda/diagram)

```bash
# Build as npm package
pnpm --filter @xomda/diagram build

# Output: packages/diagram/dist/ (with types)
# Publish to npm:
# npm publish dist/
```

---

## Contributing

### Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and ensure code quality:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm format
   pnpm test
   ```
3. Commit with clear messages
4. Open a pull request

### Guidelines

- Follow existing code style (use `pnpm format` to auto-conform)
- Add tests for new features
- Update documentation if behavior changes
- Use TypeScript strict mode (no `any`)

---

## Troubleshooting

### Port Already in Use

```bash
# Change port in packages/node/src/index.ts or packages/client/vite.config.ts
# Or kill the process:
lsof -i :3000  # Find process on port 3000
kill -9 <PID>
```

### Dependencies Not Installing

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall everything
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Type Errors After Changing Code

```bash
# Rebuild TypeScript declarations
pnpm typecheck

# Sometimes tsc cache needs clearing:
find . -name "*.tsbuildinfo" -delete
pnpm typecheck
```

### Build Fails

```bash
# Check for linting issues first
pnpm lint

# Then rebuild
pnpm build
```

---

## Tech Stack Summary

| Layer                 | Technology           | Version |
|-----------------------|----------------------|---------|
| **Language**          | TypeScript           | 6.0.3   |
| **Runtime**           | Node.js              | 20+     |
| **Package Manager**   | pnpm                 | 10.33.0 |
| **Frontend**          | Vue 3                | 3.5.32  |
| **UI Library**        | Vuetify              | 4.0.5   |
| **Backend API**       | tRPC                 | 11.16.0 |
| **HTTP Server**       | Node.js (standalone) | -       |
| **Build Tool**        | Vite                 | 8.0.8   |
| **Template Engine**   | Cell-based (in-house) | —      |
| **Handlebars (cell)** | Handlebars            | 4.7.9   |
| **Schema Validation** | Zod                  | 4.3.6   |
| **Testing**           | Vitest               | 4.1.4   |
| **E2E Tests**         | Cypress              | 15.14.0 |
| **Linting**           | ESLint               | 10.2.1  |
| **Formatting**        | Prettier             | 3.8.3   |
| **CSS Linting**       | Stylelint            | 17.8.0  |
| **Styling**           | Sass (SCSS)          | 1.99.0  |

---

## Support & Resources

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vue 3**: https://vuejs.org/guide/
- **tRPC**: https://trpc.io/docs/
- **Handlebars**: https://handlebarsjs.com/
- **Zod**: https://zod.dev/
- **pnpm**: https://pnpm.io/

---

## License

MIT License - see [LICENSE](./LICENSE) file for details

---

**Last Updated**: April 2025

---

## Navigation

- **New to the project?** → Start with this README, then read [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **AI Agent?** → Check [.cursor/rules/KNOWLEDGE_BASE.md](./.cursor/rules/KNOWLEDGE_BASE.md) — the unified knowledge
  base for all agents
- **Want to contribute?** → See Contributing section above and [.clinerules](./.clinerules)
- **Need deep technical details?** → Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md) (comprehensive guide)
