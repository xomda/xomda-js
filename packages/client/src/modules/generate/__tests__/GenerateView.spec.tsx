import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'

// happy-dom on Node 24+ doesn't always wire `globalThis.localStorage`, and
// Vuetify's VMenu reads `globalThis.visualViewport` when computing overlay
// position. Shim both so async watchers/overlays don't unhandled-reject.
{
  const g = globalThis as unknown as Record<string, unknown>
  if (!g.localStorage) {
    const store = new Map<string, string>()
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size
      },
    }
  }
  if (!g.visualViewport) {
    g.visualViewport = {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
  }
}

const generateMock = vi.fn()
const previewMock = vi.fn()
const fileTypesForMock = vi.fn()
const templateListMock = vi.fn().mockResolvedValue([])

vi.mock('../../../trpc', () => ({
  trpc: {
    template: {
      generate: { mutate: () => generateMock() },
      preview: { query: () => previewMock() },
      list: { query: () => templateListMock() },
    },
    project: {
      fileTypesFor: { query: (args: unknown) => fileTypesForMock(args) },
    },
  },
}))

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

import { GenerateView } from '../GenerateView'

const vuetify = createVuetify()

const wrappers: Array<ReturnType<typeof mount>> = []

function makeWrapper() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const w = mount(GenerateView, {
    global: {
      plugins: [vuetify, pinia],
      stubs: { CodeEditor: CodeEditorStub, PanelDivider: PanelDividerStub },
    },
  })
  wrappers.push(w)
  return w
}

const findGenerateButton = (wrapper: ReturnType<typeof makeWrapper>) =>
  wrapper.findAll('button').find((b) => /Generate All|Dry Run/.test(b.text()))!

