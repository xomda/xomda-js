import { posix, sep } from 'node:path'

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

/**
 * During dev, replace the bundled `<pkg>/style.css` export of workspace
 * packages with an empty CSS stub. Each package's components import their
 * own scoped CSS modules at the call site, so the bundled stylesheet is
 * only needed for production library builds.
 */
export const xomdaStylesPlugin = (options: XomdaStylesPluginOptions): Plugin => {
  const stubId = '\0xomda:empty-styles.css'
  const ids = new Set<string>()
  for (const [name, srcDir] of Object.entries(options.packages)) {
    ids.add(`${name}/style.css`)
    const normalized = srcDir.split(sep).join(posix.sep)
    ids.add(posix.join(normalized, 'style.css'))
  }

  return {
    name: 'xomda:workspace-styles',
    apply: 'serve',
    enforce: 'pre',
    resolveId(source) {
      if (ids.has(source)) return stubId
    },
    load(id) {
      if (id === stubId) return ''
    },
  }
}
