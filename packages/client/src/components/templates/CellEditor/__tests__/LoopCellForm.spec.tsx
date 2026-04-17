import { mount } from '@vue/test-utils'
import { useLocalStorageStore } from '@xomda/ui'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'

import { LoopCellForm } from '../LoopCellForm'

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
function makeCell(overrides: Record<string, unknown> = {}) {
  return {
    uuid: `loop-uuid-${++uuidCounter}`,
    type: 'loop' as const,
    loopSource: 'javascript' as const,
    content: 'function* provide(){}',
    ...overrides,
  }
}

function makeWrapper(opts: { stored?: number; cell?: ReturnType<typeof makeCell> } = {}) {
  setActivePinia(createPinia())
  const cell = opts.cell ?? makeCell()
  const store = useLocalStorageStore()
  if (opts.stored != null) {
    store.cellHeights = { [cell.uuid]: opts.stored }
  }
  const wrapper = mount(LoopCellForm, {
    props: { cell },
    global: {
      plugins: [vuetify],
      stubs: { CodeEditor: CodeEditorStub, PanelDivider: PanelDividerStub },
    },
  })
  return { cell, store, wrapper }
}

describe('LoopCellForm — JavaScript generator code resize', () => {
  it('renders a CodeEditor and a PanelDivider when source is javascript', () => {
    const { wrapper } = makeWrapper()
    expect(wrapper.findComponent(CodeEditorStub).exists()).toBe(true)
    expect(wrapper.findComponent(PanelDividerStub).props('orientation')).toBe('vertical')
  })

  it('does not render the CodeEditor when source is not javascript', () => {
    const cell = makeCell({ loopSource: 'entities', content: '' })
    const { wrapper } = makeWrapper({ cell })
    expect(wrapper.findComponent(CodeEditorStub).exists()).toBe(false)
    expect(wrapper.findComponent(PanelDividerStub).exists()).toBe(false)
  })

  it('defaults to height 120 when no stored height exists', () => {
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
})

describe('LoopCellForm — loop source list', () => {
  it('exposes Models and Projects as workspace-level iteration targets', () => {
    const cell = makeCell({ loopSource: undefined, content: '' })
    const { wrapper } = makeWrapper({ cell })
    // VSelect items are read from props; query the actual <select> alternative
    // via the underlying option list rendered when the menu is open.
    const select = wrapper.findComponent({ name: 'VSelect' })
    expect(select.exists()).toBe(true)
    const items = select.props('items') as Array<{ title?: string; value?: string }>
    expect(items.some((i) => i.value === 'models' && i.title === 'Models')).toBe(true)
    expect(items.some((i) => i.value === 'projects' && i.title === 'Projects')).toBe(true)
    // Existing entries still present (regression pin).
    for (const v of ['entities', 'enums', 'packages', 'javascript']) {
      expect(items.some((i) => i.value === v)).toBe(true)
    }
  })

  it('does not render the JS editor when Models or Projects is selected', () => {
    const cell = makeCell({ loopSource: 'models', content: '' })
    const { wrapper } = makeWrapper({ cell })
    expect(wrapper.findComponent(CodeEditorStub).exists()).toBe(false)

    const projectsCell = makeCell({ loopSource: 'projects', content: '' })
    const projectsWrapper = makeWrapper({ cell: projectsCell }).wrapper
    expect(projectsWrapper.findComponent(CodeEditorStub).exists()).toBe(false)
  })
})
