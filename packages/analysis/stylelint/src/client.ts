import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginStylelintIcon } from '@xomda/icons'

export const stylelintClient: AnalysisPluginClient = {
  id: 'stylelint',
  icon: PluginStylelintIcon,
}

registerAnalysisPluginClient(stylelintClient)
