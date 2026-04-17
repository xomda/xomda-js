---
name: test-file-placement
description: Guide for creating test files in __tests__ subfolders. Use when creating any .spec.ts, .spec.tsx, .test.ts, or .test.tsx files.
applyTo: '**/*.{spec.ts,spec.tsx,spec-d.ts}'
---

# Test File Placement & Structure

## Critical Rule: Tests Live in `__tests__/` Subfolders

When creating tests for any source file, **always place them in a `__tests__/` subfolder** at the same level as the file being tested.

### Pattern

```
src/
  path/
    to/
      MyComponent.tsx          ← source file
      __tests__/
        MyComponent.spec.tsx   ← tests go HERE (not in src/path/to/)
        
      useMyHook.ts
      __tests__/
        useMyHook.spec.ts      ← tests go HERE
```

### Wrong Placement ❌

```
src/
  path/
    to/
      MyComponent.tsx
      MyComponent.spec.tsx     ← ❌ WRONG: test in source folder
```

## File Naming Conventions

| Type | Extension | Example |
|------|-----------|---------|
| Unit/behavior tests | `.spec.ts` `.spec.tsx` | `DynamicForm.spec.tsx` |
| Type-level tests | `.spec-d.ts` | `validation.spec-d.ts` |
| NOT used in this project | `.test.ts` `.test.tsx` | — |

## Import Paths

Always import the subject with a relative path going up one level:

```typescript
// ✅ Correct - import from parent directory
import { MyComponent } from '../MyComponent'
import { useMyHook } from '../useMyHook'

// ❌ Wrong - going up extra levels or using full paths
import { MyComponent } from '../../MyComponent'
import { useMyHook } from '@xomda/pkg/src/path/to/useMyHook'
```

## Directory Structure Examples

### Nested Components

```
src/
  components/
    DynamicForm/
      index.ts
      DynamicForm.tsx
      __tests__/
        DynamicForm.spec.tsx
      FormField/
        index.ts
        FormField.tsx
        __tests__/
          FormField.spec.tsx
```

### Utilities & Composables

```
src/
  composables/
    useAsyncState.ts
    __tests__/
      useAsyncState.spec.ts
    
  storage/
    file-storage.ts
    __tests__/
      file-storage.test.ts
```

### Business Logic

```
src/
  router/
    file.router.ts
    __tests__/
      file.router.test.ts
    helpers.ts
    __tests__/
      helpers.test.ts
```

## Every Package Should Follow This Pattern

This `__tests__/` pattern is enforced across **all** xomda.js packages:
- `@xomda/core`
- `@xomda/client`
- `@xomda/ui`
- `@xomda/diagram`
- `@xomda/model`
- `@xomda/template`
- `@xomda/node`
- `@xomda/analysis-core`
- And all others

## Why This Matters

- **Clarity**: Tests are colocated with their source but visually separated
- **Build tools**: Vitest/Cypress configurations expect this structure
- **Maintainability**: Adding tests doesn't clutter the source directory
- **Consistency**: Every AI agent follows the same pattern across all packages
