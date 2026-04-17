import { describe, expect, it } from 'vitest'

// Unit-test the pure overlay-merging logic extracted from the component.
// The full component wires tRPC which is not available in unit tests.

/** Minimal shape matching FileEntry */
interface Entry {
  name: string
  isDirectory: boolean
  size: number
  mtime: string
  isGenerated?: boolean
}

/** Recreates the virtualEntries + mergedEntries logic for testing. */
function computeMergedEntries(
  currentPath: string,
  realEntries: Entry[],
  previewMap: Map<string, string>,
  showGenerated: boolean
): Entry[] {
  if (!showGenerated) return realEntries

  const prefix = currentPath === '.' ? '' : `${currentPath  }/`
  const seen = new Set<string>()
  const virtualOnly: Entry[] = []

  for (const outputPath of previewMap.keys()) {
    if (!outputPath.startsWith(prefix)) continue
    const relative = outputPath.slice(prefix.length)
    const firstSegment = relative.split('/')[0]
    if (!firstSegment || seen.has(firstSegment)) continue
    seen.add(firstSegment)

    const isDirectory = relative.includes('/')
    if (!realEntries.some((e) => e.name === firstSegment)) {
      virtualOnly.push({ name: firstSegment, isDirectory, size: 0, mtime: '', isGenerated: true })
    }
  }

  const generatedNames = new Set<string>()
  for (const p of previewMap.keys()) {
    if (p.startsWith(prefix)) {
      const seg = p.slice(prefix.length).split('/')[0]
      if (seg) generatedNames.add(seg)
    }
  }

  const real = realEntries.map((e) =>
    generatedNames.has(e.name) ? { ...e, isGenerated: true } : e
  )
  return [...real, ...virtualOnly].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

describe('FileBrowserView overlay logic', () => {
  const preview = new Map([
    ['generated/core/schemas/Entity.ts', 'entity content'],
    ['generated/core/schemas/Enum.ts', 'enum content'],
    ['src/real.ts', 'real content'],
  ])

  it('adds virtual entries from preview map not present on disk', () => {
    const merged = computeMergedEntries('.', [], preview, true)
    const names = merged.map((e) => e.name)
    expect(names).toContain('generated')
    expect(names).toContain('src')
  })

  it('marks real entries as generated when they appear in preview map', () => {
    const real: Entry[] = [{ name: 'src', isDirectory: true, size: 0, mtime: '' }]
    const merged = computeMergedEntries('.', real, preview, true)
    const srcEntry = merged.find((e) => e.name === 'src')
    expect(srcEntry?.isGenerated).toBe(true)
  })

  it('does not duplicate entries when real and virtual overlap', () => {
    const real: Entry[] = [{ name: 'generated', isDirectory: true, size: 0, mtime: '' }]
    const merged = computeMergedEntries('.', real, preview, true)
    expect(merged.filter((e) => e.name === 'generated')).toHaveLength(1)
  })

  it('filters out virtual entries when showGenerated is false', () => {
    const merged = computeMergedEntries('.', [], preview, false)
    expect(merged).toHaveLength(0)
  })

  it('only shows entries for the current subdirectory', () => {
    const merged = computeMergedEntries('generated/core/schemas', [], preview, true)
    const names = merged.map((e) => e.name)
    expect(names).toContain('Entity.ts')
    expect(names).toContain('Enum.ts')
    expect(names).not.toContain('generated')
    expect(names).not.toContain('src')
  })

  it('marks virtual file entries as non-directory', () => {
    const merged = computeMergedEntries('generated/core/schemas', [], preview, true)
    const entity = merged.find((e) => e.name === 'Entity.ts')
    expect(entity?.isDirectory).toBe(false)
  })

  it('marks virtual directory entries as directory', () => {
    const merged = computeMergedEntries('.', [], preview, true)
    const gen = merged.find((e) => e.name === 'generated')
    expect(gen?.isDirectory).toBe(true)
  })
})
