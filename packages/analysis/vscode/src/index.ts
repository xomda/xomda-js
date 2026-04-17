import { type AnalysisPlugin, registerAnalysisPlugin } from '@xomda/analysis-core'

export const vscodePlugin: AnalysisPlugin = {
  id: 'vscode',
  name: 'VS Code',
  icon: 'vscode',
  patterns: [{ type: 'file-exists', paths: ['.vscode'] }],
}

registerAnalysisPlugin(vscodePlugin)
