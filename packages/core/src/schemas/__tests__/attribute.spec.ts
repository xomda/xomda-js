import { describe, expect, it } from 'vitest'

import { isPrimitiveType, PRIMITIVE_TYPES } from '../attribute'

describe('PRIMITIVE_TYPES', () => {
  it('lists the six built-in primitive type names in canonical order', () => {
    expect(PRIMITIVE_TYPES).toEqual(['string', 'number', 'boolean', 'Date', 'UUID', 'decimal'])
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

  it('is case-sensitive (Date is primitive, "date" is not)', () => {
    expect(isPrimitiveType('Date')).toBe(true)
    expect(isPrimitiveType('date')).toBe(false)
    expect(isPrimitiveType('STRING')).toBe(false)
  })

  it('returns false for the empty string', () => {
    expect(isPrimitiveType('')).toBe(false)
  })
})
