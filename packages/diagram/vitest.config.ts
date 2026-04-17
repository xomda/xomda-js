import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vueJsx()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.spec.{ts,tsx}'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
