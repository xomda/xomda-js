/**
 * `@xomda/model` exposes the tRPC router (the package's reason to exist)
 * plus the deep entry points for `./router`, `./sandbox`, and `./storage`.
 *
 * Schemas, types, and pure helpers (`getEffectiveAttributes`,
 * `bumpVersion`, `MODEL_FILE`, …) live in `@xomda/core`. They used to be
 * re-exported from here as a convenience, which tempted consumers to
 * import schemas from `@xomda/model` instead of the canonical source —
 * violating AGENTS.md §11 ("Schemas live in `@xomda/core`"). Re-exports
 * removed in the §H7 cleanup; consumers import from `@xomda/core`
 * directly.
 */
export type { AppRouter } from './router/index'
// Workspace-selector output shapes — re-exported so client-side consumers
// (Pinia store, WorkspaceSelector component) can type their state without
// pulling `@trpc/server` for `inferRouterOutputs`. The router is the
// authoritative source; these types stay in lock-step via TS structural
// equality (the procedure return type IS this interface).
export type {
  AncestorProject,
  WorkspaceProjectInfo,
  WorkspaceResponse,
} from './router/project.router'

// ─── Project graph (Phase F) ────────────────────────────────────────────────
// Visibility-aware multi-project / multi-model resolver. Used by router
// procedures and codegen helpers; consumers prepare a `FromContext` to
// identify the calling model/package, then look up by id or name.
export type { FromContext } from './projectGraph/find'
export { findByNameInProjectGraph, findInProjectGraph } from './projectGraph/find'
export type {
  IndexEntry,
  LoadProjectGraphOptions,
  ProjectGraph,
  ProjectGraphWarning,
  ProjectNode,
} from './projectGraph/loader'
export { loadProjectGraph } from './projectGraph/loader'
export type { ParentProjectRejectionReason, ParentProjectResolution } from './projectGraph/security'
export { resolveParentProject } from './projectGraph/security'
export type { CrossModelValidationResult, CrossModelViolation } from './projectGraph/validate'
export { validateModelAgainstGraph } from './projectGraph/validate'
