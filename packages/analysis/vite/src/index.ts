import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

const CONFIG_FILES = [
  'vite.config.js',
  'vite.config.ts',
  'vite.config.mjs',
  'vite.config.mts',
  'vite.config.cjs',
]

async function loadViteOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const present = CONFIG_FILES.filter((f) => ctx.fileExists(f))
  if (present.length === 0) return null
  return {
    pluginId: 'vite',
    pluginName: 'Vite',
    icon: 'vite',
    sections: [
      {
        id: 'detected',
        kind: 'status',
        title: 'Vite',
        tone: 'success',
        label: 'Configured',
        sub: present.join(', '),
      },
    ],
  }
}

export const vitePlugin: AnalysisPlugin = {
  id: 'vite',
  name: 'Vite',
  icon: 'vite',
  patterns: [{ type: 'file-exists', paths: CONFIG_FILES }],
  fileTypes: [
    {
      id: 'vite-config',
      label: 'Vite config',
      match: { pathGlobs: ['vite.config.*'] },
      icon: 'vite',
      preview: { kind: 'text', language: 'typescript' },
      priority: 30,
    },
    {
      // Overlay only — no preview hint, so TypeScript/JS plugins still own
      // preview routing. Vite contributes the second icon shown next to
      // the TS icon in the file browser.
      id: 'vite-source-overlay',
      label: 'Vite',
      match: { extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'] },
      icon: 'vite',
    },
  ],
  loadOverview: loadViteOverview,
}

registerAnalysisPlugin(vitePlugin)
