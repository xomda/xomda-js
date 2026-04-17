import { describe, expect, it } from 'vitest'

import {
  createAttribute,
  createEntity,
  createEnum,
  createEnumValue,
  createModel,
  createPackage,
} from '../../testing/index'
import { diffModels, emptyModelDiff } from '../index'

const base = () =>
  createModel({
    packages: [
      createPackage({
        id: 'pkg-1',
        name: 'com.example',
        entities: [
          createEntity({
            id: 'ent-1',
            name: 'User',
            attributes: [
              createAttribute({ id: 'a-1', name: 'id', type: 'uuid', primaryKey: true }),
              createAttribute({ id: 'a-2', name: 'email', type: 'string' }),
            ],
          }),
        ],
        enums: [
          createEnum({
            id: 'enum-1',
            name: 'Status',
            values: [
              createEnumValue({ id: 'v-1', name: 'ACTIVE' }),
              createEnumValue({ id: 'v-2', name: 'INACTIVE' }),
            ],
          }),
        ],
      }),
    ],
  })

describe('diffModels — no changes', () => {
  it('returns the empty diff for identical models', () => {
    const m = base()
    expect(diffModels(m, m)).toEqual(emptyModelDiff())
  })
})

describe('diffModels — packages', () => {
  it('detects added package', () => {
    const before = base()
    const after = base()
    after.packages.push(createPackage({ id: 'pkg-new', name: 'com.new' }))
    const diff = diffModels(before, after)
    expect(diff.added.packages).toHaveLength(1)
    expect(diff.added.packages[0].id).toBe('pkg-new')
  })

  it('detects removed package', () => {
    const before = base()
    const after = createModel({ packages: [] })
    const diff = diffModels(before, after)
    expect(diff.removed.packages.map((p) => p.id)).toContain('pkg-1')
  })

  it('detects renamed package', () => {
    const before = base()
    const after = base()
    after.packages[0].name = 'com.renamed'
    const diff = diffModels(before, after)
    expect(diff.renamed.packages).toEqual([
      { id: 'pkg-1', oldName: 'com.example', newName: 'com.renamed' },
    ])
  })

  it('detects modified package description', () => {
    const before = base()
    const after = base()
    after.packages[0].description = 'new description'
    const diff = diffModels(before, after)
    expect(diff.modified.packages).toHaveLength(1)
    expect(diff.modified.packages[0].changes).toEqual(['description'])
  })
})

describe('diffModels — entities', () => {
  it('detects added entity with package context', () => {
    const before = base()
    const after = base()
    after.packages[0].entities.push(createEntity({ id: 'ent-new', name: 'Order' }))
    const diff = diffModels(before, after)
    expect(diff.added.entities).toHaveLength(1)
    expect(diff.added.entities[0].entity.name).toBe('Order')
    expect(diff.added.entities[0].packageName).toBe('com.example')
    expect(diff.added.entities[0].packageId).toBe('pkg-1')
  })

  it('detects removed entity', () => {
    const before = base()
    const after = base()
    after.packages[0].entities = []
    const diff = diffModels(before, after)
    expect(diff.removed.entities).toHaveLength(1)
    expect(diff.removed.entities[0].entity.name).toBe('User')
  })

  it('detects renamed entity', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].name = 'AppUser'
    const diff = diffModels(before, after)
    expect(diff.renamed.entities).toEqual([
      {
        id: 'ent-1',
        oldName: 'User',
        newName: 'AppUser',
        packageId: 'pkg-1',
        packageName: 'com.example',
      },
    ])
    // rename only — no `modified.entities` entry, since name is in renamed
    expect(diff.modified.entities).toHaveLength(0)
  })

  it('detects modified entity (description, abstract, extends)', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].description = 'a user'
    after.packages[0].entities[0].abstract = true
    const diff = diffModels(before, after)
    expect(diff.modified.entities).toHaveLength(1)
    expect(diff.modified.entities[0].changes).toEqual(
      expect.arrayContaining(['description', 'abstract'])
    )
  })
})

