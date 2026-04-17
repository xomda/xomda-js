import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginViteIcon } from '@xomda/icons'

export const viteClient: AnalysisPluginClient = {
  id: 'vite',
  icon: PluginViteIcon,
}

registerAnalysisPluginClient(viteClient)
