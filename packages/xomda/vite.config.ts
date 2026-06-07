import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

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
      // Two entries: the CLI bin (`dist/cli.js`, referenced by `bin.xomda` in
      // package.template.json) and the public API barrel (`dist/index.js`,
      // referenced by the `.` export). Vite's lib `entry` accepts a record;
      // each key becomes the emitted file's base name via `fileName`.
      entry: {
        cli: fileURLToPath(new URL('src/bin.ts', import.meta.url)),
        index: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      // Node-side externals — kept out of the bundle and listed as runtime
      // dependencies of the published `xomda` package.json. Everything else
      // (including all @xomda/* workspace packages) is inlined. All `node:*`
      // built-ins stay external.
      // picocolors is externalized (not inlined) because Vite 8's default
      // "client" build environment honors picocolors' legacy `browser`
      // package.json field and would substitute the no-op stub (every color
      // becomes `String`), stripping all CLI color output. Keeping it as a
      // runtime dep sidesteps the resolution and is ~2 KB on disk.
      external: [/^node:/, /^@trpc\//, 'commander', 'picocolors'],
      // Two entries (`cli.js` + `index.js`) means Rollup may hoist shared code
      // into chunk files alongside them. That's fine — the whole `dist/` ships
      // together in the tarball. We don't need `inlineDynamicImports` (which
      // forbids multiple entries anyway).
    },
    emptyOutDir: true,
    sourcemap: false,
    // esbuild minifier — preserves ESM `import … from "external"` statements
    // (externals listed above stay as bare specifiers so Node resolves them at
    // runtime) while mangling and dead-code-eliminating the inlined workspace
    // code. Trims the shipped CLI/index bundles substantially.
    minify: 'esbuild',
  },
})
