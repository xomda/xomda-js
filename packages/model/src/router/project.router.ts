import '@xomda/analysis-plugins'

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

import {
  type AnalysisPlugin,
  type AnalysisResult,
  classifyExcludes,
  type DetectedFeature,
  type DetectedProject,
  getRegisteredAnalysisPlugins,
  isCorePlugin,
  type OverviewContribution,
  ProjectAnalyzer,
  runAnalysisInline,
  type ViewsForEntry,
  type WalkOptions,
} from '@xomda/analysis-core'
import { DEFAULT_PROJECT_SCAN_EXCLUDES, type ProjectFile, ProjectFileSchema } from '@xomda/core'
import { createLogger } from '@xomda/util'
import { z } from 'zod'

import { listModelDescriptors, readProjectMeta, saveProjectMeta } from '../storage'
import { publicProcedure, router } from './trpc'

const log = createLogger('project.router')

// A long-lived analyzer instance for fileTypesFor lookups. The plugin
// registry is populated by the side-effect import of @xomda/analysis-plugins
// above, so this picks up everything.
const lookupAnalyzer = new ProjectAnalyzer().registerAll(getRegisteredAnalysisPlugins())

/**
 * The xomda plugin holds the `context` procedure's notion of "this is
 * a project root": it powers the in-root / in-subfolder / ancestor /
 * subproject banners on the homepage. Other project-kind plugins
 * (Maven, Gradle, Node) are surfaced via the generic `projects` list
 * returned by `scan`. Generalising `context` to multi-kind is tracked
 * as an explicit follow-up.
 */
function findProjectKindPlugin(): AnalysisPlugin | undefined {
  return getRegisteredAnalysisPlugins().find((p) => p.id === 'xomda')
}

/** Every plugin that contributes a projectKind (xomda, node, maven, gradle, …). */
function getProjectKindPlugins(): AnalysisPlugin[] {
  return getRegisteredAnalysisPlugins().filter((p) => p.projectKind != null)
}

/**
 * Count how often each pluginId appears across nested subprojects
 * (excluding the rootPath itself). Drives the "5 Maven, 12 Node"
 * chip row on the homepage.
 */
