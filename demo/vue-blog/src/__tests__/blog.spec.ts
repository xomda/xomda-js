import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'
import { generate } from 'xomda'

// Both shapes of assertion in this file go through the public `xomda`
// surface — the demo never reaches into internal `@xomda/*` packages.
// `preview()` gives source-text checks without touching disk; `generate()`
// populates `output/` so the runtime Zod `safeParse` checks can dynamic-
// import the emitted modules.
const demoRoot = fileURLToPath(new URL('../..', import.meta.url))
const outputRoot = join(demoRoot, 'output')
const targetSchemas = join(outputRoot, 'target', 'src', 'schemas')

beforeAll(async () => {
  await generate(demoRoot, { outputDir: 'output' })
}, 30_000)

async function read(path: string) {
  return readFile(path, 'utf-8')
}

describe('vue-blog demo — generated Zod (target/src/schemas)', () => {
  it('AuthorSchema validates well-formed input', async () => {
    const mod = await import(pathToFileURL(join(targetSchemas, 'AuthorSchema.ts')).href)
    const ok = mod.AuthorSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Ada',
      email: 'ada@example.com',
    })
    expect(ok.success).toBe(true)
  })

  it('AuthorSchema rejects a non-uuid id', async () => {
    const mod = await import(pathToFileURL(join(targetSchemas, 'AuthorSchema.ts')).href)
    const bad = mod.AuthorSchema.safeParse({
      id: 'not-a-uuid',
      name: 'Ada',
      email: 'ada@example.com',
    })
    expect(bad.success).toBe(false)
  })

  it('PostSchema source declares all model attributes', async () => {
    const src = await read(join(targetSchemas, 'PostSchema.ts'))
    for (const field of ['id', 'title', 'content', 'status', 'author', 'tags']) {
      expect(src).toMatch(new RegExp(`\\b${field}:`))
    }
    expect(src).toMatch(/export const PostSchema/)
    expect(src).toMatch(/export type Post/)
  })

  // Comment.post and Comment.author are both `aggregation: 'none'` (many-to-one
  // associations), so their generated fields are uuid strings — no embedded
  // PostSchema / AuthorSchema imports.
  it('CommentSchema stores post and author as uuid references', async () => {
    const src = await read(join(targetSchemas, 'CommentSchema.ts'))
    expect(src).toMatch(/post:\s*z\.string\(\)\.uuid\(\)/)
    expect(src).toMatch(/author:\s*z\.string\(\)\.uuid\(\)/)
    expect(src).not.toMatch(/import .* PostSchema/)
    expect(src).not.toMatch(/import .* AuthorSchema/)
  })

  // Locks in the four UML cardinality kinds via the Post entity:
  //   - many-to-one  (Post.author)        → z.string().uuid()
  //   - one-to-many  (Post.comments)      → CommentSchema.array() (embedded)
  //   - many-to-many (Post.relatedPosts)  → z.string().uuid().array() (refs)
  //   - multivalued primitive (Post.tags) → z.string().array()
  it('PostSchema reflects aggregation × multiValue for all four kinds', async () => {
    const src = await read(join(targetSchemas, 'PostSchema.ts'))
    expect(src).toMatch(/author:\s*z\.string\(\)\.uuid\(\)/)
    expect(src).toMatch(/comments:\s*CommentSchema\.array\(\)/)
    expect(src).toMatch(/relatedPosts:\s*z\.string\(\)\.uuid\(\)\.array\(\)/)
    expect(src).toMatch(/tags:\s*z\.string\(\)\.array\(\)/)
    // The composite child schema is imported; the association targets are not.
    expect(src).toMatch(/import .* CommentSchema/)
    expect(src).not.toMatch(/import .* AuthorSchema/)
  })
})

describe('vue-blog demo — generated enum schema', () => {
  it('PostStatusSchema lives in target/src/schemas/ next to entity schemas', async () => {
    const src = await read(join(targetSchemas, 'PostStatusSchema.ts'))
    expect(src).toMatch(/export const PostStatusValues/)
    expect(src).toMatch(/'draft'/)
    expect(src).toMatch(/'published'/)
    expect(src).toMatch(/'archived'/)
    expect(src).toMatch(/export const PostStatusSchema = z\.enum/)
  })

  it("PostSchema's `./PostStatusSchema` import now resolves", async () => {
    // Mounting the module would throw if the sibling file is missing.
    const mod = await import(pathToFileURL(join(targetSchemas, 'PostSchema.ts')).href)
    expect(mod.PostSchema).toBeDefined()
  })
})
