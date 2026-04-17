import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginIntellijIcon } from '@xomda/icons'

export const intellijClient: AnalysisPluginClient = {
  id: 'intellij',
  icon: PluginIntellijIcon,
}

registerAnalysisPluginClient(intellijClient)
