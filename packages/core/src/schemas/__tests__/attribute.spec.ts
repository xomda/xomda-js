import { describe, expect, it } from 'vitest'

import { AttributeSchema, isPrimitiveType, PRIMITIVE_TYPES } from '../attribute'

describe('PRIMITIVE_TYPES', () => {
  it('lists the six built-in primitive type names in canonical (lowercase) order', () => {
    expect(PRIMITIVE_TYPES).toEqual(['string', 'number', 'boolean', 'date', 'uuid', 'decimal'])
  })

  it('matches the enum values in .xomda/model.json (no PascalCase drift)', () => {
    // Canonical casing pinned: model.json stores `date`/`uuid` lowercase
    // and the runtime dispatch in dynamic/index.ts keys on the same.
    // Regression of the historical Date/UUID PascalCase variants — which
    // forced .xomda/templates/Java/main-java.template.json to carry a
    // dual-casing map — would break the self-bootstrap round-trip.
    expect(PRIMITIVE_TYPES).not.toContain('Date')
    expect(PRIMITIVE_TYPES).not.toContain('UUID')
  })

  it('is readonly at the type level (compile-time assertion)', () => {
    // @ts-expect-error — readonly tuple, push is not allowed
    PRIMITIVE_TYPES.push('extra')
  })
})

describe('isPrimitiveType', () => {
  it.each(PRIMITIVE_TYPES)('returns true for %s', (name) => {
    expect(isPrimitiveType(name)).toBe(true)
  })

  it('returns false for a user-defined type name', () => {
    expect(isPrimitiveType('Customer')).toBe(false)
    expect(isPrimitiveType('OrderStatus')).toBe(false)
  })

  it('rejects legacy PascalCase primitive names (drift guard)', () => {
    expect(isPrimitiveType('Date')).toBe(false)
    expect(isPrimitiveType('UUID')).toBe(false)
    expect(isPrimitiveType('STRING')).toBe(false)
  })

  it('returns false for the empty string', () => {
    expect(isPrimitiveType('')).toBe(false)
  })
})

describe('AttributeSchema — aggregation', () => {
  it('accepts aggregation: "composite" on an entity-typed attribute', () => {
    const parsed = AttributeSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'comments',
      type: 'Comment',
      multiValue: true,
      aggregation: 'composite',
    })
    expect(parsed.aggregation).toBe('composite')
  })

  it('accepts aggregation: "none" on an entity-typed attribute', () => {
    const parsed = AttributeSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'author',
      type: 'Author',
      aggregation: 'none',
    })
    expect(parsed.aggregation).toBe('none')
  })

  it('rejects aggregation on a primitive type', () => {
    expect(() =>
      AttributeSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'title',
        type: 'string',
        aggregation: 'composite',
      })
    ).toThrow(/aggregation/)
  })

  it('rejects aggregation on the "enum" meta-type', () => {
    expect(() =>
      AttributeSchema.parse({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'status',
        type: 'enum',
        aggregation: 'none',
      })
    ).toThrow(/aggregation/)
  })

  it('omits aggregation by default (entity-typed)', () => {
    const parsed = AttributeSchema.parse({
      id: '55555555-5555-4555-8555-555555555555',
      name: 'sibling',
      type: 'Sibling',
    })
    expect(parsed.aggregation).toBeUndefined()
  })
})

describe('AttributeSchema — legacy `reference` migration', () => {
  it('migrates `reference: true` on an entity-typed attribute to aggregation: "none"', () => {
    const parsed = AttributeSchema.parse({
      id: '66666666-6666-4666-8666-666666666666',
      name: 'author',
      type: 'Author',
      reference: true,
    })
    expect(parsed.aggregation).toBe('none')
    expect((parsed as Record<string, unknown>).reference).toBeUndefined()
  })

  it('migrates `reference: false` on an entity-typed attribute to aggregation: "composite"', () => {
    const parsed = AttributeSchema.parse({
      id: '77777777-7777-4777-8777-777777777777',
      name: 'address',
      type: 'Address',
      reference: false,
    })
    expect(parsed.aggregation).toBe('composite')
    expect((parsed as Record<string, unknown>).reference).toBeUndefined()
  })

  it('strips legacy `reference` from a primitive-typed attribute without setting aggregation', () => {
    const parsed = AttributeSchema.parse({
      id: '88888888-8888-4888-8888-888888888888',
      name: 'title',
      type: 'string',
      reference: false,
    })
    expect(parsed.aggregation).toBeUndefined()
    expect((parsed as Record<string, unknown>).reference).toBeUndefined()
  })

  it('prefers explicit aggregation over legacy reference when both are present', () => {
    const parsed = AttributeSchema.parse({
      id: '99999999-9999-4999-8999-999999999999',
      name: 'author',
      type: 'Author',
      reference: true,
      aggregation: 'composite',
    })
    expect(parsed.aggregation).toBe('composite')
    expect((parsed as Record<string, unknown>).reference).toBeUndefined()
  })
})
