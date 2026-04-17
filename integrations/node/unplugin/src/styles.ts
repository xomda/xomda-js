import { posix } from 'node:path'

import type { Plugin } from 'vite'

export interface XomdaStylesPluginOptions {
  /**
   * Map of workspace package name → absolute path of the package's `src/`
   * directory (i.e. the target of the `resolve.alias` entry for that
   * package). The plugin intercepts both the bare specifier
   * `<name>/style.css` and the post-alias path `<srcDir>/style.css`.
   */
  packages: Readonly<Record<string, string>>
}

/** Normalize backslashes to forward slashes so Windows-native paths match
 *  the same id set as posix paths. Idempotent on already-posix input. */
const toPosix = (p: string): string => (p.includes('\\') ? p.split('\\').join('/') : p)

/**
 * Replace the bundled `<pkg>/style.css` export of workspace packages with
 * an empty CSS stub. Each package's components import their own scoped CSS
 * modules at the call site, so the bundled stylesheet is unnecessary when
 * consumers alias workspace packages to their `src/` directories.
 */
export const xomdaStylesPlugin = (options: XomdaStylesPluginOptions): Plugin => {
  const stubId = '\0xomda:empty-styles.css'
  const ids = new Set<string>()
  for (const [name, srcDir] of Object.entries(options.packages)) {
    ids.add(`${name}/style.css`)
    // Always normalize to posix here too — srcDir may arrive with native
    // backslashes (Windows) regardless of which platform's `sep` is in play.
    ids.add(posix.join(toPosix(srcDir), 'style.css'))
  }

  return {
    name: 'xomda:workspace-styles',
    enforce: 'pre',
    resolveId(source) {
      // Vite's aliaser hands us native-separator paths after rewriting
      // `@xomda/<pkg>` → `<srcDir>`. On Windows that means backslashes,
      // which don't match the posix-normalized entries in `ids`.
      // Normalize both ways so the check is platform-agnostic.
      if (ids.has(source) || ids.has(toPosix(source))) return stubId
      return undefined
    },
    load(id) {
      if (id === stubId) return ''
      return undefined
    },
  }
}
