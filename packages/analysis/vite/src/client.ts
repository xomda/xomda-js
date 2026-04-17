import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginViteIcon } from '@xomda/icons'

export const viteClient: AnalysisPluginClient = {
  id: 'vite',
  icon: PluginViteIcon,
}

registerAnalysisPluginClient(viteClient)
