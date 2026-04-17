import { generate } from '@xomda/cli'
import { createUnplugin } from 'unplugin'

export interface XomdaPluginOptions {
  /** Project root containing .xomda/ and templates. Defaults to process.cwd(). */
  root?: string
  /** Directory (relative to root) to write generated files into. Defaults to root. */
  output?: string
  /**
   * When to run generation:
   * - 'build' (default): once at build start
   * - 'serve': on every file change in watch mode
   * - 'always': both build start and on changes
   */
  mode?: 'build' | 'serve' | 'always'
}

export const XomdaPlugin = createUnplugin((options?: XomdaPluginOptions) => {
  const opts = options ?? {}
  const root = opts.root ?? process.cwd()
  const mode = opts.mode ?? 'build'

  async function run(trigger: 'build' | 'change') {
    if (trigger === 'build' && mode === 'serve') return
    if (trigger === 'change' && mode === 'build') return
    try {
      const results = await generate(root, { outputDir: opts.output })
      if (results.length > 0) {
        console.log(`[xomda] Generated ${results.length} file(s)`)
      }
    } catch (err) {
      console.error('[xomda] Generation failed:', err instanceof Error ? err.message : String(err))
    }
  }

  return {
    name: 'xomda',

    async buildStart() {
      await run('build')
    },

    watchChange(id: string) {
      // Re-generate when model or template files change
      if (id.includes('.xomda') || id.endsWith('.template.json')) {
        void run('change')
      }
    },
  }
})

export const vitePlugin = XomdaPlugin.vite
export const rollupPlugin = XomdaPlugin.rollup
export const webpackPlugin = XomdaPlugin.webpack
export const rspackPlugin = XomdaPlugin.rspack
export const esbuildPlugin = XomdaPlugin.esbuild
