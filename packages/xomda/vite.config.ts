import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'

const SHEBANG = '#!/usr/bin/env node\n'

function shebangPlugin(): Plugin {
  return {
    name: 'xomda-bundle-shebang',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? resolve(import.meta.dirname ?? '.', 'dist')
      const cliPath = resolve(outDir, 'cli.js')
      const original = readFileSync(cliPath, 'utf8')
      if (!original.startsWith(SHEBANG)) {
        writeFileSync(cliPath, SHEBANG + original)
      }
      chmodSync(cliPath, 0o755)
    },
  }
}

export default defineConfig({
  // Types: emitted separately by the build script via `tsc --emitDeclarationOnly`
  // (vite-plugin-dts v5 hit rootDir errors with workspace path-mapped imports;
  // a direct tsc pass writing to dist/types is simpler and gets us the same
  // .d.ts output).
  plugins: [shebangPlugin()],
  resolve: {
    alias: {
      '@xomda/cli': fileURLToPath(new URL('../cli/src', import.meta.url)),
      '@xomda/core': fileURLToPath(new URL('../core/src', import.meta.url)),
      '@xomda/model': fileURLToPath(new URL('../model/src', import.meta.url)),
      '@xomda/node': fileURLToPath(new URL('../node/src', import.meta.url)),
      '@xomda/template': fileURLToPath(new URL('../template/src', import.meta.url)),
      '@xomda/util': fileURLToPath(new URL('../util/src', import.meta.url)),
      '@xomda/analysis-core': fileURLToPath(new URL('../analysis/core/src', import.meta.url)),
      '@xomda/analysis-plugins': fileURLToPath(new URL('../analysis/plugins/src', import.meta.url)),
    },
  },
  build: {
    target: 'node22',
    lib: {
      entry: fileURLToPath(new URL('src/bin.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'cli.js',
    },
    rollupOptions: {
      // Node-side externals — kept out of the bundle and listed as runtime
      // dependencies of the published `xomda` package.json. Everything else
      // (including all @xomda/* workspace packages) is inlined. All `node:*`
      // built-ins stay external.
      external: [/^node:/, /^@trpc\//, 'commander'],
      output: {
        // Bundle into a single cli.js — no chunk splitting for a CLI entry.
        inlineDynamicImports: true,
      },
    },
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
  },
})
