import type { AnalysisPlugin } from '@xomda/analysis-core'

// Detects any JetBrains IDE project via the shared .idea directory
export const intellijPlugin: AnalysisPlugin = {
  id: 'intellij',
  name: 'IntelliJ / JetBrains IDE',
  patterns: [{ type: 'file-exists', paths: ['.idea'] }],
}