beforeEach(() => {
  generateMock.mockReset()
  previewMock.mockReset()
  fileTypesForMock.mockReset()
  templateListMock.mockClear()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  while (wrappers.length) wrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('GenerateView', () => {
  it('renders the empty state before generation', () => {
    const wrapper = makeWrapper()
    expect(wrapper.text()).toContain('No files generated yet')
  })

  it('lists generated files after Generate All and shows a preview empty state', async () => {
    generateMock.mockResolvedValue([
      { outputPath: 'out/Foo.java', templateId: 't1', content: 'class Foo {}' },
      { outputPath: 'out/README.md', templateId: 't2', content: '# Hello' },
    ])
    const wrapper = makeWrapper()
    await findGenerateButton(wrapper).trigger('click')
    await flushPromises()

    expect(generateMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Generated Files (2)')
    expect(wrapper.text()).toContain('out/Foo.java')
    expect(wrapper.text()).toContain('out/README.md')
    expect(wrapper.text()).toContain('No file selected')
  })

  it('uses fileTypesFor to drive the preview when a generated file is clicked', async () => {
    generateMock.mockResolvedValue([
      { outputPath: 'out/Foo.java', templateId: 't1', content: 'class Foo {}' },
    ])
    fileTypesForMock.mockResolvedValue({
      matches: [],
      preview: { kind: 'text', language: 'java' },
    })

    const wrapper = makeWrapper()
    await findGenerateButton(wrapper).trigger('click')
    await flushPromises()

    const item = wrapper.findAll('.v-list-item').find((el) => el.text().includes('out/Foo.java'))!
    await item.trigger('click')
    await flushPromises()

    expect(fileTypesForMock).toHaveBeenCalledWith({ path: 'out/Foo.java' })
    const editor = wrapper.findComponent(CodeEditorStub)
    expect(editor.exists()).toBe(true)
    expect(editor.props('language')).toBe('java')
    expect(editor.props('modelValue')).toBe('class Foo {}')
  })

  it('falls back to languageFromPath when fileTypesFor returns no preview hint', async () => {
    generateMock.mockResolvedValue([
      { outputPath: 'out/Foo.ts', templateId: 't1', content: 'export {}' },
    ])
    fileTypesForMock.mockResolvedValue({ matches: [] })

    const wrapper = makeWrapper()
    await findGenerateButton(wrapper).trigger('click')
    await flushPromises()

    const item = wrapper.findAll('.v-list-item').find((el) => el.text().includes('out/Foo.ts'))!
    await item.trigger('click')
    await flushPromises()

    const editor = wrapper.findComponent(CodeEditorStub)
    expect(editor.props('language')).toBe('typescript')
    expect(editor.props('modelValue')).toBe('export {}')
  })

  it('coerces a markdown preview hint into a markdown-language editor', async () => {
    generateMock.mockResolvedValue([
      { outputPath: 'out/README.md', templateId: 't1', content: '# Hi' },
    ])
    fileTypesForMock.mockResolvedValue({ matches: [], preview: { kind: 'markdown' } })

    const wrapper = makeWrapper()
    await findGenerateButton(wrapper).trigger('click')
    await flushPromises()

    const item = wrapper.findAll('.v-list-item').find((el) => el.text().includes('out/README.md'))!
    await item.trigger('click')
    await flushPromises()

    const editor = wrapper.findComponent(CodeEditorStub)
    expect(editor.props('language')).toBe('markdown')
  })

  it('runs a dry-run from the action menu without calling the write mutation', async () => {
    previewMock.mockResolvedValue([
      { outputPath: 'out/Foo.java', templateId: 't1', content: 'class Foo {}' },
    ])

    const wrapper = makeWrapper()
    // Open the split-button menu and pick "Dry Run".
    const chevron = wrapper.find('[aria-label="Choose generate action"]')
    expect(chevron.exists()).toBe(true)
    await chevron.trigger('click')
    await flushPromises()

    const dryRunItem = document.body.querySelector('.v-list-item-title') // first menu entry — fall back to text search
    void dryRunItem
    // Find by visible text in the rendered overlay menu.
    const overlayItems = Array.from(
      document.querySelectorAll<HTMLElement>('.v-overlay .v-list-item')
    )
    const dryBtn = overlayItems.find((el) => el.textContent?.includes('Dry Run'))
    expect(dryBtn).toBeTruthy()
    dryBtn!.click()
    await flushPromises()

    expect(previewMock).toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Dry run — preview only')
    expect(wrapper.text()).toContain('out/Foo.java')
  })

  it('still lets you preview a file after a dry-run', async () => {
    previewMock.mockResolvedValue([
      { outputPath: 'out/Foo.ts', templateId: 't1', content: 'export {}' },
    ])
    fileTypesForMock.mockResolvedValue({ matches: [] })

    const wrapper = makeWrapper()
    const chevron = wrapper.find('[aria-label="Choose generate action"]')
    await chevron.trigger('click')
    await flushPromises()
    const overlayItems = Array.from(
      document.querySelectorAll<HTMLElement>('.v-overlay .v-list-item')
    )
    overlayItems.find((el) => el.textContent?.includes('Dry Run'))!.click()
    await flushPromises()

    const item = wrapper.findAll('.v-list-item').find((el) => el.text().includes('out/Foo.ts'))!
    await item.trigger('click')
    await flushPromises()

    const editor = wrapper.findComponent(CodeEditorStub)
    expect(editor.props('language')).toBe('typescript')
    expect(editor.props('modelValue')).toBe('export {}')
  })

  it('renders a tree view when the user switches to Tree mode', async () => {
    generateMock.mockResolvedValue([
      { outputPath: 'src/foo/Bar.ts', templateId: 't1', content: 'a' },
      { outputPath: 'src/Baz.ts', templateId: 't1', content: 'b' },
    ])

    const wrapper = makeWrapper()
    // Opt in to tree mode via the store before generation so the
    // post-generate render shows the tree layout.
    const { useLocalStorageStore } = await import('@xomda/ui')
    useLocalStorageStore().generateViewMode = 'tree'
    await flushPromises()

    await findGenerateButton(wrapper).trigger('click')
    await flushPromises()

    // Tree mode shows each path segment as its own row: "src" folder
    // appears once, "foo" as a subfolder, and the two files as leaves.
    // In list mode the inner folder "foo" would not appear as a row.
    // Tree-row text concatenates the entry name with the "G" generated
    // chip (e.g. "srcG"), so match on `startsWith` rather than the
    // full-path strings used in list mode.
    const items = wrapper.findAll('.v-list-item').map((el) => el.text())
    expect(items.some((t) => t.startsWith('src'))).toBe(true)
    expect(items.some((t) => t.startsWith('foo'))).toBe(true)
    expect(items.some((t) => t.startsWith('Bar.ts'))).toBe(true)
    expect(items.some((t) => t.startsWith('Baz.ts'))).toBe(true)
    expect(items.some((t) => t.includes('src/Baz.ts'))).toBe(false)
  })
})
