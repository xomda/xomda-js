import type { AnalysisPlugin } from '@xomda/analysis-core'

export const antPlugin: AnalysisPlugin = {
  id: 'ant',
  name: 'Apache Ant',
  patterns: [{ type: 'file-exists', paths: ['build.xml'] }],
}
