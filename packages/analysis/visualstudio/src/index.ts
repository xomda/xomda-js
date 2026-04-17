import { type AnalysisPlugin, registerAnalysisPlugin } from '@xomda/analysis-core'

// Visual Studio solution/project files are named after the project (e.g. MyApp.sln),
// so static path matching is insufficient — we scan the root directory instead.
export const visualStudioPlugin: AnalysisPlugin = {
  id: 'visual-studio',
  name: 'Visual Studio',
  icon: 'visualstudio',
  detect: (ctx) =>
    ctx
      .listFiles()
      .some((f) => f.endsWith('.sln') || f.endsWith('.csproj') || f.endsWith('.vbproj')),
  fileTypes: [
    {
      id: 'vs-solution',
      label: 'VS solution',
      match: { pathGlobs: ['**/*.sln'] },
      icon: 'visualstudio',
    },
    {
      id: 'vs-project',
      label: 'VS project',
      match: { pathGlobs: ['**/*.csproj', '**/*.vbproj'] },
      icon: 'visualstudio',
      preview: { kind: 'text', language: 'xml' },
      priority: 20,
    },
    {
      id: 'cs',
      label: 'C# source',
      match: { extensions: ['cs'] },
      icon: 'visualstudio',
      preview: { kind: 'text', language: 'csharp' },
      priority: 10,
    },
  ],
}

registerAnalysisPlugin(visualStudioPlugin)
