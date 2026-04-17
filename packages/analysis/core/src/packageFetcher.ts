import { createConcurrencyQueue, createLogger } from '@xomda/util'

import { getRegisteredAnalysisPlugins } from './registry'
import type { AnalysisPlugin, DetectedProject } from './types'

const log = createLogger('analysis.packageFetcher')

/**
 * Per-package metadata gathered for a detected project (npm version, Maven
 * coords, etc.). The shape is intentionally open — each plugin defines the
 * structure that's meaningful for its ecosystem and consumers narrow with
 * `as` at the use site.
 *
 * Examples by plugin:
 *  - `node`:   `{ name: '@scope/x', current: '1.2.3', latest: '1.3.0' }`
 *  - `maven`:  `{ groupId: 'org.foo', artifactId: 'bar', current: '1.0', latest: '1.1' }`
 *  - `gradle`: `{ plugin: 'org.springframework.boot', current: '3.2', latest: '3.4' }`
 */
export type PackageMetadata = Record<string, unknown>

export interface PackageFetchContext {
  /** Absolute path to the project root. */
  rootPath: string
  /** The detected project from `ProjectAnalyzer`. */
  project: DetectedProject
  /** Aborted when the caller wants to stop in-flight work (e.g. on unmount). */
  signal?: AbortSignal
}

export interface PackageFetchResult {
  pluginId: string
  /** Raw metadata records — one per package the plugin found and resolved. */
  packages: PackageMetadata[]
  /** Wall-clock duration in ms. */
  durationMs: number
  /** Set when the fetcher threw — `packages` is empty in that case. */
  error?: string
}

/**
 * Plugins extend `AnalysisPlugin` with an optional `fetchPackageData` hook
 * to participate in package-metadata enrichment. The hook is async, can
 * read network, and should honour `ctx.signal`. Implementations return a
 * list of `PackageMetadata` records; the runner normalises them into a
 * `PackageFetchResult` (timing, errors).
 */
export interface PackageFetcherPlugin {
  /** Plugin id this fetcher belongs to (matches `AnalysisPlugin.id`). */
  pluginId: string
  fetchPackageData(ctx: PackageFetchContext): Promise<PackageMetadata[]>
}

/**
 * Module-scoped registry, parallel to `AnalysisPlugin`. Kept separate
 * because most plugins won't ever ship a fetcher — registering through
 * the existing `AnalysisPlugin` shape would clutter every manifest with
 * an unused field. Plugins call this from their server entry alongside
 * `registerAnalysisPlugin(...)`.
 */
const fetchers = new Map<string, PackageFetcherPlugin>()

export function registerPackageFetcher(fetcher: PackageFetcherPlugin): void {
  fetchers.set(fetcher.pluginId, fetcher)
}

export function getRegisteredPackageFetchers(): readonly PackageFetcherPlugin[] {
  return [...fetchers.values()]
}

/** Test-only — wipe state so each spec starts clean. */
export function resetPackageFetcherRegistry(): void {
  fetchers.clear()
}

export interface RunPackageFetchersOptions {
  /** Restrict to a subset of plugin ids (e.g. only the ones the user opted into). */
  pluginIds?: readonly string[]
  /** Max concurrent fetchers. Defaults to `Math.max(1, os.cpus().length - 1)`. */
  maxConcurrent?: number
  signal?: AbortSignal
}

/**
 * Drive every registered fetcher whose plugin matches the detected
 * projects, bounded by a concurrency queue so network fan-out can't
 * exhaust upstream registries. One fetcher invocation per
 * (plugin × detected project) pair.
 *
 * Returns one `PackageFetchResult` per invocation; errors are captured
 * (not thrown) so a single plugin failure doesn't take down the batch.
 */
export async function runPackageFetchers(
  projects: readonly DetectedProject[],
  rootPath: string,
  options: RunPackageFetchersOptions = {}
): Promise<PackageFetchResult[]> {
  const allow = options.pluginIds ? new Set(options.pluginIds) : null
  const queue = createConcurrencyQueue(options.maxConcurrent ?? Math.max(1, (await cpuCount()) - 1))

  const tasks: Promise<PackageFetchResult>[] = []
  for (const project of projects) {
    for (const fetcher of fetchers.values()) {
      if (allow && !allow.has(fetcher.pluginId)) continue
      // Match fetcher to project by plugin id (the project's detected
      // plugin owns the metadata semantics for it).
      if (!project.kinds.includes(fetcher.pluginId)) continue
      tasks.push(
        queue.run(async () => {
          const started = Date.now()
          try {
            const packages = await fetcher.fetchPackageData({
              rootPath,
              project,
              signal: options.signal,
            })
            return {
              pluginId: fetcher.pluginId,
              packages,
              durationMs: Date.now() - started,
            }
          } catch (err) {
            log.warn(`fetcher '${fetcher.pluginId}' failed`, { data: err })
            return {
              pluginId: fetcher.pluginId,
              packages: [],
              durationMs: Date.now() - started,
              error: err instanceof Error ? err.message : String(err),
            }
          }
        })
      )
    }
  }
  return Promise.all(tasks)
}

/**
 * Best-effort CPU count — `node:os` may not be available in every
 * environment (browser sandbox, Deno-flavoured runners). Fall back to
 * 4 so the queue still has a sensible default.
 */
async function cpuCount(): Promise<number> {
  try {
    const os = await import('node:os')
    return os.cpus().length
  } catch {
    return 4
  }
}

/** Convenience: filter the existing analysis plugins down to those that registered a fetcher. */
export function pluginsWithFetcher(): AnalysisPlugin[] {
  const have = new Set(fetchers.keys())
  return getRegisteredAnalysisPlugins().filter((p) => have.has(p.id))
}
