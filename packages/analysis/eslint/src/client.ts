import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginEslintIcon } from '@xomda/icons'

export const eslintClient: AnalysisPluginClient = {
  id: 'eslint',
  icon: PluginEslintIcon,
}

registerAnalysisPluginClient(eslintClient)
