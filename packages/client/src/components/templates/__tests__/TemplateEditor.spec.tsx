import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'

const confirmMock = vi.fn<(opts: unknown) => Promise<boolean>>()

vi.mock('@xomda/ui', async () => {
  const actual = await vi.importActual<typeof import('@xomda/ui')>('@xomda/ui')
  return {
    ...actual,
    useConfirm: () => ({ confirm: confirmMock }),
  }
})

vi.mock('../../../composables', () => ({
  useTemplatePreview: () => ({ value: [] }),
}))

vi.mock('../CellEditor', () => ({
  CELL_LABEL: { logic: 'Logic', handlebars: 'Handlebars', output: 'Output', provider: 'Provider' },
  CELL_TYPES: ['logic', 'handlebars', 'output', 'provider'],
  CellEditor: defineComponent({
    name: 'CellEditor',
    props: ['cell', 'index', 'total', 'cellInstance'],
    emits: ['update:cell', 'delete', 'moveUp', 'moveDown', 'addAbove', 'addBelow'],
    setup() {
      return () => h('div', { class: 'cell-editor-stub' })
    },
  }),
  registerCellContextStaticLib: () => {},
  setCellContextVariablesLib: () => {},
}))

import { TemplateEditor } from '../TemplateEditor'

const vuetify = createVuetify()

function makeTemplate() {
  return {
    uuid: 'tpl-1',
    name: 'tpl',
    cells: [
      { uuid: 'a', type: 'logic' as const, content: 'A' },
      { uuid: 'b', type: 'logic' as const, content: 'B' },
      { uuid: 'c', type: 'logic' as const, content: 'C' },
    ],
  }
}

function makeWrapper() {
  const template = makeTemplate()
  const wrapper = mount(TemplateEditor, {
    props: { template: template as never },
    global: { plugins: [vuetify] },
  })
  return { template, wrapper }
}

describe('TemplateEditor cell deletion', () => {
  beforeEach(() => {
    confirmMock.mockReset()
  })

  it('asks for confirmation and removes the cell when confirmed', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const { wrapper } = makeWrapper()
    const cellEditors = wrapper.findAllComponents({ name: 'CellEditor' })

    await cellEditors[1].vm.$emit('delete')
    await new Promise((r) => setTimeout(r, 0))

    expect(confirmMock).toHaveBeenCalledOnce()
    const emitted = wrapper.emitted('update:template')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].cells.map((c: { uuid: string }) => c.uuid)).toEqual(['a', 'c'])
  })

  it('does not remove the cell when the confirmation is cancelled', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { wrapper } = makeWrapper()
    const cellEditors = wrapper.findAllComponents({ name: 'CellEditor' })

    await cellEditors[1].vm.$emit('delete')
    await new Promise((r) => setTimeout(r, 0))

    expect(confirmMock).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:template')).toBeUndefined()
  })
})
