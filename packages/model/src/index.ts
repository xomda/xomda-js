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
