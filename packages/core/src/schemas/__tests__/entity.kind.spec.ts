import { describe, expect, it } from 'vitest'

import { ENTITY_KINDS, EntitySchema, getEntityKind } from '../entity'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'

describe('Entity.kind', () => {
  it('ENTITY_KINDS contains the three locked values in order', () => {
    expect(ENTITY_KINDS).toEqual(['default', 'abstract', 'interface'])
  })

  it('entity without kind defaults to "default"', () => {
    const e = EntitySchema.parse({ id: ID, name: 'User', kind: 'default' as const, attributes: [] })
    expect(e.kind).toBe('default')
    expect(getEntityKind(e)).toBe('default')
  })

  it('entity with kind: "abstract" reads as kind "abstract"', () => {
    const e = EntitySchema.parse({ id: ID, name: 'UserBase', attributes: [], kind: 'abstract' })
    expect(getEntityKind(e)).toBe('abstract')
  })

  it('entity with kind: "interface" reads as kind "interface"', () => {
    const e = EntitySchema.parse({ id: ID, name: 'IUser', attributes: [], kind: 'interface' })
    expect(getEntityKind(e)).toBe('interface')
  })

  it('parse accepts each ENTITY_KINDS value', () => {
    for (const k of ENTITY_KINDS) {
      const e = EntitySchema.parse({ id: ID, name: 'E', attributes: [], kind: k })
      expect(getEntityKind(e)).toBe(k)
    }
  })

  it('parse rejects an unknown kind string', () => {
    expect(() =>
      EntitySchema.parse({ id: ID, name: 'E', attributes: [], kind: 'mixin' as 'default' })
    ).toThrow()
  })

  it('kind round-trips through parse/stringify/parse', () => {
    const e = EntitySchema.parse({ id: ID, name: 'IFoo', attributes: [], kind: 'interface' })
    const reParsed = EntitySchema.parse(JSON.parse(JSON.stringify(e)))
    expect(reParsed.kind).toBe('interface')
  })

  it('unknown tier-2 fields still round-trip alongside kind via .loose()', () => {
    const e = EntitySchema.parse({
      id: ID,
      name: 'User',
      attributes: [],
      kind: 'interface',
      stackTag: 'spring-boot',
    })
    expect((e as { stackTag?: string }).stackTag).toBe('spring-boot')
    expect(getEntityKind(e)).toBe('interface')
  })
})
