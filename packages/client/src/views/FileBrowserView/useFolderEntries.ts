import { FolderXomdaIcon } from '@xomda/icons'
import type { MultiIconEntry, SortState } from '@xomda/ui'

import type { FileEntry, PreviewMap } from './types'

/**
 * Folder basenames that are typically excluded from project scanning
 * and that we visually mute in the browser (JetBrains-style "grey
 * out"). Mirrors @xomda/core's DEFAULT_PROJECT_SCAN_EXCLUDES plus
 * `.gradle`. Duplicated here to keep the client free of a runtime dep
 * on @xomda/core.
 */
export const IGNORED_FOLDER_NAMES: ReadonlySet<string> = new Set([
  '.git',
  '.gradle',
  '.idea',
  '.vscode',
  'build',
  'dist',
  'node_modules',
  'out',
  'target',
])

export function isIgnoredFolder(entry: FileEntry): boolean {
  return entry.isDirectory && IGNORED_FOLDER_NAMES.has(entry.name)
}

const compareEntries = (a: FileEntry, b: FileEntry, sort: SortState): number => {
  const dir = sort.dir === 'desc' ? -1 : 1
  // Directories-first remains a stable secondary ordering for any mode.
  if (a.isDirectory && !b.isDirectory) return -1
  if (!a.isDirectory && b.isDirectory) return 1
  let result: number
  switch (sort.by) {
    case 'modified':
      result = new Date(a.mtime).getTime() - new Date(b.mtime).getTime()
      break
    case 'size':
      result = a.size - b.size
      break
    case 'type': {
      const at = a.name.includes('.') ? a.name.split('.').pop()! : ''
      const bt = b.name.includes('.') ? b.name.split('.').pop()! : ''
      result = at.localeCompare(bt)
      break
    }
    case 'name':
    default:
      result = 0
  }
  if (result === 0) result = a.name.localeCompare(b.name)
  return result * dir
}

export const sortEntries = (entries: FileEntry[], sort: SortState): FileEntry[] =>
  [...entries].sort((a, b) => compareEntries(a, b, sort))

export interface EntryDisplayProps {
  color: string | undefined
  iconOverlay: string | null
  iconColor: string | null
  classList: (string | undefined)[]
  style: { opacity: number }
  /** Plugin-kind icons to render as folder/file decoration. May be empty. */
  projectIcons: MultiIconEntry[]
}

/**
 * Resolve every visual prop for a directory entry. Precedence for
 * folder overlays is:
 *
 *   1. project-kind overlay (first detected kind — Node, Maven, …)
 *   2. xomda overlay (folder containing a `.xomda` or named `.xomda`)
 *   3. plain folder glyph
 *
 * Folder muting (lower opacity) fires for ignored basenames
 * (`node_modules`, `.git`, `dist`, …) and inherits from the existing
 * `isHidden` treatment so the visual idiom stays consistent.
 */
export function getEntryDisplayProps(
  entry: FileEntry,
  projectIcons?: MultiIconEntry[]
): EntryDisplayProps {
  const kinds = projectIcons ?? []
  const hasProjectKind = entry.isDirectory && kinds.length > 0
  const ignored = isIgnoredFolder(entry)

  const baseOpacity = entry.isHidden ? 0.75 : 1
  const opacity = ignored ? Math.min(baseOpacity, 0.5) : baseOpacity

  // Project-kind overlay wins over xomda overlay so a Maven-rooted
  // .xomda monorepo subfolder still reads as a Maven module here.
  const iconOverlay = hasProjectKind
    ? kinds[0].icon
    : entry.isXomdaDir || entry.isXomda
      ? FolderXomdaIcon
      : null

  return {
    color: entry.isXomdaDir ? 'secondary' : entry.isXomda ? 'primary' : undefined,
    iconOverlay,
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
      ignored ? 'text-disabled' : undefined,
    ],
    style: { opacity },
    projectIcons: kinds,
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
  showGenerated: boolean,
  sort: SortState = { by: 'name', dir: 'asc' }
): FileEntry[] {
  if (!showGenerated) return sortEntries(realEntries, sort)

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

  return sortEntries([...real, ...virtual], sort)
}
