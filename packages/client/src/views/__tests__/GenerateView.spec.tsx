import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'

const generateMock = vi.fn()
const fileTypesForMock = vi.fn()

vi.mock('../../trpc', () => ({
  trpc: {
    template: {
      generate: { mutate: () => generateMock() },
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

function makeWrapper() {
  return mount(GenerateView, {
    global: {
      plugins: [vuetify],
      stubs: { CodeEditor: CodeEditorStub, PanelDivider: PanelDividerStub },
    },
  })
}

beforeEach(() => {
  generateMock.mockReset()
  fileTypesForMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
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
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Generate All'))!
    await btn.trigger('click')
    await flushPromises()

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
    const generateBtn = wrapper.findAll('button').find((b) => b.text().includes('Generate All'))!
    await generateBtn.trigger('click')
    await flushPromises()

    const item = wrapper
      .findAll('.v-list-item')
      .find((el) => el.text().includes('out/Foo.java'))!
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
    const generateBtn = wrapper.findAll('button').find((b) => b.text().includes('Generate All'))!
    await generateBtn.trigger('click')
    await flushPromises()

    const item = wrapper
      .findAll('.v-list-item')
      .find((el) => el.text().includes('out/Foo.ts'))!
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
    const generateBtn = wrapper.findAll('button').find((b) => b.text().includes('Generate All'))!
    await generateBtn.trigger('click')
    await flushPromises()

    const item = wrapper
      .findAll('.v-list-item')
      .find((el) => el.text().includes('out/README.md'))!
    await item.trigger('click')
    await flushPromises()

    const editor = wrapper.findComponent(CodeEditorStub)
    expect(editor.props('language')).toBe('markdown')
  })
})
