import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.spec.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
