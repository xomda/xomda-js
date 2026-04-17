import { describe, expect, it } from 'vitest'

import { AttributeSchema } from '../attribute'
import { EntitySchema } from '../entity'
import { EnumSchema, EnumValueSchema } from '../enum'
import { ModelSchema } from '../model'
import { PackageSchema } from '../package'

// Tier-2 users may extend the meta-types (e.g. `SpecialEntity extends Entity`
// with extra attributes). Those extra fields appear as unknown keys on the
// underlying JSON records, and they must round-trip through Zod parse without
// being stripped or rejected.

const ID_ATTR = 'c410efd4-0a90-42df-9a31-082db114fcda'
const ID_ENT = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'
const ID_ENUM = '803b6297-8032-4142-b6d1-0fa85851378e'
const ID_ENUMVAL = '1c7f0bdd-c3b5-4fa1-9df9-294f781f1eb5'
const ID_PKG = 'e9ebf8e5-ec57-4e50-9798-1c77343acb7d'
const ID_MODEL = '00e12e8e-719b-429d-9324-953e40ae253f'
const ID_EXTRA = '86d3687e-5850-4e3f-9a72-e18d28bcc80c'

describe('schema openness — extra unknown keys round-trip', () => {
  it('AttributeSchema preserves unknown keys', () => {
    const parsed = AttributeSchema.parse({
      id: ID_ATTR,
      name: 'foo',
      type: 'string',
      lombokFlag: true,
      customMeta: { hint: 'x' },
    })
    expect(parsed.lombokFlag).toBe(true)
    expect(parsed.customMeta).toEqual({ hint: 'x' })
  })

  it('EntitySchema preserves unknown keys', () => {
    const parsed = EntitySchema.parse({
      id: ID_ENT,
      name: 'User',
      attributes: [],
      lombokFlag: true,
    })
    expect(parsed.lombokFlag).toBe(true)
  })

  it('EnumSchema preserves unknown keys (and so do nested EnumValues)', () => {
    const parsed = EnumSchema.parse({
      id: ID_ENUM,
      name: 'Color',
      values: [{ id: ID_ENUMVAL, name: 'red', hex: '#ff0000' }],
      annotated: 'yes',
    })
    expect(parsed.annotated).toBe('yes')
    expect((parsed.values[0] as { hex?: string }).hex).toBe('#ff0000')
  })

  it('PackageSchema preserves unknown keys', () => {
    const parsed = PackageSchema.parse({
      id: ID_PKG,
      name: 'security',
      packages: [],
      enums: [],
      entities: [],
      stackTag: 'spring-boot',
    })
    expect((parsed as { stackTag?: string }).stackTag).toBe('spring-boot')
  })

  it('ModelSchema preserves unknown keys', () => {
    const parsed = ModelSchema.parse({
      id: ID_MODEL,
      name: 'M',
      version: '1.0.0',
      packages: [],
      authoredBy: 'alice',
    })
    expect((parsed as { authoredBy?: string }).authoredBy).toBe('alice')
  })

  it('extra keys survive a parse/serialize/parse round-trip', () => {
    const input = {
      id: ID_ENT,
      name: 'User',
      attributes: [{ id: ID_EXTRA, name: 'email', type: 'string', extraAttrField: 42 }],
      extraEntityField: 'kept',
    }
    const first = EntitySchema.parse(input)
    const round = EntitySchema.parse(JSON.parse(JSON.stringify(first)))
    expect((round as { extraEntityField?: string }).extraEntityField).toBe('kept')
    expect((round.attributes[0] as { extraAttrField?: number }).extraAttrField).toBe(42)
  })

  it('EnumValueSchema preserves unknown keys directly', () => {
    const parsed = EnumValueSchema.parse({
      id: ID_ENUMVAL,
      name: 'PRIMARY',
      legacyCode: 1,
    })
    expect((parsed as { legacyCode?: number }).legacyCode).toBe(1)
  })
})
