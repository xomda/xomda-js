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

function makeWrapper(
  opts: {
    stored?: number
    preview?: {
      done: boolean
      output?: string
      error?: string
      consoleLogs?: string[]
      contextDiff?: Record<string, unknown>
    }
  } = {}
) {
  setActivePinia(createPinia())
  const cell = makeCell()
  const store = useLocalStorageStore()
  if (opts.stored != null) {
    store.cellHeights = { [cell.uuid]: opts.stored }
  }
  const preview = opts.preview
    ? {
        cell,
        state: {
          output: opts.preview.output ?? '',
          error: opts.preview.error,
          consoleLogs: opts.preview.consoleLogs ?? [],
          contextDiff: opts.preview.contextDiff ?? {},
          done: opts.preview.done,
        },
      }
    : undefined
  const wrapper = mount(CellEditor, {
    props: { cell, index: 0, total: 1, ...(preview ? { preview } : {}) },
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

describe('CellEditor output section', () => {
  // Keeping the Output collapsible mounted from initial render avoids a layout
  // jump when the cell finishes executing. See feature request: outputs should
  // be present and collapsed up-front, with a loader visible if opened "too
  // soon."
  it('renders the Output collapsible even when no preview is available', () => {
    const { wrapper } = makeWrapper()
    expect(wrapper.text()).toContain('Output')
  })

  it('renders the Output collapsible when the preview state is not yet done', () => {
    const { wrapper } = makeWrapper({ preview: { done: false } })
    expect(wrapper.text()).toContain('Output')
  })

  it('renders the Output collapsible when the preview is done with content', () => {
    const { wrapper } = makeWrapper({ preview: { done: true, output: 'hello' } })
    expect(wrapper.text()).toContain('Output')
  })
})
