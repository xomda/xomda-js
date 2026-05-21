import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'

import { DEFAULT_PROJECT_SCAN_EXCLUDES, ProjectFileSchema, XOMDA_DIR } from '@xomda/core'

/**
 * Minimal, dependency-free workspace walker the CLI uses for `-R` recursive
 * generate / preview. Mirrors the analysis plugin's `walkForSubprojects`
 * but lives in `@xomda/cli` so the CLI does not need to pull the entire
 * analysis-plugin tree (and the plugin side-effect imports).
 *
 * Walks downward from `root`, listing every directory containing `.xomda/`
 * (the project marker), capped at `MAX_DEPTH` to keep accidental
 * monorepo-recursion bounded. A subproject whose `project.json` declares
 * `settings.isRoot: true` is still surfaced but its descendants are NOT
 * walked — the boundary semantics are the same the SPA / analysis layer
 * already enforce.
 *
 * Returns paths sorted lexically by `path` for deterministic output.
 */
export interface SubprojectInfo {
  /** Absolute path of the subproject root. */
  path: string
  /** Display name from project.json, or basename fallback. */
  name: string
  /** `settings.isRoot` from project.json (false on parse failure). */
  isRoot: boolean
}

const MAX_DEPTH = 4

function readIsRoot(absRoot: string): { isRoot: boolean; name: string | null } {
  const projectJson = join(absRoot, XOMDA_DIR, 'project.json')
  if (!existsSync(projectJson)) return { isRoot: false, name: null }
  try {
    const raw = readFileSync(projectJson, 'utf-8')
    const parsed = ProjectFileSchema.parse(JSON.parse(raw))
    return { isRoot: parsed.settings.isRoot, name: parsed.name }
  } catch {
    return { isRoot: false, name: null }
  }
}

function readExcludes(absRoot: string): Set<string> {
  const projectJson = join(absRoot, XOMDA_DIR, 'project.json')
  if (!existsSync(projectJson)) return new Set(DEFAULT_PROJECT_SCAN_EXCLUDES)
  try {
    const raw = readFileSync(projectJson, 'utf-8')
    const parsed = ProjectFileSchema.parse(JSON.parse(raw))
    return new Set(parsed.settings.excludeFromScan)
  } catch {
    return new Set(DEFAULT_PROJECT_SCAN_EXCLUDES)
  }
}

function walkInner(
  workspaceRoot: string,
  current: string,
  depth: number,
  excludes: Set<string>,
  out: SubprojectInfo[]
): void {
  if (depth > MAX_DEPTH) return
  let entries: string[]
  try {
    entries = readdirSync(current)
  } catch {
    return
  }
  for (const entry of entries) {
    if (excludes.has(entry)) continue
    const child = join(current, entry)
    let isDir: boolean
    try {
      isDir = statSync(child).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue

    if (existsSync(join(child, XOMDA_DIR))) {
      const { isRoot, name } = readIsRoot(child)
      out.push({
        path: child,
        name: name ?? basename(child),
        isRoot,
      })
      // `isRoot: true` marks an independent workspace — list it, but do
      // not descend. Recursive generate at the parent stops here.
      if (isRoot) continue
    }
    walkInner(workspaceRoot, child, depth + 1, excludes, out)
  }
}

/**
 * Enumerate every `.xomda/`-rooted subproject under `root`, stopping at
 * `isRoot: true` boundaries. The workspace itself is NOT included in the
 * result (callers process it separately).
 *
 * Quietly tolerates unreadable directories and malformed `project.json`
 * (treated as `isRoot: false`) — best-effort walk, exactly mirroring the
 * analysis-plugin walker.
 */
export function walkSubprojects(root: string): SubprojectInfo[] {
  const absRoot = resolve(root)
  const out: SubprojectInfo[] = []
  walkInner(absRoot, absRoot, 0, readExcludes(absRoot), out)
  out.sort((a, b) => a.path.localeCompare(b.path))
  return out
}

/** Project-relative path (POSIX-style) for logging. */
export function relativeFromWorkspace(workspaceRoot: string, projectPath: string): string {
  return relative(resolve(workspaceRoot), projectPath).replace(/\\/g, '/') || '.'
}
