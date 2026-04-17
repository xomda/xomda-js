import { mount } from '@vue/test-utils'
import type { Template } from '@xomda/template'
import { useEditBuffer } from '@xomda/ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'
import { createVuetify } from 'vuetify'

import type { OpenTemplateTab } from '../../useTemplateTabs'
import { TemplateTabs } from '../TemplateTabs'

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

function makeTab(uuid: string, name: string, dirty = false): OpenTemplateTab {
  const buffer = useEditBuffer<Template>()
  buffer.set({ uuid, name, version: '1.0.0', cells: [] })
  if (dirty && buffer.draft.value) buffer.draft.value.name = `${name}-edited`
  return { uuid, buffer: markRaw(buffer) }
}

function mountTabs(tabs: OpenTemplateTab[], activeUuid: string | null = null) {
  return mount(TemplateTabs, {
    props: { tabs, activeUuid },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })
}

describe('TemplateTabs', () => {
  it('renders one VTab per item with the buffer name as label', () => {
    mountTabs([makeTab('u1', 'First'), makeTab('u2', 'Second')], 'u1')
    const tabs = document.querySelectorAll('.v-tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].textContent).toContain('First')
    expect(tabs[1].textContent).toContain('Second')
  })

  it('renders even with a single tab (regression guard for hide-below-2)', () => {
    mountTabs([makeTab('u1', 'Only')], 'u1')
    expect(document.querySelectorAll('.v-tab')).toHaveLength(1)
  })

  it('shows a dirty dot when buffer.dirty is true', () => {
    mountTabs([makeTab('u1', 'Clean', false), makeTab('u2', 'Dirty', true)], 'u1')
    const dots = document.querySelectorAll('[aria-label="Unsaved changes"]')
    expect(dots).toHaveLength(1)
  })

  it('emits update:activeUuid when a tab is clicked', async () => {
    const wrapper = mountTabs([makeTab('u1', 'First'), makeTab('u2', 'Second')], 'u1')
    const secondTab = document.querySelectorAll<HTMLElement>('.v-tab')[1]
    secondTab.click()
    await wrapper.vm.$nextTick()
    const events = wrapper.emitted('update:activeUuid')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual(['u2'])
  })

  it('emits close with the tab uuid when the close button is clicked', async () => {
    const wrapper = mountTabs([makeTab('u1', 'First'), makeTab('u2', 'Second')], 'u1')
    const closeBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Close tab"]')
    )[1]
    expect(closeBtn).toBeDefined()
    closeBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')![0]).toEqual(['u2'])
  })

  it('close-button click does NOT also switch active tab (stopPropagation)', async () => {
    const wrapper = mountTabs([makeTab('u1', 'First'), makeTab('u2', 'Second')], 'u1')
    const closeBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Close tab"]')
    )[1]
    closeBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:activeUuid')).toBeFalsy()
  })

  it('Close-tab buttons have an aria-label (a11y §18)', () => {
    mountTabs([makeTab('u1', 'First')], 'u1')
    const closeBtns = document.querySelectorAll('button[aria-label="Close tab"]')
    expect(closeBtns.length).toBeGreaterThan(0)
  })

  it('emits contextmenu with the tab uuid and the MouseEvent on right-click', async () => {
    const wrapper = mountTabs([makeTab('u1', 'First'), makeTab('u2', 'Second')], 'u1')
    const secondTab = document.querySelectorAll<HTMLElement>('.v-tab')[1]
    const event = new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 20 })
    secondTab.dispatchEvent(event)
    await wrapper.vm.$nextTick()
    const emitted = wrapper.emitted('contextmenu')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe('u2')
    expect(emitted![0][1]).toBeInstanceOf(MouseEvent)
  })
})
