import { defineConfig } from 'vitest/config'

/**
 * Root vitest config — the `projects` array lists every per-package
 * config so editor Vitest extensions (VS Code, JetBrains) can discover
 * the full suite. Without it, the IDE loads tests against this empty
 * root config and `.tsx` test files fail to transform because no Vite
 * plugin (e.g. `@vitejs/plugin-vue-jsx`) is wired here.
 *
 * The CLI runs tests via `pnpm -r test` (declared in root
 * package.json#scripts.test), which walks every workspace package with
 * a `test` script — so this list and `pnpm test` are independent
 * coverage paths. A `dependency-direction`-style spec would be the
 * right way to gate this list against `find packages -name vitest.config.ts`;
 * for now it's hand-kept.
 */
export default defineConfig({
  test: {
    projects: [
      'integrations/node/unplugin/vitest.config.ts',
      'integrations/node/vscode/vitest.config.ts',
      'packages/analysis/binary/vitest.config.ts',
      'packages/analysis/client/vitest.config.ts',
      'packages/analysis/core/vitest.config.ts',
      'packages/analysis/markdown/vitest.config.ts',
      'packages/analysis/maven/vitest.config.ts',
      'packages/analysis/node/vitest.config.ts',
      'packages/analysis/plugins-client/vitest.config.ts',
      'packages/analysis/plugins/vitest.config.ts',
      'packages/analysis/typescript/vitest.config.ts',
      'packages/analysis/vite/vitest.config.ts',
      'packages/analysis/xomda/vitest.config.ts',
      'packages/cli/vitest.config.ts',
      'packages/client/vite.config.ts',
      'packages/core/vitest.config.ts',
      'packages/diagram/vitest.config.ts',
      'packages/e2e-tests/vitest.config.ts',
      'packages/icons/vitest.config.ts',
      'packages/model/vitest.config.ts',
      'packages/node/vitest.config.ts',
      'packages/template/vitest.config.ts',
      'packages/ui/vite.config.ts',
      'packages/util/vitest.config.ts',
      'packages/xomda/vitest.config.ts',
    ],
  },
})
