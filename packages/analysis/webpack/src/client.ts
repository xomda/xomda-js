import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginWebpackIcon } from '@xomda/icons'

export const webpackClient: AnalysisPluginClient = {
  id: 'webpack',
  icon: PluginWebpackIcon,
}

registerAnalysisPluginClient(webpackClient)
