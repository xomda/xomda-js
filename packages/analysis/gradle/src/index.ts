import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  type OverviewSection,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

const BUILD_FILES = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']

async function findIncludedSubprojects(ctx: AnalysisContext): Promise<string[]> {
  // settings.gradle{,.kts} → look for include 'a:b:c' / include(":a:b")
  for (const settingsFile of ['settings.gradle.kts', 'settings.gradle']) {
    const raw = await ctx.readFile(settingsFile)
    if (raw == null) continue
    const out = new Set<string>()
    const re = /include\s*\(?\s*['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) out.add(m[1])
    return [...out]
  }
  return []
}

async function loadGradleOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  // Detect at least one Gradle file.
  const present = BUILD_FILES.filter((f) => ctx.fileExists(f))
  if (present.length === 0) return null

  const subs = await findIncludedSubprojects(ctx)
  const sections: OverviewSection[] = [
    {
      id: 'detected',
      kind: 'status',
      title: 'Gradle',
      tone: 'success',
      label: `${present.length} build file${present.length === 1 ? '' : 's'}`,
      sub: present.join(', '),
    },
  ]
  if (subs.length > 0) {
    sections.push({
      id: 'modules',
      kind: 'list',
      title: 'Included subprojects',
      items: subs.map((label) => ({ label })),
    })
  }
  return { pluginId: 'gradle', pluginName: 'Gradle', icon: 'gradle', sections }
}

export const gradlePlugin: AnalysisPlugin = {
  id: 'gradle',
  name: 'Gradle',
  icon: 'gradle',
  patterns: [{ type: 'file-exists', paths: BUILD_FILES }],
  fileTypes: [
    {
      id: 'gradle-build',
      label: 'Gradle build',
      match: { filenames: BUILD_FILES },
      icon: 'gradle',
      preview: { kind: 'text', language: 'groovy' },
      priority: 20,
    },
  ],
  // No loadMeta: Gradle's module name lives in `settings.gradle[.kts]`
  // and parsing it (Groovy or Kotlin DSL) is non-trivial. Fall back to
  // the folder basename, which is what the walker uses by default.
  projectKind: {
    marker: BUILD_FILES,
  },
  loadOverview: loadGradleOverview,
}

registerAnalysisPlugin(gradlePlugin)