describe('diffModels — attributes', () => {
  it('detects added attribute', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes.push(
      createAttribute({ id: 'a-new', name: 'phone', type: 'string' })
    )
    const diff = diffModels(before, after)
    expect(diff.added.attributes).toHaveLength(1)
    expect(diff.added.attributes[0].attribute.name).toBe('phone')
    expect(diff.added.attributes[0].entityId).toBe('ent-1')
    expect(diff.added.attributes[0].entityName).toBe('User')
  })

  it('detects removed attribute', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes = after.packages[0].entities[0].attributes.slice(1)
    const diff = diffModels(before, after)
    expect(diff.removed.attributes).toHaveLength(1)
    expect(diff.removed.attributes[0].attribute.name).toBe('id')
  })

  it('detects renamed attribute (name-only change)', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes[1].name = 'emailAddress'
    const diff = diffModels(before, after)
    expect(diff.renamed.attributes).toHaveLength(1)
    expect(diff.renamed.attributes[0].oldName).toBe('email')
    expect(diff.renamed.attributes[0].newName).toBe('emailAddress')
    // name-only change is NOT in modified
    expect(diff.modified.attributes).toHaveLength(0)
  })

  it('detects modified attribute type without rename', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes[1].type = 'text'
    const diff = diffModels(before, after)
    expect(diff.modified.attributes).toHaveLength(1)
    expect(diff.modified.attributes[0].changes).toEqual(['type'])
    expect(diff.modified.attributes[0].before.type).toBe('string')
    expect(diff.modified.attributes[0].after.type).toBe('text')
    expect(diff.renamed.attributes).toHaveLength(0)
  })

  it('detects rename + type change as both rename and modify', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes[1].name = 'emailAddress'
    after.packages[0].entities[0].attributes[1].type = 'text'
    const diff = diffModels(before, after)
    expect(diff.renamed.attributes).toHaveLength(1)
    expect(diff.modified.attributes).toHaveLength(1)
    expect(diff.modified.attributes[0].changes).toEqual(['type'])
  })
})

describe('diffModels — enums and enum values', () => {
  it('detects added enum', () => {
    const before = base()
    const after = base()
    after.packages[0].enums.push(createEnum({ id: 'enum-new', name: 'Role' }))
    const diff = diffModels(before, after)
    expect(diff.added.enums).toHaveLength(1)
    expect(diff.added.enums[0].enum.name).toBe('Role')
  })

  it('detects renamed enum', () => {
    const before = base()
    const after = base()
    after.packages[0].enums[0].name = 'UserStatus'
    const diff = diffModels(before, after)
    expect(diff.renamed.enums).toEqual([
      {
        id: 'enum-1',
        oldName: 'Status',
        newName: 'UserStatus',
        packageId: 'pkg-1',
        packageName: 'com.example',
      },
    ])
  })

  it('detects added enum value', () => {
    const before = base()
    const after = base()
    after.packages[0].enums[0].values.push(createEnumValue({ id: 'v-new', name: 'PENDING' }))
    const diff = diffModels(before, after)
    expect(diff.added.enumValues).toHaveLength(1)
    expect(diff.added.enumValues[0].value.name).toBe('PENDING')
    expect(diff.added.enumValues[0].enumId).toBe('enum-1')
    expect(diff.added.enumValues[0].enumName).toBe('Status')
  })

  it('detects renamed enum value', () => {
    const before = base()
    const after = base()
    after.packages[0].enums[0].values[0].name = 'ENABLED'
    const diff = diffModels(before, after)
    expect(diff.renamed.enumValues).toHaveLength(1)
    expect(diff.renamed.enumValues[0].oldName).toBe('ACTIVE')
    expect(diff.renamed.enumValues[0].newName).toBe('ENABLED')
  })

  it('detects removed enum value', () => {
    const before = base()
    const after = base()
    after.packages[0].enums[0].values = after.packages[0].enums[0].values.slice(1)
    const diff = diffModels(before, after)
    expect(diff.removed.enumValues).toHaveLength(1)
    expect(diff.removed.enumValues[0].value.name).toBe('ACTIVE')
  })
})

describe('diffModels — loose extension fields', () => {
  it('captures unknown keys on attributes via the loose channel', () => {
    const before = base()
    const after = base()
    // simulate a tier-2 .loose() extension key
    ;(after.packages[0].entities[0].attributes[1] as Record<string, unknown>).customLength = 255
    const diff = diffModels(before, after)
    expect(diff.loose).toContainEqual({
      kind: 'attribute',
      id: 'a-2',
      before: {},
      after: { customLength: 255 },
    })
  })

  it('captures unknown keys on entities', () => {
    const before = base()
    const after = base()
    ;(after.packages[0].entities[0] as Record<string, unknown>).tableName = 'app_user'
    const diff = diffModels(before, after)
    expect(diff.loose.some((c) => c.kind === 'entity' && c.id === 'ent-1')).toBe(true)
  })
})

describe('diffModels — mixed changes', () => {
  it('accumulates changes across all axes simultaneously', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].name = 'AppUser'
    after.packages[0].entities[0].attributes.push(
      createAttribute({ id: 'a-new', name: 'phone', type: 'string' })
    )
    after.packages[0].enums[0].values.push(createEnumValue({ id: 'v-new', name: 'PENDING' }))
    const diff = diffModels(before, after)
    expect(diff.renamed.entities).toHaveLength(1)
    expect(diff.added.attributes).toHaveLength(1)
    expect(diff.added.enumValues).toHaveLength(1)
  })
})
