import type { AnalysisPlugin } from '@xomda/analysis-core'

export const xomdaPlugin: AnalysisPlugin = {
  id: 'xomda',
  name: 'xomda Project',
  patterns: [{ type: 'file-exists', paths: ['.xomda'] }],
}
