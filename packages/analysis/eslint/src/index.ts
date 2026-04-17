import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

const CONFIG_FILES = [
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
]

async function loadEslintOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const present = CONFIG_FILES.filter((f) => ctx.fileExists(f))
  if (present.length === 0) return null
  return {
    pluginId: 'eslint',
    pluginName: 'ESLint',
    icon: 'eslint',
    sections: [
      {
        id: 'detected',
        kind: 'status',
        title: 'ESLint',
        tone: 'success',
        label: 'Configured',
        sub: present.join(', '),
      },
    ],
  }
}

export const eslintPlugin: AnalysisPlugin = {
  id: 'eslint',
  name: 'ESLint',
  icon: 'eslint',
  patterns: [{ type: 'file-exists', paths: CONFIG_FILES }],
  fileTypes: [
    {
      id: 'eslint-config',
      label: 'ESLint config',
      match: { filenames: CONFIG_FILES },
      icon: 'eslint',
    },
  ],
  loadOverview: loadEslintOverview,
}

registerAnalysisPlugin(eslintPlugin)
