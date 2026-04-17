// Loaded via `vite --configLoader runner` (set in package.json scripts).
// Default `bundle` loader externalises workspace deps and hands them to
// Node's native ESM resolver, which can't follow `@xomda/cli` and
// `unplugin-xomda`'s extensionless TS imports (their `"main"` points at
// `src/index.ts`, not a built `.js`). `runner` uses vite-node, which
// handles TS resolution natively.
import { fileURLToPath } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { XomdaPlugin } from 'unplugin-xomda'
import { defineConfig } from 'vite'

const demoRoot = fileURLToPath(new URL('.', import.meta.url))

// The xomda Vite plugin owns regenerate-on-change: edit `.xomda/model.json`
// (or run `pnpm model` to rebuild it from `scripts/build-model.ts`) and the
// dev server rerenders templates without a manual `pnpm generate`. Output
// lands under `output/` so the SPA can resolve `@generated/*` from there.
export default defineConfig({
  root: fileURLToPath(new URL('src/app', import.meta.url)),
  plugins: [XomdaPlugin.vite({ root: demoRoot, output: 'output', mode: 'always' }), vueJsx()],
  resolve: {
    alias: {
      '@generated': fileURLToPath(new URL('output/target/src/schemas', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('dist', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})
