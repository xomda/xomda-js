import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vueJsx(), dts({ tsconfigPath: './tsconfig.json', exclude: ['**/*.stories.*'] })],
  resolve: {
    alias: {
      '@xomda/icons': fileURLToPath(new URL('../icons/src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      name: 'XomdaDiagram',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
    },
    cssCodeSplit: false,
  },
})
