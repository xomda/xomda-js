import type { Component } from 'vue'

/**
 * Client-side counterpart of an analysis plugin. The plugin id pairs
 * with the server-side `AnalysisPlugin.id`; the rest is everything the
 * browser needs to render features owned by this plugin (icon for chips
 * and file rows, optional custom preview components).
 *
 * Plugins live in their own packages and ship both halves:
 *   src/index.ts  → node-side (detection, fileTypes, projectKind)
 *   src/client.ts → registers an AnalysisPluginClient here
 */
export interface AnalysisPluginClient {
  /** Must match the server-side AnalysisPlugin.id. */
  id: string
  /**
   * Material-symbols-style icon SVG path, OR a logical name the host
   * resolves. Used in chips and file rows.
   */
  icon?: string
  /** Optional accent color (CSS color string) for the plugin chip. */
  color?: string
  /**
   * Custom preview components keyed by the `componentId` declared in a
   * server-side `PreviewHint { kind: 'custom', componentId }`. Lets a
   * plugin render its file types with a domain-specific viewer.
   *
   * Each component receives props { path: string; bytes?: Uint8Array; text?: string }.
   */
  previewComponents?: Record<string, Component>
}
