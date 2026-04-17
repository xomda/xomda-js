import type { AnalysisPlugin } from '@xomda/analysis-core'

// Visual Studio solution/project files are named after the project (e.g. MyApp.sln),
// so static path matching is insufficient — we scan the root directory instead.
export const visualStudioPlugin: AnalysisPlugin = {
  id: 'visual-studio',
  name: 'Visual Studio',
  detect: (ctx) => {
    const files = ctx.listFiles()
    return files.some(
      (f) => f.endsWith('.sln') || f.endsWith('.csproj') || f.endsWith('.vbproj')
    )
  },
}
