import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginXomdaIcon } from '@xomda/icons'

export const xomdaClient: AnalysisPluginClient = {
  id: 'xomda',
  icon: PluginXomdaIcon,
}

registerAnalysisPluginClient(xomdaClient)
