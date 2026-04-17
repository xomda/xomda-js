import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
    testTimeout: 120_000,
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
