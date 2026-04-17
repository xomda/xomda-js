import type { Component } from 'vue'

import type { AnalysisPluginClient } from './types'

const clients: AnalysisPluginClient[] = []

/**
 * Plugins call this at module top-level (from their `client.ts` entry)
 * so that importing the client aggregator wires every plugin's icon
 * and preview components without a central edit.
 */
export function registerAnalysisPluginClient(client: AnalysisPluginClient): void {
  if (clients.some((c) => c.id === client.id)) return
  clients.push(client)
}

export function getRegisteredAnalysisPluginClients(): AnalysisPluginClient[] {
  return [...clients]
}

/** Test-only — drop all registrations so each spec starts clean. */
export function resetAnalysisClientRegistry(): void {
  clients.length = 0
}

/** Look up a plugin client by id, or undefined if not registered. */
export function getAnalysisPluginClient(id: string): AnalysisPluginClient | undefined {
  return clients.find((c) => c.id === id)
}

/** Resolve the icon contributed by a plugin (string id from the manifest). */
export function getIconForPlugin(id: string): string | undefined {
  return getAnalysisPluginClient(id)?.icon
}

/** Resolve the accent color contributed by a plugin, if any. */
export function getColorForPlugin(id: string): string | undefined {
  return getAnalysisPluginClient(id)?.color
}

/**
 * Look up a custom preview component by its `componentId` (the value
 * declared in the server's `PreviewHint { kind: 'custom', componentId }`).
 * Searches across all registered plugins.
 */
export function getPreviewComponent(componentId: string): Component | undefined {
  for (const client of clients) {
    const c = client.previewComponents?.[componentId]
    if (c) return c
  }
  return undefined
}
