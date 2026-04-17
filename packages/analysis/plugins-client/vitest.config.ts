import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vitest/config'

/**
 * Vuetify's component modules import their own `.css` files for the
 * normal Vite bundle. In Vitest we don't render anything; we just want
 * the analysis plugin registry to populate. Stub every `.css` import
 * with an empty module so loading Maven/Node plugin halves (which now
 * pull in `vuetify/components`) succeeds.
 */
const cssStub = {
  name: 'css-stub',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id.endsWith('.css')) return '\0empty-css'
    return null
  },
  load(id: string) {
    if (id === '\0empty-css') return 'export default {}'
    return null
  },
}

export default defineConfig({
  plugins: [cssStub, vueJsx()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.spec.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
  },
})
