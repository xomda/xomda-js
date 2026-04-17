import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

const CONFIG_FILES = [
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
]

async function loadPrettierOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const present = CONFIG_FILES.filter((f) => ctx.fileExists(f))
  if (present.length === 0) return null
  return {
    pluginId: 'prettier',
    pluginName: 'Prettier',
    icon: 'prettier',
    sections: [
      {
        id: 'detected',
        kind: 'status',
        title: 'Prettier',
        tone: 'success',
        label: 'Configured',
        sub: present.join(', '),
      },
    ],
  }
}

export const prettierPlugin: AnalysisPlugin = {
  id: 'prettier',
  name: 'Prettier',
  icon: 'prettier',
  patterns: [{ type: 'file-exists', paths: CONFIG_FILES }],
  fileTypes: [
    {
      id: 'prettier-config',
      label: 'Prettier config',
      match: { filenames: CONFIG_FILES },
      icon: 'prettier',
    },
  ],
  loadOverview: loadPrettierOverview,
}

registerAnalysisPlugin(prettierPlugin)
