import { describe, expect, it } from 'vitest'

import { classifyExcludes, isGlobPattern, matchesGlob } from '../glob'

describe('isGlobPattern', () => {
  it('returns true when the entry contains `*`', () => {
    expect(isGlobPattern('packages/*/dist')).toBe(true)
    expect(isGlobPattern('**/tmp')).toBe(true)
  })

  it('returns false for plain basenames and paths', () => {
    expect(isGlobPattern('node_modules')).toBe(false)
    expect(isGlobPattern('packages/legacy')).toBe(false)
  })
})

describe('matchesGlob', () => {
  it('matches a single segment with `*`', () => {
    expect(matchesGlob('packages/*', 'packages/foo')).toBe(true)
    // `*` does not cross separators, so the deeper path is not matched.
    expect(matchesGlob('packages/*', 'packages/foo/bar')).toBe(false)
  })

  it('matches across separators with `**`', () => {
    expect(matchesGlob('**/tmp', 'a/b/c/tmp')).toBe(true)
    expect(matchesGlob('packages/**/dist', 'packages/x/y/dist')).toBe(true)
  })

  it('does not match when the trailing literal differs', () => {
    expect(matchesGlob('packages/*/dist', 'packages/x/build')).toBe(false)
  })
})

describe('classifyExcludes', () => {
  it('routes entries to basenames / paths / globs by shape', () => {
    const result = classifyExcludes([
      'node_modules',
      'packages/legacy',
      'packages/*/dist',
      '**/tmp',
    ])
    expect([...result.basenames]).toEqual(['node_modules'])
    expect([...result.paths]).toEqual(['packages/legacy'])
    expect(result.globs).toEqual(['packages/*/dist', '**/tmp'])
  })

  it('normalises backslashes and a leading `./`', () => {
    const result = classifyExcludes(['./packages\\legacy'])
    expect([...result.paths]).toEqual(['packages/legacy'])
  })

  it('skips empty entries', () => {
    const result = classifyExcludes(['', '   ', 'node_modules'])
    // whitespace-only entries are not stripped — they remain basenames.
    expect([...result.basenames]).toEqual(['   ', 'node_modules'])
    expect(result.globs).toEqual([])
  })
})
