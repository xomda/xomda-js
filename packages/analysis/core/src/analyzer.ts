import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { type MarkerCheck, walkForProjectKinds, type WalkOptions } from './project-walker'
import type {
  AnalysisContext,
  AnalysisPlugin,
  AnalysisResult,
  DetectedFeature,
  DetectedProject,
  FileTypeDescriptor,
  FileTypeView,
  OverviewContribution,
  PreviewHint,
} from './types'

/**
 * Minimal `**` / `*` glob: `**` crosses path separators, `*` matches a
 * single segment. Sufficient for fileTypes matching — we don't need brace
 * groups or `?`.
 */
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  // NUL placeholder is intentional: a 2-pass swap to avoid `*` matching
  // inside `**`. NUL can't appear in a file path so collisions are impossible.

  const pattern = escaped.replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*')
  return new RegExp(`^${pattern}$`)
}

function matchesFileType(relativePath: string, fileType: FileTypeDescriptor): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  const filename = basename(normalized)
  const { extensions, filenames, pathGlobs } = fileType.match
  if (filenames?.includes(filename)) return true
  if (extensions) {
    const dot = filename.lastIndexOf('.')
    const ext = dot >= 0 ? filename.slice(dot + 1) : ''
    if (ext && extensions.includes(ext)) return true
  }
  if (pathGlobs?.some((g) => globToRegex(g).test(normalized))) return true
  return false
}

/**
 * Normalise a FileTypeDescriptor's preview/views into a single array.
 * The shorthand `preview: PreviewHint` becomes one default view; an
 * explicit `views` array is returned as-is. Returns [] for icon-only
 * matchers that declare neither preview nor views.
 */
function normaliseViews(fileType: FileTypeDescriptor): FileTypeView[] {
  if (fileType.views && fileType.views.length > 0) return fileType.views
  if (fileType.preview) {
    return [{ id: 'default', label: 'Preview', preview: fileType.preview }]
  }
  return []
}

export interface FileTypesForResult {
  matches: Array<{ pluginId: string; pluginIcon?: string; fileType: FileTypeDescriptor }>
  /** Highest-priority preview hint, or undefined if none of the matches declared one. */
  preview?: PreviewHint
}

/**
 * Serialisable per-view shape returned to the client. The server-side
 * `loadViewData` callback is stripped; clients address it indirectly
 * via the `project.viewData` tRPC procedure using the view's identity.
 */
export interface SerialisableFileTypeView {
  id: string
  label: string
  icon?: string
  preview: PreviewHint
  /** True when the view has a server-side data loader. */
  hasLoadViewData: boolean
}

export interface ViewsForEntry {
  pluginId: string
  pluginIcon?: string
  fileTypeId: string
  fileTypeLabel: string
  views: SerialisableFileTypeView[]
}

function toSerialisableView(view: FileTypeView): SerialisableFileTypeView {
  return {
    id: view.id,
    label: view.label,
    ...(view.icon !== undefined ? { icon: view.icon } : {}),
    preview: view.preview,
    hasLoadViewData: typeof view.loadViewData === 'function',
  }
}

/**
 * Cache key for overview/view-data results. Keyed by file mtime: when
 * the underlying file changes, the next read recomputes. Stat failures
 * yield a sentinel (-1) that always invalidates.
 */
interface MtimeCacheEntry<T> {
  mtimeMs: number
  value: T
}

function safeMtimeMs(absPath: string): number {
  try {
    return statSync(absPath).mtimeMs
  } catch {
    return -1
  }
}

/**
 * Build an `AnalysisContext` rooted at `rootPath`. Shared between
 * detection, `loadOverview`, and `loadViewData` — plugins always get
 * the same fs surface regardless of the call site.
 */
function buildAnalysisContext(rootPath: string): AnalysisContext {
  const fileExistsCache = new Map<string, boolean>()
  return {
    rootPath,
    fileExists: (relativePath) => {
      const cached = fileExistsCache.get(relativePath)
      if (cached !== undefined) return cached
      const result = existsSync(join(rootPath, relativePath))
      fileExistsCache.set(relativePath, result)
      return result
    },
    listFiles: (relativePath = '.') => {
      try {
        return readdirSync(join(rootPath, relativePath))
      } catch {
        return []
      }
    },
    readFile: async (relativePath) => {
      try {
        return await readFile(join(rootPath, relativePath), 'utf-8')
      } catch {
        return null
      }
    },
  }
}

export class ProjectAnalyzer {
  private readonly plugins: AnalysisPlugin[] = []

