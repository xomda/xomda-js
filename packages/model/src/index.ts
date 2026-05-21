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
export type { WorkspaceProjectInfo, WorkspaceResponse } from './router/project.router'
