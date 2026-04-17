import { flushPromises, mount } from '@vue/test-utils'
import { registerAnalysisPluginClient, resetAnalysisClientRegistry } from '@xomda/analysis-client'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createVuetify } from 'vuetify'

import { PluginsCard } from '../PluginsCard'
import type { PluginInfo } from '../usePreferencesEditor'
import { createTestEditor, provideHost } from './testEditor'

const vuetify = createVuetify()
const TS_ICON = 'M1 1 L2 2'
const VITE_ICON = 'M3 3 L4 4'

const mountCard = (
  overrides: {
    allPlugins?: PluginInfo[]
    detectedPlugins?: string[]
    plugins?: string[]
  } = {}
) => {
  const { editor, spies } = createTestEditor({
    allPlugins: overrides.allPlugins,
    detectedPlugins: overrides.detectedPlugins,
    draft: { plugins: overrides.plugins ?? [] },
    initial: { plugins: overrides.plugins ?? [] },
  })
  const Host = provideHost(editor, () => h(PluginsCard))
  const wrapper = mount(Host, { global: { plugins: [vuetify, createPinia()] } })
  return { wrapper, editor, spies }
}

beforeEach(() => {
  resetAnalysisClientRegistry()
  registerAnalysisPluginClient({ id: 'typescript', icon: TS_ICON })
  registerAnalysisPluginClient({ id: 'vite', icon: VITE_ICON })
})

afterEach(() => {
  resetAnalysisClientRegistry()
})

describe('PluginsCard', () => {
  it('lists every plugin from the editor, sorted by name', () => {
    const { wrapper } = mountCard({
      allPlugins: [
        { id: 'vite', name: 'Vite', core: false },
        { id: 'typescript', name: 'TypeScript', core: false },
      ],
      detectedPlugins: ['typescript'],
      plugins: ['typescript'],
    })
    const titles = wrapper.findAllComponents({ name: 'VListItem' }).map((w) => w.text())
    // Alphabetical: TypeScript before Vite
    expect(titles[0]).toContain('TypeScript')
    expect(titles[1]).toContain('Vite')
  })

  it('shows the detected / not detected caption under each plugin', () => {
    const { wrapper } = mountCard({
      allPlugins: [
        { id: 'typescript', name: 'TypeScript', core: false },
        { id: 'vite', name: 'Vite', core: false },
      ],
      detectedPlugins: ['typescript'],
      plugins: [],
    })
    const text = wrapper.text()
    expect(text).toContain('Detected in this project')
    expect(text).toContain('Not detected')
  })

  it('toggling a switch off mutates the editor draft into an explicit list', async () => {
    const { wrapper, editor } = mountCard({
      allPlugins: [
        { id: 'typescript', name: 'TypeScript', core: false },
        { id: 'vite', name: 'Vite', core: false },
      ],
      detectedPlugins: ['typescript', 'vite'],
      // Empty list = "no filter": both switches render as on. Turning Vite off
      // must materialise the implicit list before removing Vite from it.
      plugins: [],
    })

    const switches = wrapper.findAllComponents({ name: 'VSwitch' })
    expect(switches).toHaveLength(2)
    const viteSwitch = switches[1]
    viteSwitch.vm.$emit('update:modelValue', false)
    await flushPromises()

    expect(editor.draft.value.plugins).toEqual(['typescript'])
  })

  it('clicking "Auto-detect" delegates to the editor', async () => {
    const { wrapper, spies } = mountCard({
      allPlugins: [{ id: 'typescript', name: 'TypeScript', core: false }],
      plugins: [],
    })
    const refreshBtn = wrapper.findAllComponents({ name: 'VBtn' })[0]
    await refreshBtn.trigger('click')
    await flushPromises()
    expect(spies.refreshPluginsAutoDetect).toHaveBeenCalledTimes(1)
  })

  it('shows every plugin enabled when the draft plugin list is empty', () => {
    const { wrapper } = mountCard({
      allPlugins: [
        { id: 'typescript', name: 'TypeScript', core: false },
        { id: 'vite', name: 'Vite', core: false },
      ],
      plugins: [],
    })
    const switches = wrapper.findAllComponents({ name: 'VSwitch' })
    expect(switches).toHaveLength(2)
    for (const s of switches) expect(s.props('modelValue')).toBe(true)
  })

  it('throws a helpful error if rendered without a provider', () => {
    // Sanity check on the contract: the card injects required context.
    expect(() => mount(PluginsCard, { global: { plugins: [vuetify, createPinia()] } })).toThrow(
      /usePreferencesContext/
    )
  })
})
