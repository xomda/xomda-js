import { describe, expect, it } from 'vitest'

import { AttributeSchema } from '../attribute'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'
const REF = '99999999-9999-4999-8999-999999999999'

describe('E2 — Per-type extension fields on Attribute', () => {
  describe('targetEntity', () => {
    it('round-trips on an entity-typed attribute', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'owner',
        type: 'entity',
        reference: true,
        targetEntity: REF,
      })
      expect(a.targetEntity).toBe(REF)
      const reParsed = AttributeSchema.parse(JSON.parse(JSON.stringify(a)))
      expect(reParsed.targetEntity).toBe(REF)
    })

    it('rejects a non-UUID value', () => {
      expect(() =>
        AttributeSchema.parse({
          id: ID,
          name: 'owner',
          type: 'entity',
          targetEntity: 'not-a-uuid',
        })
      ).toThrow()
    })

    it('is absent on legacy attributes', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'x', type: 'string' })
      expect(a.targetEntity).toBeUndefined()
    })
  })

  describe('targetEnum', () => {
    it('round-trips on an enum-typed attribute', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'status',
        type: 'enum',
        targetEnum: REF,
      })
      expect(a.targetEnum).toBe(REF)
    })

    it('rejects a non-UUID value', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'status', type: 'enum', targetEnum: 'nope' })
      ).toThrow()
    })
  })

  describe('length (for string)', () => {
    it('round-trips a positive length', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'email', type: 'string', length: 254 })
      expect(a.length).toBe(254)
    })

    it('accepts zero', () => {
      const a = AttributeSchema.parse({ id: ID, name: 'x', type: 'string', length: 0 })
      expect(a.length).toBe(0)
    })

    it('rejects a negative length', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'x', type: 'string', length: -1 })
      ).toThrow()
    })

    it('rejects a non-integer length', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'x', type: 'string', length: 1.5 })
      ).toThrow()
    })
  })

  describe('precision + scale (for decimal)', () => {
    it('round-trips precision and scale together', () => {
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

    it('accepts precision only', () => {
      const a = AttributeSchema.parse({
        id: ID,
        name: 'qty',
        type: 'decimal',
        precision: 5,
      })
      expect(a.precision).toBe(5)
      expect(a.scale).toBeUndefined()
    })

    it('rejects negative precision', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'x', type: 'decimal', precision: -3 })
      ).toThrow()
    })

    it('rejects negative scale', () => {
      expect(() =>
        AttributeSchema.parse({ id: ID, name: 'x', type: 'decimal', scale: -1 })
      ).toThrow()
    })
  })

  it('extension fields coexist with tier-2 extras via .loose() (each field on its proper type)', () => {
    // E4's superRefine enforces field ↔ type pairing, so we can't put all five
    // on a single attribute. This test confirms that legal pairings still
    // round-trip alongside arbitrary tier-2 extra keys.
    const entityAttr = AttributeSchema.parse({
      id: ID,
      name: 'owner',
      type: 'entity',
      reference: true,
      targetEntity: REF,
      stackTag: 'spring-boot',
    })
    expect(entityAttr.targetEntity).toBe(REF)
    expect((entityAttr as { stackTag?: string }).stackTag).toBe('spring-boot')

    const decimalAttr = AttributeSchema.parse({
      id: ID,
      name: 'price',
      type: 'decimal',
      precision: 10,
      scale: 2,
      stackTag: 'spring-boot',
    })
    expect(decimalAttr.precision).toBe(10)
    expect(decimalAttr.scale).toBe(2)
  })
})
