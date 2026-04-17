import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

const CONFIG_FILES = [
  'webpack.config.js',
  'webpack.config.ts',
  'webpack.config.mjs',
  'webpack.config.cjs',
]

async function loadWebpackOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const present = CONFIG_FILES.filter((f) => ctx.fileExists(f))
  if (present.length === 0) return null
  return {
    pluginId: 'webpack',
    pluginName: 'Webpack',
    icon: 'webpack',
    sections: [
      {
        id: 'detected',
        kind: 'status',
        title: 'Webpack',
        tone: 'success',
        label: 'Configured',
        sub: present.join(', '),
      },
    ],
  }
}

export const webpackPlugin: AnalysisPlugin = {
  id: 'webpack',
  name: 'Webpack',
  icon: 'webpack',
  patterns: [{ type: 'file-exists', paths: CONFIG_FILES }],
  fileTypes: [
    {
      id: 'webpack-config',
      label: 'Webpack config',
      match: { filenames: CONFIG_FILES },
      icon: 'webpack',
    },
  ],
  loadOverview: loadWebpackOverview,
}

registerAnalysisPlugin(webpackPlugin)
