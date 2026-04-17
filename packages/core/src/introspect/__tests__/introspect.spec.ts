import { describe, expect, it } from 'vitest'

import type { Model } from '../../schemas/model'
import {
  findAttributeByName,
  findEntityById,
  findEntityByName,
  findEnumById,
  findEnumByName,
  findPackageById,
  findPackageByName,
  getAllEntities,
  getAllEnums,
  getAllPackages,
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

describe('findAttributeByName', () => {
  const user = model.packages[0].entities[0]
  it('finds by name', () => expect(findAttributeByName(user, 'email')?.id).toBe('a3'))
  it('returns undefined when not found', () =>
    expect(findAttributeByName(user, 'phone')).toBeUndefined())
})
