import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginAntIcon } from '@xomda/icons'

export const antClient: AnalysisPluginClient = {
  id: 'ant',
  icon: PluginAntIcon,
}

registerAnalysisPluginClient(antClient)
