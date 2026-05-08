import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/analysis/core/vitest.config.ts',
      'packages/client/vite.config.ts',
      'packages/core/vitest.config.ts',
      'packages/diagram/vitest.config.ts',
      'packages/model/vitest.config.ts',
      'packages/node/vitest.config.ts',
      'packages/template/vitest.config.ts',
      'packages/ui/vite.config.ts',
    ],
  },
})
