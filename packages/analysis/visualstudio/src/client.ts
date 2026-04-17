import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginVisualStudioIcon } from '@xomda/icons'

export const visualStudioClient: AnalysisPluginClient = {
  id: 'visual-studio',
  icon: PluginVisualStudioIcon,
}

registerAnalysisPluginClient(visualStudioClient)
