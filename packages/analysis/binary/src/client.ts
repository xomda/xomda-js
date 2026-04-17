import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginBinaryIcon } from '@xomda/icons'

export const binaryClient: AnalysisPluginClient = {
  id: 'binary',
  icon: PluginBinaryIcon,
}

registerAnalysisPluginClient(binaryClient)
