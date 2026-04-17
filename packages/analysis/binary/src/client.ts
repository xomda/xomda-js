import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { BufferIcon } from '@xomda/icons'

export const binaryClient: AnalysisPluginClient = {
  id: 'binary',
  icon: BufferIcon,
}

registerAnalysisPluginClient(binaryClient)
