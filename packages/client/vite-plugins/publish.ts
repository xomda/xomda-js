import { createRequire } from 'node:module'
import { dirname } from 'node:path'

import type { Plugin } from 'vite'

import { PUBLISH_EXTERNALS } from './externals'

const require = createRequire(import.meta.url)

/**
 * Activated when `XOMDA_BUILD=publish` is set.
 *
 * Externalizes packages listed in `PUBLISH_EXTERNALS` so the SPA bundle stops
 * inlining their code. Injects a `<script type="importmap">` into `index.html`
 * pointing each bare specifier at `/vendor/<pkg>/<entry>`. Emits a sibling
 * `vendor.manifest.json` that the runtime server reads to map `/vendor/*`
 * requests back to absolute files inside its own `node_modules`.
 *
 * The publish plugin is a no-op when `PUBLISH_EXTERNALS` is empty; the rails
 * stay quiet until step 4 starts populating it.
 */
export function xomdaPublishPlugin(): Plugin {
  const externals = [...PUBLISH_EXTERNALS]

  return {
    name: 'xomda-publish',
    apply: 'build',
    enforce: 'pre',
    config(config) {
      if (externals.length === 0) return
      config.build ??= {}
      config.build.rollupOptions ??= {}
      const existing = config.build.rollupOptions.external
      const existingArr = Array.isArray(existing) ? existing : existing ? [existing as never] : []
      config.build.rollupOptions.external = [...new Set([...existingArr, ...externals])]
    },
    transformIndexHtml(html) {
      if (externals.length === 0) return html
      const imports = buildImportMap(externals)
      const tag = `<script type="importmap">${JSON.stringify({ imports }, null, 2)}</script>`
      return html.replace('</head>', `  ${tag}\n  </head>`)
    },
    generateBundle() {
      const manifest = buildVendorManifest(externals)
      this.emitFile({
        type: 'asset',
        fileName: 'vendor.manifest.json',
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}

function buildImportMap(externals: readonly string[]): Record<string, string> {
  const imports: Record<string, string> = {}
  for (const pkg of externals) {
    const entry = resolvePackageEntry(pkg)
    imports[pkg] = `/vendor/${pkg}/${entry}`
    imports[`${pkg}/`] = `/vendor/${pkg}/`
  }
  return imports
}

function buildVendorManifest(externals: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pkg of externals) {
    out[pkg] = dirname(require.resolve(`${pkg}/package.json`))
  }
  return out
}

/**
 * Resolve a package's preferred ESM entry relative to its own root, so the
 * importmap URL is `/vendor/<pkg>/<relative-entry>`. Falls back to the bare
 * package name (which the import map's trailing-slash entry will resolve
 * against the package root) if no main field is present.
 */
function resolvePackageEntry(pkg: string): string {
  const pkgRoot = dirname(require.resolve(`${pkg}/package.json`))
  const absMain = require.resolve(pkg)
  const rel = absMain.startsWith(pkgRoot)
    ? absMain
        .slice(pkgRoot.length + 1)
        .split('\\')
        .join('/')
    : 'index.js'
  return rel
}
