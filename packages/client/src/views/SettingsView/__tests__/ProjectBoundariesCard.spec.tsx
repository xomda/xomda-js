import { flushPromises, mount } from '@vue/test-utils'
import { defaultProjectSettings } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

const metaMock = vi.fn()
const updateMetaMock = vi.fn()

vi.mock('../../../trpc', () => ({
  trpc: {
    project: {
      meta: { query: () => metaMock() },
      updateMeta: { mutate: (args: unknown) => updateMetaMock(args) },
    },
  },
}))

import { ProjectBoundariesCard } from '../ProjectBoundariesCard'

const vuetify = createVuetify()

const baseMeta = (overrides?: { isRoot?: boolean; excludeFromScan?: string[] }) => ({
  name: 'demo',
  versions: { head: null, versions: [] },
  settings: {
    ...defaultProjectSettings(),
    ...(overrides?.isRoot !== undefined ? { isRoot: overrides.isRoot } : {}),
    ...(overrides?.excludeFromScan !== undefined
      ? { excludeFromScan: overrides.excludeFromScan }
      : {}),
  },
  plugins: [],
})

beforeEach(() => {
  metaMock.mockReset()
  updateMetaMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProjectBoundariesCard', () => {
  it('reflects the persisted isRoot value', async () => {
    metaMock.mockResolvedValue(baseMeta({ isRoot: true }))
    const wrapper = mount(ProjectBoundariesCard, { global: { plugins: [vuetify] } })
    await flushPromises()
    const sw = wrapper.findComponent({ name: 'VSwitch' })
    expect(sw.props('modelValue')).toBe(true)
  })

  it('renders one chip per excluded folder', async () => {
    metaMock.mockResolvedValue(baseMeta({ excludeFromScan: ['vendor', 'node_modules'] }))
    const wrapper = mount(ProjectBoundariesCard, { global: { plugins: [vuetify] } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('vendor')
    expect(text).toContain('node_modules')
  })

  it('typing + Add appends to the list (sorted)', async () => {
    metaMock.mockResolvedValue(baseMeta({ excludeFromScan: ['node_modules'] }))
    updateMetaMock.mockResolvedValue(baseMeta())
    const wrapper = mount(ProjectBoundariesCard, { global: { plugins: [vuetify] } })
    await flushPromises()

    const input = wrapper.find('input[type="text"]')
    await input.setValue('cypress')
    const addBtn = wrapper.findAll('button').find((b) => b.text() === 'Add')!
    await addBtn.trigger('click')

    expect(wrapper.text()).toContain('cypress')

    // Save propagates the new list
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveBtn.trigger('click')
    await flushPromises()

    const arg = updateMetaMock.mock.calls[0][0] as {
      meta: { settings: { excludeFromScan: string[] } }
    }
    expect(arg.meta.settings.excludeFromScan).toEqual(['cypress', 'node_modules'])
  })

  it('toggling isRoot then saving persists the new value', async () => {
    metaMock.mockResolvedValue(baseMeta({ isRoot: false }))
    updateMetaMock.mockResolvedValue(baseMeta({ isRoot: true }))
    const wrapper = mount(ProjectBoundariesCard, { global: { plugins: [vuetify] } })
    await flushPromises()

    const sw = wrapper.findComponent({ name: 'VSwitch' })
    sw.vm.$emit('update:modelValue', true)
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveBtn.trigger('click')
    await flushPromises()

    const arg = updateMetaMock.mock.calls[0][0] as {
      meta: { settings: { isRoot: boolean } }
    }
    expect(arg.meta.settings.isRoot).toBe(true)
  })

  it('Add button is disabled when the input is empty', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = mount(ProjectBoundariesCard, { global: { plugins: [vuetify] } })
    await flushPromises()
    const addBtn = wrapper.findAll('button').find((b) => b.text() === 'Add')!
    expect(addBtn.attributes('disabled')).toBeDefined()
  })

  it('Save button is disabled until something changes', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = mount(ProjectBoundariesCard, { global: { plugins: [vuetify] } })
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })
})
