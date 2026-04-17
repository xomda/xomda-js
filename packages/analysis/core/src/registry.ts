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

/**
 * True when a plugin is always-on: either it explicitly opts in via the
 * `core: true` flag, or it contributes only baseline file-type semantics
 * (no `detect`, no `patterns`) so it would never appear as a "detected"
 * feature and therefore never end up in `project.plugins`. Used by the
 * model router so the user's allow-list can't accidentally strip these.
 */
export function isCorePlugin(p: AnalysisPlugin): boolean {
  if (p.core === true) return true
  return !p.detect && (!p.patterns || p.patterns.length === 0)
}
