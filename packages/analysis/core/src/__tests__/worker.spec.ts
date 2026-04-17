import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { registerAnalysisPlugin, resetAnalysisRegistry } from '../registry'
import { runAnalysisInline } from '../worker'

describe('runAnalysisInline', () => {
  let root: string

  beforeEach(async () => {
    resetAnalysisRegistry()
    root = await mkdtemp(join(tmpdir(), 'xomda-worker-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('uses the registry to populate the analyzer', async () => {
    registerAnalysisPlugin({
      id: 'demo',
      name: 'Demo',
      patterns: [{ type: 'file-exists', paths: ['marker'] }],
    })
    await writeFile(join(root, 'marker'), '')
    const result = await runAnalysisInline(root)
    expect(result.features.map((f) => f.pluginId)).toEqual(['demo'])
    expect(result.rootPath).toBe(root)
  })

  it('returns no features when nothing matches', async () => {
    registerAnalysisPlugin({
      id: 'never',
      name: 'Never',
      patterns: [{ type: 'file-exists', paths: ['absent'] }],
    })
    const result = await runAnalysisInline(root)
    expect(result.features).toEqual([])
  })
})
