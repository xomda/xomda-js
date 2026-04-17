import { describe, expect, it } from 'vitest'

import { useVersion } from '../useVersion'

describe('useVersion', () => {
  const v = useVersion()

  it('exposes the canonical pure-helper surface', () => {
    expect(typeof v.parse).toBe('function')
    expect(typeof v.isValid).toBe('function')
    expect(typeof v.compare).toBe('function')
    expect(typeof v.bump).toBe('function')
    expect(typeof v.max).toBe('function')
    expect(typeof v.validateUpcoming).toBe('function')
    expect(typeof v.validateEdit).toBe('function')
  })

  describe('parse / isValid', () => {
    it('parses a full major.minor.patch string', () => {
      expect(v.parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, parts: 3 })
    })

    it('parses major-only and major.minor with parts reflecting segments', () => {
      expect(v.parse('5')).toEqual({ major: 5, minor: 0, patch: 0, parts: 1 })
      expect(v.parse('5.7')).toEqual({ major: 5, minor: 7, patch: 0, parts: 2 })
    })

    it('parse returns null for malformed input', () => {
      expect(v.parse('not a version')).toBeNull()
      expect(v.parse('1.x.0')).toBeNull()
      expect(v.parse(null)).toBeNull()
      expect(v.parse(undefined)).toBeNull()
    })

    it('isValid mirrors parse() being non-null', () => {
      expect(v.isValid('1.0.0')).toBe(true)
      expect(v.isValid('10.20.30')).toBe(true)
      expect(v.isValid('1.2')).toBe(true) // major.minor is valid
      expect(v.isValid('1')).toBe(true) // major-only is valid
      expect(v.isValid('not a version')).toBe(false)
      expect(v.isValid('')).toBe(false)
    })
  })

  describe('compare', () => {
    it('returns 0 for equal versions', () => {
      expect(v.compare('1.0.0', '1.0.0')).toBe(0)
    })

    it('returns a positive number when the first is newer', () => {
      expect(v.compare('1.0.1', '1.0.0')).toBeGreaterThan(0)
      expect(v.compare('2.0.0', '1.999.999')).toBeGreaterThan(0)
    })

    it('returns a negative number when the first is older', () => {
      expect(v.compare('1.0.0', '1.0.1')).toBeLessThan(0)
    })
  })

  describe('max', () => {
    it('returns the highest of a list', () => {
      expect(v.max(['1.0.0', '2.0.1', '1.9.9'])).toBe('2.0.1')
    })

    it('returns null for an empty list', () => {
      expect(v.max([])).toBeNull()
    })

    it('ignores unparseable entries in the list', () => {
      expect(v.max(['x', '1.0.0', 'y', '0.9.0'])).toBe('1.0.0')
    })
  })

  describe('bump', () => {
    it('bumps major, zeros minor and patch', () => {
      expect(v.bump('1.2.3', 'major')).toBe('2.0.0')
    })

    it('bumps minor, zeros patch', () => {
      expect(v.bump('1.2.3', 'minor')).toBe('1.3.0')
    })

    it('bumps patch', () => {
      expect(v.bump('1.2.3', 'patch')).toBe('1.2.4')
    })
  })

  describe('validateUpcoming', () => {
    it('returns null (ok) for a valid bump from the current version', () => {
      expect(v.validateUpcoming('1.1.0', '1.0.0', [])).toBeNull()
    })

    it('returns an error string when the upcoming version is not greater', () => {
      const err = v.validateUpcoming('1.0.0', '1.0.0', [])
      expect(err).toBeTruthy()
    })

    it('returns an error when the upcoming version is a duplicate label', () => {
      const err = v.validateUpcoming('1.0.1', '1.0.0', ['1.0.1'])
      expect(err).toBeTruthy()
    })
  })

  describe('validateEdit', () => {
    it('returns null (ok) when editing to a non-conflicting version', () => {
      expect(v.validateEdit('1.2.0', ['1.0.0', '1.1.0'])).toBeNull()
    })

    it('allows editing to equal a historical version (metadata-only re-tag)', () => {
      expect(v.validateEdit('1.0.0', ['1.0.0'])).toBeNull()
    })

    it('returns an error when editing to a lower version than the historical max', () => {
      expect(v.validateEdit('1.0.0', ['1.1.0'])).toBeTruthy()
    })

    it('returns an error for malformed versions', () => {
      expect(v.validateEdit('not-a-version', [])).toBeTruthy()
    })
  })
})
