import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import {
  getAnalysisPluginClient,
  getIconForPlugin,
  getPreviewComponent,
  getRegisteredAnalysisPluginClients,
  registerAnalysisPluginClient,
  resetAnalysisClientRegistry,
} from '../registry'

const ICON_TS = 'M0 0 L1 1'

describe('analysis client registry', () => {
  beforeEach(() => {
    resetAnalysisClientRegistry()
  })

  it('starts empty', () => {
    expect(getRegisteredAnalysisPluginClients()).toEqual([])
  })

  it('registers clients in order', () => {
    registerAnalysisPluginClient({ id: 'a' })
    registerAnalysisPluginClient({ id: 'b' })
    expect(getRegisteredAnalysisPluginClients().map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('is idempotent on duplicate ids (first wins)', () => {
    registerAnalysisPluginClient({ id: 'a', icon: 'first' })
    registerAnalysisPluginClient({ id: 'a', icon: 'second' })
    expect(getRegisteredAnalysisPluginClients()).toHaveLength(1)
    expect(getIconForPlugin('a')).toBe('first')
  })

  it('returns a snapshot copy from getRegisteredAnalysisPluginClients', () => {
    registerAnalysisPluginClient({ id: 'a' })
    const snap = getRegisteredAnalysisPluginClients()
    snap.push({ id: 'rogue' })
    expect(getRegisteredAnalysisPluginClients().map((c) => c.id)).toEqual(['a'])
  })

  it('getAnalysisPluginClient finds by id', () => {
    registerAnalysisPluginClient({ id: 'typescript', icon: ICON_TS })
    expect(getAnalysisPluginClient('typescript')?.icon).toBe(ICON_TS)
    expect(getAnalysisPluginClient('absent')).toBeUndefined()
  })

  it('getIconForPlugin returns the icon or undefined', () => {
    registerAnalysisPluginClient({ id: 'typescript', icon: ICON_TS })
    registerAnalysisPluginClient({ id: 'no-icon' })
    expect(getIconForPlugin('typescript')).toBe(ICON_TS)
    expect(getIconForPlugin('no-icon')).toBeUndefined()
    expect(getIconForPlugin('absent')).toBeUndefined()
  })

  it('getPreviewComponent finds a component across plugins', () => {
    const A = defineComponent({ name: 'A', setup: () => () => h('div', 'a') })
    const B = defineComponent({ name: 'B', setup: () => () => h('div', 'b') })
    registerAnalysisPluginClient({ id: 'p1', previewComponents: { 'xomda-model-view': A } })
    registerAnalysisPluginClient({ id: 'p2', previewComponents: { 'xomda-template-view': B } })
    expect(getPreviewComponent('xomda-model-view')).toBe(A)
    expect(getPreviewComponent('xomda-template-view')).toBe(B)
    expect(getPreviewComponent('unknown')).toBeUndefined()
  })

  it('reset clears all', () => {
    registerAnalysisPluginClient({ id: 'a' })
    resetAnalysisClientRegistry()
    expect(getRegisteredAnalysisPluginClients()).toEqual([])
  })
})
