import { describe, expect, it } from 'vitest'

import {
  ATTRIBUTE_TYPES,
  AttributeSchema,
  isAttributeTypeKind,
  isMetaType,
  isPrimitiveType,
  META_TYPES,
  PRIMITIVE_TYPES,
} from '../attribute'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'

describe('E1 — AttributeType enum (primitives + meta-types)', () => {
  it('PRIMITIVE_TYPES is the six lowercase scalars', () => {
    expect(PRIMITIVE_TYPES).toEqual(['string', 'number', 'boolean', 'date', 'uuid', 'decimal'])
  })

  it('META_TYPES is the four meta-type names', () => {
    expect(META_TYPES).toEqual(['entity', 'enum', 'package', 'attribute'])
  })

  it('ATTRIBUTE_TYPES is primitives followed by meta-types', () => {
    expect(ATTRIBUTE_TYPES).toEqual([
      'string',
      'number',
      'boolean',
      'date',
      'uuid',
      'decimal',
      'entity',
      'enum',
      'package',
      'attribute',
    ])
  })

  describe('isPrimitiveType', () => {
    it('returns true for each primitive', () => {
      for (const p of PRIMITIVE_TYPES) expect(isPrimitiveType(p)).toBe(true)
    })
    it('returns false for meta-types', () => {
      for (const m of META_TYPES) expect(isPrimitiveType(m)).toBe(false)
    })
    it('returns false for unknown strings', () => {
      expect(isPrimitiveType('User')).toBe(false)
      expect(isPrimitiveType('')).toBe(false)
    })
  })

  describe('isMetaType', () => {
    it('returns true for each meta-type', () => {
      for (const m of META_TYPES) expect(isMetaType(m)).toBe(true)
    })
    it('returns false for primitives', () => {
      for (const p of PRIMITIVE_TYPES) expect(isMetaType(p)).toBe(false)
    })
    it('returns false for unknown strings', () => {
      expect(isMetaType('User')).toBe(false)
    })
  })

  describe('isAttributeTypeKind', () => {
    it('returns true for primitives and meta-types', () => {
      for (const t of ATTRIBUTE_TYPES) expect(isAttributeTypeKind(t)).toBe(true)
    })
    it('returns false for user-defined names', () => {
      expect(isAttributeTypeKind('User')).toBe(false)
    })
  })

  describe('AttributeSchema accepts the recognised values and legacy strings', () => {
    it('parses each recognised type value', () => {
      for (const t of ATTRIBUTE_TYPES) {
        const a = AttributeSchema.parse({ id: ID, name: 'a', type: t })
        expect(a.type).toBe(t)
      }
    })

    it('parses a legacy entity-name string (E3 will promote later)', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'user', type: 'User' })
      expect(a.type).toBe('User')
    })

    it('parses any unknown string without erroring', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'x', type: 'foobar' })
      expect(a.type).toBe('foobar')
    })

    it('rejects empty string for type (existing min(1) guard)', () => {
      expect(() => AttributeSchema.parse({ id: ID, name: 'x', type: '' })).toThrow()
    })
  })
})
