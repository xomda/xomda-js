export interface AnalysisContext {
  rootPath: string
  fileExists(relativePath: string): boolean
  readFile(relativePath: string): Promise<string | null>
  listFiles(relativePath?: string): string[]
}

export interface FileExistsPattern {
  type: 'file-exists'
  paths: string[]
}

export interface FileContentPattern {
  type: 'file-content'
  path: string
  match: string | RegExp
}

export type DetectionPattern = FileExistsPattern | FileContentPattern

/**
 * How the client should render a given file in the preview pane.
 * Resolved per file at lookup time (multiple plugins may claim a file —
 * the highest-priority FileTypeDescriptor's hint wins).
 */
export type PreviewHint =
  | { kind: 'text'; language?: string }
  | { kind: 'markdown' }
  | { kind: 'image' }
  | { kind: 'binary' }
  | { kind: 'custom'; componentId: string }

export interface FileTypeMatcher {
  extensions?: string[]
  filenames?: string[]
  pathGlobs?: string[]
}

/**
 * One renderable view of a file. Plugins may declare multiple views for
 * the same FileTypeDescriptor (e.g. pom.xml → Source + Info) and the
 * file browser renders a tab bar above the preview. A `loadViewData`
 * hook lets a custom-component view fetch structured data server-side
 * (parsed POM, dependency graph, etc.) before the client renders.
 */
export interface FileTypeView {
  id: string
  label: string
  icon?: string
  preview: PreviewHint
  /**
   * Server-side data loader for this view. Called via `project.viewData`
   * tRPC when the user opens the tab. Result is forwarded to the custom
   * Vue component (when preview.kind === 'custom') as its `data` prop.
   */
  loadViewData?: (ctx: AnalysisContext, relativePath: string) => Promise<unknown>
}

/**
 * One file shape a plugin claims (for icon, preview routing, labels).
 * Several plugins may match the same file — the host returns the full set
 * and renders all icons; preview routing picks the highest priority.
 *
 * Use `preview` for a single-view file (most file types). Use `views`
 * for a multi-tab file (Source + Info, Source + Rendered, …). The two
 * are mutually exclusive in practice; `preview` is auto-normalised by
 * the analyzer into a single-element views array so consumers see one
 * shape.
 */
export interface FileTypeDescriptor {
  id: string
  label: string
  match: FileTypeMatcher
  icon?: string
  preview?: PreviewHint
  views?: FileTypeView[]
  /** Higher wins ties when resolving preview. Default 0. */
  priority?: number
}

/**
 * Result returned by a plugin's optional `inspect` step. Carries
 * plugin-specific structured details about how the folder is laid out
 * (source roots, references, etc.).
 */
export interface PluginMatch {
  matched: true
  roots?: string[]
  details?: Record<string, unknown>
}

export interface ProjectKindMeta {
  name: string
  description?: string
}

export interface ProjectKindSubproject {
  path: string
  name: string
  /**
   * True when this subproject claims to be a workspace boundary itself
   * (e.g. project.json `settings.isRoot`). The host stops recursing
   * past it and the UI can render it as a leaf.
   */
  isRoot?: boolean
}

/**
 * Contributed by a plugin that owns a project kind (e.g. xomda owns
 * folders containing a `.xomda` directory). The host calls these hooks
 * to discover the project name and any nested subprojects.
 */
export interface ProjectKindContribution {
  /**
   * Marker file(s) or directory(ies) whose presence scopes the plugin's
   * ownership. A single string is shorthand for one marker; an array
   * means "any of these" (e.g. Gradle accepts both `build.gradle` and
   * `build.gradle.kts`).
   */
  marker: string | string[]
  /** Read project metadata for the UI (name, description). */
  loadMeta?: (root: string) => Promise<ProjectKindMeta | null>
  hooks?: {
    listSubprojects?: (root: string) => Promise<ProjectKindSubproject[]>
  }
}

// ─── Project overview ────────────────────────────────────────────────────

/**
 * Structured insight contributed by a plugin for a detected project
 * root. Rendered in the home page and file-browser center pane when the
 * user selects a project folder. Read-only; no editing path.
 */
export type OverviewSection =
  | {
      id: string
      kind: 'key-value'
      title: string
      icon?: string
      rows: Array<{ key: string; value: string; href?: string }>
    }
  | {
      id: string
      kind: 'table'
      title: string
      icon?: string
      columns: string[]
      rows: string[][]
    }
  | {
      id: string
      kind: 'list'
      title: string
      icon?: string
      items: Array<{ label: string; icon?: string; sub?: string }>
    }
  | {
      id: string
      kind: 'status'
      title: string
      icon?: string
      tone: 'success' | 'info' | 'warning' | 'error'
      label: string
      sub?: string
    }
  | {
      id: string
      kind: 'custom'
      title: string
      icon?: string
      /** Resolved against the client-side `previewComponents` registry. */
      componentId: string
      data?: unknown
    }

export interface OverviewContribution {
  pluginId: string
  pluginName: string
  icon?: string
  sections: OverviewSection[]
}

export interface AnalysisPlugin {
  id: string
  name: string
  /** Headline icon used in chips and lists. */
  icon?: string
  patterns?: DetectionPattern[]
  detect?: (context: AnalysisContext) => boolean | PromiseLike<boolean>
  /** Optional richer detect returning structured details. */
  inspect?: (context: AnalysisContext) => Promise<PluginMatch | null>
  /** File shapes this plugin claims (icons, preview hints). */
  fileTypes?: FileTypeDescriptor[]
  /** Set when the plugin owns a project kind (xomda, maven, npm, …). */
  projectKind?: ProjectKindContribution
  /**
   * Contribute structured insights for a detected project root. Called
   * by `ProjectAnalyzer.overviewFor`. Return null to opt out for this
   * project (e.g. when the plugin's marker isn't present). Plugins
   * without a `projectKind` may still contribute (e.g. typescript,
   * eslint) — useful for cross-cutting tooling sections.
   */
  loadOverview?: (context: AnalysisContext) => Promise<OverviewContribution | null>
  /**
   * Core plugins contribute file-type semantics, project-kind detection,
   * and overview sections unconditionally — the user's project.plugins
   * allow-list never strips them. Reserved for plugins that provide
   * platform-essential behavior (the xomda plugin owns the `.xomda`
   * marker; binary/markdown provide always-on preview fallbacks). The
   * Settings UI renders them with a locked switch.
   */
  core?: boolean
}

export interface DetectedFeature {
  pluginId: string
  name: string
  icon?: string
  fileTypes?: FileTypeDescriptor[]
  match?: PluginMatch
}

/**
 * A folder claimed by one or more plugins via their `projectKind`. The
 * walker emits one entry per distinct folder, with every matching
 * `pluginId` aggregated into `kinds` (e.g. a folder with both
 * `package.json` and `pom.xml` produces `kinds: ['node', 'maven']`).
 */
export interface DetectedProject {
  /** Project-relative POSIX path. '.' when this is the rootPath itself. */
  path: string
  name: string
  /** Plugin ids whose projectKind marker exists at `path`. */
  kinds: string[]
  /** True when this is the rootPath. */
  isRoot?: boolean
}

export interface AnalysisResult {
  rootPath: string
  features: DetectedFeature[]
  /**
   * Every folder at or below `rootPath` claimed by a plugin's
   * `projectKind`. Empty when no plugin defines a `projectKind`.
   */
  projects: DetectedProject[]
  analyzedAt: string
}
