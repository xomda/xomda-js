import { describe, expect, it } from 'vitest'

import { ProjectFileSchema } from '../project'

const VERSION_ID = '15c2d6cd-2c5d-4d1b-9f06-7c66bfbf0c2a'

describe('ProjectFileSchema', () => {
  it('parses a minimal project (just a name)', () => {
    const parsed = ProjectFileSchema.parse({ name: 'my-project' })
    expect(parsed.name).toBe('my-project')
    expect(parsed.description).toBeUndefined()
    expect(parsed.versions).toEqual({ head: null, versions: [] })
    expect(parsed.settings.restrictWritesToProjectRoot).toBe(true)
    expect(parsed.settings.isRoot).toBe(false)
    expect(parsed.settings.excludeFromScan).toContain('node_modules')
  })

  it('sorts and deduplicates excludeFromScan on parse', () => {
    const parsed = ProjectFileSchema.parse({
      name: 'p',
      settings: { excludeFromScan: ['vendor', 'node_modules', 'vendor', '.git'] },
    })
    expect(parsed.settings.excludeFromScan).toEqual(['.git', 'node_modules', 'vendor'])
  })

  it('respects an explicit isRoot=true', () => {
    const parsed = ProjectFileSchema.parse({
      name: 'p',
      settings: { isRoot: true },
    })
    expect(parsed.settings.isRoot).toBe(true)
  })

  it('parses a full project file including versions and settings', () => {
    const parsed = ProjectFileSchema.parse({
      name: 'my-project',
      description: 'best project ever',
      versions: {
        head: VERSION_ID,
        versions: [
          {
            id: VERSION_ID,
            label: '1.0.0',
            parent: null,
            snapshotFilename: 'v.json',
            timestamp: '2026-05-14T00:00:00.000Z',
          },
        ],
      },
      settings: { restrictWritesToProjectRoot: false },
    })
    expect(parsed.versions.head).toBe(VERSION_ID)
    expect(parsed.versions.versions).toHaveLength(1)
    expect(parsed.settings.restrictWritesToProjectRoot).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(() => ProjectFileSchema.parse({ name: '' })).toThrow()
  })

  it('preserves unknown keys (loose)', () => {
    const parsed = ProjectFileSchema.parse({ name: 'p', author: 'alice' }) as {
      author?: string
    }
    expect(parsed.author).toBe('alice')
  })

  it('defaults plugins to an empty array', () => {
    const parsed = ProjectFileSchema.parse({ name: 'p' })
    expect(parsed.plugins).toEqual([])
  })

  it('sorts plugins alphabetically and deduplicates on parse', () => {
    const parsed = ProjectFileSchema.parse({
      name: 'p',
      plugins: ['vite', 'typescript', 'eslint', 'vite'],
    })
    expect(parsed.plugins).toEqual(['eslint', 'typescript', 'vite'])
  })

  it('rejects empty plugin ids in the array', () => {
    expect(() => ProjectFileSchema.parse({ name: 'p', plugins: ['typescript', ''] })).toThrow()
  })
})
