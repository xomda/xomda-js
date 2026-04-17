import { describe, expect, it } from 'vitest'

import { EntitySchema, getEntityImplements } from '../entity'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'
const I1 = '11111111-1111-4111-8111-111111111111'
const I2 = '22222222-2222-4222-8222-222222222222'

describe('C2 — Entity.implements field', () => {
  it('entity without implements key reads as effective []', () => {
    const e = EntitySchema.parse({ id: ID, name: 'User', kind: 'default' as const, attributes: [] })
    expect(e.implements).toBeUndefined()
    expect(getEntityImplements(e)).toEqual([])
  })

  it('entity with implements: [] reads as empty array', () => {
    const e = EntitySchema.parse({
      id: ID,
      name: 'User',
      attributes: [],
      kind: 'default' as const,
      implements: [],
    })
    expect(e.implements).toEqual([])
    expect(getEntityImplements(e)).toEqual([])
  })

  it('entity with implements: [I1, I2] reads them in declaration order', () => {
    const e = EntitySchema.parse({
      id: ID,
      name: 'User',
      attributes: [],
      kind: 'default' as const,
      implements: [I1, I2],
    })
    expect(e.implements).toEqual([I1, I2])
    expect(getEntityImplements(e)).toEqual([I1, I2])
  })

  it('implements UUIDs round-trip through parse/stringify/parse', () => {
    const e = EntitySchema.parse({
      id: ID,
      name: 'User',
      attributes: [],
      kind: 'default' as const,
      implements: [I1, I2],
    })
    const reParsed = EntitySchema.parse(JSON.parse(JSON.stringify(e)))
    expect(reParsed.implements).toEqual([I1, I2])
  })

  it('non-UUID strings in implements are rejected', () => {
    expect(() =>
      EntitySchema.parse({
        id: ID,
        name: 'User',
        attributes: [],
        kind: 'default' as const,
        implements: ['not-a-uuid'],
      })
    ).toThrow()
  })

  it('non-array implements is rejected', () => {
    expect(() =>
      EntitySchema.parse({
        id: ID,
        name: 'User',
        attributes: [],
        kind: 'default' as const,
        implements: I1 as unknown as string[],
      })
    ).toThrow()
  })
})
