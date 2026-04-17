import type { AnalysisPlugin } from './types'

const plugins: AnalysisPlugin[] = []

/**
 * Plugins call this at module top-level so adding a plugin only requires
 * importing its package (typically via @xomda/analysis-plugins).
 */
export function registerAnalysisPlugin(plugin: AnalysisPlugin): void {
  if (plugins.some((p) => p.id === plugin.id)) return
  plugins.push(plugin)
}

export function getRegisteredAnalysisPlugins(): AnalysisPlugin[] {
  return [...plugins]
}

/** Test-only: drop all registrations so each spec starts clean. */
export function resetAnalysisRegistry(): void {
  plugins.length = 0
}
