import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

const CONFIG_FILES = [
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
]

async function loadStylelintOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const present = CONFIG_FILES.filter((f) => ctx.fileExists(f))
  if (present.length === 0) return null
  return {
    pluginId: 'stylelint',
    pluginName: 'Stylelint',
    icon: 'stylelint',
    sections: [
      {
        id: 'detected',
        kind: 'status',
        title: 'Stylelint',
        tone: 'success',
        label: 'Configured',
        sub: present.join(', '),
      },
    ],
  }
}

export const stylelintPlugin: AnalysisPlugin = {
  id: 'stylelint',
  name: 'Stylelint',
  icon: 'stylelint',
  patterns: [{ type: 'file-exists', paths: CONFIG_FILES }],
  fileTypes: [
    {
      id: 'stylelint-config',
      label: 'Stylelint config',
      match: { filenames: CONFIG_FILES },
      icon: 'stylelint',
    },
  ],
  loadOverview: loadStylelintOverview,
}

registerAnalysisPlugin(stylelintPlugin)
