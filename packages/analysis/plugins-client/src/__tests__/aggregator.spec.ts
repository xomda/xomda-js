import '../index'

import {
  getRegisteredAnalysisPluginClients,
  resetAnalysisClientRegistry,
} from '@xomda/analysis-client'
import { describe, expect, it } from 'vitest'

const EXPECTED_PLUGIN_IDS = [
  'ant',
  'binary',
  'eslint',
  'gradle',
  'intellij',
  'markdown',
  'maven',
  'node',
  'prettier',
  'rust',
  'stylelint',
  'typescript',
  'visual-studio',
  'vite',
  'vscode',
  'webpack',
  'xomda',
]

describe('@xomda/analysis-plugins-client aggregator', () => {
  it('registers every plugin client on import', () => {
    const ids = getRegisteredAnalysisPluginClients().map((c) => c.id)
    for (const expected of EXPECTED_PLUGIN_IDS) {
      expect(ids).toContain(expected)
    }
  })

  it('every registered client has an icon', () => {
    for (const client of getRegisteredAnalysisPluginClients()) {
      expect(client.icon, `${client.id} missing icon`).toBeTruthy()
    }
  })

  it('does not double-register on re-import', async () => {
    const before = getRegisteredAnalysisPluginClients().length
    await import('../index')
    expect(getRegisteredAnalysisPluginClients().length).toBe(before)
  })

  it('reset clears the registry (sanity check)', () => {
    resetAnalysisClientRegistry()
    expect(getRegisteredAnalysisPluginClients()).toEqual([])
  })
})
