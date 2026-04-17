import { FolderXomdaIcon } from '@xomda/icons'

import type { FileEntry, PreviewMap } from './types'

export interface EntryDisplayProps {
  color: string | undefined
  iconOverlay: string | null
  iconColor: string | null
  classList: (string | undefined)[]
  style: { opacity: number }
}

export function getEntryDisplayProps(entry: FileEntry): EntryDisplayProps {
  return {
    color: entry.isXomdaDir ? 'secondary' : entry.isXomda ? 'primary' : undefined,
    iconOverlay: entry.isXomdaDir || entry.isXomda ? FolderXomdaIcon : null,
    iconColor: entry.isGenerated
      ? 'rgb(var(--v-theme-secondary))'
      : entry.isXomdaDir
        ? 'rgb(var(--v-theme-secondary))'
        : entry.isXomda
          ? 'rgb(var(--v-theme-primary))'
          : null,
    classList: [
      entry.isXomdaDir ? 'text-secondary' : entry.isXomda ? 'text-primary' : undefined,
      entry.isGenerated ? 'font-italic' : undefined,
    ],
    style: { opacity: entry.isHidden ? 0.75 : 1 },
  }
}

/**
 * Merge real folder entries with virtual entries synthesized from the template
 * preview map (paths that templates would generate but don't yet exist on disk).
 * Returns the merged list sorted directories-first then alphabetically.
 */
export function mergeWithVirtualEntries(
  realEntries: FileEntry[],
  previewMap: PreviewMap,
  path: string,
  showGenerated: boolean
): FileEntry[] {
  if (!showGenerated) return realEntries

  const prefix = path === '.' ? '' : `${path}/`
  const generatedFirstSegments = new Map<string, boolean>()

  for (const outputPath of previewMap.keys()) {
    if (!outputPath.startsWith(prefix)) continue
    const relative = outputPath.slice(prefix.length)
    const firstSegment = relative.split('/')[0]
    if (!firstSegment) continue
    const isDirectory = relative.includes('/')
    const existing = generatedFirstSegments.get(firstSegment)
    if (!existing) generatedFirstSegments.set(firstSegment, isDirectory)
  }

  const realNames = new Set(realEntries.map((e) => e.name))

  const real = realEntries.map((e) =>
    generatedFirstSegments.has(e.name) ? { ...e, isGenerated: true } : e
  )

  const virtual: FileEntry[] = []
  for (const [name, isDirectory] of generatedFirstSegments) {
    if (realNames.has(name)) continue
    virtual.push({
      name,
      isDirectory,
      size: 0,
      mtime: new Date(0).toISOString(),
      isGenerated: true,
    })
  }

  return [...real, ...virtual].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}
