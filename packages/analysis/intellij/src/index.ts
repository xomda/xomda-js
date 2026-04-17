import { type AnalysisPlugin, registerAnalysisPlugin } from '@xomda/analysis-core'

// Detects any JetBrains IDE project via the shared .idea directory.
export const intellijPlugin: AnalysisPlugin = {
  id: 'intellij',
  name: 'IntelliJ / JetBrains IDE',
  icon: 'intellij',
  patterns: [{ type: 'file-exists', paths: ['.idea'] }],
}

registerAnalysisPlugin(intellijPlugin)
