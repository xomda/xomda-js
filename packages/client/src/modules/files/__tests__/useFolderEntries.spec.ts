import { FolderXomdaIcon } from '@xomda/icons'
import { describe, expect, it } from 'vitest'

import type { FileEntry } from '../types'
import { getEntryDisplayProps, isIgnoredFolder, mergeWithVirtualEntries } from '../useFolderEntries'

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

  it('isIgnoredFolder mutes known build/scm directories', () => {
    expect(isIgnoredFolder(entry({ name: 'node_modules', isDirectory: true }))).toBe(true)
    expect(isIgnoredFolder(entry({ name: '.git', isDirectory: true }))).toBe(true)
    expect(isIgnoredFolder(entry({ name: 'target', isDirectory: true }))).toBe(true)
    expect(isIgnoredFolder(entry({ name: 'src', isDirectory: true }))).toBe(false)
    // Files with these names are not folders → not ignored
    expect(isIgnoredFolder(entry({ name: 'node_modules', isDirectory: false }))).toBe(false)
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

describe('getEntryDisplayProps', () => {
  const folder = (overrides: Partial<FileEntry> = {}): FileEntry => ({
    name: 'foo',
    isDirectory: true,
    size: 0,
    mtime: '',
    ...overrides,
  })

  it('returns no overlay and full opacity for a plain folder', () => {
    const props = getEntryDisplayProps(folder({ name: 'src' }))
    expect(props.iconOverlay).toBeNull()
    expect(props.projectIcons).toEqual([])
    expect(props.style.opacity).toBe(1)
  })

  it('uses the first project-kind icon as the overlay', () => {
    const props = getEntryDisplayProps(folder({ name: 'packages-a' }), [
      { icon: 'M1 1', label: 'node' },
      { icon: 'M2 2', label: 'maven' },
    ])
    expect(props.iconOverlay).toBe('M1 1')
    expect(props.projectIcons).toHaveLength(2)
  })

  it('project-kind overlay wins over xomda overlay', () => {
    const props = getEntryDisplayProps(folder({ name: 'a', isXomda: true }), [
      { icon: 'M-node', label: 'node' },
    ])
    expect(props.iconOverlay).toBe('M-node')
  })

  it('falls back to xomda overlay when no project icons provided', () => {
    const props = getEntryDisplayProps(folder({ name: '.xomda', isXomdaDir: true }))
    expect(props.iconOverlay).toBe(FolderXomdaIcon)
  })

  it('mutes ignored folders to 0.5 opacity', () => {
    const props = getEntryDisplayProps(folder({ name: 'node_modules' }))
    expect(props.style.opacity).toBe(0.5)
    expect(props.classList).toContain('text-disabled')
  })

  it('ignored takes precedence over hidden for opacity', () => {
    const props = getEntryDisplayProps(folder({ name: '.git', isHidden: true }))
    expect(props.style.opacity).toBe(0.5)
  })
})
