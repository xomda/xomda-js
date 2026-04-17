import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests for the sandbox builder live alongside the source under
    // `sandbox/`. Cypress specs live under `cypress/e2e/**` and are
    // intentionally excluded here.
    include: ['sandbox/**/__tests__/**/*.spec.ts'],
  },
})
