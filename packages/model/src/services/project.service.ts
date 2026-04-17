/**
 * Project-detection and analyser orchestration service. The
 * `project.router.ts` adapters delegate to functions here so the
 * router stays a thin tRPC layer.
 *
 * The side-effect import below populates the analysis-plugin registry
 * at module load — every consumer of this service gets a fully-loaded
 * registry without each consumer remembering to import the aggregator.
 */
import '@xomda/analysis-plugins'

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

import type { AnalysisPlugin, DetectedFeature, DetectedProject } from '@xomda/analysis-core'
import { getRegisteredAnalysisPlugins, ProjectAnalyzer } from '@xomda/analysis-core'

import { readProjectMeta } from '../storage'

/**
 * Long-lived analyzer instance for fileTypesFor lookups. The plugin
 * registry is populated by the side-effect import above.
 */
export const lookupAnalyzer = new ProjectAnalyzer().registerAll(getRegisteredAnalysisPlugins())

/**
 * The xomda plugin holds the `context` procedure's notion of "this is
 * a project root": it powers the in-root / in-subfolder / ancestor /
 * subproject banners on the homepage. Other project-kind plugins
 * (Maven, Gradle, Node) are surfaced via the generic `projects` list
 * returned by `scan`. Generalising `context` to multi-kind is tracked
 * as an explicit follow-up.
 */
export function findProjectKindPlugin(): AnalysisPlugin | undefined {
  return getRegisteredAnalysisPlugins().find((p) => p.id === 'xomda')
}

/** Every plugin that contributes a projectKind (xomda, node, maven, gradle, …). */
export function getProjectKindPlugins(): AnalysisPlugin[] {
  return getRegisteredAnalysisPlugins().filter((p) => p.projectKind != null)
}

/**
 * Count how often each pluginId appears across nested subprojects
 * (excluding the rootPath itself). Drives the "5 Maven, 12 Node"
 * chip row on the homepage.
 */
export function countProjectKinds(projects: readonly DetectedProject[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of projects) {
    if (p.isRoot) continue
    for (const k of p.kinds) out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Normalise a plugin's `marker` (string | string[]) to a string[]. */
export function markersOf(plugin: AnalysisPlugin | undefined): string[] {
  const m = plugin?.projectKind?.marker
  if (m == null) return []
  return Array.isArray(m) ? m : [m]
}

export function anyMarkerAt(dir: string, markers: readonly string[]): boolean {
  return markers.some((m) => existsSync(resolve(dir, m)))
}

/**
 * Walk up from `start` looking for a directory containing any of
 * `markers`. Returns the first match, or `null` if none up to the
 * filesystem root.
 */
export function findProjectRoot(start: string, markers: readonly string[]): string | null {
  let current = resolve(start)
  while (true) {
    if (anyMarkerAt(current, markers)) return current
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

export interface AncestorProject {
  path: string
  name: string
  isRoot: boolean
}

/**
 * Walk strictly upward from `start` (exclusive) collecting every
 * directory that contains `marker`, in nearest-first order. Stops on
 * the first ancestor whose project.json declares `settings.isRoot:
 * true` (after including it) — a workspace boundary cuts off further
 * walking. Best-effort: malformed project.json is treated as
 * isRoot=false rather than aborting the walk.
 */
export async function findAncestorProjects(
  start: string,
  markers: readonly string[]
): Promise<AncestorProject[]> {
  const ancestors: AncestorProject[] = []
  let current = resolve(start)
  while (true) {
    const parent = dirname(current)
    if (parent === current) break
    current = parent
    if (!anyMarkerAt(current, markers)) continue

    let isRoot = false
    let name = current.split(/[\\/]/).filter(Boolean).pop() ?? current
    try {
      const meta = await readProjectMeta(current)
      if (meta) {
        isRoot = meta.settings.isRoot
        name = meta.name
      }
    } catch {
      // swallow — fall through with the basename + isRoot=false
    }
    ancestors.push({ path: current, name, isRoot })
    if (isRoot) break // boundary — don't surface anything beyond
  }
  return ancestors
}

/**
 * Resolve relative paths lazily against the *current* process cwd — not
 * a value captured at module load. The @xomda/node dev/start scripts
 * pass `--cwd ../..` so startServer chdirs to the workspace root after
 * import (matching the pattern in @xomda/e2e-tests' start:app), so cwd
 * is the user's project root by the time these handlers run.
 */
export function resolveAgainstCwd(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path)
}

/**
 * Apply the project's `plugins` filter (if any) to a feature list.
 * An empty / missing list means "no filter": the project has not
 * recorded a preference yet, so return everything that was detected.
 */
export function filterByActivePlugins(
  features: DetectedFeature[],
  active: readonly string[] | undefined
): DetectedFeature[] {
  if (!active || active.length === 0) return features
  const allowed = new Set(active)
  return features.filter((f) => allowed.has(f.pluginId))
}
