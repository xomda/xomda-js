/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'

// Frontend root: `src/`. Generated TS DTOs land in `src/generated/` from
// the parent demo's `xomda generate` run (see ../package.json scripts).
// In dev, the Vite dev server proxies `/api/**` to the Spring Boot backend
// on :8080; in tests we mount components against the generated types
// without needing a live backend.
export default defineConfig({
  root: fileURLToPath(new URL('src', import.meta.url)),
  plugins: [vueJsx()],
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: fileURLToPath(new URL('dist', import.meta.url)),
    emptyOutDir: true,
  },
})
