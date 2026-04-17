import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginNodeIcon } from '@xomda/icons'

import { NodePackageInfoView } from './NodePackageInfoView'

export const nodeClient: AnalysisPluginClient = {
  id: 'node',
  icon: PluginNodeIcon,
  previewComponents: {
    'node-package-info': NodePackageInfoView,
  },
}

registerAnalysisPluginClient(nodeClient)
