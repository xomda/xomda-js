import { TRPCError } from '@trpc/server'
import type { Entity, Enum, Model, Package } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import {
  appendToElementsOrder,
  findEntityById,
  findEnumById,
  findPackageById,
  getContainerById,
  removeFromElementsOrder,
  reorderByIds,
  requireEntityById,
  requireEnumById,
} from '../helpers'

const entity = (id: string, name = id): Entity => ({
  id,
  name,
  attributes: [],
})

const enumValue = (id: string, name = id): Enum => ({
  id,
  name,
  values: [],
})

const pkg = (id: string, partial: Partial<Package> = {}): Package => ({
  id,
  name: id,
  packages: [],
  enums: [],
  entities: [],
  ...partial,
})

const makeModel = (partial: Partial<Model> = {}): Model => ({
  id: '00000000-0000-0000-0000-000000000000',
  name: 'M',
  version: '1.0.0',
  packages: [],
  ...partial,
})

describe('findPackageById', () => {
  it('finds a top-level package', () => {
    const a = pkg('a')
    const result = findPackageById([a, pkg('b')], 'a')
    expect(result).toBe(a)
  })

  it('finds a deeply nested package', () => {
    const target = pkg('deep')
    const root = pkg('root', { packages: [pkg('mid', { packages: [target] })] })
    expect(findPackageById([root], 'deep')).toBe(target)
  })

  it('returns undefined when not found', () => {
    expect(findPackageById([pkg('a')], 'missing')).toBeUndefined()
  })
})

describe('getContainerById', () => {
  it('returns the model when packageId is undefined', () => {
    const model = makeModel()
    expect(getContainerById(model, undefined)).toBe(model)
  })

  it('returns a nested package by id', () => {
    const target = pkg('p1')
    const model = makeModel({ packages: [target] })
    expect(getContainerById(model, 'p1')).toBe(target)
  })

  it('throws TRPCError NOT_FOUND when packageId does not exist', () => {
    const model = makeModel()
    try {
      getContainerById(model, 'nope')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError)
      expect((err as TRPCError).code).toBe('NOT_FOUND')
    }
  })
})

describe('findEntityById', () => {
  it('finds an entity inside a top-level package', () => {
    const e = entity('e1')
    const model = makeModel({ packages: [pkg('p1', { entities: [e] })] })
    expect(findEntityById(model, 'e1')).toBe(e)
  })

  it('finds an entity inside a nested package', () => {
    const e = entity('deep')
    const model = makeModel({
      packages: [pkg('outer', { packages: [pkg('inner', { entities: [e] })] })],
    })
    expect(findEntityById(model, 'deep')).toBe(e)
  })

  it('returns undefined when not found', () => {
    expect(findEntityById(makeModel(), 'missing')).toBeUndefined()
  })
})

describe('findEnumById', () => {
  it('finds an enum inside a top-level package', () => {
    const en = enumValue('en1')
    const model = makeModel({ packages: [pkg('p1', { enums: [en] })] })
    expect(findEnumById(model, 'en1')).toBe(en)
  })

  it('finds an enum inside a nested package', () => {
    const en = enumValue('deep')
    const model = makeModel({ packages: [pkg('outer', { enums: [en] })] })
    expect(findEnumById(model, 'deep')).toBe(en)
  })
})

describe('requireEntityById / requireEnumById', () => {
  it('returns the entity when found', () => {
    const e = entity('e1')
    const model = makeModel({ packages: [pkg('p1', { entities: [e] })] })
    expect(requireEntityById(model, 'e1')).toBe(e)
  })

  it('throws TRPCError NOT_FOUND for missing entity', () => {
    expect(() => requireEntityById(makeModel(), 'missing')).toThrow(TRPCError)
  })

  it('returns the enum when found', () => {
    const en = enumValue('en1')
    const model = makeModel({ packages: [pkg('p1', { enums: [en] })] })
    expect(requireEnumById(model, 'en1')).toBe(en)
  })

  it('throws TRPCError NOT_FOUND for missing enum', () => {
    expect(() => requireEnumById(makeModel(), 'missing')).toThrow(TRPCError)
  })
})

describe('reorderByIds', () => {
  it('reorders items by id', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(reorderByIds(items, ['c', 'a', 'b'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
  })

  it('appends items missing from orderedIds at the end', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(reorderByIds(items, ['c'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
  })

  it('ignores ids that do not exist in items', () => {
    const items = [{ id: 'a' }]
    expect(reorderByIds(items, ['ghost', 'a'])).toEqual([{ id: 'a' }])
  })

  it('returns empty array for empty inputs', () => {
    expect(reorderByIds([], [])).toEqual([])
  })
})

describe('elementsOrder helpers', () => {
  it('appendToElementsOrder appends to existing order', () => {
    const container = pkg('p', { elementsOrder: ['a'] })
    appendToElementsOrder(container, 'b')
    expect(container.elementsOrder).toEqual(['a', 'b'])
  })

  it('appendToElementsOrder initializes order when missing', () => {
    const container = pkg('p')
    appendToElementsOrder(container, 'b')
    expect(container.elementsOrder).toEqual(['b'])
  })

  it('removeFromElementsOrder removes the matching id', () => {
    const container = pkg('p', { elementsOrder: ['a', 'b', 'c'] })
    removeFromElementsOrder(container, 'b')
    expect(container.elementsOrder).toEqual(['a', 'c'])
  })

  it('removeFromElementsOrder is a no-op when id is absent', () => {
    const container = pkg('p', { elementsOrder: ['a'] })
    removeFromElementsOrder(container, 'b')
    expect(container.elementsOrder).toEqual(['a'])
  })

  it('removeFromElementsOrder handles undefined order', () => {
    const container = pkg('p')
    removeFromElementsOrder(container, 'b')
    expect(container.elementsOrder).toEqual([])
  })
})
