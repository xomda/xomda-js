import { flushPromises, mount } from '@vue/test-utils'
import { registerAnalysisPluginClient, resetAnalysisClientRegistry } from '@xomda/analysis-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

interface MockProjectMeta {
  name: string
  description?: string
  versions: { head: null; versions: [] }
  settings: { restrictWritesToProjectRoot: boolean }
  plugins: string[]
}

const listPluginsMock = vi.fn()
const metaMock = vi.fn()
const scanMock = vi.fn()
const updateMetaMock = vi.fn()
const refreshPluginsMock = vi.fn()

vi.mock('../../../trpc', () => ({
  trpc: {
    project: {
      listPlugins: { query: () => listPluginsMock() },
      meta: { query: () => metaMock() },
      scan: { query: () => scanMock() },
      updateMeta: { mutate: (args: unknown) => updateMetaMock(args) },
      refreshPlugins: { mutate: (args: unknown) => refreshPluginsMock(args) },
    },
  },
}))

import { PluginsCard } from '../PluginsCard'

const vuetify = createVuetify()
const TS_ICON = 'M1 1 L2 2'
const VITE_ICON = 'M3 3 L4 4'

const baseMeta = (plugins: string[] = []): MockProjectMeta => ({
  name: 'demo',
  versions: { head: null, versions: [] },
  settings: { restrictWritesToProjectRoot: true },
  plugins,
})

beforeEach(() => {
  listPluginsMock.mockReset()
  metaMock.mockReset()
  scanMock.mockReset()
  updateMetaMock.mockReset()
  refreshPluginsMock.mockReset()
  resetAnalysisClientRegistry()
  registerAnalysisPluginClient({ id: 'typescript', icon: TS_ICON })
  registerAnalysisPluginClient({ id: 'vite', icon: VITE_ICON })
})

afterEach(() => {
  resetAnalysisClientRegistry()
})

describe('PluginsCard', () => {
  it('lists every plugin from listPlugins, sorted by name', async () => {
    listPluginsMock.mockResolvedValue([
      { id: 'vite', name: 'Vite' },
      { id: 'typescript', name: 'TypeScript' },
    ])
    metaMock.mockResolvedValue(baseMeta(['typescript']))
    scanMock.mockResolvedValue({ detectedIds: ['typescript'] })

    const wrapper = mount(PluginsCard, { global: { plugins: [vuetify] } })
    await flushPromises()

    const titles = wrapper.findAllComponents({ name: 'VListItem' }).map((w) => w.text())
    // Alphabetical: TypeScript before Vite
    expect(titles[0]).toContain('TypeScript')
    expect(titles[1]).toContain('Vite')
  })

  it('shows the detected/not detected status under each plugin', async () => {
    listPluginsMock.mockResolvedValue([
      { id: 'typescript', name: 'TypeScript' },
      { id: 'vite', name: 'Vite' },
    ])
    metaMock.mockResolvedValue(baseMeta([]))
    scanMock.mockResolvedValue({ detectedIds: ['typescript'] })

    const wrapper = mount(PluginsCard, { global: { plugins: [vuetify] } })
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Detected in this project')
    expect(text).toContain('Not detected')
  })

  it('toggling a switch calls updateMeta with the sorted plugin list', async () => {
    listPluginsMock.mockResolvedValue([
      { id: 'typescript', name: 'TypeScript' },
      { id: 'vite', name: 'Vite' },
    ])
    metaMock.mockResolvedValue(baseMeta(['typescript']))
    scanMock.mockResolvedValue({ detectedIds: ['typescript', 'vite'] })
    updateMetaMock.mockResolvedValue(baseMeta(['typescript', 'vite']))

    const wrapper = mount(PluginsCard, { global: { plugins: [vuetify] } })
    await flushPromises()

    const switches = wrapper.findAllComponents({ name: 'VSwitch' })
    // VSwitch wrappers carry the modelValue prop we just set
    const viteSwitch = switches.find((s) => s.props('modelValue') === false)
    expect(viteSwitch).toBeDefined()
    viteSwitch!.vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(updateMetaMock).toHaveBeenCalledTimes(1)
    const arg = updateMetaMock.mock.calls[0][0] as { meta: { plugins: string[] } }
    expect(arg.meta.plugins.sort()).toEqual(['typescript', 'vite'])
  })

  it('clicking "Refresh detection" calls refreshPlugins and updates state', async () => {
    listPluginsMock.mockResolvedValue([
      { id: 'typescript', name: 'TypeScript' },
      { id: 'vite', name: 'Vite' },
    ])
    metaMock.mockResolvedValue(baseMeta([]))
    scanMock.mockResolvedValue({ detectedIds: [] })
    refreshPluginsMock.mockResolvedValue({
      plugins: ['typescript', 'vite'],
      detectedIds: ['typescript', 'vite'],
    })

    const wrapper = mount(PluginsCard, { global: { plugins: [vuetify] } })
    await flushPromises()

    const refreshBtn = wrapper.findAllComponents({ name: 'VBtn' })[0]
    await refreshBtn.trigger('click')
    await flushPromises()

    expect(refreshPluginsMock).toHaveBeenCalledTimes(1)
  })

  it('survives a scan() error (detected falls back to empty)', async () => {
    listPluginsMock.mockResolvedValue([{ id: 'typescript', name: 'TypeScript' }])
    metaMock.mockResolvedValue(baseMeta([]))
    scanMock.mockRejectedValue(new Error('worker offline'))

    const wrapper = mount(PluginsCard, { global: { plugins: [vuetify] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Not detected')
  })
})
