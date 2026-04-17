# xomda.js Development Guide for AI Agents

This guide provides comprehensive context for AI assistants working on the xomda.js project. Use this to understand the
project's architecture, conventions, and best practices.

## Quick Navigation

- **Project Overview** → `project-overview.mdc` (package structure, data model)
- **Tech Stack** → `tech-stack.mdc` (technologies, versions, configurations)
- **Coding Standards** → `coding-standards.mdc` (formatting, linting, best practices)
- **Architecture Details** → Root `ARCHITECTURE.md` (complete technical deep-dive)
- **Quick Start** → Root `README.md` (setup and common tasks)

---

## Understanding the Project

### What is xomda?

**xomda.js** = Data Model Designer + Code Generator Platform

Users can:

1. Design database schemas/data models visually (entities and attributes)
2. Write code generation templates (Handlebars-based)
3. Generate code in any language/framework by rendering templates

### Why This Matters for Development

- **Type Safety First**: All backend types flow to frontend automatically (tRPC)
- **Monorepo Structure**: Changes to one package may affect others
- **Code Generation**: Template logic is critical—test thoroughly
- **File-Based Storage**: Model data is JSON in `.xomda/` directory (no database)

---

## Project Structure Deep Dive

### The 12 Packages

```
@xomda/core          (Types & Constants)
    ↓ (imported by)
@xomda/template      (Handlebars Engine)
@xomda/model         (Business Logic)
    ↓ (imported by)
@xomda/node          (HTTP Server)
@xomda/client        (Web UI)
    ↓ (UI layer)
@xomda/diagram       (Vue Components)
@xomda/icons         (Icon Assets)
@xomda/ui            (Generic UI Components)
@xomda/codeeditor    (Monaco Editor)
@xomda/analysis-core (Analysis Framework)
@xomda/plugin-analysis-* (Technology Detectors)
```

### Dependency Direction

**Allowed Dependencies**: `client` → `model` → `template` → `core`  
**NOT Allowed**: `core` → `model` (creates circular dependency)

### Key Files by Package

| Package      | Core Files                               | Purpose                                      |
|--------------|------------------------------------------|----------------------------------------------|
| **core**     | `src/index.ts`                           | Exports `Attribute`, `Entity`, `Model` types |
| **template** | `engine.ts`, `helpers.ts`, `storage.ts`  | Handlebars compilation + custom helpers      |
| **model**    | `router/model.router.ts`, `schemas/`     | tRPC procedures + Zod validation             |
| **node**     | `src/server.ts`                          | HTTP server (CORS + tRPC adapter)            |
| **client**   | `src/views/ModelView.tsx`, `src/router/` | Main UI + tRPC client                        |
| **diagram**  | `src/components/`, `.storybook/`         | Reusable Vue components                      |

---

## Common Development Tasks

### Adding a Feature

**Step 1: Determine Package**

- Models/attributes? → `@xomda/model`
- Template rendering? → `@xomda/template`
- UI component? → `@xomda/client` or `@xomda/diagram`
- New core type? → `@xomda/core`

**Step 2: Implement**

```bash
# Navigate to package
cd packages/my-package

# Edit source files in src/
# TypeScript auto-checks via IDE

# Test locally
pnpm typecheck
```

**Step 3: Quality Check**

```bash
pnpm lint      # ESLint + Stylelint
pnpm format    # Prettier
pnpm test      # Vitest + Cypress
```

### Modifying the Data Model

**Example: Add "indexed" field to Attribute**

1. Update type in `@xomda/core/src/index.ts`:

```typescript
export interface Attribute {
  id: string
  name: string
  type: string
  required: boolean
  indexed?: boolean // ← NEW
  // ... other fields
}
```

2. Update Zod schema in `@xomda/model/src/schemas/attribute.ts`:

```typescript
export const AttributeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  indexed: z.boolean().optional(), // ← NEW
  // ...
})
```

3. The change automatically flows to:

- `@xomda/client` (types updated)
- `@xomda/diagram` (components can access new field)
- Database validation (Zod)

4. Test: `pnpm typecheck` (should pass automatically)

### Adding a Template Helper

In `@xomda/template/src/helpers.ts`:

```typescript
export function registerHelpers(hbs: typeof Handlebars = Handlebars): void {
  // ... existing helpers ...

  // NEW HELPER
  hbs.registerHelper('pluralize', (word: string) => {
    // Your pluralization logic
    return word + 's'
  })
}
```

Usage in template:

```handlebars
table {{entity.name | pluralize}}
```

### Testing a Change

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Unit tests
pnpm test

# E2E tests (client only)
pnpm --filter @xomda/client cypress:open

