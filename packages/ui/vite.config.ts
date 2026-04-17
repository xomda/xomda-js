import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vueJsx(), dts({ tsconfigPath: './tsconfig.json', exclude: ['**/*.stories.*'] })],
  resolve: {
    alias: {
      '@xomda/codeeditor': fileURLToPath(new URL('../codeeditor/src', import.meta.url)),
      // `@xomda/icons` is intentionally not aliased — it resolves via
      // the pnpm workspace symlink in `node_modules`, which makes it
      // eligible for `optimizeDeps` pre-bundling below.
      '@xomda/model': fileURLToPath(new URL('../model/src', import.meta.url)),
      '@xomda/util': fileURLToPath(new URL('../util/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // `@xomda/icons`' barrel re-exports ~15k Material Symbols. Without
    // pre-bundling, Storybook's Vite dev server would fetch every
    // re-export target file up-front when any story imports from it.
    // Pre-bundling collapses the barrel into a single optimized module.
    include: ['@xomda/icons'],
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      name: 'XomdaUi',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'pinia', /^vuetify/],
    },
    cssCodeSplit: false,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    css: true,
    include: ['src/**/__tests__/**/*.{spec,spec-d}.{ts,tsx}'],
    server: {
      deps: {
        inline: [/vuetify/],
      },
    },
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
