import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

// Import after mock is registered.
import { FilePreviewDialog, languageFromPath } from '../FilePreviewDialog'

// Monaco can't initialize in happy-dom (no canvas 2D context). Replace with a stub.
vi.mock('@xomda/codeeditor', () => ({
  CodeEditor: {
    name: 'CodeEditor',
    props: { modelValue: String, language: String, options: Object, height: String },
    template: '<div class="code-editor-stub" />',
  },
}))

// VDialog's location strategy reads window.visualViewport, absent in happy-dom.
beforeEach(() => {
  if (!window.visualViewport) {
    vi.stubGlobal('visualViewport', {
      width: 1024,
      height: 768,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  }
})

afterEach(() => {
  document.body.innerHTML = ''
})

const vuetify = createVuetify()

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(FilePreviewDialog, {
    props: {
      modelValue: true,
      title: 'test.ts',
      content: 'const x = 1',
      language: 'typescript',
      ...props,
    },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

describe('languageFromPath', () => {
  it('maps .ts → typescript', () => expect(languageFromPath('foo.ts')).toBe('typescript'))
  it('maps .java → java', () => expect(languageFromPath('Foo.java')).toBe('java'))
  it('maps .hbs → handlebars', () => expect(languageFromPath('tmpl.hbs')).toBe('handlebars'))
  it('returns plaintext for unknown ext', () =>
    expect(languageFromPath('file.xyz')).toBe('plaintext'))
  it('returns plaintext for no ext', () => expect(languageFromPath('Makefile')).toBe('plaintext'))
})

describe('FilePreviewDialog', () => {
  // VDialog teleports content to document.body, so assertions go through the DOM.
  it('shows the title', () => {
    mountDialog({ title: 'Entity.ts' })
    expect(document.body.textContent).toContain('Entity.ts')
  })

  it('renders CodeEditor stub', () => {
    mountDialog({ content: 'hello' })
    expect(document.querySelector('.code-editor-stub')).not.toBeNull()
  })

  it('emits update:modelValue false when close button clicked', async () => {
    const wrapper = mountDialog()
    const btn = document.querySelector<HTMLElement>('button')
    expect(btn).not.toBeNull()
    btn!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })
})