# Running specific package tests
pnpm --filter @xomda/node test:watch
```

### Debugging

**Backend (Node.js)**:

```bash
# Add console.log or debugger statements
# Run with inspector
node --inspect packages/node/dist/index.js
# Open chrome://inspect in Chrome
```

**Frontend (Vue)**:

```bash
# Vue DevTools extension (browser)
# Console logs
# Network tab (tRPC calls)
```

**Templates**:

```handlebars
{{#debug entity}}
<!-- Prints entity to console -->
```

---

## Code Patterns & Conventions

### Writing tRPC Procedures

**In `@xomda/model/src/router/`**:

```typescript
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { publicProcedure, router } from './trpc'
import { EntitySchema } from '../schemas/entity'
import { readModel, writeModel } from '../storage/file-storage'

export const modelRouter = router({
  // Query (read-only)
  get: publicProcedure.query(() => readModel()),

  // Mutation (write with validation)
  updateEntity: publicProcedure.input(EntitySchema).mutation(async ({ input }) => {
    const model = await readModel()
    const index = model.entities.findIndex((e) => e.id === input.id)
    if (index === -1) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Entity ${input.id} not found`,
      })
    }
    const entities = [...model.entities]
    entities[index] = input
    return writeModel(ModelSchema.parse({ ...model, entities }))
  }),
})
```

**Key Points**:

- Queries for reads, mutations for writes
- Always validate input with Zod
- Throw `TRPCError` for API errors
- Return validated output

### Using tRPC in Vue Components

**In `@xomda/client/src/`**:

```typescript
import { ref } from 'vue'
import { trpc } from '../router'

export default {
  async setup() {
    const model = ref(null)
    const loading = ref(false)

    async function loadModel() {
      loading.value = true
      try {
        model.value = await trpc.model.get.query()
      } catch (error) {
        console.error('Failed to load model:', error)
      } finally {
        loading.value = false
      }
    }

    // Load on mount
    await loadModel()

    return { model, loading }
  },
}
```

### Template with Type Safety

In a Vue component using a model template:

```typescript
import { renderTemplate } from '@xomda/template'
import type { Model } from '@xomda/core'

function generateCode(template: string, model: Model): string {
  return renderTemplate(template, model)
}
```

---

## Working with the Frontend

### Adding a New View

1. Create file: `packages/client/src/views/MyView.tsx`
2. Add route in `packages/client/src/router/`
3. Register in navigation (Sidebar)
4. Add styling: `MyView.module.scss`

Example:

```typescript
// MyView.tsx
import { ref } from 'vue'
import styles from './MyView.module.scss'

export const MyView = () => {
  const data = ref(null)
  // Your logic here
  return <div class={styles.container}>{/* Your template */}</div>
}
```

### Working with Vuetify Components

```typescript
import { VBtn, VCard, VTextField } from 'vuetify/components'

export const MyComponent = () => (
  <VCard>
    <VTextField v-model={value.value} label="Enter text" />
    <VBtn onClick={() => handleSave()}>Save</VBtn>
  </VCard>
)
```

### Styling with SCSS Modules

**MyView.module.scss**:

```scss
.container {
  padding: 16px;
  background: var(--v-background-base);

  .section {
    margin-bottom: 24px;
  }
}
```

**MyView.tsx**:

```typescript
import styles from './MyView.module.scss'

export const MyView = () => (
  <div class={styles.container}>
    <div class={styles.section}>Content</div>
  </div>
)
```

---

## Working with Components

### Creating a Vue Component for Diagram

1. File: `packages/diagram/src/components/MyComponent.tsx`
2. Export: `packages/diagram/src/index.ts`
3. Story: `packages/diagram/src/components/MyComponent.stories.tsx`

Example:

```typescript
// MyComponent.tsx
import type { FC } from 'vue'

interface MyComponentProps {
  title: string
  editable?: boolean
}

export const MyComponent: FC<MyComponentProps> = ({ title, editable = false }) => (
  <div class="my-component">
    <h3>{title}</h3>
    {editable && <button>Edit</button>}
  </div>
)
```

### Storybook Story

```typescript
// MyComponent.stories.tsx
import type { StoryObj } from '@storybook/vue3'
import { MyComponent } from './MyComponent'

export default {
  component: MyComponent,
  argTypes: {
    title: { control: 'text' },
    editable: { control: 'boolean' },
  },
}

export const Default: StoryObj = {
  args: {
    title: 'My Title',
    editable: false,
  },
}

export const Editable: StoryObj = {
  args: {
    title: 'Editable Title',
    editable: true,
  },
}
```

---

## Error Handling

### Backend Errors (tRPC)

```typescript
import { TRPCError } from '@trpc/server'

// In procedures:
throw new TRPCError({
  code: 'NOT_FOUND', // or INTERNAL_SERVER_ERROR, UNAUTHORIZED, etc.
  message: 'Entity not found',
})
```

Automatically serialized to frontend with type information.

### Frontend Error Handling

```typescript
try {
  const result = await trpc.model.save.mutate(model)
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    console.error('Model not found')
  } else {
    console.error('Unexpected error:', error.message)
  }
}
```

### Template Errors

```typescript
try {
  const code = render(template, context)
} catch (error) {
  console.error('Template compilation failed:', error.message)
}
```

---

## Performance Considerations

### Avoiding N+1 Queries

**❌ Bad**:

```typescript
for (const entity of model.entities) {
  const details = await getEntityDetails(entity.id) // Multiple queries!
}
```

**✅ Good**:

```typescript
const model = await trpc.model.get.query() // Single query, includes all data
```

### Memoization

```typescript
// Vue 3 - computed automatically caches
import { computed } from 'vue'

const sortedEntities = computed(() => {
  return model.entities.sort((a, b) => a.name.localeCompare(b.name))
})
```

### Lazy Loading

```typescript
// Load Storybook dev server only when needed
pnpm --filter @xomda/diagram dev
```

---

## Testing Mindset

### What to Test

**High Priority**:

- tRPC procedures (business logic)
- Zod schemas (validation)
- Handlebars helpers (template logic)
- Critical UI flows

**Lower Priority**:

- UI component snapshots (brittle)
- Simple utility functions

### Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@xomda/template'

describe('Template Engine', () => {
  it('renders a simple template', () => {
    const result = render('Hello {{name}}', { name: 'World' })
    expect(result).toBe('Hello World')
  })

  it('applies the camelCase helper', () => {
    const result = render('{{name | camelCase}}', { name: 'hello-world' })
    expect(result).toBe('helloWorld')
  })
})
```

---

## Security Best Practices

### Validate All Input

```typescript
// ALWAYS validate input in tRPC procedures
export const myRouter = router({
  createEntity: publicProcedure
    .input(EntitySchema) // ← Zod validation
    .mutation(({ input }) => {
      // input is now type-safe and validated
      return writeModel(input)
    }),
})
```

### No `any` Types

```typescript
// ❌ Bad - trusts client input
function save(data: any) {}

// ✅ Good - validates with schema
function save(data: unknown) {
  const validated = EntitySchema.parse(data)
  // ...
}
```

### Template Safety

Handlebars itself is safe (no code execution), but be careful with custom helpers:

```typescript
// ❌ Avoid eval or dynamic code generation in helpers
hbs.registerHelper('dangerous', (code: string) => eval(code))

// ✅ Safe transformations only
hbs.registerHelper('safe', (str: string) => str.toUpperCase())
```

---

## Workflow Summary for AI Agents

### When Making Changes

1. **Understand the package structure**

- Where does this change belong?
- What packages will be affected?

2. **Check types first**

- Run `pnpm typecheck`
- Are types still correct?

3. **Write/update tests**

- Unit tests for logic
- Storybook story for components

4. **Format and lint**

   ```bash
   pnpm format
   pnpm lint
   ```

5. **Run full test suite**

   ```bash
   pnpm test
   ```

6. **Verify no regressions**

- Test the feature manually if possible
- Check related components still work

### When Stuck

1. **Check ARCHITECTURE.md** - Package details and rationale
2. **Look at similar code** - Find existing patterns
3. **Check type errors** - TypeScript often explains the issue
4. **Read comments** - Developers left hints
5. **Check git history** - How was this done before?

---

## Resources & Documentation

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vue 3**: https://vuejs.org/guide/
- **tRPC**: https://trpc.io/docs/
- **Zod**: https://zod.dev/
- **Handlebars**: https://handlebarsjs.com/
- **ESLint**: https://eslint.org/
- **Vitest**: https://vitest.dev/
- **Prettier**: https://prettier.io/

---

## Quick Reference

### Useful Commands

```bash
# Development
pnpm dev                    # Start all servers
pnpm --filter @xomda/node dev         # Backend only

# Quality checks (run before committing)
pnpm typecheck
pnpm lint
pnpm format

# Testing
pnpm test
pnpm --filter @xomda/client test:watch

# Building
pnpm build
pnpm --filter @xomda/diagram build-storybook

# Specific package operations
pnpm --filter @xomda/model test:watch
```

### File Locations

- **Entities/Attributes Types**: `packages/core/src/index.ts`
- **Model CRUD Logic**: `packages/model/src/router/model.router.ts`
- **Template Engine**: `packages/template/src/engine.ts`
- **Main UI**: `packages/client/src/views/ModelView.tsx`
- **Components**: `packages/diagram/src/components/`
- **Tests**: `packages/*/src/**/__tests__/*.spec.ts`

### Environment Variables

```bash
XOMDA_DIR=.xomda           # Data/template storage location
NODE_ENV=development       # Backend environment
VITE_API_URL=...          # Frontend API URL
```

---

## Final Notes

- **This is a type-first project**: Trust TypeScript to guide you
- **Monorepo discipline matters**: Respect package boundaries
- **Templates are critical**: Thoroughly test template logic
- **File-based storage is intentional**: Version control friendly, offline-capable
- **tRPC provides safety**: Leverage the type flow for confidence

Good luck, and happy coding! 🚀
