import { describe, expect, it } from 'vitest'

import type { FileEntry } from '../types'
import { mergeWithVirtualEntries } from '../useFolderEntries'

const entry = (overrides: Partial<FileEntry> & { name: string }): FileEntry => ({
  isDirectory: false,
  size: 0,
  mtime: '',
  ...overrides,
})

describe('mergeWithVirtualEntries', () => {
  const preview = new Map([
    ['generated/core/schemas/Entity.ts', 'entity content'],
    ['generated/core/schemas/Enum.ts', 'enum content'],
    ['src/real.ts', 'real content'],
  ])

  it('adds virtual entries from preview map not present on disk', () => {
    const merged = mergeWithVirtualEntries([], preview, '.', true)
    const names = merged.map((e) => e.name)
    expect(names).toContain('generated')
    expect(names).toContain('src')
  })

  it('marks real entries as generated when they appear in preview map', () => {
    const real = [entry({ name: 'src', isDirectory: true })]
    const merged = mergeWithVirtualEntries(real, preview, '.', true)
    expect(merged.find((e) => e.name === 'src')?.isGenerated).toBe(true)
  })

  it('does not duplicate entries when real and virtual overlap', () => {
    const real = [entry({ name: 'generated', isDirectory: true })]
    const merged = mergeWithVirtualEntries(real, preview, '.', true)
    expect(merged.filter((e) => e.name === 'generated')).toHaveLength(1)
  })

  it('returns real entries unchanged when showGenerated is false', () => {
    const real = [entry({ name: 'src', isDirectory: true })]
    const merged = mergeWithVirtualEntries(real, preview, '.', false)
    expect(merged).toEqual(real)
  })

  it('only synthesizes entries for the current subdirectory', () => {
    const merged = mergeWithVirtualEntries([], preview, 'generated/core/schemas', true)
    const names = merged.map((e) => e.name)
    expect(names).toContain('Entity.ts')
    expect(names).toContain('Enum.ts')
    expect(names).not.toContain('generated')
  })

  it('marks deeper-path virtual entries as directories', () => {
    const merged = mergeWithVirtualEntries([], preview, '.', true)
    expect(merged.find((e) => e.name === 'generated')?.isDirectory).toBe(true)
  })

  it('marks leaf-path virtual entries as files', () => {
    const merged = mergeWithVirtualEntries([], preview, 'generated/core/schemas', true)
    expect(merged.find((e) => e.name === 'Entity.ts')?.isDirectory).toBe(false)
  })

  it('sorts directories first then alphabetically', () => {
    const real = [
      entry({ name: 'zeta.ts' }),
      entry({ name: 'alpha.ts' }),
      entry({ name: 'beta', isDirectory: true }),
    ]
    const merged = mergeWithVirtualEntries(real, new Map(), '.', true)
    expect(merged.map((e) => e.name)).toEqual(['beta', 'alpha.ts', 'zeta.ts'])
  })
})
