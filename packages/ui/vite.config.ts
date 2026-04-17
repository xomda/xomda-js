import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vueJsx(), dts({ tsconfigPath: './tsconfig.json' })],
  resolve: {
    alias: {
      '@xomda/codeeditor': fileURLToPath(new URL('../codeeditor/src', import.meta.url)),
      '@xomda/icons': fileURLToPath(new URL('../icons/src', import.meta.url)),
      '@xomda/model': fileURLToPath(new URL('../model/src', import.meta.url)),
    },
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
