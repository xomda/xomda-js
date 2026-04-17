import type { AnalysisPlugin } from '@xomda/analysis-core'

export const typescriptPlugin: AnalysisPlugin = {
  id: 'typescript',
  name: 'TypeScript',
  patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
}
