import { describe, expect, it } from 'vitest'

import type { Attribute } from '../../schemas/attribute'
import type { Model } from '../../schemas/model'
import {
  findAttributeByName,
  findEntityById,
  findEntityByName,
  findEntityParentPackage,
  findEnumById,
  findEnumByName,
  findEnumParentPackage,
  findPackageById,
  findPackageByName,
  getAllEntities,
  getAllEnums,
  getAllPackages,
  sortAttributesForDisplay,
} from '../index'

const model: Model = {
  id: 'm1',
  name: 'Test',
  version: '1.0.0',
  packages: [
    {
      id: 'p1',
      name: 'root',
      packages: [
        {
          id: 'p2',
          name: 'sub',
          packages: [],
          enums: [{ id: 'e1', name: 'Color', values: [{ id: 'v1', name: 'Red' }] }],
          entities: [
            {
              id: 'ent2',
              name: 'Product',
              attributes: [
                {
                  id: 'a2',
                  name: 'sku',
                  type: 'string',
                  required: true,
                  multiValue: false,
                  primaryKey: false,
                  unique: true,
                },
              ],
            },
          ],
        },
      ],
      enums: [],
      entities: [
        {
          id: 'ent1',
          name: 'User',
          attributes: [
            {
              id: 'a1',
              name: 'id',
              type: 'uuid',
              required: true,
              multiValue: false,
              primaryKey: true,
              unique: true,
            },
            {
              id: 'a3',
              name: 'email',
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
}

describe('getAllPackages', () => {
  it('returns all packages including nested', () => {
    const pkgs = getAllPackages(model)
    expect(pkgs.map((p) => p.name)).toEqual(['root', 'sub'])
  })
})

describe('getAllEntities', () => {
  it('returns all entities across packages', () => {
    const names = getAllEntities(model).map((e) => e.name)
    expect(names).toContain('User')
    expect(names).toContain('Product')
  })
})

describe('getAllEnums', () => {
  it('returns all enums across packages', () => {
    expect(getAllEnums(model).map((e) => e.name)).toEqual(['Color'])
  })
})

describe('findEntityById', () => {
  it('finds by id', () => expect(findEntityById(model, 'ent1')?.name).toBe('User'))
  it('returns undefined when not found', () => expect(findEntityById(model, 'x')).toBeUndefined())
})

describe('findEntityByName', () => {
  it('finds nested entity', () => expect(findEntityByName(model, 'Product')?.id).toBe('ent2'))
  it('returns undefined when not found', () =>
    expect(findEntityByName(model, 'Ghost')).toBeUndefined())
})

describe('findEnumById / findEnumByName', () => {
  it('finds by id', () => expect(findEnumById(model, 'e1')?.name).toBe('Color'))
  it('finds by name', () => expect(findEnumByName(model, 'Color')?.id).toBe('e1'))
  it('returns undefined when missing', () =>
    expect(findEnumByName(model, 'Status')).toBeUndefined())
})

describe('findPackageById / findPackageByName', () => {
  it('finds by id', () => expect(findPackageById(model, 'p2')?.name).toBe('sub'))
  it('finds by name', () => expect(findPackageByName(model, 'root')?.id).toBe('p1'))
})

describe('findEntityParentPackage', () => {
  it('finds the package containing the entity', () =>
    expect(findEntityParentPackage(model, 'ent1')?.name).toBe('root'))
  it('finds nested-package parent', () =>
    expect(findEntityParentPackage(model, 'ent2')?.name).toBe('sub'))
  it('returns undefined when entity is not in any package', () =>
    expect(findEntityParentPackage(model, 'nope')).toBeUndefined())
})

describe('findEnumParentPackage', () => {
  it('finds the package containing the enum', () =>
    expect(findEnumParentPackage(model, 'e1')?.name).toBe('sub'))
  it('returns undefined when enum is not in any package', () =>
    expect(findEnumParentPackage(model, 'nope')).toBeUndefined())
})

describe('findAttributeByName', () => {
  const user = model.packages[0].entities[0]
  it('finds by name', () => expect(findAttributeByName(user, 'email')?.id).toBe('a3'))
  it('returns undefined when not found', () =>
    expect(findAttributeByName(user, 'phone')).toBeUndefined())
})

describe('sortAttributesForDisplay', () => {
  const a = (id: string, name: string): Attribute => ({
    id,
    name,
    type: 'string',
    required: false,
    multiValue: false,
    primaryKey: false,
    unique: false,
  })

  it('pins the description attribute to the end', () => {
    const out = sortAttributesForDisplay([a('1', 'id'), a('2', 'description'), a('3', 'name')])
    expect(out.map((x) => x.name)).toEqual(['id', 'name', 'description'])
  })

  it('preserves the original order of non-description attributes', () => {
    const out = sortAttributesForDisplay([
      a('1', 'z'),
      a('2', 'description'),
      a('3', 'a'),
      a('4', 'm'),
    ])
    expect(out.map((x) => x.name)).toEqual(['z', 'a', 'm', 'description'])
  })

  it('is a no-op when no description attribute is present', () => {
    const input = [a('1', 'id'), a('2', 'name')]
    const out = sortAttributesForDisplay(input)
    expect(out.map((x) => x.name)).toEqual(['id', 'name'])
  })

  it('does not mutate the input array', () => {
    const input = [a('1', 'description'), a('2', 'name')]
    sortAttributesForDisplay(input)
    expect(input.map((x) => x.name)).toEqual(['description', 'name'])
  })
})
