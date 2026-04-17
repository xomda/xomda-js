import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createVuetify } from 'vuetify'

const confirmMock = vi.fn<(opts: unknown) => Promise<boolean>>()

vi.mock('@xomda/ui', async () => {
  type XomdaUi = typeof import('@xomda/ui')
  const actual = await vi.importActual<XomdaUi>('@xomda/ui')
  return {
    ...actual,
    useConfirm: () => ({ confirm: confirmMock }),
  }
})

vi.mock('../../../composables', () => ({
  useTemplatePreview: () => ref(new Map()),
}))

vi.mock('../CellEditor', () => ({
  CellList: defineComponent({
    name: 'CellList',
    props: ['cells', 'previews', 'nested', 'onConfirmDelete'],
    emits: ['update:cells'],
    setup(props, { emit }) {
      return () =>
        h(
          'div',
          { class: 'cell-list-stub' },
          props.cells.map((c: { uuid: string }) =>
            h('button', {
              class: 'cell-delete',
              'data-uuid': c.uuid,
              onClick: async () => {
                const ok = await props.onConfirmDelete()
                if (ok) {
                  emit(
                    'update:cells',
                    props.cells.filter((x: { uuid: string }) => x.uuid !== c.uuid)
                  )
                }
              },
            })
          )
        )
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
    const buttons = wrapper.findAll('button.cell-delete')
    await buttons[1].trigger('click')
    await new Promise((r) => setTimeout(r, 0))

    expect(confirmMock).toHaveBeenCalledOnce()
    const emitted = wrapper.emitted('update:template')
    expect(emitted).toBeTruthy()
    const payload = emitted![0][0] as { cells: { uuid: string }[] }
    expect(payload.cells.map((c) => c.uuid)).toEqual(['a', 'c'])
  })

  it('does not remove the cell when the confirmation is cancelled', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { wrapper } = makeWrapper()
    const buttons = wrapper.findAll('button.cell-delete')
    await buttons[1].trigger('click')
    await new Promise((r) => setTimeout(r, 0))

    expect(confirmMock).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:template')).toBeUndefined()
  })
})
