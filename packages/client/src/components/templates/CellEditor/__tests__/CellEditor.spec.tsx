import { mount } from '@vue/test-utils'
import { useLocalStorageStore } from '@xomda/ui'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'

import { CellEditor } from '../CellEditor'

const vuetify = createVuetify()

function makeMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => {
      data.delete(k)
    },
    setItem: (k, v) => {
      data.set(k, String(v))
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeMemoryStorage())
})

const CodeEditorStub = defineComponent({
  name: 'CodeEditor',
  props: ['height', 'modelValue', 'language', 'theme', 'width', 'options'],
  emits: ['init', 'update:modelValue'],
  setup() {
    return () => h('div', { class: 'code-editor-stub' })
  },
})

const PanelDividerStub = defineComponent({
  name: 'PanelDivider',
  props: ['orientation'],
  emits: ['resize'],
  setup() {
    return () => h('div', { class: 'panel-divider-stub' })
  },
})

let uuidCounter = 0
function makeCell() {
  return {
    uuid: `cell-uuid-${++uuidCounter}`,
    type: 'logic' as const,
    content: 'console.log("hi")',
  }
}

function makeWrapper(opts: { stored?: number } = {}) {
  setActivePinia(createPinia())
  const cell = makeCell()
  const store = useLocalStorageStore()
  if (opts.stored != null) {
    store.cellHeights = { [cell.uuid]: opts.stored }
  }
  const wrapper = mount(CellEditor, {
    props: { cell, index: 0, total: 1 },
    global: {
      plugins: [vuetify],
      stubs: { CodeEditor: CodeEditorStub, PanelDivider: PanelDividerStub },
    },
  })
  return { cell, store, wrapper }
}

describe('CellEditor height management', () => {
  it('defaults to 120 when no stored height exists', () => {
    const { wrapper } = makeWrapper()
    expect(wrapper.findComponent(CodeEditorStub).props('height')).toBe(120)
  })

  it('uses the stored height when one exists', () => {
    const { wrapper } = makeWrapper({ stored: 250 })
    expect(wrapper.findComponent(CodeEditorStub).props('height')).toBe(250)
  })

  it('updates height and persists to the store on resize', async () => {
    const { cell, store, wrapper } = makeWrapper({ stored: 200 })
    await wrapper.findComponent(PanelDividerStub).vm.$emit('resize', 50)
    expect(wrapper.findComponent(CodeEditorStub).props('height')).toBe(250)
    expect(store.cellHeights[cell.uuid]).toBe(250)
  })

  it('clamps to the minimum height (80) on large negative resize', async () => {
    const { cell, store, wrapper } = makeWrapper({ stored: 100 })
    await wrapper.findComponent(PanelDividerStub).vm.$emit('resize', -200)
    expect(wrapper.findComponent(CodeEditorStub).props('height')).toBe(80)
    expect(store.cellHeights[cell.uuid]).toBe(80)
  })

  it('clamps to the maximum height (600) on large positive resize', async () => {
    const { cell, store, wrapper } = makeWrapper({ stored: 500 })
    await wrapper.findComponent(PanelDividerStub).vm.$emit('resize', 500)
    expect(wrapper.findComponent(CodeEditorStub).props('height')).toBe(600)
    expect(store.cellHeights[cell.uuid]).toBe(600)
  })

  it('renders a vertical PanelDivider below the editor', () => {
    const { wrapper } = makeWrapper()
    expect(wrapper.findComponent(PanelDividerStub).props('orientation')).toBe('vertical')
  })
})
