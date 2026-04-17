import type { AnalysisPlugin } from '@xomda/analysis-core'

export const vscodePlugin: AnalysisPlugin = {
  id: 'vscode',
  name: 'VS Code',
  patterns: [{ type: 'file-exists', paths: ['.vscode'] }],
}
