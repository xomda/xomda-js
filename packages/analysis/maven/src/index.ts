import type { AnalysisPlugin } from '@xomda/analysis-core'

export const mavenPlugin: AnalysisPlugin = {
  id: 'maven',
  name: 'Apache Maven',
  patterns: [{ type: 'file-exists', paths: ['pom.xml'] }],
}
