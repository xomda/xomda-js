import { TRPCError } from '@trpc/server'
import type { Entity, Enum, Model, Package } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import {
  findEntityById,
  findEnumById,
  findPackageById,
  getContainerById,
  isPackageDescendantOf,
  removeEntityById,
  removeEnumById,
  removePackageById,
  reorderByIds,
  replaceEntityById,
  replaceEnumById,
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

describe('findPackageById (re-export from @xomda/core)', () => {
  it('finds a top-level package', () => {
    const a = pkg('a')
    const model = makeModel({ packages: [a, pkg('b')] })
    expect(findPackageById(model, 'a')).toBe(a)
  })

  it('finds a deeply nested package', () => {
    const target = pkg('deep')
    const model = makeModel({
      packages: [pkg('root', { packages: [pkg('mid', { packages: [target] })] })],
    })
    expect(findPackageById(model, 'deep')).toBe(target)
  })

  it('returns undefined when not found', () => {
    expect(findPackageById(makeModel({ packages: [pkg('a')] }), 'missing')).toBeUndefined()
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

describe('replaceEntityById', () => {
  it('replaces an entity in a nested package and returns true', () => {
    const original = entity('e1', 'OldName')
    const model = makeModel({
      packages: [pkg('outer', { packages: [pkg('inner', { entities: [original] })] })],
    })
    const replacement: Entity = { id: 'e1', name: 'NewName', attributes: [] }
    expect(replaceEntityById(model, replacement)).toBe(true)
    expect(findEntityById(model, 'e1')).toEqual(replacement)
  })

  it('returns false when no entity has the id', () => {
    const model = makeModel({ packages: [pkg('p1', { entities: [entity('e1')] })] })
    expect(replaceEntityById(model, entity('missing'))).toBe(false)
  })
})

describe('replaceEnumById', () => {
  it('replaces an enum in a nested package and returns true', () => {
    const original = enumValue('en1', 'OldName')
    const model = makeModel({
      packages: [pkg('outer', { packages: [pkg('inner', { enums: [original] })] })],
    })
    const replacement: Enum = { id: 'en1', name: 'NewName', values: [] }
    expect(replaceEnumById(model, replacement)).toBe(true)
    expect(findEnumById(model, 'en1')).toEqual(replacement)
  })

  it('returns false when no enum has the id', () => {
    const model = makeModel({ packages: [pkg('p1', { enums: [enumValue('en1')] })] })
    expect(replaceEnumById(model, enumValue('missing'))).toBe(false)
  })
})

describe('removeEntityById', () => {
  it('removes a nested entity and returns it', () => {
    const target = entity('e1')
    const model = makeModel({
      packages: [pkg('outer', { packages: [pkg('inner', { entities: [target] })] })],
    })
    const removed = removeEntityById(model, 'e1')
    expect(removed).toBe(target)
    expect(findEntityById(model, 'e1')).toBeUndefined()
  })

  it('returns undefined when no entity has the id', () => {
    const model = makeModel()
    expect(removeEntityById(model, 'missing')).toBeUndefined()
  })
})

describe('removeEnumById', () => {
  it('removes a nested enum and returns it', () => {
    const target = enumValue('en1')
    const model = makeModel({
      packages: [pkg('outer', { packages: [pkg('inner', { enums: [target] })] })],
    })
    const removed = removeEnumById(model, 'en1')
    expect(removed).toBe(target)
    expect(findEnumById(model, 'en1')).toBeUndefined()
  })

  it('returns undefined when no enum has the id', () => {
    expect(removeEnumById(makeModel(), 'missing')).toBeUndefined()
  })
})

describe('removePackageById', () => {
  it('removes a top-level package and returns it', () => {
    const target = pkg('p1')
    const other = pkg('p2')
    const model = makeModel({ packages: [target, other] })
    const removed = removePackageById(model, 'p1')
    expect(removed).toBe(target)
    expect(model.packages).toEqual([other])
  })

  it('removes a deeply nested package and returns it', () => {
    const target = pkg('deep')
    const model = makeModel({
      packages: [pkg('outer', { packages: [pkg('mid', { packages: [target] })] })],
    })
    const removed = removePackageById(model, 'deep')
    expect(removed).toBe(target)
    expect(findPackageById(model, 'deep')).toBeUndefined()
  })

  it('returns undefined when no package has the id', () => {
    expect(removePackageById(makeModel(), 'nope')).toBeUndefined()
  })
})

describe('isPackageDescendantOf', () => {
  it('returns true when ancestor and descendant are the same package (by id)', () => {
    const p = pkg('p1')
    expect(isPackageDescendantOf(p, { id: 'p1' } as Package)).toBe(true)
  })

  it('returns true for a deep descendant', () => {
    const deep = pkg('deep')
    const root = pkg('root', { packages: [pkg('mid', { packages: [deep] })] })
    expect(isPackageDescendantOf(root, { id: 'deep' } as Package)).toBe(true)
  })

  it('returns false when the descendant is unrelated', () => {
    const root = pkg('root', { packages: [pkg('child')] })
    expect(isPackageDescendantOf(root, { id: 'unrelated' } as Package)).toBe(false)
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
