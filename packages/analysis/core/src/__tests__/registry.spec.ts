import { beforeEach, describe, expect, it } from 'vitest'

import {
  getRegisteredAnalysisPlugins,
  registerAnalysisPlugin,
  resetAnalysisRegistry,
} from '../registry'

describe('analysis plugin registry', () => {
  beforeEach(() => {
    resetAnalysisRegistry()
  })

  it('starts empty', () => {
    expect(getRegisteredAnalysisPlugins()).toEqual([])
  })

  it('registers plugins in order', () => {
    registerAnalysisPlugin({ id: 'a', name: 'A' })
    registerAnalysisPlugin({ id: 'b', name: 'B' })
    expect(getRegisteredAnalysisPlugins().map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('returns a snapshot copy (mutations do not leak in)', () => {
    registerAnalysisPlugin({ id: 'a', name: 'A' })
    const snapshot = getRegisteredAnalysisPlugins()
    snapshot.push({ id: 'rogue', name: 'rogue' })
    expect(getRegisteredAnalysisPlugins().map((p) => p.id)).toEqual(['a'])
  })

  it('is idempotent for duplicate ids', () => {
    registerAnalysisPlugin({ id: 'a', name: 'A' })
    registerAnalysisPlugin({ id: 'a', name: 'A (dup)' })
    expect(getRegisteredAnalysisPlugins()).toHaveLength(1)
    expect(getRegisteredAnalysisPlugins()[0].name).toBe('A')
  })

  it('reset clears all', () => {
    registerAnalysisPlugin({ id: 'a', name: 'A' })
    resetAnalysisRegistry()
    expect(getRegisteredAnalysisPlugins()).toEqual([])
  })
})
