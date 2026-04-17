import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginIntellijIcon } from '@xomda/icons'

export const intellijClient: AnalysisPluginClient = {
  id: 'intellij',
  icon: PluginIntellijIcon,
}

registerAnalysisPluginClient(intellijClient)
