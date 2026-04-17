import type { AnalysisPlugin } from '@xomda/analysis-core'

export const webpackPlugin: AnalysisPlugin = {
  id: 'webpack',
  name: 'Webpack',
  patterns: [
    {
      type: 'file-exists',
      paths: [
        'webpack.config.js',
        'webpack.config.ts',
        'webpack.config.mjs',
        'webpack.config.cjs',
      ],
    },
  ],
}
