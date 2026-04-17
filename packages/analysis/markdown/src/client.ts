import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginMarkdownIcon } from '@xomda/icons'

export const markdownClient: AnalysisPluginClient = {
  id: 'markdown',
  icon: PluginMarkdownIcon,
}

registerAnalysisPluginClient(markdownClient)
