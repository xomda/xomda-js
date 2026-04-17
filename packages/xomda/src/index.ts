// Public API for the `xomda` npm package.
//
// Demos and end-user projects import everything they need from here:
//
//   import { createEntity, createAttribute, writeModel } from 'xomda'
//
// The CLI (`npx xomda generate`) is shipped from the same package via `bin.ts`.
// Internal workspace packages (`@xomda/core`, `@xomda/model`, …) are an
// implementation detail and must not be imported by user code; only what this
// barrel re-exports is part of the public surface.

export type {
  Attribute,
  AttributeType,
  AttributeTypeKind,
  Entity,
  EntityKind,
  Enum,
  EnumValue,
  Model,
  Package,
  PrimitiveType,
} from '@xomda/core'
export {
  createAttribute,
  createEntity,
  createEnum,
  createEnumValue,
  createModel,
  createPackage,
} from '@xomda/core'
export { readModel, writeModel } from '@xomda/model/storage'

// Programmatic generation. Equivalent to invoking the `xomda generate` CLI
// in-process. Useful for tests and tooling that wants to assert on emitted
// content without spawning a subprocess; everyday `package.json` scripts
// should prefer the CLI (`xomda generate`).
export type { GenerateOptions, GenerateResult, PreviewOptions } from '@xomda/cli'
export { generate, preview } from '@xomda/cli'
export type { RenderResult } from '@xomda/template'
