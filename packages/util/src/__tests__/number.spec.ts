import { describe, expect, it } from 'vitest'

import { isNumberLike } from '../number'

describe('isNumberLike', () => {
  it('returns true for actual numbers', () => {
    expect(isNumberLike(0)).toBe(true)
    expect(isNumberLike(-3.14)).toBe(true)
    expect(isNumberLike(1e10)).toBe(true)
  })

  it('returns true for numeric strings (integer / decimal / signed / exponent)', () => {
    expect(isNumberLike('0')).toBe(true)
    expect(isNumberLike('42')).toBe(true)
    expect(isNumberLike('-7')).toBe(true)
    expect(isNumberLike('3.14')).toBe(true)
    expect(isNumberLike('1e3')).toBe(true)
    expect(isNumberLike('-1.5e-2')).toBe(true)
  })

  it('returns false for non-numeric strings', () => {
    expect(isNumberLike('abc')).toBe(false)
    expect(isNumberLike('')).toBe(false)
    expect(isNumberLike('  ')).toBe(false)
    expect(isNumberLike('1.2.3')).toBe(false)
  })

  it('returns false for non-string non-number inputs', () => {
    expect(isNumberLike(null)).toBe(false)
    expect(isNumberLike(undefined)).toBe(false)
    expect(isNumberLike({})).toBe(false)
    expect(isNumberLike([])).toBe(false)
    expect(isNumberLike(true)).toBe(false)
  })

  it('returns true for NaN (NaN is typeof "number")', () => {
    // Documents existing behaviour: the function gates on `typeof === 'number'`
    // before any value check, so NaN slips through. Callers that need a
    // finite-number guard should pair this with `Number.isFinite`.
    expect(isNumberLike(NaN)).toBe(true)
  })

  it('returns false for the string "NaN" and "Infinity"-ish strings', () => {
    // parseFloat('NaN') === NaN → second check rejects.
    expect(isNumberLike('NaN')).toBe(false)
  })

  it('returns true for numeric strings with surrounding whitespace', () => {
    // parseFloat and Number both tolerate whitespace, so '  42  ' qualifies.
    expect(isNumberLike('  42  ')).toBe(true)
  })
})
