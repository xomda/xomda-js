import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginGradleIcon } from '@xomda/icons'

export const gradleClient: AnalysisPluginClient = {
  id: 'gradle',
  icon: PluginGradleIcon,
}

registerAnalysisPluginClient(gradleClient)
