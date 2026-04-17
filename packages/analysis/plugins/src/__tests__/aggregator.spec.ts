import '../index'

import { getRegisteredAnalysisPlugins, resetAnalysisRegistry } from '@xomda/analysis-core'
import { describe, expect, it } from 'vitest'

const EXPECTED_PLUGIN_IDS = [
  'ant',
  'binary',
  'eslint',
  'gradle',
  'intellij',
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

describe('@xomda/analysis-plugins aggregator', () => {
  it('registers every workspace plugin on import', () => {
    const ids = getRegisteredAnalysisPlugins().map((p) => p.id)
    for (const expected of EXPECTED_PLUGIN_IDS) {
      expect(ids).toContain(expected)
    }
  })

  it('does not double-register on re-import', async () => {
    const before = getRegisteredAnalysisPlugins().length
    await import('../index')
    expect(getRegisteredAnalysisPlugins().length).toBe(before)
  })

  it('reset clears the registry (sanity check)', () => {
    resetAnalysisRegistry()
    expect(getRegisteredAnalysisPlugins()).toEqual([])
  })
})
