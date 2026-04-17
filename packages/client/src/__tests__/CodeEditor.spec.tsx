import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// Stub the workspace `@xomda/codeeditor/.../monaco` module before
// importing CodeEditor. The path is relative to *this* test file —
// Vitest resolves it to the same absolute file CodeEditor.tsx imports
// via `./monaco`, so the SUT picks up our mock instead of the real
// Monaco bundle (which can't load in a happy-dom env: the `?worker`
// imports and the Monaco runtime require a real browser).
type ChangeListener = () => void
const changeListeners = new Set<ChangeListener>()
let editorText = ''

vi.mock('../../../codeeditor/src/monaco', () => {
  const fakeModel = {
    onDidChangeContent(cb: ChangeListener) {
      changeListeners.add(cb)
      return { dispose: () => changeListeners.delete(cb) }
    },
  }
  const fakeEditor = {
    getValue: () => editorText,
    setValue: (v: string) => {
      editorText = v
      // Mimic monaco: setValue fires onDidChangeContent.
      for (const l of changeListeners) l()
    },
    getModel: () => fakeModel,
    updateOptions: vi.fn(),
    layout: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    monaco: {
      editor: {
        create: vi.fn((_root: HTMLElement, opts: { value?: string }) => {
          editorText = opts.value ?? ''
          return fakeEditor
        }),
        createModel: vi.fn(() => fakeModel),
        setModelLanguage: vi.fn(),
        setTheme: vi.fn(),
      },
    },
  }
})

import { CodeEditor } from '@xomda/codeeditor'

/** Drive the mocked editor as if the user typed a new value. */
function simulateUserType(next: string) {
  editorText = next
  for (const l of changeListeners) l()
}

describe('CodeEditor', () => {
  it('emits update:modelValue with the LATEST text on every change (regression: only-first-character)', async () => {
    changeListeners.clear()
    editorText = ''
    const w = mount(CodeEditor, { props: { modelValue: '' } })
    // Mount triggers `editor.create` synchronously inside onMounted.
    await w.vm.$nextTick()

    simulateUserType('a')
    simulateUserType('ab')
    simulateUserType('abc')

    const events = w.emitted('update:modelValue') ?? []
    // Every keystroke must propagate the up-to-date editor text. The
    // pre-fix bug emitted "a" three times because the Vue `computed`
    // backing the read had no reactive deps and got cached forever.
    const payloads = events.map((e) => e[0])
    expect(payloads).toContain('a')
    expect(payloads).toContain('ab')
    expect(payloads).toContain('abc')
    // And the *last* event matches the latest value, not a stale one.
    expect(payloads[payloads.length - 1]).toBe('abc')
  })

  it('writes prop changes into the editor only when they differ from current text', async () => {
    changeListeners.clear()
    editorText = ''
    const w = mount(CodeEditor, { props: { modelValue: 'hello' } })
    await w.vm.$nextTick()
    expect(editorText).toBe('hello')

    await w.setProps({ modelValue: 'world' })
    expect(editorText).toBe('world')

    // Same value — setValue should be a no-op. Verifying via change
    // listener count: setValue fires onDidChangeContent in our mock.
    const before = (w.emitted('update:modelValue') ?? []).length
    await w.setProps({ modelValue: 'world' })
    const after = (w.emitted('update:modelValue') ?? []).length
    expect(after).toBe(before)
  })
})
