import type { AnalysisPlugin } from '@xomda/analysis-core'

export const prettierPlugin: AnalysisPlugin = {
  id: 'prettier',
  name: 'Prettier',
  patterns: [
    {
      type: 'file-exists',
      paths: [
        '.prettierrc',
        '.prettierrc.json',
        '.prettierrc.yaml',
        '.prettierrc.yml',
        '.prettierrc.json5',
        '.prettierrc.js',
        '.prettierrc.mjs',
        '.prettierrc.cjs',
        'prettier.config.js',
        'prettier.config.mjs',
        'prettier.config.cjs',
        'prettier.config.ts',
        'prettier.config.mts',
      ],
    },
  ],
}
