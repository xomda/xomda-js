import type { AnalysisPluginClient } from '@xomda/analysis-client'
import { registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginMarkdownIcon } from '@xomda/icons'

import { MarkdownPreview } from './MarkdownPreview'

export const markdownClient: AnalysisPluginClient = {
  id: 'markdown',
  icon: PluginMarkdownIcon,
  previewComponents: {
    'markdown-rendered': MarkdownPreview,
  },
}

registerAnalysisPluginClient(markdownClient)
