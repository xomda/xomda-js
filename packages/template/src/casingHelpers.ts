// The canonical casing helpers live in @xomda/util. This re-export
// is a backward-compatibility shim — the template engine and its
// downstream consumers (helpers.ts, processors/utils.ts) continue to
// import from this path while the move settles. Prefer importing
// `casingHelpers` from `@xomda/util` in new code.
export type { CasingHelpers } from '@xomda/util'
export { casingHelpers } from '@xomda/util'
