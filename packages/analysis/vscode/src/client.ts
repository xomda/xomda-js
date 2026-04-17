import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginVscodeIcon } from '@xomda/icons'

export const vscodeClient: AnalysisPluginClient = {
  id: 'vscode',
  icon: PluginVscodeIcon,
}

registerAnalysisPluginClient(vscodeClient)