  /**
   * Overview cache. Keyed by `${pluginId}\0${rootPath}`. Invalidated
   * when any of the plugin's marker files' mtime changes since the
   * cached entry was produced. Plugins without a `projectKind.marker`
   * are not cached (we have no cheap freshness signal).
   */
  private readonly overviewCache = new Map<string, MtimeCacheEntry<OverviewContribution | null>>()

  /**
   * View-data cache. Keyed by
   * `${pluginId}\0${fileTypeId}\0${viewId}\0${rootPath}\0${relativePath}`.
   * Invalidated by the underlying file's mtime.
   */
  private readonly viewDataCache = new Map<string, MtimeCacheEntry<unknown>>()

  register(plugin: AnalysisPlugin): this {
    this.plugins.push(plugin)
    return this
  }

  registerAll(plugins: Iterable<AnalysisPlugin>): this {
    for (const plugin of plugins) this.register(plugin)
    return this
  }

  listPlugins(): Array<{ id: string; name: string }> {
    return this.plugins.map(({ id, name }) => ({ id, name }))
  }

  /**
   * Find every FileTypeDescriptor across all registered plugins that
   * claims the given relative path. Returns matches in registration
   * order, plus the highest-priority preview hint (ties → first match).
   */
  fileTypesFor(relativePath: string): FileTypesForResult {
    const matches: FileTypesForResult['matches'] = []
    for (const plugin of this.plugins) {
      for (const fileType of plugin.fileTypes ?? []) {
        if (matchesFileType(relativePath, fileType)) {
          matches.push({ pluginId: plugin.id, pluginIcon: plugin.icon, fileType })
        }
      }
    }
    const previewable = matches.filter((m) => {
      const view = normaliseViews(m.fileType)[0]
      return view !== undefined
    })
    const best = previewable.sort(
      (a, b) => (b.fileType.priority ?? 0) - (a.fileType.priority ?? 0)
    )[0]
    const bestView = best ? normaliseViews(best.fileType)[0] : undefined
    return { matches, preview: bestView?.preview }
  }

  /**
   * Resolve every view from every plugin claiming `relativePath`.
   * Returns one entry per matching file type, with views in
   * declaration order. Used by the file browser to render the tab bar
   * above the preview pane when ≥2 views resolve.
   */
  viewsFor(relativePath: string): ViewsForEntry[] {
    const out: ViewsForEntry[] = []
    for (const plugin of this.plugins) {
      for (const fileType of plugin.fileTypes ?? []) {
        if (!matchesFileType(relativePath, fileType)) continue
        const views = normaliseViews(fileType)
        if (views.length === 0) continue
        out.push({
          pluginId: plugin.id,
          ...(plugin.icon !== undefined ? { pluginIcon: plugin.icon } : {}),
          fileTypeId: fileType.id,
          fileTypeLabel: fileType.label,
          views: views.map(toSerialisableView),
        })
      }
    }
    return out
  }

  /**
   * Combined mtime fingerprint for a plugin's marker files at the given
   * root. Returns the max mtimeMs across every marker that exists, or
   * -1 when no markers exist or none can be stat'd. Used as the cache
   * invalidation signal for `overviewFor`.
   */
  private overviewCacheKey(plugin: AnalysisPlugin, rootPath: string): number | null {
    const raw = plugin.projectKind?.marker
    if (raw == null) return null
    const markers = Array.isArray(raw) ? raw : [raw]
    let max = -1
    for (const m of markers) {
      const t = safeMtimeMs(join(rootPath, m))
      if (t > max) max = t
    }
    return max
  }

  /**
   * Run every plugin's `loadOverview` against `rootPath` and return the
   * non-null contributions. Filters by `enabledPluginIds` when supplied
   * (mirrors `project.plugins` allow-list). Cached by per-plugin marker
   * mtime; plugins without a `projectKind.marker` are recomputed every
   * call (cheaper than maintaining a multi-file mtime fingerprint).
   */
  async overviewFor(
    rootPath: string,
    opts?: { enabledPluginIds?: ReadonlySet<string> }
  ): Promise<OverviewContribution[]> {
    const context = buildAnalysisContext(rootPath)
    const enabled = opts?.enabledPluginIds
    const eligible = this.plugins.filter(
      (p) => typeof p.loadOverview === 'function' && (!enabled || enabled.has(p.id))
    )

    const results = await Promise.all(
      eligible.map(async (plugin): Promise<OverviewContribution | null> => {
        const mtime = this.overviewCacheKey(plugin, rootPath)
        if (mtime !== null) {
          const cacheKey = `${plugin.id}\0${rootPath}`
          const hit = this.overviewCache.get(cacheKey)
          if (hit && hit.mtimeMs === mtime) return hit.value
          // loadOverview is non-null here by the eligible filter; the
          // `!` is to keep TS happy without a runtime check.
          const value = await plugin.loadOverview!(context)
          this.overviewCache.set(cacheKey, { mtimeMs: mtime, value })
          return value
        }
        return await plugin.loadOverview!(context)
      })
    )

    return results.filter((c): c is OverviewContribution => c !== null)
  }

