import { type AnalysisPlugin, registerAnalysisPlugin } from '@xomda/analysis-core'

export const antPlugin: AnalysisPlugin = {
  id: 'ant',
  name: 'Apache Ant',
  icon: 'ant',
  patterns: [{ type: 'file-exists', paths: ['build.xml'] }],
  fileTypes: [
    {
      id: 'ant-build',
      label: 'Ant build',
      match: { filenames: ['build.xml'] },
      icon: 'ant',
      preview: { kind: 'text', language: 'xml' },
      priority: 20,
    },
  ],
}

registerAnalysisPlugin(antPlugin)
