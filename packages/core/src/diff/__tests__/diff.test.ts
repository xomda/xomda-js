import { describe, expect, it } from 'vitest'

import {
  createAttribute,
  createEntity,
  createEnum,
  createEnumValue,
  createModel,
  createPackage,
} from '../../testing/index'
import { diffModels } from '../index'

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
  it('returns empty diff for identical models', () => {
    const m = base()
    expect(diffModels(m, m)).toEqual([])
  })
})

describe('diffModels — packages', () => {
  it('detects added package', () => {
    const before = base()
    const after = base()
    after.packages.push(createPackage({ id: 'pkg-new', name: 'com.new' }))
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('package-added')
  })

  it('detects removed package', () => {
    const before = base()
    const after = createModel({ packages: [] })
    const entries = diffModels(before, after)
    expect(entries.some((e) => e.kind === 'package-removed')).toBe(true)
  })
})

describe('diffModels — entities', () => {
  it('detects added entity', () => {
    const before = base()
    const after = base()
    after.packages[0].entities.push(createEntity({ id: 'ent-new', name: 'Order' }))
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('entity-added')
    if (entries[0].kind === 'entity-added') {
      expect(entries[0].entity.name).toBe('Order')
      expect(entries[0].packageName).toBe('com.example')
    }
  })

  it('detects removed entity', () => {
    const before = base()
    const after = base()
    after.packages[0].entities = []
    const entries = diffModels(before, after)
    expect(entries.some((e) => e.kind === 'entity-removed')).toBe(true)
  })

  it('detects renamed entity', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].name = 'AppUser'
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('entity-renamed')
    if (entries[0].kind === 'entity-renamed') {
      expect(entries[0].oldName).toBe('User')
      expect(entries[0].entity.name).toBe('AppUser')
    }
  })
})

describe('diffModels — attributes', () => {
  it('detects added attribute', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes.push(createAttribute({ id: 'a-new', name: 'phone' }))
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('attribute-added')
    if (entries[0].kind === 'attribute-added') {
      expect(entries[0].attribute.name).toBe('phone')
      expect(entries[0].entityName).toBe('User')
    }
  })

  it('detects removed attribute', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes = after.packages[0].entities[0].attributes.slice(1)
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('attribute-removed')
  })

  it('detects changed attribute', () => {
    const before = base()
    const after = base()
    after.packages[0].entities[0].attributes[1].type = 'text'
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('attribute-changed')
    if (entries[0].kind === 'attribute-changed') {
      expect(entries[0].old.type).toBe('string')
      expect(entries[0].attribute.type).toBe('text')
    }
  })
})

describe('diffModels — enums', () => {
  it('detects added enum', () => {
    const before = base()
    const after = base()
    after.packages[0].enums.push(createEnum({ id: 'enum-new', name: 'Role' }))
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('enum-added')
  })

  it('detects removed enum', () => {
    const before = base()
    const after = base()
    after.packages[0].enums = []
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('enum-removed')
  })

  it('detects added enum value', () => {
    const before = base()
    const after = base()
    after.packages[0].enums[0].values.push(createEnumValue({ id: 'v-new', name: 'PENDING' }))
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('enum-value-added')
    if (entries[0].kind === 'enum-value-added') {
      expect(entries[0].enumName).toBe('Status')
    }
  })

  it('detects removed enum value', () => {
    const before = base()
    const after = base()
    after.packages[0].enums[0].values = after.packages[0].enums[0].values.slice(1)
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('enum-value-removed')
  })
})

describe('diffModels — mixed changes', () => {
  it('accumulates multiple diff entries', () => {
    const before = base()
    const after = base()
    // rename entity + add attribute + add enum value
    after.packages[0].entities[0].name = 'AppUser'
    after.packages[0].entities[0].attributes.push(createAttribute({ id: 'a-new', name: 'phone' }))
    after.packages[0].enums[0].values.push(createEnumValue({ id: 'v-new', name: 'PENDING' }))
    const entries = diffModels(before, after)
    expect(entries).toHaveLength(3)
    const kinds = entries.map((e) => e.kind)
    expect(kinds).toContain('entity-renamed')
    expect(kinds).toContain('attribute-added')
    expect(kinds).toContain('enum-value-added')
  })
})
