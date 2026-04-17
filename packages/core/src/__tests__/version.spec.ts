import { describe, expect, it } from 'vitest'

import {
  bumpVersion,
  compareVersions,
  isValidVersion,
  maxVersion,
  parseVersion,
  validateModelVersionEdit,
  validateUpcomingVersion,
} from '../version'

describe('parseVersion', () => {
  it('parses major.minor.patch', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, parts: 3 })
  })
  it('parses major.minor', () => {
    expect(parseVersion('4.5')).toEqual({ major: 4, minor: 5, patch: 0, parts: 2 })
  })
  it('parses major only', () => {
    expect(parseVersion('7')).toEqual({ major: 7, minor: 0, patch: 0, parts: 1 })
  })
  it('trims whitespace', () => {
    expect(parseVersion('  1.0.0  ')?.major).toBe(1)
  })
  it('rejects garbage', () => {
    expect(parseVersion('abc')).toBeNull()
    expect(parseVersion('1.2.3-rc1')).toBeNull()
    expect(parseVersion('')).toBeNull()
    expect(parseVersion(null)).toBeNull()
  })
})

describe('isValidVersion', () => {
  it('mirrors parseVersion', () => {
    expect(isValidVersion('1.0.0')).toBe(true)
    expect(isValidVersion('nope')).toBe(false)
  })
})

describe('compareVersions', () => {
  it('orders by major then minor then patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })
  it('treats missing segments as zero', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
  })
  it('returns null for non-parseable inputs', () => {
    expect(compareVersions('abc', '1.0.0')).toBeNull()
  })
})

describe('bumpVersion', () => {
  it('bumps the smallest available part by default', () => {
    expect(bumpVersion('1.2.3')).toBe('1.2.4')
    expect(bumpVersion('1.2')).toBe('1.3')
    expect(bumpVersion('1')).toBe('2')
  })
  it('honours an explicit part', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0')
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4')
  })
  it('returns null for invalid input', () => {
    expect(bumpVersion('nope')).toBeNull()
  })
})

describe('maxVersion', () => {
  it('returns the max parseable, ignoring garbage', () => {
    expect(maxVersion(['1.0.0', '2.3.1', 'garbage', '1.9.9'])).toBe('2.3.1')
  })
  it('returns null when nothing parses', () => {
    expect(maxVersion(['a', 'b'])).toBeNull()
    expect(maxVersion([])).toBeNull()
  })
})

describe('validateUpcomingVersion', () => {
  it('requires a value', () => {
    expect(validateUpcomingVersion('', '1.0.0')).toMatch(/required/)
  })
  it('requires a valid version', () => {
    expect(validateUpcomingVersion('zzz', '1.0.0')).toMatch(/valid version/)
  })
  it('rejects values not greater than current', () => {
    expect(validateUpcomingVersion('1.0.0', '1.0.0')).toMatch(/greater than 1\.0\.0/)
    expect(validateUpcomingVersion('0.9.9', '1.0.0')).toMatch(/greater than 1\.0\.0/)
  })
  it('rejects values not greater than max historical', () => {
    expect(validateUpcomingVersion('1.0.1', '1.0.0', ['1.5.0'])).toMatch(/previous version 1\.5\.0/)
  })
  it('accepts a strict bump', () => {
    expect(validateUpcomingVersion('1.0.1', '1.0.0', ['0.9.0'])).toBeNull()
  })
})

describe('validateModelVersionEdit', () => {
  it('requires a value', () => {
    expect(validateModelVersionEdit('')).toMatch(/required/)
  })
  it('rejects non-semver', () => {
    expect(validateModelVersionEdit('abc')).toMatch(/valid version/)
  })
  it('rejects lower than historical max', () => {
    expect(validateModelVersionEdit('1.0.0', ['2.0.0'])).toMatch(/lower than previous version 2\.0\.0/)
  })
  it('allows equal to historical max', () => {
    expect(validateModelVersionEdit('2.0.0', ['2.0.0'])).toBeNull()
  })
  it('allows greater than historical', () => {
    expect(validateModelVersionEdit('3.0.0', ['2.0.0'])).toBeNull()
  })
})
