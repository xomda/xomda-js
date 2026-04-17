import { describe, expect, it } from 'vitest'

import { AttributeSchema } from '../attribute'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'
const REF = '99999999-9999-4999-8999-999999999999'

describe('E4 — Per-type rules on Attribute.superRefine', () => {
  describe('targetEntity rules', () => {
    it('entity type with targetEntity: ok', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'owner',
        type: 'entity',
        targetEntity: REF,
      })
      expect(a.targetEntity).toBe(REF)
    })

    it('entity type without targetEntity: ok (orphan reported by graph resolver, not parse)', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'owner', type: 'entity' })
      expect(a.targetEntity).toBeUndefined()
    })

    it('targetEntity on non-entity type: error', () => {
      expect(() =>
        AttributeSchema.parse({
          id: ID,
          name: 'x',
          type: 'string',
          targetEntity: REF,
        })
      ).toThrow(/targetEntity is only valid when type is/)
    })

    it('targetEntity on enum type: error', () => {
      expect(() =>
        AttributeSchema.parse({
          id: ID,
          name: 'x',
          type: 'enum',
          targetEntity: REF,
        })
      ).toThrow(/targetEntity is only valid when type is/)
    })
  })

  describe('targetEnum rules', () => {
    it('enum type with targetEnum: ok', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'status',
        type: 'enum',
        targetEnum: REF,
      })
      expect(a.targetEnum).toBe(REF)
    })

    it('targetEnum on non-enum type: error', () => {
      expect(() =>
        AttributeSchema.parse({
          id: ID,
          name: 'x',
          type: 'string',
          targetEnum: REF,
        })
      ).toThrow(/targetEnum is only valid when type is/)
    })
  })

  describe('length rule (string only)', () => {
    it('string with length 64: ok', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'name', type: 'string', length: 64 })
      expect(a.length).toBe(64)
    })

    it('length on non-string type: error', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'qty', type: 'number', length: 10 })
      ).toThrow(/length is only valid when type is/)
    })
  })

  describe('precision + scale rules (decimal only)', () => {
    it('decimal with precision 10 scale 2: ok', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'price',
        type: 'decimal',
        precision: 10,
        scale: 2,
      })
      expect(a.precision).toBe(10)
      expect(a.scale).toBe(2)
    })

    it('decimal with scale 5 precision 2: error (scale exceeds precision)', () => {
      expect(() =>
        AttributeSchema.parse({
          id: ID,
          name: 'x',
          type: 'decimal',
          precision: 2,
          scale: 5,
        })
      ).toThrow(/scale .* must not exceed precision/)
    })

    it('decimal with scale equal to precision: ok', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'x',
        type: 'decimal',
        precision: 5,
        scale: 5,
      })
      expect(a.scale).toBe(5)
    })

    it('precision on non-decimal type: error', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'x', type: 'string', precision: 5 })
      ).toThrow(/precision is only valid when type is/)
    })

    it('scale on non-decimal type: error', () => {
      expect(() => AttributeSchema.parse({ id: ID, name: 'x', type: 'string', scale: 2 })).toThrow(
        /scale is only valid when type is/
      )
    })

    it('boolean with precision set: error', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'x', type: 'boolean', precision: 3 })
      ).toThrow(/precision is only valid when type is/)
    })
  })

  it('legacy attribute with type "string" and no extension fields: ok', () => {
    const a = AttributeSchema.parse({ id: ID, name: 'x', type: 'string' })
    expect(a.type).toBe('string')
    expect(a.targetEntity).toBeUndefined()
    expect(a.length).toBeUndefined()
  })

  it('legacy entity-name string for type: ok (extension rules do not fire)', () => {
    const a = AttributeSchema.parse({ id: ID, name: 'owner', type: 'User' })
    expect(a.type).toBe('User')
  })
})
