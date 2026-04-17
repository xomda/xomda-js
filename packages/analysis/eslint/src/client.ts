import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginEslintIcon } from '@xomda/icons'

export const eslintClient: AnalysisPluginClient = {
  id: 'eslint',
  icon: PluginEslintIcon,
}

registerAnalysisPluginClient(eslintClient)
