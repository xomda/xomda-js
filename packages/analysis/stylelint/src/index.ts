import type { AnalysisPlugin } from '@xomda/analysis-core'

export const stylelintPlugin: AnalysisPlugin = {
  id: 'stylelint',
  name: 'Stylelint',
  patterns: [
    {
      type: 'file-exists',
      paths: [
        '.stylelintrc',
        '.stylelintrc.json',
        '.stylelintrc.yaml',
        '.stylelintrc.yml',
        '.stylelintrc.js',
        '.stylelintrc.cjs',
        '.stylelintrc.mjs',
        'stylelint.config.js',
        'stylelint.config.cjs',
        'stylelint.config.mjs',
        'stylelint.config.ts',
        'stylelint.config.mts',
      ],
    },
  ],
}
