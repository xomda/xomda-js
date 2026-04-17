import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { ConfirmDialog } from '../ConfirmDialog'

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
  mount(ConfirmDialog, {
    props: {
      modelValue: true,
      title: 'Delete entity',
      message: 'Are you sure?',
      ...props,
    },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

describe('ConfirmDialog', () => {
  it('renders the title and message', () => {
    mountDialog({ title: 'Delete entity', message: 'Forever?' })
    expect(document.body.textContent).toContain('Delete entity')
    expect(document.body.textContent).toContain('Forever?')
  })

  it('renders the configured labels', () => {
    mountDialog({ confirmLabel: 'Yeet', cancelLabel: 'Nope' })
    expect(document.body.textContent).toContain('Yeet')
    expect(document.body.textContent).toContain('Nope')
  })

  it('emits confirm when confirm button clicked', async () => {
    const wrapper = mountDialog({ confirmLabel: 'Delete' })
    const confirmBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Delete')
    )
    expect(confirmBtn).toBeDefined()
    confirmBtn!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits cancel and closes when cancel button clicked', async () => {
    const wrapper = mountDialog({ cancelLabel: 'Cancel' })
    const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Cancel')
    )
    expect(cancelBtn).toBeDefined()
    cancelBtn!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('renders default slot in place of message', () => {
    mount(ConfirmDialog, {
      props: { modelValue: true, title: 'X', message: 'should not appear' },
      slots: { default: '<div class="custom-body">custom content</div>' },
      global: { plugins: [vuetify] },
      attachTo: document.body,
    })
    expect(document.querySelector('.custom-body')).not.toBeNull()
    expect(document.body.textContent).not.toContain('should not appear')
  })

  it('disables cancel and shows loading on confirm when loading=true', () => {
    mountDialog({ loading: true, confirmLabel: 'Delete', cancelLabel: 'Cancel' })
    const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Cancel')
    )
    expect(cancelBtn?.disabled).toBe(true)
  })
})
