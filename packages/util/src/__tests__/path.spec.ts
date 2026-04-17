import { describe, expect, it } from 'vitest'

import { resolveWorkspaceRelative } from '../path'

describe('resolveWorkspaceRelative', () => {
  it('resolves a sibling link from inside the workspace', () => {
    expect(resolveWorkspaceRelative('docs/a.md', './other.md')).toBe('docs/other.md')
  })

  it('resolves a sibling link without a leading ./', () => {
    expect(resolveWorkspaceRelative('docs/a.md', 'other.md')).toBe('docs/other.md')
  })

  it('walks up via ..', () => {
    expect(resolveWorkspaceRelative('docs/sub/a.md', '../other.md')).toBe('docs/other.md')
  })

  it('resolves to a file at the workspace root', () => {
    expect(resolveWorkspaceRelative('docs/a.md', '../README.md')).toBe('README.md')
  })

  it('resolves from a root-level file', () => {
    expect(resolveWorkspaceRelative('README.md', './docs/x.md')).toBe('docs/x.md')
  })

  it('returns null when .. escapes the workspace root', () => {
    expect(resolveWorkspaceRelative('docs/a.md', '../../escape.md')).toBeNull()
  })

  it('returns null for absolute POSIX paths', () => {
    expect(resolveWorkspaceRelative('docs/a.md', '/etc/passwd')).toBeNull()
  })

  it('returns null for Windows drive-rooted paths', () => {
    expect(resolveWorkspaceRelative('docs/a.md', 'C:/Users/me/file.md')).toBeNull()
    expect(resolveWorkspaceRelative('docs/a.md', 'C:\\Users\\me\\file.md')).toBeNull()
  })

  it('returns null for URL-scheme references', () => {
    expect(resolveWorkspaceRelative('docs/a.md', 'https://example.com/x')).toBeNull()
    expect(resolveWorkspaceRelative('docs/a.md', 'mailto:x@y')).toBeNull()
    expect(resolveWorkspaceRelative('docs/a.md', 'javascript:alert(1)')).toBeNull()
  })

  it('strips a trailing query/fragment before resolving', () => {
    expect(resolveWorkspaceRelative('docs/a.md', './other.md#section')).toBe('docs/other.md')
    expect(resolveWorkspaceRelative('docs/a.md', './other.md?x=1')).toBe('docs/other.md')
  })

  it('returns null for empty or whitespace input', () => {
    expect(resolveWorkspaceRelative('docs/a.md', '')).toBeNull()
    expect(resolveWorkspaceRelative('docs/a.md', '   ')).toBeNull()
  })

  it('treats a bare fragment as non-relative (caller handles fragments)', () => {
    // The fragment has no path component; this is a same-page anchor,
    // not a file reference.
    expect(resolveWorkspaceRelative('docs/a.md', '#section')).toBeNull()
  })
})
