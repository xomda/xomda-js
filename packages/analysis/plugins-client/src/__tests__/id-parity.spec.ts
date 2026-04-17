import '@xomda/analysis-plugins'
import '../index'

import {
  getRegisteredAnalysisPluginClients,
  resetAnalysisClientRegistry,
} from '@xomda/analysis-client'
import { getRegisteredAnalysisPlugins, resetAnalysisRegistry } from '@xomda/analysis-core'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * The node side and client side of every plugin must register under
 * the exact same id. A mismatch silently breaks icon lookups (the
 * client manifest will never be reached for a given feature). This
 * spec enforces parity across both registries.
 */
describe('node ↔ client id parity', () => {
  beforeAll(() => {
    // The imports above already populated both registries; nothing to do.
  })

  it('every node plugin has a client counterpart with the same id', () => {
    const nodeIds = new Set(getRegisteredAnalysisPlugins().map((p) => p.id))
    const clientIds = new Set(getRegisteredAnalysisPluginClients().map((c) => c.id))
    const missingClient = [...nodeIds].filter((id) => !clientIds.has(id))
    expect(missingClient).toEqual([])
  })

  it('every client plugin has a node counterpart with the same id', () => {
    const nodeIds = new Set(getRegisteredAnalysisPlugins().map((p) => p.id))
    const clientIds = new Set(getRegisteredAnalysisPluginClients().map((c) => c.id))
    const orphans = [...clientIds].filter((id) => !nodeIds.has(id))
    expect(orphans).toEqual([])
  })

  it('every registered client provides an icon', () => {
    for (const client of getRegisteredAnalysisPluginClients()) {
      expect(client.icon, `${client.id} missing icon`).toBeTruthy()
    }
  })

  // Ensure later specs can still rely on isolation if they reset.
  it('reset utilities clear both registries independently', () => {
    resetAnalysisRegistry()
    resetAnalysisClientRegistry()
    expect(getRegisteredAnalysisPlugins()).toEqual([])
    expect(getRegisteredAnalysisPluginClients()).toEqual([])
  })
})
