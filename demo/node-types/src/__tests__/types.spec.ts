import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import { generate } from 'xomda'

import type { User } from '../generated/User'

// Runs the published `xomda` generator programmatically — exact same code
// path `xomda generate` (the CLI bin) takes, with no `tsx` glue.
// vitest reads the .ts source from `src/generated/` and the dynamic import
// gives us the type the user would see in their IDE.
const demoRoot = fileURLToPath(new URL('../..', import.meta.url))
const userPath = fileURLToPath(new URL('../generated/User.ts', import.meta.url))

beforeAll(async () => {
  // Idempotent — running this against an already-generated tree is a no-op
  // by the storage layer's dirty check.
  await generate(demoRoot)
}, 30_000)

describe('demo/node-types — emitted TypeScript', () => {
  it('emits an exported `type User = {...}` alias under src/generated/', async () => {
    const source = await readFile(userPath, 'utf-8')
    expect(source).toMatch(/export type User = \{/)
    expect(source).toMatch(/id: string/)
    expect(source).toMatch(/name: string/)
    expect(source).toMatch(/email: string/)
    expect(source).toMatch(/tags\?: string\[\]/)
  })

  // expectTypeOf is a compile-time check — if the emitted shape drifts from
  // the model.json, the spec stops type-checking and the build fails.
  it('the emitted User type matches the model shape at compile time', () => {
    expectTypeOf<User>().toEqualTypeOf<{
      id: string
      name: string
      email: string
      tags?: string[]
    }>()
  })
})
