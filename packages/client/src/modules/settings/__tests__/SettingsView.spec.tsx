import { flushPromises, mount } from '@vue/test-utils'
import { defaultProjectSettings } from '@xomda/core'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'

const metaMock = vi.fn()
const updateMetaMock = vi.fn()
const listPluginsMock = vi.fn().mockResolvedValue([])
const scanMock = vi.fn().mockResolvedValue({ detectedIds: [] })

vi.mock('../../../trpc', () => ({
  trpc: {
    project: {
      meta: { query: () => metaMock() },
      updateMeta: { mutate: (args: unknown) => updateMetaMock(args) },
      listPlugins: { query: () => listPluginsMock() },
      scan: { query: () => scanMock() },
    },
  },
}))

import { SettingsRoutes } from '../routes'
import { SettingsView } from '../SettingsView'

const vuetify = createVuetify()

const baseMeta = () => ({
  name: 'demo',
  versions: { head: null, versions: [] },
  settings: defaultProjectSettings(),
  plugins: [],
})

const makeRouter = (initialPath = '/settings'): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings', name: SettingsRoutes.view, component: SettingsView }],
    // History start position; tests set hash via router.push afterwards if needed.
    ...({ initialPath } as Record<string, unknown>),
  })

const mountView = async (router: Router) => {
  await router.push('/settings')
  await router.isReady()
  // We deliberately do *not* `attachTo: document.body` — Vuetify's button
  // ripple bubbles up to a monaco-editor clipboard listener registered on
  // body during other tests, which logs an unhandled CancellationError.
  // Nothing under test here relies on real document attachment.
  const wrapper = mount(SettingsView, {
    global: { plugins: [vuetify, router, createPinia()] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  metaMock.mockReset()
  updateMetaMock.mockReset()
  listPluginsMock.mockClear()
  scanMock.mockClear()
  // jsdom doesn't implement IntersectionObserver; stub it so the view mounts.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsView navigation', () => {
  it('renders only the always-available sections when no project file exists', async () => {
    metaMock.mockResolvedValue(null)
    const wrapper = await mountView(makeRouter())

    const labels = wrapper.findAll('button[role="tab"]').map((b) => b.text())
    expect(labels).toEqual(['Appearance', 'File-system sandbox', 'Diagram'])
  })

  it('reveals the project-only sections once a project meta is loaded', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())

    const labels = wrapper.findAll('button[role="tab"]').map((b) => b.text())
    expect(labels).toEqual([
      'Appearance',
      'File-system sandbox',
      'Diagram',
      'Project boundaries',
      'Plugins',
    ])
  })

  it('updates the URL hash and the active item when a nav item is clicked', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const router = makeRouter()
    const wrapper = await mountView(router)

    const diagramBtn = wrapper.findAll('button[role="tab"]').find((b) => b.text() === 'Diagram')!
    await diagramBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.hash).toBe('#diagram')
    expect(diagramBtn.attributes('aria-selected')).toBe('true')
  })

  it('renders a section anchor element for every nav item', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())

    for (const id of ['appearance', 'sandbox', 'diagram', 'boundaries', 'plugins']) {
      expect(wrapper.find(`#settings-section-${id}`).exists()).toBe(true)
    }
  })

  it('shows "Preferences" in the title bar', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())
    expect(wrapper.text()).toContain('Preferences')
  })
})

describe('SettingsView sticky save bar', () => {
  it('does not render the actions bar when nothing is dirty', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())

    const buttons = wrapper.findAll('button').map((b) => b.text())
    expect(buttons).not.toContain('Cancel')
    expect(buttons).not.toContain('Save')
  })

  it('renders the actions bar as soon as a field becomes dirty', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())

    expect(wrapper.findAll('button').some((b) => b.text() === 'Save')).toBe(false)

    const sandboxSwitch = wrapper.findAllComponents({ name: 'VSwitch' })[0]
    sandboxSwitch.vm.$emit('update:modelValue', false)
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    expect(saveBtn).toBeTruthy()
    expect(saveBtn.attributes('disabled')).toBeUndefined()
  })

  it('toggling a setting enables Save and persists every dirty field at once', async () => {
    metaMock.mockResolvedValue(baseMeta())
    updateMetaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())

    // Toggle the file-system sandbox switch off (default is true).
    const sandboxSwitch = wrapper.findAllComponents({ name: 'VSwitch' })[0]
    sandboxSwitch.vm.$emit('update:modelValue', false)
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    expect(saveBtn.attributes('disabled')).toBeUndefined()
    await saveBtn.trigger('click')
    await flushPromises()

    expect(updateMetaMock).toHaveBeenCalledTimes(1)
    const call = updateMetaMock.mock.calls[0][0] as {
      meta: { settings: { restrictWritesToProjectRoot: boolean } }
    }
    expect(call.meta.settings.restrictWritesToProjectRoot).toBe(false)
    // After save the dirty flag clears, so Save disables again.
    const saveBtnAfter = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    expect(saveBtnAfter.attributes('disabled')).toBeDefined()
  })

  it('keeps the bar visible during the "Saved." flash and hides it once the flash expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      metaMock.mockResolvedValue(baseMeta())
      updateMetaMock.mockResolvedValue(baseMeta())
      const wrapper = await mountView(makeRouter())

      const sandboxSwitch = wrapper.findAllComponents({ name: 'VSwitch' })[0]
      sandboxSwitch.vm.$emit('update:modelValue', false)
      await flushPromises()

      const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save')!
      await saveBtn.trigger('click')
      await flushPromises()

      // Dirty has cleared, but the 2,500ms "Saved." flash keeps the bar
      // mounted so the confirmation isn't lost behind a slide-out.
      expect(wrapper.text()).toContain('Saved.')
      expect(wrapper.findAll('button').some((b) => b.text() === 'Save')).toBe(true)

      // Once the flash timer expires the bar slides out — no Save/Cancel
      // controls left in the DOM until the user dirties something again.
      vi.advanceTimersByTime(2500)
      await flushPromises()

      const labels = wrapper.findAll('button').map((b) => b.text())
      expect(labels).not.toContain('Save')
      expect(labels).not.toContain('Cancel')
    } finally {
      vi.useRealTimers()
    }
  })

  it('Cancel reverts edits back to the loaded values without calling updateMeta', async () => {
    metaMock.mockResolvedValue(baseMeta())
    const wrapper = await mountView(makeRouter())

    const sandboxSwitch = wrapper.findAllComponents({ name: 'VSwitch' })[0]
    sandboxSwitch.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(sandboxSwitch.props('modelValue')).toBe(false)

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    await flushPromises()

    expect(updateMetaMock).not.toHaveBeenCalled()
    expect(sandboxSwitch.props('modelValue')).toBe(true)
  })
})
