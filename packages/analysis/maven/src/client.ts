import { type AnalysisPluginClient, registerAnalysisPluginClient } from '@xomda/analysis-client'
import { PluginMavenIcon } from '@xomda/icons'

import { MavenPomInfoView } from './MavenPomInfoView'

export const mavenClient: AnalysisPluginClient = {
  id: 'maven',
  icon: PluginMavenIcon,
  previewComponents: {
    'maven-pom-info': MavenPomInfoView,
  },
}

registerAnalysisPluginClient(mavenClient)
