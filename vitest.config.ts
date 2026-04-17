import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/analysis/binary/vitest.config.ts',
      'packages/analysis/client/vitest.config.ts',
      'packages/analysis/core/vitest.config.ts',
      'packages/analysis/plugins/vitest.config.ts',
      'packages/analysis/plugins-client/vitest.config.ts',
      'packages/analysis/xomda/vitest.config.ts',
      'packages/cli/vitest.config.ts',
      'packages/client/vite.config.ts',
      'packages/core/vitest.config.ts',
      'packages/diagram/vitest.config.ts',
      'packages/model/vitest.config.ts',
      'packages/node/vitest.config.ts',
      'packages/template/vitest.config.ts',
      'packages/ui/vite.config.ts',
      'packages/util/vitest.config.ts',
      'demo/blog/vitest.config.ts',
      'demo/springboot/vitest.config.ts',
      'integrations/node/unplugin/vitest.config.ts',
      'integrations/node/vscode/vitest.config.ts',
    ],
  },
})
