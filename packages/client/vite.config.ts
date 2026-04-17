/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { xomdaStylesPlugin } from '@xomda/unplugin/styles'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test'
  const port = Number(process.env.XOMDA_PORT ?? 6431)

  const diagramSrc = fileURLToPath(new URL('../diagram/src', import.meta.url))
  const uiSrc = fileURLToPath(new URL('../ui/src', import.meta.url))

  return {
    plugins: [
      vueJsx(),
      xomdaStylesPlugin({
        packages: {
          '@xomda/diagram': diagramSrc,
          '@xomda/ui': uiSrc,
        },
      }),
      // vite-plugin-vuetify's loader-shared resolves `vuetify/package.json` from
      // process.cwd(), which fails when Vitest loads this config from the workspace
      // root (e.g. the VS Code Vitest extension). Tests don't need this plugin.
      ...(isTest ? [] : [vuetify({ autoImport: false, styles: { configFile: './src/styles/settings.scss' } })]),
    ],
    resolve: {
      alias: {
        '@xomda/diagram': diagramSrc,
        '@xomda/icons': fileURLToPath(new URL('../icons/src', import.meta.url)),
        '@xomda/model': fileURLToPath(new URL('../model/src', import.meta.url)),
        '@xomda/template': fileURLToPath(new URL('../template/src/browser.ts', import.meta.url)),
        '@xomda/core': fileURLToPath(new URL('../core/src', import.meta.url)),
        '@xomda/ui': uiSrc,
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
        provider: 'v8' as const,
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.ts', 'src/**/__tests__/**'],
      },
    },
  }
})
