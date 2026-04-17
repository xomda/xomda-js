import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

import type { DetectedProject } from './types'

export interface MarkerCheck {
  pluginId: string
  /** Any of these basenames present in a folder marks it as this kind. */
  markers: string[]
}

export interface WalkOptions {
  rootPath: string
  /** Hard ceiling on recursion depth (rootPath = 0). */
  maxDepth?: number
  /** Folder basenames to skip anywhere in the tree (e.g. `node_modules`). */
  excludes?: ReadonlySet<string>
  /** Project-relative POSIX paths to skip entirely (e.g. `packages/legacy`). */
  excludePaths?: ReadonlySet<string>
}

const DEFAULT_MAX_DEPTH = 6

/**
 * Folder basenames the walker skips by default. Kept short and aligned
 * with the user-facing `DEFAULT_PROJECT_SCAN_EXCLUDES` in @xomda/core,
 * but duplicated here to keep analysis-core dep-free.
 */
export const DEFAULT_WALKER_EXCLUDES: readonly string[] = [
  '.git',
  '.gradle',
  '.idea',
  '.vscode',
  '.xomda',
  'build',
  'dist',
  'node_modules',
  'out',
  'target',
]

/**
 * Walk `rootPath` (sync fs; runs inside the analysis worker) and emit
 * one DetectedProject per folder that any plugin claims via its
 * marker. The rootPath itself is included when claimed. Recurses into
 * detected projects so nested monorepo layouts are surfaced.
 *
 * Symlinks are not followed (lstat) to defend against cycles.
 */
export function walkForProjectKinds(
  opts: WalkOptions,
  checks: readonly MarkerCheck[]
): DetectedProject[] {
  const root = opts.rootPath
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH
  const excludes = opts.excludes ?? new Set(DEFAULT_WALKER_EXCLUDES)
  const excludePaths = opts.excludePaths ?? new Set<string>()
  const found: DetectedProject[] = []

  if (checks.length === 0) return found

  const rootKinds = kindsAt(root, checks)
  if (rootKinds.length > 0) {
    found.push({
      path: '.',
      name: basename(root) || root,
      kinds: rootKinds,
      isRoot: true,
    })
  }

  walk(root, root, 0, maxDepth, excludes, excludePaths, checks, found)
  return found
}

function kindsAt(dir: string, checks: readonly MarkerCheck[]): string[] {
  const kinds: string[] = []
  for (const c of checks) {
    if (c.markers.some((m) => existsSync(join(dir, m)))) kinds.push(c.pluginId)
  }
  return kinds
}

function walk(
  root: string,
  current: string,
  depth: number,
  maxDepth: number,
  excludes: ReadonlySet<string>,
  excludePaths: ReadonlySet<string>,
  checks: readonly MarkerCheck[],
  found: DetectedProject[]
): void {
  if (depth >= maxDepth) return
  let entries: string[]
  try {
    entries = readdirSync(current)
  } catch {
    return
  }
  for (const entry of entries) {
    if (excludes.has(entry)) continue
    const child = join(current, entry)
    const rel = relative(root, child).replace(/\\/g, '/')
    if (excludePaths.has(rel)) continue
    let isDir: boolean
    try {
      // lstat (not stat): a symlinked dir is treated as a non-directory
      // so we don't follow into cycles or out of the project tree.
      isDir = lstatSync(child).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    const kinds = kindsAt(child, checks)
    if (kinds.length > 0) {
      found.push({ path: rel, name: basename(child), kinds })
    }
    walk(root, child, depth + 1, maxDepth, excludes, excludePaths, checks, found)
  }
}
