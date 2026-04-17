import type { AnalysisPlugin } from '@xomda/analysis-core'
import { registerAnalysisPlugin } from '@xomda/analysis-core'

export const vscodePlugin: AnalysisPlugin = {
  id: 'vscode',
  name: 'VS Code',
  icon: 'vscode',
  patterns: [{ type: 'file-exists', paths: ['.vscode'] }],
}

registerAnalysisPlugin(vscodePlugin)
