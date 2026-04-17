import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginTypeScriptIcon } from '@xomda/icons'

export const typescriptClient: AnalysisPluginClient = {
  id: 'typescript',
  icon: PluginTypeScriptIcon,
}

registerAnalysisPluginClient(typescriptClient)
