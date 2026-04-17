import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import { generate, outputRoot } from '../generate'

beforeAll(async () => {
  await generate()
}, 30_000)

const targetSchemas = join(outputRoot, 'target', 'src', 'schemas')
const coreSchemas = join(outputRoot, 'generated', 'core', 'schemas')
const javaTarget = join(outputRoot, 'target', 'src', 'main', 'java')

async function read(path: string) {
  return readFile(path, 'utf-8')
}

describe('blog demo — generated Zod (target/src/schemas)', () => {
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

  it('CommentSchema references Post and Author', async () => {
    const src = await read(join(targetSchemas, 'CommentSchema.ts'))
    expect(src).toMatch(/PostSchema/)
    expect(src).toMatch(/AuthorSchema/)
  })
})

describe('blog demo — generated core schemas', () => {
  it('AuthorSchema has a uuid default for id', async () => {
    const src = await read(join(coreSchemas, 'Author.ts'))
    expect(src).toMatch(/id: z\.string\(\)\.uuid\(\)\.default/)
    expect(src).toMatch(/name: z\.string\(\)\.min\(1\)/)
  })

  it('PostSchema has array default for tags', async () => {
    const src = await read(join(coreSchemas, 'Post.ts'))
    expect(src).toMatch(/tags: z\.array\(z\.string\(\)\)\.default\(\[\]\)/)
  })
})

describe('blog demo — generated Java POJOs', () => {
  it('Author.java has private fields and accessors', async () => {
    const src = await read(join(javaTarget, 'Author.java'))
    expect(src).toMatch(/public class Author/)
    expect(src).toMatch(/private String name;/)
    expect(src).toMatch(/public String getName\(\)/)
    expect(src).toMatch(/public void setName\(String name\)/)
  })

  it('Post.java models tags as List<String>', async () => {
    const src = await read(join(javaTarget, 'Post.java'))
    expect(src).toMatch(/private List<String> tags;/)
  })
})
