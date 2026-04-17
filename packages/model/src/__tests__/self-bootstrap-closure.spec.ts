import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { listTemplates, renderTemplate } from '@xomda/template'
import { describe, expect, it } from 'vitest'

import { readModel } from '../storage/file-storage'

// Self-bootstrap closure — Xomda's meta-model fed through Xomda's templates
// produces code Xomda could run. The promise made in concepts.md
// ("self-definition") is load-bearing for the platform's identity; this
// test pins it.
//
// The bundled templates ship with output paths suitable for a tier-2 demo
// project (`target/src/...`). They are intentionally not the templates
// that emit into `packages/core/src/schemas/` — that's a deeper integration
// step. The check here is that the **loop closes**: every meta-type the
// hand-written core schema describes also surfaces in the codegen output
// when the bundled templates run against `.xomda/model.json`.

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

describe('self-bootstrap closure: .xomda/templates run on .xomda/model.json', () => {
  const repoRoot = findRepoRoot()

  it('loads the meta-model and every bundled template without error', async () => {
    const model = await readModel(repoRoot)
    const templates = await listTemplates(repoRoot)
    expect(model.name).toBe('Main Model')
    expect(templates.length).toBeGreaterThan(0)
  })

  it('renders the full bundled-template pipeline against the meta-model', async () => {
    const model = await readModel(repoRoot)
    const templates = (await listTemplates(repoRoot)).filter((t) => !t.disabled)

    const all = []
    for (const t of templates) {
      const results = await renderTemplate(t, model)
      for (const r of results) all.push(r)
    }
    expect(all.length).toBeGreaterThan(0)

    const paths = all.map((r) => r.outputPath)

    // The meta-model declares 10 default-kind entities (Model, Project,
    // Enum, Package, Attribute, Enum Value, Entity, Template,
    // Template Folder, Template Cell) plus 6 enums (Attribute Type, Entity
    // Kind, Visibility, Aggregation Kind, Template Language, Cell Type).
    // The zod template emits one file per non-interface entity, the enum
    // template emits one file per Enum — both colocate under
    // target/src/schemas/ so per-entity schemas can resolve sibling
    // imports for enum-typed attributes.
    const tsSchemas = paths.filter(
      (p) => p.startsWith('target/src/schemas/') && p.endsWith('Schema.ts')
    )
    expect(tsSchemas.length).toBe(10 + 6)
  })

  it('the generated Entity Zod schema mentions every kind/implements/visibility field', async () => {
    const model = await readModel(repoRoot)
    const templates = (await listTemplates(repoRoot)).filter((t) => !t.disabled)

    const all = []
    for (const t of templates) {
      const results = await renderTemplate(t, model)
      for (const r of results) all.push(r)
    }

    const entitySchema = all.find((r) => r.outputPath === 'target/src/schemas/EntitySchema.ts')
    expect(entitySchema, 'EntitySchema.ts must exist in the generated set').toBeDefined()
    const content = entitySchema!.content
    // Every meta-attribute on Entity must surface in the generated schema:
    //   id, name, attributes, extends, kind, implements, visibility, description.
    for (const field of [
      'id',
      'name',
      'attributes',
      'extends',
      'kind',
      'implements',
      'visibility',
    ]) {
      expect(content, `field "${field}" must appear in the generated Entity schema`).toContain(
        field
      )
    }
    // EntityKind enum reference (the meta-attribute `kind` has type "Entity Kind").
    expect(content).toContain('EntityKind')
  })

  it('the generated EntityKind enum file emits the three locked values', async () => {
    const model = await readModel(repoRoot)
    const templates = (await listTemplates(repoRoot)).filter((t) => !t.disabled)

    const all = []
    for (const t of templates) {
      const results = await renderTemplate(t, model)
      for (const r of results) all.push(r)
    }

    const enumFile = all.find((r) => r.outputPath === 'target/src/schemas/EntityKindSchema.ts')
    expect(enumFile, 'EntityKind.ts must exist in the generated set').toBeDefined()
    const content = enumFile!.content
    expect(content).toContain("'default'")
    expect(content).toContain("'abstract'")
    expect(content).toContain("'interface'")
  })

  it('the generated Attribute Type enum lists the primitives and meta-types', async () => {
    const model = await readModel(repoRoot)
    const templates = (await listTemplates(repoRoot)).filter((t) => !t.disabled)

    const all = []
    for (const t of templates) {
      const results = await renderTemplate(t, model)
      for (const r of results) all.push(r)
    }

    const enumFile = all.find((r) => r.outputPath === 'target/src/schemas/AttributeTypeSchema.ts')
    expect(enumFile, 'AttributeType.ts must exist in the generated set').toBeDefined()
    const content = enumFile!.content
    for (const value of [
      'string',
      'number',
      'boolean',
      'date',
      'uuid',
      'decimal',
      'entity',
      'enum',
      'package',
      'attribute',
    ]) {
      expect(content, `value "${value}" must appear in the generated AttributeType enum`).toContain(
        value
      )
    }
  })

  it('rendering twice is deterministic — identical files across two runs', async () => {
    const model = await readModel(repoRoot)
    const templates = (await listTemplates(repoRoot)).filter((t) => !t.disabled)

    const renderAll = async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>()
      for (const t of templates) {
        const results = await renderTemplate(t, model)
        for (const r of results) map.set(r.outputPath, r.content)
      }
      return map
    }

    const first = await renderAll()
    const second = await renderAll()
    expect(first.size).toBe(second.size)
    for (const [path, content] of first) {
      expect(second.get(path), `content of ${path} must be identical across runs`).toBe(content)
    }
  })
})
