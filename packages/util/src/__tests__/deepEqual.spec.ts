import { describe, expect, it } from 'vitest'

import { deepEqual } from '../deepEqual'

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
  })

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual('a', 'b')).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
  })

  it('compares nested objects structurally', () => {
    expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true)
    expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })).toBe(false)
  })

  it('is insensitive to key insertion order', () => {
    // The defining contract — JSON.stringify equality fails here.
    expect(deepEqual({ a: 1, b: 2, c: 3 }, { c: 3, b: 2, a: 1 })).toBe(true)
  })

  it('treats an explicitly-`undefined` value as different from key absence', () => {
    // `dequal` reads as "different key sets" — pin it so callers know.
    // This is stricter than JSON.stringify, which drops `undefined`.
    expect(deepEqual({ a: undefined }, {} as { a?: undefined })).toBe(false)
  })

  it('handles arrays element-wise (ordered)', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false)
  })

  it('handles Map and Set structurally', () => {
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true)
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true)
  })

  it('handles Date by value', () => {
    expect(deepEqual(new Date(123), new Date(123))).toBe(true)
    expect(deepEqual(new Date(123), new Date(124))).toBe(false)
  })

  it('returns false when one side is null and the other an object', () => {
    expect(deepEqual(null, {})).toBe(false)
  })
})
