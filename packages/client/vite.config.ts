/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig(() => {
  const port = 3000

  return {
    plugins: [
      vueJsx(),
      vuetify({
        autoImport: false,
        styles: {
          configFile: './src/styles/settings.scss',
        },
      }),
    ],
    resolve: {
      alias: {
        '@xomda/diagram/style.css': fileURLToPath(
          new URL('../diagram/dist/index.css', import.meta.url)
        ),
        '@xomda/diagram': fileURLToPath(new URL('../diagram/src', import.meta.url)),
        '@xomda/icons': fileURLToPath(new URL('../icons/src', import.meta.url)),
        '@xomda/model': fileURLToPath(new URL('../model/src', import.meta.url)),
        '@xomda/template': fileURLToPath(new URL('../template/src/browser.ts', import.meta.url)),
        '@xomda/core': fileURLToPath(new URL('../core/src', import.meta.url)),
        '@xomda/ui': fileURLToPath(new URL('../ui/src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/trpc': {
          target: `http://localhost:${port}`,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'happy-dom',
      css: true,
      server: {
        deps: {
          inline: [/vuetify/],
        },
      },
      include: ['src/**/__tests__/**/*.{spec,spec-d}.{ts,tsx}'],
      typecheck: {
        tsconfig: './tsconfig.test.json',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.ts', 'src/**/__tests__/**'],
      },
    },
  }
})
