import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import type { Model, Template } from '@xomda/core'
import { TemplateSchema } from '@xomda/core'
import { executeTemplate } from '@xomda/template'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readModel, writeModel } from '../storage/file-storage'

// Cross-package integration: core (schemas) → model (file-storage) →
// template (engine + bundled .xomda/templates). Exercises the whole chain
// the CLI / dev server run on every regenerate.

function findRepoRoot(): string {
  let dir = resolve(process.cwd())
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, '.xomda', 'templates'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not locate repo root from ${process.cwd()}`)
}

const repoRoot = findRepoRoot()

function loadBundledTemplate(relPath: string): Template {
  const raw = readFileSync(join(repoRoot, '.xomda', 'templates', relPath), 'utf-8')
  return TemplateSchema.parse(JSON.parse(raw))
}

let _seq = 0
const newId = (): string => `00000000-0000-4000-8000-${String(++_seq).padStart(12, '0')}`

const PKG_ID = newId()
const BLOG_ID = newId()
const POST_ID = newId()
const AUDITABLE_ID = newId()
const AUDITABLE_ATTR_ID = newId()
const BLOG_TITLE_ID = newId()
const POST_BODY_ID = newId()
const POST_AUTHOR_ID = newId()

const buildBlogModel = (): Model => ({
  id: newId(),
  name: 'BlogModel',
  version: '1.0.0',
  packages: [
    {
      id: PKG_ID,
      name: 'blog',
      packages: [],
      enums: [],
      entities: [
        {
          id: AUDITABLE_ID,
          name: 'Auditable',
          kind: 'interface',
          attributes: [
            {
              id: AUDITABLE_ATTR_ID,
              name: 'createdAt',
              type: 'date',
              required: false,
              multiValue: false,
              primaryKey: false,
              unique: false,
            },
          ],
        },
        {
          id: BLOG_ID,
          name: 'Blog',
          kind: 'default',
          attributes: [
            {
              id: BLOG_TITLE_ID,
              name: 'title',
              type: 'string',
              required: true,
              multiValue: false,
              primaryKey: false,
              unique: true,
            },
          ],
          implements: [AUDITABLE_ID],
        },
        {
          id: POST_ID,
          name: 'Post',
          kind: 'default',
          attributes: [
            {
              id: POST_BODY_ID,
              name: 'body',
              type: 'string',
              required: true,
              multiValue: false,
              primaryKey: false,
              unique: false,
            },
            {
              id: POST_AUTHOR_ID,
              name: 'author',
              type: 'string',
              required: false,
              multiValue: false,
              primaryKey: false,
              unique: false,
            },
          ],
          implements: [AUDITABLE_ID],
        },
      ],
    },
  ],
})

let tmpProjectRoot = ''

beforeEach(() => {
  tmpProjectRoot = mkdtempSync(join(tmpdir(), 'xomda-integration-'))
  mkdirSync(join(tmpProjectRoot, '.xomda'), { recursive: true })
})

afterEach(() => {
  rmSync(tmpProjectRoot, { recursive: true, force: true })
})

describe('integration — write → read → generate cycle', () => {
  it('persists a model via file-storage and reads back the same shape', async () => {
    const original = buildBlogModel()
    await writeModel(original, tmpProjectRoot)
    const loaded = await readModel(tmpProjectRoot)

    // Core identity preserved.
    expect(loaded.id).toBe(original.id)
    expect(loaded.name).toBe('BlogModel')
    expect(loaded.packages[0].entities.length).toBe(3)

    // Auditable interface round-trips alongside the regular entities.
    const auditable = loaded.packages[0].entities.find((e) => e.name === 'Auditable')!
    expect(auditable.kind).toBe('interface')
    expect(auditable.attributes[0].name).toBe('createdAt')

    // `kind` is the source of truth and is always populated (the schema
    // defaults it to `'default'`); the legacy `abstract` boolean has been
    // removed.
    const blog = loaded.packages[0].entities.find((e) => e.name === 'Blog')!
    expect(blog.kind).toBe('default')
  })

  it('runs the bundled Zod template against a freshly-loaded model and emits one file per entity', async () => {
    await writeModel(buildBlogModel(), tmpProjectRoot)
    const loaded = await readModel(tmpProjectRoot)
    const template = loadBundledTemplate('TypeScript/zod.template.json')

    const result = await executeTemplate(template, loaded)
    expect(result.files.map((f) => f.outputPath).sort()).toEqual([
      'target/src/schemas/BlogSchema.ts',
      'target/src/schemas/PostSchema.ts',
    ])
  })

  it('interface-implemented attributes survive the full write/read/generate path', async () => {
    await writeModel(buildBlogModel(), tmpProjectRoot)
    const loaded = await readModel(tmpProjectRoot)
    const template = loadBundledTemplate('TypeScript/zod.template.json')

    const result = await executeTemplate(template, loaded)
    const blogFile = result.files.find((f) => f.outputPath.endsWith('BlogSchema.ts'))!
    const postFile = result.files.find((f) => f.outputPath.endsWith('PostSchema.ts'))!

    // `createdAt` is on the Auditable interface; both entities implement it,
    // so it must appear in both generated Zod schemas.
    expect(blogFile.content).toContain('createdAt')
    expect(postFile.content).toContain('createdAt')

    // Own attributes also present.
    expect(blogFile.content).toContain('title')
    expect(postFile.content).toContain('body')
    expect(postFile.content).toContain('author')
  })

  it('save is idempotent on a no-op write (regression guard for `model.json` save discipline)', async () => {
    const original = buildBlogModel()
    await writeModel(original, tmpProjectRoot)
    const firstRead = await readModel(tmpProjectRoot)
    const firstMtime = await getMtimeMs(join(tmpProjectRoot, '.xomda', 'model.json'))

    // Write the same model back — file-storage's dirty-check should
    // recognise this as a no-op and skip the actual file write.
    await new Promise((r) => setTimeout(r, 10))
    await writeModel(firstRead, tmpProjectRoot)
    const secondMtime = await getMtimeMs(join(tmpProjectRoot, '.xomda', 'model.json'))

    expect(secondMtime).toBe(firstMtime)
  })
})

async function getMtimeMs(filePath: string): Promise<number> {
  const { stat } = await import('node:fs/promises')
  const s = await stat(filePath)
  return s.mtimeMs
}
