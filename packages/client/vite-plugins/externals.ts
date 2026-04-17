/**
 * Packages externalized from the SPA bundle when `XOMDA_BUILD=publish`.
 *
 * Source of truth — consumed by:
 *   1. `xomdaPublishPlugin` in this folder — feeds rollup `external`, builds the
 *      `<script type="importmap">`, emits `vendor.manifest.json`.
 *   2. The bundled `xomda` package's published `dependencies` (so npm/pnpm pulls
 *      them into the user's node_modules where the runtime server can resolve them).
 *
 * Keep these in sync — every entry here must be a runtime dependency of the
 * published `xomda` package, and removing one without un-listing it in the
 * published `package.json` will break the SPA at runtime.
 *
 * Step 3 ships the rails empty; later steps populate the list.
 */
export const PUBLISH_EXTERNALS = ['lodash-es'] as const satisfies readonly string[]
