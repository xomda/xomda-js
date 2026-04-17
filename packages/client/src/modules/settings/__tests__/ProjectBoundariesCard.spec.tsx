import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createVuetify } from 'vuetify'

import { ProjectBoundariesCard } from '../ProjectBoundariesCard'
import { createTestEditor, provideHost } from './testEditor'

const vuetify = createVuetify()

const mountCard = (overrides: Parameters<typeof createTestEditor>[0] = {}) => {
  const { editor, spies } = createTestEditor(overrides)
  const Host = provideHost(editor, () => h(ProjectBoundariesCard))
  const wrapper = mount(Host, { global: { plugins: [vuetify] } })
  return { wrapper, editor, spies }
}

describe('ProjectBoundariesCard', () => {
  it('reflects the editor draft isRoot value in the switch', () => {
    const { wrapper } = mountCard({ draft: { settings: { isRoot: true } as never } })
    const sw = wrapper.findComponent({ name: 'VSwitch' })
    expect(sw.props('modelValue')).toBe(true)
  })

  it('renders one chip per excluded folder from the draft', () => {
    const { wrapper } = mountCard({
      draft: { settings: { excludeFromScan: ['vendor', 'node_modules'] } as never },
    })
    const text = wrapper.text()
    expect(text).toContain('vendor')
    expect(text).toContain('node_modules')
  })

  it('typing + Add writes the new entry into the editor draft (sorted)', async () => {
    const { wrapper, editor } = mountCard({
      draft: { settings: { excludeFromScan: ['node_modules'] } as never },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('cypress')
    const addBtn = wrapper.findAll('button').find((b) => b.text() === 'Add')!
    await addBtn.trigger('click')
    await flushPromises()

    expect(editor.draft.value.settings.excludeFromScan).toEqual(['cypress', 'node_modules'])
  })

  it('toggling isRoot updates the editor draft (without saving directly)', async () => {
    const { wrapper, editor, spies } = mountCard({
      draft: { settings: { isRoot: false } as never },
    })
    const sw = wrapper.findComponent({ name: 'VSwitch' })
    sw.vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(editor.draft.value.settings.isRoot).toBe(true)
    // The card no longer triggers save; the page-level sticky bar does that.
    expect(spies.save).not.toHaveBeenCalled()
  })

  it('removing a chip mutates the editor draft', async () => {
    const { wrapper, editor } = mountCard({
      draft: { settings: { excludeFromScan: ['vendor', 'node_modules'] } as never },
    })
    const chip = wrapper.findAllComponents({ name: 'VChip' }).find((c) => c.text() === 'vendor')!
    chip.vm.$emit('click:close')
    await flushPromises()
    expect(editor.draft.value.settings.excludeFromScan).toEqual(['node_modules'])
  })

  it('Add button is disabled when the input is empty', () => {
    const { wrapper } = mountCard()
    const addBtn = wrapper.findAll('button').find((b) => b.text() === 'Add')!
    expect(addBtn.attributes('disabled')).toBeDefined()
  })
})