function countProjectKinds(projects: readonly DetectedProject[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of projects) {
    if (p.isRoot) continue
    for (const k of p.kinds) out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Normalise a plugin's `marker` (string | string[]) to a string[]. */
function markersOf(plugin: AnalysisPlugin | undefined): string[] {
  const m = plugin?.projectKind?.marker
  if (m == null) return []
  return Array.isArray(m) ? m : [m]
}

function anyMarkerAt(dir: string, markers: readonly string[]): boolean {
  return markers.some((m) => existsSync(resolve(dir, m)))
}

/**
 * Walk up from `start` looking for a directory containing any of
 * `markers`. Returns the absolute path of the directory that owns one,
 * or null if no ancestor has it.
 */
function findProjectRoot(start: string, markers: readonly string[]): string | null {
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
async function findAncestorProjects(
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

// Resolve relative paths lazily against the *current* process cwd — not
// a value captured at module load. The @xomda/node dev/start scripts
// `cd ../..` to the workspace root before launching tsx (matching the
// pattern in @xomda/e2e-tests' start:app), so cwd is the user's project
// root by the time these handlers run.
function resolveAgainstCwd(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path)
}

/**
 * Apply the project's `plugins` filter (if any) to a feature list.
 * An empty / missing list means "no filter": the project has not
 * recorded a preference yet, so return everything that was detected.
 */
function filterByActivePlugins(
  features: DetectedFeature[],
  active: readonly string[] | undefined
): DetectedFeature[] {
  if (!active || active.length === 0) return features
  const allowed = new Set(active)
  return features.filter((f) => allowed.has(f.pluginId))
}

export const projectRouter = router({
  /**
   * Determine the project context for the given path (defaults to cwd):
   *   in-root      → the path itself contains the project marker
   *   in-subfolder → an ancestor contains the marker
   *   none         → no marker anywhere up the tree
   */
  context: publicProcedure
    .input(z.object({ path: z.string().default('.') }).default({ path: '.' }))
    .query(async ({ input }) => {
      const start = resolveAgainstCwd(input.path)
      const plugin = findProjectKindPlugin()
      const markers = markersOf(plugin)
      if (markers.length === 0) {
        return {
          kind: 'none' as const,
          cwdHasXomda: false,
          suggestions: { createHere: start },
          ancestorProjects: [] as AncestorProject[],
        }
      }

      const cwdHasXomda = anyMarkerAt(start, markers)
      if (cwdHasXomda) {
        // Even at a project root, the user may want to know about
        // surrounding parent projects — unless this project marked
        // itself as the boundary.
        const meta = await readProjectMeta(start)
        const ancestorProjects = meta?.settings.isRoot
          ? []
          : await findAncestorProjects(start, markers)
        return {
          kind: 'in-root' as const,
          projectRoot: start,
          cwdHasXomda: true,
          suggestions: {},
          ancestorProjects,
        }
      }
      const found = findProjectRoot(start, markers)
      if (found) {
        const meta = await readProjectMeta(found)
        const ancestorProjects = meta?.settings.isRoot
          ? []
          : await findAncestorProjects(found, markers)
        return {
          kind: 'in-subfolder' as const,
          projectRoot: found,
          cwdHasXomda: false,
          suggestions: { useFound: found, createHere: start },
          ancestorProjects,
        }
      }
      return {
        kind: 'none' as const,
        cwdHasXomda: false,
        suggestions: { createHere: start },
        ancestorProjects: [] as AncestorProject[],
      }
    }),

  /**
   * Read project.json for the given root. Returns null when the file
   * is absent (caller decides whether to surface "no project" UI).
   */
  meta: publicProcedure
    .input(z.object({ root: z.string().default('.') }).default({ root: '.' }))
    .query(({ input }) => readProjectMeta(resolveAgainstCwd(input.root))),

  /**
   * Write project.json. Re-parses through ProjectFileSchema so defaults
   * are materialized and unknown keys are preserved.
   */
  updateMeta: publicProcedure
    .input(
      z.object({
        root: z.string().default('.'),
        meta: ProjectFileSchema,
      })
    )
    .mutation(({ input }) => saveProjectMeta(input.meta, resolveAgainstCwd(input.root))),

  /**
   * Full background scan. Runs the analyzer in-process for now: spawning
   * a worker thread under tsx (dev) fails to resolve extensionless TS
   * imports because tsx's preflight does not propagate to workers. The
   * worker-thread plumbing in @xomda/analysis-core/worker.ts is kept for
   * when packages ship compiled `dist/` output; until then `runAnalysisInline`
   * is correct and fast enough (typical scan is well under one second).
   * The response also includes any nested subprojects discovered via the
   * xomda plugin's projectKind hook.
   */
  scan: publicProcedure
    .input(z.object({ root: z.string().default('.') }).default({ root: '.' }))
    .query(async ({ input }) => {
      const rootPath = resolveAgainstCwd(input.root)
      const meta = await readProjectMeta(rootPath)
      // The walker uses the project's excludeFromScan setting if present;
      // otherwise it falls back to the same defaults the schema injects.
      const excludeEntries = meta?.settings.excludeFromScan ?? [...DEFAULT_PROJECT_SCAN_EXCLUDES]
      const { basenames, paths, globs } = classifyExcludes(excludeEntries)
      const walkOptions: Omit<WalkOptions, 'rootPath'> = {
        excludes: basenames,
        excludePaths: paths,
        excludeGlobs: globs,
      }
      const result: AnalysisResult = await runAnalysisInline(rootPath, walkOptions)
      const plugin = findProjectKindPlugin()
      const subprojects = (await plugin?.projectKind?.hooks?.listSubprojects?.(rootPath)) ?? []
      const active = meta?.plugins
      // Detected pluginIds (raw, before filtering) for the settings UI.
      const detectedIds = result.features.map((f) => f.pluginId)
      const filtered = filterByActivePlugins(result.features, active)
      // `projects` is the generic, multi-kind list (every folder claimed
      // by any plugin's projectKind). `subprojects` is xomda-only and
      // remains for the homepage's xomda-actionable banners.
      const projectKinds = countProjectKinds(result.projects)
      return {
        ...result,
        features: filtered,
        subprojects,
        projects: result.projects,
        projectKinds,
        detectedIds,
      }
    }),

  /**
   * Per-folder project-kind lookup. The file browser calls this once
   * per visible directory entry to know whether a folder is a Node
   * package, Maven module, Gradle subproject, etc., so it can show a
   * JetBrains-style overlay icon. Each plugin gets one entry per
   * folder when any of its marker files exists.
   *
   * Cheap: just a handful of `existsSync` checks per folder. tRPC's
   * HTTP batching coalesces a folder listing into a single round trip.
   */
  kindsFor: publicProcedure
    .input(z.object({ path: z.string(), root: z.string().default('.') }))
    .query(({ input }) => {
      const abs = resolve(resolveAgainstCwd(input.root), input.path)
      const kinds: Array<{ pluginId: string; icon?: string }> = []
      for (const p of getProjectKindPlugins()) {
        if (anyMarkerAt(abs, markersOf(p))) {
          kinds.push({ pluginId: p.id, ...(p.icon !== undefined ? { icon: p.icon } : {}) })
        }
      }
      return { kinds }
    }),

  /**
   * Look up every FileTypeDescriptor across all registered plugins that
   * claims the given relative path, plus the highest-priority preview
   * hint. The file browser uses this to decide what icon(s) to show
   * and how to render the preview pane. Honors the project's plugins
   * filter — if active, only matches from enabled plugins are returned.
   */
  fileTypesFor: publicProcedure
    .input(z.object({ path: z.string(), root: z.string().default('.') }))
    .query(async ({ input }) => {
      const result = lookupAnalyzer.fileTypesFor(input.path)
      const meta = await readProjectMeta(resolveAgainstCwd(input.root))
      const active = meta?.plugins
      if (!active || active.length === 0) return result

      // Core plugins (binary, markdown, xomda — see isCorePlugin) are
      // always-on contributors of file-type semantics. Without this
      // bypass the user's filter would strip image/binary previews and
      // leave .png/.zip files trying to render as text.
      const coreIds = new Set(
        getRegisteredAnalysisPlugins()
          .filter(isCorePlugin)
          .map((p) => p.id)
      )
      const allowed = new Set([...active, ...coreIds])
      const matches = result.matches.filter((m) => allowed.has(m.pluginId))
      // Recompute preview hint from the surviving matches (highest priority).
      const best = matches
        .filter((m) => m.fileType.preview !== undefined)
        .sort((a, b) => (b.fileType.priority ?? 0) - (a.fileType.priority ?? 0))[0]
      return { matches, preview: best?.fileType.preview }
    }),

  /**
   * Re-run plugin detection across the project and persist the result
   * into `project.plugins` (sorted, deduped via the schema). The user
   * can edit the list afterwards via the Settings page.
   *
   * If project.json doesn't exist yet, it is created (name = folder
   * basename, default settings).
   */
  refreshPlugins: publicProcedure
    .input(z.object({ root: z.string().default('.') }).default({ root: '.' }))
    .mutation(async ({ input }) => {
      const rootPath = resolveAgainstCwd(input.root)
      try {
        const result = await runAnalysisInline(rootPath)
        const detectedIds = result.features.map((f) => f.pluginId)

        const existing = await readProjectMeta(rootPath)
        const next: ProjectFile = ProjectFileSchema.parse(
          existing
            ? { ...existing, plugins: detectedIds }
            : { name: 'project', plugins: detectedIds }
        )
        await saveProjectMeta(next, rootPath)
        return { detectedIds, plugins: next.plugins }
      } catch (err) {
        // Surface the cause so the 500 response carries actionable info
        // instead of an empty body. The previous worker-based path was
        // failing silently on tsx-loader issues.
        log.error(`refreshPlugins failed for ${rootPath}`, { data: err })
        throw err
      }
    }),

  /** List every plugin registered server-side (id + display name + core flag). */
  listPlugins: publicProcedure.query(() => lookupAnalyzer.listPlugins()),

  /**
   * User-initiated re-scan. Drops the analyzer's overview + view-data
   * caches before re-running the inline analysis so plugin contributions
   * are recomputed from scratch. The plain `scan` query also re-runs the
   * walker, but it doesn't bust the marker-mtime cache used by
   * `overviewFor` / `loadViewData` — which is exactly what the file-
   * browser toolbar's refresh button is here to do.
   */
  rescan: publicProcedure
    .input(z.object({ root: z.string().default('.') }).default({ root: '.' }))
    .mutation(async ({ input }) => {
      const rootPath = resolveAgainstCwd(input.root)
      lookupAnalyzer.clearCaches()
      const result: AnalysisResult = await runAnalysisInline(rootPath)
      return {
        analyzedAt: result.analyzedAt,
        detectedIds: result.features.map((f) => f.pluginId),
      }
    }),

  /**
   * Plugin-contributed project overview for `root` (defaults to cwd).
   * Aggregates `loadOverview` from every registered plugin and filters
   * by `project.plugins` allow-list (read from `xomdaRoot`, which
   * defaults to cwd — that's the user's outermost xomda project, which
   * owns the preference). Cached per-plugin by marker mtime inside the
   * analyzer.
   */
  overview: publicProcedure
    .input(
      z
        .object({ root: z.string().default('.'), xomdaRoot: z.string().default('.') })
        .default({ root: '.', xomdaRoot: '.' })
    )
    .query(async ({ input }): Promise<{ contributions: OverviewContribution[] }> => {
      const rootPath = resolveAgainstCwd(input.root)
      const meta = await readProjectMeta(resolveAgainstCwd(input.xomdaRoot))
      const active = meta?.plugins
      // No filter when the project hasn't recorded a preference; otherwise
      // honor the allow-list and always re-add core plugins (xomda,
      // binary, markdown — see isCorePlugin).
      const coreIds = new Set(
        getRegisteredAnalysisPlugins()
          .filter(isCorePlugin)
          .map((p) => p.id)
      )
      const enabled = !active || active.length === 0 ? undefined : new Set([...active, ...coreIds])
      const contributions = await lookupAnalyzer.overviewFor(rootPath, {
        ...(enabled ? { enabledPluginIds: enabled } : {}),
      })
      return { contributions }
    }),

  /**
   * Resolve every view contributed by every plugin claiming `path`.
   * The file browser uses this to decide whether to render a tab bar
   * above the preview (≥2 views) and what each tab's preview hint is.
   * Honors the `project.plugins` allow-list (core plugins bypassed,
   * same as `fileTypesFor`).
   */
  viewsFor: publicProcedure
    .input(z.object({ path: z.string(), root: z.string().default('.') }))
    .query(async ({ input }): Promise<{ views: ViewsForEntry[] }> => {
      const all = lookupAnalyzer.viewsFor(input.path)
      const meta = await readProjectMeta(resolveAgainstCwd(input.root))
      const active = meta?.plugins
      if (!active || active.length === 0) return { views: all }
      const coreIds = new Set(
        getRegisteredAnalysisPlugins()
          .filter(isCorePlugin)
          .map((p) => p.id)
      )
      const allowed = new Set([...active, ...coreIds])
      return { views: all.filter((e) => allowed.has(e.pluginId)) }
    }),

  /**
   * Run a specific plugin view's `loadViewData` for the given file.
   * Used by custom-component tabs (e.g. Maven POM "Info") to fetch
   * parsed/structured server-side data before rendering.
   */
  viewData: publicProcedure
    .input(
      z.object({
        pluginId: z.string(),
        fileTypeId: z.string(),
        viewId: z.string(),
        path: z.string(),
        root: z.string().default('.'),
      })
    )
    .query(async ({ input }): Promise<{ data: unknown }> => {
      const rootPath = resolveAgainstCwd(input.root)
      const data = await lookupAnalyzer.loadViewData(
        rootPath,
        input.pluginId,
        input.fileTypeId,
        input.viewId,
        input.path
      )
      return { data }
    }),

  /**
   * Bundle the cwd-resolved project and its nested xomda subprojects into
   * a single query response shaped for the workspace selector. Each entry
   * carries every model in the project (lightweight descriptors only —
   * the full model is loaded on demand via `model.get`).
   *
   * `isRoot: true` on a subproject denotes a workspace boundary — the
   * recursive walk does not descend into its children, mirroring the
   * existing `walkForSubprojects` semantics.
   */
  workspace: publicProcedure
    .input(z.object({ root: z.string().default('.') }).default({ root: '.' }))
    .query(async ({ input }): Promise<WorkspaceResponse> => {
      const rootPath = resolveAgainstCwd(input.root)
      const buildEntry = async (
        absRoot: string,
        fallbackName: string,
        isRootFlag: boolean | null = null
      ): Promise<WorkspaceProjectInfo> => {
        const meta = await readProjectMeta(absRoot).catch(() => null)
        const models = await listModelDescriptors(absRoot).catch(() => [])
        return {
          root: absRoot,
          name: meta?.name ?? fallbackName,
          isRoot: isRootFlag ?? meta?.settings.isRoot ?? false,
          ...(meta?.description !== undefined ? { description: meta.description } : {}),
          models,
        }
      }
      const workspaceEntry = await buildEntry(rootPath, rootPath.split(/[\\/]/).pop() ?? 'project')

      const plugin = findProjectKindPlugin()
      const rawSubs = (await plugin?.projectKind?.hooks?.listSubprojects?.(rootPath)) ?? []
      const subprojects = await Promise.all(
        rawSubs.map(async (s) => buildEntry(resolve(rootPath, s.path), s.name, s.isRoot))
      )
      return { workspace: workspaceEntry, subprojects }
    }),
})

export interface WorkspaceProjectInfo {
  /** Absolute path of the project root. */
  root: string
  /** Project name from project.json, or basename fallback. */
  name: string
  /** Whether this project's `settings.isRoot` is true (a workspace boundary). */
  isRoot: boolean
  description?: string
  models: Array<{
    id: string
    name: string
    version: string
    updatedAt?: string
    isPrimary: boolean
  }>
}

export interface WorkspaceResponse {
  workspace: WorkspaceProjectInfo
  subprojects: WorkspaceProjectInfo[]
}
