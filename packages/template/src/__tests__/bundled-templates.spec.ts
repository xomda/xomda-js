import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import type { Model, Template } from '@xomda/core'
import { TemplateSchema } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { executeTemplate } from '../engine'

// Verify the bundled .xomda/templates against real model shapes. These are
// the templates Xomda ships with — the regenerate-Xomda-from-its-own-model
// loop runs them on every release. A bug here breaks the self-bootstrap
// contract (AGENTS.md §19).
//
// Path resolution walks upward from the current package until it finds the
// repo root (the directory that contains `.xomda/templates/`). Works the
// same on Linux, macOS, Windows, and under `pnpm -r` (where cwd is the
// package, not the repo root).
function findRepoRoot(): string {
  let dir = resolve(process.cwd())
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, '.xomda', 'templates'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not locate repo root containing .xomda/templates/ from ${process.cwd()}`)
}

const repoRoot = findRepoRoot()

function loadBundledTemplate(relPath: string): Template {
  const raw = readFileSync(join(repoRoot, '.xomda', 'templates', relPath), 'utf-8')
  return TemplateSchema.parse(JSON.parse(raw))
}

let _seq = 0
const newId = (): string => `00000000-0000-4000-8000-${String(++_seq).padStart(12, '0')}`

const ID_PKG = newId()
const ID_USER = newId()
const ID_USER_EMAIL = newId()
const ID_USER_TAGS = newId()
const ID_AUDITABLE = newId()
const ID_AUDIT_CREATED = newId()
const ID_ABSTRACT_BASE = newId()
const ID_ABSTRACT_BASE_ATTR = newId()
const ID_INTERFACE = newId()
const ID_INTERFACE_NAME_ATTR = newId()
const ID_STATUS_ENUM = newId()
const ID_STATUS_ACTIVE = newId()
const ID_STATUS_INACTIVE = newId()

const fixtureModel = (): Model => ({
  id: newId(),
  name: 'GoldenModel',
  version: '1.0.0',
  packages: [
    {
      id: ID_PKG,
      name: 'pkg',
      packages: [],
      enums: [
        {
          id: ID_STATUS_ENUM,
          name: 'Status',
          values: [
            { id: ID_STATUS_ACTIVE, name: 'active' },
            { id: ID_STATUS_INACTIVE, name: 'inactive' },
          ],
        },
      ],
      entities: [
        {
          id: ID_AUDITABLE,
          name: 'Auditable',
          kind: 'interface',
          attributes: [
            {
              id: ID_AUDIT_CREATED,
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
          id: ID_USER,
          name: 'User',
          kind: 'default',
          attributes: [
            {
              id: ID_USER_EMAIL,
              name: 'email',
              type: 'string',
              required: true,
              multiValue: false,
              primaryKey: false,
              unique: true,
            },
            {
              id: ID_USER_TAGS,
              name: 'tags',
              type: 'string',
              required: false,
              multiValue: true,
              primaryKey: false,
              unique: false,
            },
          ],
          implements: [ID_AUDITABLE],
        },
        {
          id: ID_ABSTRACT_BASE,
          name: 'AuditableBase',
          kind: 'abstract',
          attributes: [
            {
              id: ID_ABSTRACT_BASE_ATTR,
              name: 'id',
              type: 'uuid',
              required: true,
              multiValue: false,
              primaryKey: true,
              unique: true,
            },
          ],
        },
        {
          id: ID_INTERFACE,
          name: 'Named',
          kind: 'interface',
          attributes: [
            {
              id: ID_INTERFACE_NAME_ATTR,
              name: 'name',
              type: 'string',
              required: true,
              multiValue: false,
              primaryKey: false,
              unique: false,
            },
          ],
        },
      ],
    },
  ],
})

describe('bundled templates — TypeScript/zod.template.json', () => {
  const template = loadBundledTemplate('TypeScript/zod.template.json')

  it('parses through TemplateSchema (regression guard)', () => {
    expect(template.name).toBe('Zod Schema')
    expect(template.cells.length).toBeGreaterThan(0)
  })

  it('emits one .ts file per non-interface entity (interfaces are filtered out)', async () => {
    const result = await executeTemplate(template, fixtureModel())
    // User (default) + AuditableBase (abstract) = 2 files; Named (interface) skipped.
    const paths = result.files.map((f) => f.outputPath).sort()
    expect(paths).toEqual([
      'target/src/schemas/AuditableBaseSchema.ts',
      'target/src/schemas/UserSchema.ts',
    ])
  })

  it('generated file includes the entity name and Zod import', async () => {
    const result = await executeTemplate(template, fixtureModel())
    const user = result.files.find((f) => f.outputPath.endsWith('UserSchema.ts'))!
    expect(user.content).toContain('UserSchema')
    expect(user.content).toContain("from 'zod'")
  })

  it('interface-implemented attributes appear in the generated schema (effectiveAttributes wiring)', async () => {
    const result = await executeTemplate(template, fixtureModel())
    const user = result.files.find((f) => f.outputPath.endsWith('UserSchema.ts'))!
    // `createdAt` is on the Auditable interface, NOT on User's own attribute
    // list. It must surface because the template reads `effectiveAttributes`.
    expect(user.content).toContain('createdAt')
    // Own attribute also present.
    expect(user.content).toContain('email')
    // Multi-value attribute becomes `.array()`.
    expect(user.content).toContain('tags')
    expect(user.content).toContain('.array()')
  })

  it('regenerating twice yields identical content (deterministic)', async () => {
    const first = await executeTemplate(template, fixtureModel())
    // Reset _seq so the second model gets the same ids.
    _seq = 0
    const second = await executeTemplate(template, fixtureModel())
    const firstByPath = Object.fromEntries(first.files.map((f) => [f.outputPath, f.content]))
    const secondByPath = Object.fromEntries(second.files.map((f) => [f.outputPath, f.content]))
    expect(secondByPath).toEqual(firstByPath)
  })
})

describe('bundled templates — TypeScript/enum.template.json', () => {
  const template = loadBundledTemplate('TypeScript/enum.template.json')

  it('parses through TemplateSchema (regression guard)', () => {
    expect(template.name).toBe('TypeScript Enum')
  })

  it('emits one .ts file per Enum, colocated with entity schemas', async () => {
    const result = await executeTemplate(template, fixtureModel())
    expect(result.files.map((f) => f.outputPath)).toEqual(['target/src/schemas/StatusSchema.ts'])
  })

  it('generated file emits StatusValues + StatusSchema + Status type', async () => {
    const result = await executeTemplate(template, fixtureModel())
    const content = result.files[0].content
    expect(content).toContain("StatusValues = ['active', 'inactive'] as const")
    expect(content).toContain('z.enum(StatusValues)')
    expect(content).toContain('export type Status')
  })
})
