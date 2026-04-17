import type { AnalysisPlugin } from '@xomda/analysis-core'

export const eslintPlugin: AnalysisPlugin = {
  id: 'eslint',
  name: 'ESLint',
  patterns: [
    {
      type: 'file-exists',
      paths: [
        '.eslintrc',
        '.eslintrc.js',
        '.eslintrc.cjs',
        '.eslintrc.mjs',
        '.eslintrc.json',
        '.eslintrc.yaml',
        '.eslintrc.yml',
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.cjs',
        'eslint.config.ts',
        'eslint.config.mts',
      ],
    },
  ],
}
