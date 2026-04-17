import { fileURLToPath } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vitest/config'

// Two test environments under one config:
//   - node specs (src/__tests__/**) cover the generated source-text shape
//     and runtime Zod parsing of the emitted schemas
//   - happy-dom specs (src/app/**/__tests__/**) mount the Vue SPA components
//     against the generated `AuthorSchema`
//
// `@generated` resolves to `output/target/src/schemas/` so app code can
// `import { PostSchema } from '@generated/PostSchema'` without knowing the
// generator's on-disk layout. `globalSetup` writes that tree before any
// project starts so both environments see populated files.
const generatedAlias = {
  '@generated': fileURLToPath(new URL('output/target/src/schemas', import.meta.url)),
}

export default defineConfig({
  plugins: [vueJsx()],
  resolve: { alias: generatedAlias },
  test: {
    testTimeout: 30_000,
    globalSetup: fileURLToPath(new URL('scripts/vitest-setup.ts', import.meta.url)),
    projects: [
      {
        plugins: [vueJsx()],
        resolve: { alias: generatedAlias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/__tests__/**/*.spec.ts'],
        },
      },
      {
        plugins: [vueJsx()],
        resolve: { alias: generatedAlias },
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/app/**/__tests__/**/*.spec.{ts,tsx}'],
        },
      },
    ],
  },
})
