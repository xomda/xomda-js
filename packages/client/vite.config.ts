/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import { xomdaStylesPlugin } from 'unplugin-xomda/styles'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

import { xomdaPublishPlugin } from './vite-plugins/publish'

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test'
  const isPublishBuild = process.env.XOMDA_BUILD === 'publish'
  const port = Number(process.env.XOMDA_PORT ?? 6431)

  const diagramSrc = fileURLToPath(new URL('../diagram/src', import.meta.url))
  const uiSrc = fileURLToPath(new URL('../ui/src', import.meta.url))
  // Absolute path — vite-plugin-vuetify hands this to sass, whose cwd /
  // path resolution differs across platforms (Windows in particular fails
  // a relative `../ui/src/...` lookup with "system cannot find the file").
  const uiStylesSettings = fileURLToPath(new URL('../ui/src/styles/settings.scss', import.meta.url))

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
      ...(isTest
        ? []
        : [
            vuetify({
              autoImport: false,
              styles: { configFile: uiStylesSettings },
            }),
          ]),
      ...(isPublishBuild ? [xomdaPublishPlugin()] : []),
    ],
    resolve: {
      alias: {
        '@xomda/diagram': diagramSrc,
        // `@xomda/icons` is intentionally not aliased — it resolves via
        // the pnpm workspace symlink in `node_modules`, which makes it
        // eligible for `optimizeDeps` pre-bundling below.
        '@xomda/model': fileURLToPath(new URL('../model/src', import.meta.url)),
        '@xomda/template': fileURLToPath(new URL('../template/src/browser.ts', import.meta.url)),
        '@xomda/core': fileURLToPath(new URL('../core/src', import.meta.url)),
        '@xomda/ui': uiSrc,
      },
    },
    optimizeDeps: {
      // `@xomda/icons`' barrel re-exports ~15k Material Symbols. Without
      // pre-bundling, native-ESM linker semantics force the dev server
      // to fetch every re-export target file up-front — thousands of
      // HTTP requests on page load, painful HMR. Routing the package
      // through esbuild's pre-bundler collapses the barrel into a
      // single optimized module. Production builds still tree-shake via
      // Rollup, so the bundle stays minimal.
      include: ['@xomda/icons'],
    },
    build: {
      // Strip the source-derived name prefix from emitted bundle files so
      // chunks/entries/assets are content-addressed by hash alone (e.g.
      // `assets/CV2TBzgj.js` instead of `assets/AccountTreeOutlineIcon-CV2TBzgj.js`).
      // index.html references are rewritten by Vite automatically.
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[hash].js',
          chunkFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash][extname]',
        },
      },
    },
    worker: {
      // Apply the same hash-only naming to worker bundles (Monaco emits
      // 5 of them). Vite uses a separate Rolldown invocation for workers,
      // so the main `build.rollupOptions.output` config doesn't reach here.
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[hash].js',
          chunkFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash][extname]',
        },
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
      // setup-monaco-mock: globally stubs `@xomda/codeeditor`'s `./monaco`
      //   wrapper so no test loads real `monaco-editor` (whose lazy submodule
      //   imports race test-env teardown and flake the run under load).
      // setup-monaco-clipboard-filter: swallows Monaco's
      //   installWebKitWriteTextWorkaround inner-promise cancellation — see the
      //   file header for the full why. Kept as a belt-and-braces net.
      setupFiles: [
        './src/__tests__/setup-monaco-mock.ts',
        './src/__tests__/setup-monaco-clipboard-filter.ts',
      ],
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
