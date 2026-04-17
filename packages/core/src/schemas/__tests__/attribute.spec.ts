import { describe, expect, it } from 'vitest'

import { isPrimitiveType, PRIMITIVE_TYPES } from '../attribute'

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
