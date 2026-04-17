import type { AnalysisPlugin } from '@xomda/analysis-core'

export const vitePlugin: AnalysisPlugin = {
  id: 'vite',
  name: 'Vite',
  patterns: [
    {
      type: 'file-exists',
      paths: [
        'vite.config.js',
        'vite.config.ts',
        'vite.config.mjs',
        'vite.config.mts',
        'vite.config.cjs',
      ],
    },
  ],
}
