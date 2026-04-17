import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginRustIcon } from '@xomda/icons'

export const rustClient: AnalysisPluginClient = {
  id: 'rust',
  icon: PluginRustIcon,
}

registerAnalysisPluginClient(rustClient)
