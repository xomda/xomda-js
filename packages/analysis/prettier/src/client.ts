import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginPrettierIcon } from '@xomda/icons'

export const prettierClient: AnalysisPluginClient = {
  id: 'prettier',
  icon: PluginPrettierIcon,
}

registerAnalysisPluginClient(prettierClient)
