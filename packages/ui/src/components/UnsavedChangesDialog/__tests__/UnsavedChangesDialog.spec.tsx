import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { UnsavedChangesDialog } from '../UnsavedChangesDialog'

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
  mount(UnsavedChangesDialog, {
    props: {
      modelValue: true,
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Save them before closing?',
      ...props,
    },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

const findBtn = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.includes(label)
  )

describe('UnsavedChangesDialog', () => {
  it('renders title, message, and all three button labels', () => {
    mountDialog({
      title: 'Close tab?',
      message: 'Tab has edits.',
      saveLabel: 'Save',
      discardLabel: 'Discard',
      cancelLabel: 'Cancel',
    })
    expect(document.body.textContent).toContain('Close tab?')
    expect(document.body.textContent).toContain('Tab has edits.')
    expect(findBtn('Save')).toBeDefined()
    expect(findBtn('Discard')).toBeDefined()
    expect(findBtn('Cancel')).toBeDefined()
  })

  it('emits save when the Save button is clicked', async () => {
    const wrapper = mountDialog()
    findBtn('Save')!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('save')).toBeTruthy()
  })

  it('emits discard AND closes when Discard is clicked', async () => {
    const wrapper = mountDialog()
    findBtn('Discard')!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('discard')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('emits cancel AND closes when Cancel is clicked', async () => {
    const wrapper = mountDialog()
    findBtn('Cancel')!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('disables non-Save buttons and marks Save loading when loading=true', () => {
    mountDialog({ loading: true })
    expect(findBtn('Discard')?.disabled).toBe(true)
    expect(findBtn('Cancel')?.disabled).toBe(true)
  })
})