  /**
   * Call the named view's `loadViewData` for the given relative path.
   * Cached by the file's mtime. Returns undefined when the view does
   * not declare a loader (or when the plugin / file type / view id
   * cannot be resolved).
   */
  async loadViewData(
    rootPath: string,
    pluginId: string,
    fileTypeId: string,
    viewId: string,
    relativePath: string
  ): Promise<unknown> {
    const plugin = this.plugins.find((p) => p.id === pluginId)
    const fileType = plugin?.fileTypes?.find((f) => f.id === fileTypeId)
    if (!plugin || !fileType) return undefined
    const view = normaliseViews(fileType).find((v) => v.id === viewId)
    if (!view || typeof view.loadViewData !== 'function') return undefined

    const cacheKey = `${pluginId}\0${fileTypeId}\0${viewId}\0${rootPath}\0${relativePath}`
    const mtime = safeMtimeMs(join(rootPath, relativePath))
    if (mtime !== -1) {
      const hit = this.viewDataCache.get(cacheKey)
      if (hit && hit.mtimeMs === mtime) return hit.value
    }
    const context = buildAnalysisContext(rootPath)
    const value = await view.loadViewData(context, relativePath)
    if (mtime !== -1) this.viewDataCache.set(cacheKey, { mtimeMs: mtime, value })
    return value
  }

  /**
   * Build MarkerCheck[] from every plugin that contributes a
   * `projectKind`. Normalises `marker: string | string[]` (the
   * widening introduced in commit 2 is forward-compatible here).
   */
  private projectKindChecks(): MarkerCheck[] {
    const checks: MarkerCheck[] = []
    for (const plugin of this.plugins) {
      const kind = plugin.projectKind
      if (!kind) continue
      const marker = kind.marker as string | string[]
      const markers = Array.isArray(marker) ? marker : [marker]
      checks.push({ pluginId: plugin.id, markers })
    }
    return checks
  }

  async analyze(
    rootPath: string,
    walkOptions?: Omit<WalkOptions, 'rootPath'>
  ): Promise<AnalysisResult> {
    const context = buildAnalysisContext(rootPath)

    const contentPaths = new Set<string>()
    for (const plugin of this.plugins) {
      for (const pattern of plugin.patterns ?? []) {
        if (pattern.type === 'file-content') contentPaths.add(pattern.path)
      }
    }

    const contentCache = new Map<string, string | null>()
    await Promise.all(
      [...contentPaths].map(async (path) => {
        contentCache.set(path, await context.readFile(path))
      })
    )

    const detectionResults = await Promise.all(
      this.plugins.map(async (plugin): Promise<DetectedFeature | null> => {
        let detected = false

        if (plugin.detect) {
          detected = await plugin.detect(context)
        } else {
          for (const pattern of plugin.patterns ?? []) {
            if (detected) break

            if (pattern.type === 'file-exists') {
              detected = pattern.paths.some((p) => context.fileExists(p))
            } else if (pattern.type === 'file-content') {
              const content = contentCache.get(pattern.path)
              if (content != null) {
                detected =
                  typeof pattern.match === 'string'
                    ? content.includes(pattern.match)
                    : pattern.match.test(content)
              }
            }
          }
        }

        if (!detected) return null

        const match = plugin.inspect ? ((await plugin.inspect(context)) ?? undefined) : undefined
        return {
          pluginId: plugin.id,
          name: plugin.name,
          ...(plugin.icon !== undefined ? { icon: plugin.icon } : {}),
          ...(plugin.fileTypes !== undefined ? { fileTypes: plugin.fileTypes } : {}),
          ...(match !== undefined ? { match } : {}),
        }
      })
    )

    const projects: DetectedProject[] = walkForProjectKinds(
      { rootPath, ...walkOptions },
      this.projectKindChecks()
    )

    return {
      rootPath,
      features: detectionResults.filter((f): f is DetectedFeature => f !== null),
      projects,
      analyzedAt: new Date().toISOString(),
    }
  }
}
