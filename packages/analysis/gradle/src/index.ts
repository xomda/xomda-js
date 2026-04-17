import type { AnalysisPlugin } from '@xomda/analysis-core'

export const gradlePlugin: AnalysisPlugin = {
  id: 'gradle',
  name: 'Gradle',
  patterns: [
    {
      type: 'file-exists',
      paths: [
        'build.gradle',
        'build.gradle.kts',
        'settings.gradle',
        'settings.gradle.kts',
      ],
    },
  ],
}
