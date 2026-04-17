import { flushPromises, mount } from '@vue/test-utils'
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

import { EditProjectMetaPanel } from '../EditProjectMetaPanel'

const vuetify = createVuetify()

const baseMeta = (overrides?: Partial<{ name: string; description: string }>) => ({
  name: 'demo',
  versions: { head: null, versions: [] },
  settings: { restrictWritesToProjectRoot: true },
  plugins: [],
  ...overrides,
})

beforeEach(() => {
  metaMock.mockReset()
  updateMetaMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EditProjectMetaPanel', () => {
  it('renders the initial name and description in the inputs', () => {
    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: 'demo', description: 'Hello' } },
      global: { plugins: [vuetify] },
    })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('demo')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('Hello')
  })

  it('Save calls updateMeta with the trimmed name + description and emits saved', async () => {
    metaMock.mockResolvedValue(baseMeta())
    updateMetaMock.mockResolvedValue(baseMeta({ name: 'New Name' }))
    const onSaved = vi.fn()

    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: 'demo' }, onSaved },
      global: { plugins: [vuetify] },
    })
    await wrapper.find('input').setValue('  New Name  ')
    await wrapper.find('textarea').setValue('  desc  ')

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(updateMetaMock).toHaveBeenCalledTimes(1)
    const call = updateMetaMock.mock.calls[0][0] as {
      meta: { name: string; description?: string }
    }
    expect(call.meta.name).toBe('New Name')
    expect(call.meta.description).toBe('desc')
    expect(onSaved).toHaveBeenCalledWith({ name: 'New Name', description: 'desc' })
  })

  it('Save is disabled when the name is empty', async () => {
    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: '' } },
      global: { plugins: [vuetify] },
    })
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('Cancel emits cancel without calling updateMeta', async () => {
    const onCancel = vi.fn()
    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: 'demo' }, onCancel },
      global: { plugins: [vuetify] },
    })
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(updateMetaMock).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  it('Esc cancels the edit', async () => {
    const onCancel = vi.fn()
    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: 'demo' }, onCancel },
      global: { plugins: [vuetify] },
    })
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('Cmd+Enter saves', async () => {
    metaMock.mockResolvedValue(baseMeta())
    updateMetaMock.mockResolvedValue(baseMeta())
    const onSaved = vi.fn()
    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: 'demo' }, onSaved },
      global: { plugins: [vuetify] },
    })
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Enter', metaKey: true })
    await flushPromises()
    expect(updateMetaMock).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('preserves existing settings + plugins when saving', async () => {
    metaMock.mockResolvedValue({
      ...baseMeta(),
      settings: { restrictWritesToProjectRoot: false },
      plugins: ['typescript', 'vite'],
    })
    updateMetaMock.mockResolvedValue(baseMeta())
    const wrapper = mount(EditProjectMetaPanel, {
      props: { initial: { name: 'demo' } },
      global: { plugins: [vuetify] },
    })
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveBtn.trigger('click')
    await flushPromises()
    const call = updateMetaMock.mock.calls[0][0] as {
      meta: { settings: { restrictWritesToProjectRoot: boolean }; plugins: string[] }
    }
    expect(call.meta.settings.restrictWritesToProjectRoot).toBe(false)
    expect(call.meta.plugins).toEqual(['typescript', 'vite'])
  })
})
