import { describe, expect, it } from 'vitest'

import type { Attribute } from '../../schemas/attribute'
import type { Entity } from '../../schemas/entity'
import type { Model } from '../../schemas/model'
import { buildEntitySchema } from '../index'

const attr = (name: string, overrides: Partial<Attribute> = {}): Attribute => ({
  id: `attr-${name}`,
  name,
  type: 'string',
  required: false,
  multiValue: false,
  primaryKey: false,
  unique: false,
  ...overrides,
})

const entity = (id: string, name: string, overrides: Partial<Entity> = {}): Entity => ({
  id,
  name,
  attributes: [],
  ...overrides,
})

const modelOf = (entities: Entity[]): Model => ({
  id: '00000000-0000-0000-0000-000000000000',
  name: 'M',
  version: '1.0.0',
  packages: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'p',
      packages: [],
      enums: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Color',
          values: [
            { id: 'cv-r', name: 'red' },
            { id: 'cv-g', name: 'green' },
          ],
        },
      ],
      entities,
    },
  ],
})

describe('buildEntitySchema', () => {
  it('builds a schema with one Zod field per own attribute', () => {
    const e = entity('e1', 'User', {
      attributes: [
        attr('name', { type: 'string', required: true }),
        attr('age', { type: 'number' }),
      ],
    })
    const schema = buildEntitySchema(e, modelOf([e]))
    const parsed = schema.parse({ name: 'Alice', age: 30 })
    expect(parsed).toMatchObject({ name: 'Alice', age: 30 })
  })

  it('rejects required string fields when missing or empty', () => {
    const e = entity('e1', 'User', {
      attributes: [attr('name', { type: 'string', required: true })],
    })
    const schema = buildEntitySchema(e, modelOf([e]))
    expect(() => schema.parse({ name: '' })).toThrow()
  })

  it('includes inherited attributes via extends', () => {
    const base = entity('base', 'BaseEntity', {
      attributes: [attr('createdAt', { type: 'date' })],
    })
    const child = entity('child', 'User', {
      extends: 'base',
      attributes: [attr('email', { type: 'string', required: true })],
    })
    const schema = buildEntitySchema(child, modelOf([base, child]))
    const parsed = schema.parse({
      email: 'a@b.com',
      createdAt: '2026-04-29T00:00:00.000Z',
    })
    expect(parsed).toMatchObject({ email: 'a@b.com' })
  })

  it('resolves an Enum-typed attribute to z.enum of values', () => {
    const e = entity('e1', 'Item', {
      attributes: [attr('color', { type: 'Color', required: true })],
    })
    const schema = buildEntitySchema(e, modelOf([e]))
    expect(() => schema.parse({ color: 'red' })).not.toThrow()
    expect(() => schema.parse({ color: 'blue' })).toThrow()
  })

  it('treats reference fields as uuid strings, not embedded objects', () => {
    const e = entity('e1', 'User', {
      attributes: [attr('parent', { type: 'User', reference: true })],
    })
    const schema = buildEntitySchema(e, modelOf([e]))
    const validUuid = 'c410efd4-0a90-42df-9a31-082db114fcda'
    expect(schema.parse({ parent: validUuid })).toMatchObject({ parent: validUuid })
    expect(() => schema.parse({ parent: 'not-a-uuid' })).toThrow()
    // Embedded object is rejected for reference fields.
    expect(() => schema.parse({ parent: { id: validUuid, name: 'x' } })).toThrow()
  })

  it('embeds non-reference Entity-typed attributes recursively', () => {
    const address = entity('addr', 'Address', {
      attributes: [attr('city', { type: 'string', required: true })],
    })
    const user = entity('user', 'User', {
      attributes: [attr('home', { type: 'Address' })],
    })
    const schema = buildEntitySchema(user, modelOf([address, user]))
    const parsed = schema.parse({ home: { city: 'Paris' } })
    expect(parsed).toMatchObject({ home: { city: 'Paris' } })
  })

  it('handles cycles in embedded entity references without infinite recursion', () => {
    const a = entity('a', 'A', { attributes: [attr('b', { type: 'B' })] })
    const b = entity('b', 'B', { attributes: [attr('a', { type: 'A' })] })
    // Should not throw at build time even though A → B → A is cyclic.
    const schema = buildEntitySchema(a, modelOf([a, b]))
    // The cyclic branch is permissive; passes for any object.
    const parsed = schema.parse({ b: { a: { b: { a: {} } } } })
    expect(parsed).toBeTruthy()
  })

  it('preserves unknown keys (loose object) so user extensions survive', () => {
    const e = entity('e1', 'User', {
      attributes: [attr('name', { type: 'string', required: true })],
    })
    const schema = buildEntitySchema(e, modelOf([e]))
    const parsed = schema.parse({ name: 'Alice', stackHint: 'spring' })
    expect((parsed as { stackHint?: string }).stackHint).toBe('spring')
  })

  it('makes multiValue attributes default to []', () => {
    const e = entity('e1', 'User', {
      attributes: [attr('tags', { type: 'string', multiValue: true })],
    })
    const schema = buildEntitySchema(e, modelOf([e]))
    const parsed = schema.parse({})
    expect((parsed as { tags?: string[] }).tags).toEqual([])
  })
})
